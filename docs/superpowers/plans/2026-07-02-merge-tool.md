# Merge Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Merge tool — combine 2+ PDFs into one, upload order = merge order — through the existing job queue, with a reorderable web page.

**Architecture:** Same shape as every existing tool: one pikepdf service module, one `_RUNNERS` entry in the worker, one `POST /pdf/merge` endpoint returning 202, one web route through `runJobFlow`. No new dependencies anywhere.

**Tech Stack:** pikepdf, FastAPI, pytest; React/TanStack Start, axios, vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-merge-tool-design.md`
**Branch:** all work on `merge-tool` (already created; `main` is protected — delivery is via PR).

## Global Constraints

- Tool id is exactly `"merge"` everywhere (params, `_RUNNERS`, web `tool:` option, board label)
- Endpoint requires **≥ 2 files**; fewer → 400 `"Merging needs at least two PDF files."`
- Inputs stored as `workspace/input-{i}.pdf`; params exactly `{"names": [...]}` (safe names, upload order)
- Output: `workspace/output.pdf`, `download_name="merged.pdf"`, `media_type="application/pdf"`
- Error copy exactly: `'<name>' is password-protected — unlock it first.` and `'<name>' could not be read as a PDF.`
- pikepdf source Pdfs must stay open until the merged Pdf is saved (foreign pages are copied lazily) — use `ExitStack`
- api commands: `cd api && uv run …`; web commands: `cd web && bun …`
- Never `git add -A` — unrelated files are dirty in this worktree

---

### Task 1: Merge service

**Files:**
- Create: `api/app/services/merge.py`
- Test: `api/tests/test_merge_service.py`

**Interfaces:**
- Produces: `MergeError(RuntimeError)`; `merge_pdf_files(input_paths: list[Path], names: list[str], output_path: Path) -> None`

- [ ] **Step 1: Write the failing tests**

Create `api/tests/test_merge_service.py`:
```python
"""Merging PDFs with pikepdf."""

import pikepdf
import pytest

from app.services.merge import MergeError, merge_pdf_files


def make_pdf(path, pages=1):
    pdf = pikepdf.new()
    for _ in range(pages):
        pdf.add_blank_page()
    pdf.save(path)
    pdf.close()


def test_merge_concatenates_pages_in_order(tmp_path):
    first = tmp_path / "a.pdf"
    second = tmp_path / "b.pdf"
    out = tmp_path / "out.pdf"
    make_pdf(first, pages=1)
    make_pdf(second, pages=2)
    merge_pdf_files([first, second], ["a.pdf", "b.pdf"], out)
    with pikepdf.open(out) as merged:
        assert len(merged.pages) == 3


def test_merge_rejects_encrypted_input(tmp_path):
    plain = tmp_path / "a.pdf"
    locked = tmp_path / "locked.pdf"
    out = tmp_path / "out.pdf"
    make_pdf(plain)
    pdf = pikepdf.new()
    pdf.add_blank_page()
    pdf.save(locked, encryption=pikepdf.Encryption(owner="pw", user="pw", R=6))
    pdf.close()
    with pytest.raises(MergeError, match="'locked.pdf' is password-protected"):
        merge_pdf_files([plain, locked], ["a.pdf", "locked.pdf"], out)


def test_merge_rejects_garbage_input(tmp_path):
    plain = tmp_path / "a.pdf"
    garbage = tmp_path / "junk.pdf"
    out = tmp_path / "out.pdf"
    make_pdf(plain)
    garbage.write_bytes(b"%PDF-not really a pdf")
    with pytest.raises(MergeError, match="'junk.pdf' could not be read"):
        merge_pdf_files([plain, garbage], ["a.pdf", "junk.pdf"], out)
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd api && uv run pytest tests/test_merge_service.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.services.merge'`.

- [ ] **Step 3: Implement the service**

