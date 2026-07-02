# Open Source Contribution Kit — Design

**Date:** 2026-07-02
**Status:** Approved

## Context

The repo (`oddFEELING/chowbea-pdf`) is already public with issues enabled and CI (`.github/workflows/ci.yml`, jobs `api` and `web`) running on pushes and PRs. Railway auto-deploys `main` (api/web scoped by watch paths). Missing: a license (legally blocking contributions), all community files, branch protection (anything pushed to `main` deploys straight to prod), and any way to trace a running deploy back to a commit.

## Decisions (made by the owner)

- **License:** MIT, copyright holder "Emmanuel Alawode", year 2026.
- **Branch protection:** PRs + green CI required for *everyone*, including admins. Required approvals: 0 (solo maintainer — CI is the gate; requiring a reviewer would deadlock own PRs).
- **Scope:** full community kit in one pass.
- **Versioning:** no SemVer/CHANGELOG/release tooling. Deploy traceability only: surface the deployed git SHA. Manual GitHub Releases at milestones, written by hand, when warranted.

## Deliverables

### 1. Community files (one PR)

- `LICENSE` — MIT, "Copyright (c) 2026 Emmanuel Alawode".
- `README.md` — rewritten: what chowbea-pdf is, live at https://pdf.chowbea.com, current tools (compress, lock, unlock — all through a RabbitMQ job queue with a public `/queue` board), architecture sketch (web ↔ api ↔ RabbitMQ), prerequisites (bun, uv, Ghostscript, Docker for the local broker), quickstart (`make install`, `make rabbit`, `make dev`), test commands (`cd api && uv run pytest`; `cd web && bun run test && bun run typecheck`), CI/CD note (merges to main auto-deploy), links to CONTRIBUTING/LICENSE. Keep `purpose.md` link.
- `CONTRIBUTING.md` — local setup (same commands), running the suites, PR flow (fork → feature branch → PR to `main`; CI must pass; no direct pushes — enforced), "open an issue before starting large features", commit-message style (short imperative subject, matching history), note: CI holds no secrets and `main` auto-deploys to production, so PRs never touch prod until merged.
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1; enforcement contact `platforms@chowbea.com`.
- `SECURITY.md` — report privately via GitHub security advisories (private vulnerability reporting enabled) or `platforms@chowbea.com`; explicitly in scope: anything touching uploaded files, passwords, or the job queue; do not open public issues for vulnerabilities.
- `.github/ISSUE_TEMPLATE/bug_report.yml` — structured form: what happened, expected, steps, tool used (compress/lock/unlock/queue page), browser/env.
- `.github/ISSUE_TEMPLATE/feature_request.yml` — problem, proposed solution, alternatives.
- `.github/PULL_REQUEST_TEMPLATE.md` — checklist: linked issue, both suites pass locally, scope is one change.

### 2. Deploy traceability (same PR)

- `api/app/core/config.py`: new setting `commit_sha: str` defaulting to `"dev"`, read from the `RAILWAY_GIT_COMMIT_SHA` env var via `validation_alias` (Railway injects it on git-connected deploys; the `CHOWBEA_` prefix does not apply to this one variable).
- `/health` returns `{"status": "ok", "commit": "<first 7 chars>"}`.
- FastAPI `version` becomes `"{app_version}+{commit_sha[:7]}"` when `commit_sha != "dev"`, else unchanged — so OpenAPI/docs identify the deploy while local codegen stays stable.
- Test: health endpoint includes a `commit` key; settings default is `"dev"`.

### 3. Repo settings (gh api / gh repo edit, applied BEFORE the PR so the PR dogfoods the flow)

- Branch protection on `main`: required status checks `api` and `web` (strict=false), `enforce_admins: true`, `required_pull_request_reviews: {required_approving_review_count: 0}`, no force pushes, no deletions, restrictions null.
- Enable private vulnerability reporting.
- Repo description: "Free, ad-free PDF tools — compress, lock, unlock. FastAPI + RabbitMQ job queue, TanStack Start frontend." Topics: `pdf`, `fastapi`, `rabbitmq`, `tanstack-start`, `self-hosted`.

## Out of scope (revisit when a contributor base exists)

CLA/DCO, CHANGELOG/conventional commits/release-please, GitHub Discussions, release automation, PR preview environments.

## Sequence & verification

1. Apply repo settings + branch protection.
2. Branch `open-source-kit`, add all files + traceability change, push, open PR.
3. Verify: direct push to `main` is rejected; PR shows the two required checks; merge lands only after green CI.
4. After merge: api auto-deploys (api/ changed); `curl /health` on prod shows the merge commit's SHA; web is SKIPPED (watch paths). GitHub repo page shows license, CoC, contributing links; new-issue page offers the two forms.
