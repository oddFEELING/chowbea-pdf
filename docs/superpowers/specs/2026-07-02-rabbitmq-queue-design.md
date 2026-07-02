# RabbitMQ Job Queue — Design

**Date:** 2026-07-02
**Status:** Approved (Option A — embedded worker)

## Context

chowbea-pdf runs on Railway as two services (`api`: FastAPI + Ghostscript/pikepdf, `web`: TanStack Start). All three tools (compress, lock, unlock) are synchronous today: the browser uploads, the API processes in the request handler, and the file streams back in the same response. Concurrent heavy jobs can exhaust the api container's CPU/memory and take the whole system down.

The user has provisioned a RabbitMQ service (`rabbitmq:management` image, 5 GB volume) in the Railway project, reachable from the api over private networking via `RABBITMQ_PRIVATE_URL`.

## Goals

1. Jobs are queued through RabbitMQ instead of processed inline; at most **3 jobs run concurrently**.
2. Users can see the queue — their position in line and what is ahead of them — so they know when their job will be attended to.
3. Remove the Sign in button; the product has no accounts.

## Non-goals

- A separate worker service or object-storage handoff (revisit if usage grows — Option B in the brainstorm).
- Job durability across api redeploys (in-flight and queued jobs fail gracefully instead).
- Per-user auth or private queues. Everything is anonymous.
- Capping the number of files in a compress job.

## Architecture (Option A: embedded worker)

One process, three roles:

```
browser ──POST /pdf/<tool>──▶ FastAPI handler
                               │  save upload to /tmp workspace
                               │  create JobRecord in registry (in-process dict)
                               │  publish job_id to RabbitMQ "pdf-jobs" (durable queue)
                               ◀── 202 {job_id, position, queue_size}
browser ──GET /jobs/{id} (poll ~2s)──▶ registry lookup ──▶ status/position
                    aio-pika consumer (prefetch_count=3)
                               │  pick job_id off queue
                               │  run existing service fn in a worker thread
                               │  write result into workspace, update registry
browser ──GET /jobs/{id}/download──▶ FileResponse from workspace
```

- **RabbitMQ** is the admission queue and concurrency governor (`prefetch_count=3`; each delivered message is handled as an asyncio task, so up to 3 run at once). Connection via `aio-pika` robust connection; queue `pdf-jobs`, durable, no TTL.
- **Job registry** is an insertion-ordered in-process dict `{job_id: JobRecord}` — the source of truth for status, position, and the public board. RabbitMQ has no per-message position API, so position is computed from the registry: the count of `queued` jobs created before this one. Single replica, single process (uvicorn, no `--workers`), so no coherence issues.
- **Existing service functions** (`compress_pdf_file`, `lock_pdf_file`, `unlock_pdf_file`) are unchanged. They are synchronous subprocess/CPU work, so the consumer runs them via `asyncio.to_thread` to keep the event loop responsive.

### JobRecord

| field | notes |
|---|---|
| `id` | `uuid4().hex` — full id is the download capability; only the first 6 chars appear on the public board |
| `tool` | `compress` \| `lock` \| `unlock` |
| `status` | `queued` → `processing` → `done` \| `failed` |
| `params` | tool-specific (quality / password + permissions + encryption). Held in memory only, never logged, never serialized into the RabbitMQ message |
| `file_count`, `total_bytes` | for the board and status responses |
| `workspace` | temp dir holding inputs and, later, the result |
| `result_path`, `download_name`, `media_type`, `result_headers` | set on completion (same filenames/headers as the current sync responses, incl. `X-Original-Size`/`X-Compressed-Size`) |
| `error` | human-readable message on failure (same texts the sync API returns today) |
| `created_at`, `started_at`, `finished_at` | timestamps |

The RabbitMQ message body is just `{"job_id": ...}` — files (up to 200 MB) and passwords never transit the broker.

## API changes

**Changed** (breaking; the generated web client is regenerated):

- `POST /pdf/compress`, `POST /pdf/lock`, `POST /pdf/unlock` — same multipart contracts and upload-time validation (PDF magic bytes, size cap, empty-file, password-required) as today, but return `202 JobAccepted {job_id, position, queue_size}` instead of the file. Validation failures still reject immediately with the current status codes; nothing invalid is ever queued.