Create `api/app/services/merge.py`:
```python
"""PDF merging backed by pikepdf.

Appending page trees with pikepdf is lossless — pages are copied as-is with no
re-rendering or recompression. Foreign pages are copied lazily, so every source
document must stay open until the merged file is saved; the ExitStack below
guarantees that.
"""

from __future__ import annotations

from contextlib import ExitStack
from pathlib import Path

import pikepdf


class MergeError(RuntimeError):
    """Raised when the uploaded PDFs cannot be merged; message is user-facing."""


def merge_pdf_files(input_paths: list[Path], names: list[str], output_path: Path) -> None:
    """Concatenate the inputs, in order, into a single PDF at `output_path`."""
    with pikepdf.new() as merged, ExitStack() as sources:
        for input_path, name in zip(input_paths, names):
            try:
                source = sources.enter_context(pikepdf.open(input_path))
            except pikepdf.PasswordError as exc:
                raise MergeError(f"'{name}' is password-protected — unlock it first.") from exc
            except pikepdf.PdfError as exc:
                raise MergeError(f"'{name}' could not be read as a PDF.") from exc
            merged.pages.extend(source.pages)
        merged.save(output_path)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd api && uv run pytest tests/test_merge_service.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add api/app/services/merge.py api/tests/test_merge_service.py
git commit -m "Add pikepdf merge service"
```

---

### Task 2: Worker runner for merge

**Files:**
- Modify: `api/app/jobs/worker.py` (imports, `_run_merge`, `_RUNNERS`, `_KNOWN_ERRORS`)
- Test: `api/tests/test_worker.py` (append one test)

**Interfaces:**
- Consumes: `merge_pdf_files`, `MergeError` from Task 1; params contract `{"names": [...]}` with inputs at `input-{i}.pdf`.
- Produces: `_RUNNERS["merge"]`; results per Global Constraints.

- [ ] **Step 1: Write the failing test**

Append to `api/tests/test_worker.py`:
```python
def test_merge_job_succeeds(tmp_path):
    registry = JobRegistry()
    workspace = tmp_path / "job"
    workspace.mkdir()
    write_blank_pdf(workspace / "input-0.pdf")
    write_blank_pdf(workspace / "input-1.pdf")
    record = registry.create(
        tool="merge",
        workspace=workspace,
        file_count=2,
        total_bytes=sum((workspace / f"input-{i}.pdf").stat().st_size for i in range(2)),
        params={"names": ["a.pdf", "b.pdf"]},
    )
    asyncio.run(execute_job(registry, record.id))
    assert record.status is JobStatus.done
    assert record.error is None
    assert record.result_path is not None and record.result_path.exists()
    assert record.download_name == "merged.pdf"
    assert record.media_type == "application/pdf"
```

- [ ] **Step 2: Run to verify failure**

Run: `cd api && uv run pytest tests/test_worker.py::test_merge_job_succeeds -v`
Expected: FAIL — record ends `failed` with error `Unknown tool 'merge'` (status assertion fails).

- [ ] **Step 3: Implement**

In `api/app/jobs/worker.py`:
1. Add import after the lock imports:
```python
from app.services.merge import MergeError, merge_pdf_files
```
2. Add `MergeError` to the `_KNOWN_ERRORS` tuple.
3. Add the runner (after `_run_unlock`):
```python
def _run_merge(record: JobRecord) -> None:
    names: list[str] = record.params["names"]
    input_paths = [record.workspace / f"input-{index}.pdf" for index in range(len(names))]
    output_path = record.workspace / "output.pdf"
    merge_pdf_files(input_paths, names, output_path)
    record.result_path = output_path
    record.download_name = "merged.pdf"
    record.media_type = "application/pdf"
```
4. Register it:
```python
_RUNNERS = {"compress": _run_compress, "lock": _run_lock, "unlock": _run_unlock, "merge": _run_merge}
```

- [ ] **Step 4: Run the full worker file, then the whole suite**

Run: `cd api && uv run pytest tests/test_worker.py -v && uv run pytest`
Expected: all pass (5 worker tests, 31 total).

- [ ] **Step 5: Commit**

```bash
git add api/app/jobs/worker.py api/tests/test_worker.py
git commit -m "Execute merge jobs in the worker"
```

---

### Task 3: Merge submit endpoint

**Files:**
- Modify: `api/app/routers/pdf.py` (new endpoint after `lock`)
- Test: `api/tests/test_submit_endpoints.py` (append two tests)

**Interfaces:**
- Consumes: `_stream_upload_to_disk`, `_safe_name`, `_accept_job` (all already in `pdf.py`); fixtures `client`, `registry`, `fake_queue`, `pdf_bytes` from `api/tests/conftest.py`.
- Produces: `POST /pdf/merge` → 202 `JobAccepted`.

- [ ] **Step 1: Write the failing tests**

Append to `api/tests/test_submit_endpoints.py`:
```python
def test_merge_returns_202_with_ordered_names(client, registry, fake_queue, pdf_bytes):
    response = client.post(
        "/pdf/merge",
        files=[
            ("files", ("b.pdf", pdf_bytes, "application/pdf")),
            ("files", ("a.pdf", pdf_bytes, "application/pdf")),
        ],
    )
    assert response.status_code == 202
    body = response.json()
    record = registry.get(body["job_id"])
    assert record.tool == "merge"
    assert record.params["names"] == ["b.pdf", "a.pdf"]
    assert (record.workspace / "input-0.pdf").exists()
    assert (record.workspace / "input-1.pdf").exists()
    assert fake_queue.published == [body["job_id"]]


def test_merge_requires_two_files(client, pdf_bytes):
    response = client.post(
        "/pdf/merge",
        files=[("files", ("a.pdf", pdf_bytes, "application/pdf"))],
    )
    assert response.status_code == 400
    assert "at least two" in response.json()["detail"]
```

- [ ] **Step 2: Run to verify failure**

Run: `cd api && uv run pytest tests/test_submit_endpoints.py -v`
Expected: the two new tests FAIL with 404 (route does not exist); the existing four still pass.

- [ ] **Step 3: Implement the endpoint**

In `api/app/routers/pdf.py`, after the `lock` endpoint:
```python
@router.post(
    "/merge",
    status_code=202,
    summary="Queue a merge of two or more PDF files",
    response_model=JobAccepted,
)
async def merge(
    request: Request,
    files: List[UploadFile] = File(..., description="Two or more PDF files, in merge order."),
) -> JobAccepted:
    """Validate and store the uploads, then queue a merge job."""
    if len(files) < 2:
        raise HTTPException(status_code=400, detail="Merging needs at least two PDF files.")

    work_dir = Path(tempfile.mkdtemp(prefix="chowbea-merge-"))
    try:
        names: list[str] = []
        total_bytes = 0
        for index, file in enumerate(files):
            input_path = work_dir / f"input-{index}.pdf"
            await _stream_upload_to_disk(file, input_path)
            names.append(_safe_name(file.filename, f"document-{index + 1}.pdf"))
            total_bytes += input_path.stat().st_size
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise

    return await _accept_job(
        request,
        tool="merge",
        workspace=work_dir,
        file_count=len(names),
        total_bytes=total_bytes,
        params={"names": names},
    )
```

- [ ] **Step 4: Run the full api suite**

Run: `cd api && uv run pytest`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add api/app/routers/pdf.py api/tests/test_submit_endpoints.py
git commit -m "Add POST /pdf/merge submit endpoint"
```

---

### Task 4: Web — merge page, api wrapper, live tile, board label

**Files:**
- Modify: `web/src/lib/api.ts` (add `MergeResult` + `mergePdfs` after the compress section)
- Create: `web/src/routes/merge.tsx`
- Modify: `web/src/routes/index.tsx` (Merge tile → Live, link `/merge`)
- Modify: `web/src/routes/queue.tsx` (`TOOL_LABELS` gains `merge: "Merge"`)
- Commit also: `web/src/routeTree.gen.ts` (regenerated by build)

**Interfaces:**
- Consumes: `runJobFlow`, `submitForm`, `CompressionProgress`, `formatBytes`, `downloadBlob` — all existing in `web/src/lib/{api,jobs}.ts`; `Dropzone`, `ToolHeader`, `Button`, `Progress` components.
- Produces: `mergePdfs(files: File[], onProgress?: (p: CompressionProgress) => void): Promise<MergeResult>` where `MergeResult = {blob: Blob; filename: string}`.

- [ ] **Step 1: Add the api wrapper**

In `web/src/lib/api.ts`, after the `compressPdfs` function:
```ts
/** Result of a successful merge request. */
export interface MergeResult {
  /** The combined PDF. */
  blob: Blob
  /** Suggested download filename parsed from the response. */
  filename: string
}