**New:**

- `GET /jobs/{job_id}` → `JobStatus {id, tool, status, position (int|null, only while queued), queue_size, error (string|null), file_count, total_bytes, created_at}`. 404 for unknown/expired ids.
- `GET /jobs/{job_id}/download` → the result file with the original download semantics. 404 unknown/expired, 409 if not `done`. Re-downloadable until expiry.
- `GET /queue` → `QueueBoard {concurrency: 3, processing: [BoardEntry], waiting: [BoardEntry]}` where `BoardEntry = {id_prefix (6 chars), tool, file_count, total_bytes, created_at}`. No filenames — they can be sensitive.

## Lifecycle details

- **Retention:** a background sweep (every 60 s) deletes workspaces and registry entries 30 minutes after `finished_at` (done and failed alike). Poll/download after that → 404, which the UI treats as expired.
- **Failures:** service exceptions mark the job `failed` with the same human-readable detail the sync API used, and the message is **acked** (terminal — no redelivery loops). Unexpected exceptions are logged and also terminal.
- **Orphans after redeploy:** the registry and workspaces die with the container while RabbitMQ retains messages. On consume, a `job_id` missing from the registry is acked and dropped with a log line. Users see their old job as expired (404) and resubmit.
- **Shutdown:** consumer connection closes on FastAPI shutdown; in-flight thread work is abandoned with the container.

## Web changes

- **`lib/api.ts`:** per-tool submit functions return a `job_id`; a shared `pollJob(jobId, onUpdate)` polls `GET /jobs/{id}` every 2 s until `done`/`failed`; `downloadJobResult(jobId)` fetches the blob (axios, `responseType: "blob"`, download progress preserved). Progress phases become `uploading → queued(#position of queue_size) → processing → downloading`; the existing per-tool progress UI gains one phase label.
- **Tool pages** (`compress.tsx`, `lock.tsx`, `unlock.tsx`): unchanged flow otherwise — submit, show phases (now including "In line — #3"), auto-download available on success exactly as today.
- **New `/queue` route:** public board from `GET /queue`, refreshed every 3 s — shows processing (up to 3) and waiting jobs as anonymized rows; the user's own jobs (ids persisted in `localStorage` under `chowbea:jobs`, pruned on 404) are highlighted "yours". Linked from the home page tool grid area.
- **Remove Sign in:** delete the button and `Login03Icon` usage from `routes/__root.tsx`.
- **Codegen:** regenerate the typed client (`_generated/`) from the updated OpenAPI document.

## Config & infra

- New setting `CHOWBEA_RABBITMQ_URL` (pydantic `rabbitmq_url`), default `amqp://guest:guest@localhost:5672/` for local dev.
- New api dependency: `aio-pika`.
- Railway: set `CHOWBEA_RABBITMQ_URL=${{RabbitMQ.RABBITMQ_PRIVATE_URL}}` on the api service; redeploy api and web.
- Local dev: `make rabbit` starts a local `rabbitmq:4` container (docker/OrbStack) if not running; `make dev` mentions it in `help`.
- **Consequence:** the api service will no longer sleep on Railway (persistent AMQP connection + polling traffic). Idle cost stays small on usage-based billing but is no longer ~zero. The web service still sleeps.
- If RabbitMQ is unreachable at submit time, `POST /pdf/*` returns 503 with a clear message; the API still starts (consumer retries connecting in the background) so `/health` stays truthful.

## Testing

- **pytest (new api dev-dependency):** registry unit tests (position math, TTL sweep, orphan handling) and endpoint contract tests with the publisher/consumer faked — no broker needed in CI.
- **Integration (manual, local):** `make rabbit && make dev`, submit compress/lock/unlock jobs, verify: 202 + position, board shows jobs, 4th concurrent job waits while 3 process, download works, wrong-password unlock surfaces the error via the poll, results expire after TTL.
- **Production check after deploy:** submit a job on pdf.chowbea.com, watch `/queue`, confirm download; RabbitMQ management UI shows the queue draining.