/**
 * Merge two or more PDFs, in array order, into a single file.
 *
 * @throws Error with the API's error detail (e.g. a locked input) on failure.
 */
export async function mergePdfs(
  files: File[],
  onProgress?: (progress: CompressionProgress) => void,
): Promise<MergeResult> {
  const form = new FormData()
  for (const file of files) {
    form.append("files", file)
  }
  const download = await runJobFlow({
    tool: "merge",
    submit: () => submitForm("/pdf/merge", form, onProgress),
    onProgress,
  })
  return {
    blob: download.blob,
    filename: download.filename ?? "merged.pdf",
  }
}
```

- [ ] **Step 2: Resolve icon names before writing the page**

The page needs a merge icon and up/down arrows. Read `web/src/routes/index.tsx` and note the icon used on the existing "Merge" tile — reuse it for the ToolHeader. For reorder arrows, verify the names exist:
```bash
grep -o "ArrowUp01Icon\|ArrowDown01Icon" web/node_modules/@hugeicons/core-free-icons/dist/esm/index.d.ts | sort -u
```
Expected: both names print. If either is missing, search for an existing alternative (`grep -o "ArrowUp[A-Za-z0-9]*Icon" … | sort -u | head`) and use the closest numbered variant.

- [ ] **Step 3: Create `web/src/routes/merge.tsx`**

```tsx
import { createFileRoute } from "@tanstack/react-router"
import * as React from "react"
import { motion } from "motion/react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  Cancel01Icon,
  Download04Icon,
  Loading03Icon,
  Pdf01Icon,
} from "@hugeicons/core-free-icons"
// ALSO import the same icon the homepage Merge tile uses (see index.tsx) and
// pass it to ToolHeader below; the identifier here assumes it's named like the
// tile's import.

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Dropzone } from "@/components/dropzone"
import { ToolHeader } from "@/components/tool-header"
import {
  type CompressionProgress,
  type MergeResult,
  downloadBlob,
  formatBytes,
  mergePdfs,
} from "@/lib/api"

export const Route = createFileRoute("/merge")({ component: MergePage })

const PHASE_LABELS: Record<CompressionProgress["phase"], string> = {
  uploading: "Uploading",
  queued: "In line",
  processing: "Merging",
  downloading: "Downloading",
}

type Status = "idle" | "loading" | "success" | "error"

function MergePage() {
  const [files, setFiles] = React.useState<File[]>([])
  const [status, setStatus] = React.useState<Status>("idle")
  const [result, setResult] = React.useState<MergeResult | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [progress, setProgress] = React.useState<CompressionProgress | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Merge newly picked files into state, keeping only PDFs and skipping duplicates.
  const addFiles = React.useCallback((incoming: FileList | null) => {
    if (!incoming) return
    const pdfs = Array.from(incoming).filter(
      (file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"),
    )
    setFiles((current) => {
      const seen = new Set(current.map((f) => `${f.name}:${f.size}`))
      const unique = pdfs.filter((f) => !seen.has(`${f.name}:${f.size}`))
      return [...current, ...unique]
    })
    setStatus("idle")
    setResult(null)
    setError(null)
  }, [])

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index))
    setStatus("idle")
    setResult(null)
  }

  // Swap a file with its neighbour; list order is merge order.
  const moveFile = (index: number, delta: -1 | 1) => {
    setFiles((current) => {
      const target = index + delta
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setStatus("idle")
    setResult(null)
  }

  const handleMerge = async () => {
    if (files.length < 2) return
    setStatus("loading")
    setError(null)
    setResult(null)
    setProgress({ phase: "uploading", percent: 0 })
    try {
      const merged = await mergePdfs(files, setProgress)
      setResult(merged)
      setStatus("success")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setStatus("error")
    } finally {
      setProgress(null)
    }
  }

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const hasEnough = files.length >= 2

  return (
    <div className="pb-4">
      <ToolHeader
        icon={/* homepage Merge tile icon */ Pdf01Icon}
        title="Merge PDF"
        subtitle="Combine files into one — the order below is the page order."
      />

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => addFiles(event.target.files)}
      />

      <div className="mt-8 grid grid-cols-1 items-start gap-7 lg:grid-cols-[1fr_360px]">
        {/* ── Left: ordered files ── */}
        {files.length === 0 ? (
          <Dropzone
            multiple
            onFiles={addFiles}
            onPick={() => inputRef.current?.click()}
            title="Drop PDFs here"
            hint="At least two files"
          />
        ) : (
          <div className="rounded-[20px] border-2 border-ink bg-card p-[22px] shadow-block-lg">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[13px] font-extrabold uppercase tracking-wide text-muted-ink">
                {files.length} file{files.length > 1 ? "s" : ""} — merged top to bottom
              </span>
              <span className="text-[13px] font-bold text-muted-ink">{formatBytes(totalSize)}</span>
            </div>

            <div className="flex flex-col gap-2.5">
              {files.map((file, index) => (
                <div
                  key={`${file.name}:${file.size}`}
                  className="flex items-center gap-3 rounded-[14px] border-2 border-ink bg-surface px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[9px] border-2 border-ink bg-soft-amber font-heading text-[15px] font-extrabold text-ink">
                    {index + 1}
                  </span>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border-2 border-ink bg-card text-ink">
                    <HugeiconsIcon icon={Pdf01Icon} className="size-5" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-heading text-[15px] font-extrabold text-ink">
                      {file.name}
                    </div>
                    <div className="text-[13px] font-semibold text-muted-ink">
                      {formatBytes(file.size)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Move ${file.name} up`}
                      disabled={index === 0}
                      onClick={() => moveFile(index, -1)}
                      className="press flex size-8 items-center justify-center rounded-[9px] border-2 border-ink text-ink disabled:opacity-30"
                    >
                      <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${file.name} down`}
                      disabled={index === files.length - 1}
                      onClick={() => moveFile(index, 1)}
                      className="press flex size-8 items-center justify-center rounded-[9px] border-2 border-ink text-ink disabled:opacity-30"
                    >
                      <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" strokeWidth={2.4} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${file.name}`}
                      onClick={() => removeFile(index)}
                      className="press flex size-8 items-center justify-center rounded-[9px] border-2 border-ink text-ink"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={2.4} />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="flex items-center justify-center gap-2 rounded-[14px] border-2 border-dashed border-[#c9b89c] py-3 text-[13px] font-extrabold uppercase tracking-wide text-muted-ink transition-colors hover:border-ink hover:text-ink"
              >
                <HugeiconsIcon icon={Add01Icon} className="size-4" strokeWidth={2.4} />
                Add more files
              </button>
            </div>
          </div>
        )}

        {/* ── Right: action ── */}
        <div className="rounded-[20px] border-2 border-ink bg-card p-6 shadow-block-lg sm:p-8">
          <div className="mb-3.5 text-[13px] font-extrabold uppercase tracking-wide text-ink">
            Merge
          </div>
          <p className="text-[14px] font-semibold text-muted-ink">
            Pages are combined losslessly, in the order shown. Locked PDFs must be
            unlocked first.
          </p>

          <Button
            size="lg"
            onClick={handleMerge}
            disabled={!hasEnough || status === "loading"}
            className="mt-6 w-full"
          >
            {status === "loading" ? (
              <>
                <HugeiconsIcon icon={Loading03Icon} className="animate-spin" />
                Merging…
              </>
            ) : (
              <>Merge{files.length > 0 ? ` ${files.length} file${files.length > 1 ? "s" : ""}` : ""}</>
            )}
          </Button>
          {!hasEnough && files.length === 1 && (
            <p className="mt-3 text-[13px] font-semibold text-muted-ink">
              Add at least one more PDF to merge.
            </p>
          )}

          {/* Progress */}
          {status === "loading" && progress && (
            <div className="mt-5 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px] font-extrabold uppercase tracking-wide text-muted-ink">
                <span>
                  {progress.phase === "queued" && progress.position != null
                    ? `In line — #${progress.position}`
                    : PHASE_LABELS[progress.phase]}
                  …
                </span>
                {progress.percent !== null && (
                  <span className="tabular-nums text-ink">{Math.round(progress.percent)}%</span>
                )}
              </div>
              {progress.percent !== null ? (
                <Progress value={progress.percent} />
              ) : (
                <div className="h-2.5 w-full overflow-hidden rounded-full border-2 border-ink bg-surface">
                  <div className="animate-indeterminate h-full w-2/5 rounded-full bg-amber" />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {status === "error" && error && (
            <p className="mt-5 rounded-[12px] border-2 border-destructive bg-destructive/10 px-4 py-3 text-sm font-semibold text-destructive">
              {error}
            </p>
          )}

          {/* Result */}
          {status === "success" && result && (
            <motion.div
              className="mt-5 rounded-[16px] border-2 border-ink bg-cream p-5 shadow-amber-sm"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
            >
              <div className="font-heading text-lg font-extrabold text-ink">
                {files.length} files → 1 PDF
              </div>
              <Button
                variant="outline"
                size="lg"
                className="mt-4 w-full"
                onClick={() => downloadBlob(result.blob, result.filename)}
              >
                <HugeiconsIcon icon={Download04Icon} strokeWidth={2.2} />
                Download
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
```
Replace the `ToolHeader` icon and the placeholder comment with the homepage Merge tile's icon import found in Step 2.

- [ ] **Step 4: Flip the homepage tile and add the board label**

In `web/src/routes/index.tsx`: find the Merge tile (currently rendered in the "Soon" style with heading "Merge" / "Combine PDFs"). Convert it to a Live link exactly the way the Unlock/Lock/Compress tiles are built (same wrapper `<Link to="/merge">`, same "Live" badge markup), keeping its existing icon and description.

In `web/src/routes/queue.tsx`, extend the labels map:
```tsx
const TOOL_LABELS: Record<string, string> = {
  compress: "Compress",
  lock: "Lock",
  unlock: "Unlock",
  merge: "Merge",
}
```

- [ ] **Step 5: Verify — tests, types, build**

Run: `cd web && bun run test && bun run typecheck && bun run build`
Expected: vitest 4/4, typecheck clean, build succeeds and regenerates `routeTree.gen.ts` with `/merge`.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/api.ts web/src/routes/merge.tsx web/src/routes/index.tsx web/src/routes/queue.tsx web/src/routeTree.gen.ts
git commit -m "Add merge tool page with reorderable file list"
```

---

### Task 5 (controller): Codegen + browser smoke

- [ ] Start local stack (`make rabbit` if not running; api via uvicorn; web via vite), run `cd web && bun api:fetch && bun api:generate`, typecheck, commit `web/src/services/api/` as "Regenerate typed API client for the merge endpoint".
- [ ] Browser smoke: /merge — add 2 PDFs, reorder with ▲▼, merge, download; homepage shows Merge as Live; /queue shows "Merge" label for the job.

### Task 6 (controller): PR through protected flow + prod verify

- [ ] Push `merge-tool`, `gh pr create`, watch checks, merge PR, pull main.
- [ ] Prod: submit 2-file merge via curl to `https://api-production-9ae1.up.railway.app/pdf/merge`, poll to `done`, download begins `%PDF`; `/health` commit matches the merge commit; https://pdf.chowbea.com shows the Merge tile Live.
