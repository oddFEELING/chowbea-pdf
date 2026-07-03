# Convert Tool — Design

**Date:** 2026-07-03
**Status:** Approved

## Context

Five tools are live, all through the job queue. Convert is the last big
roadmap tile ("To & from Word, images"). The owner chose a six-format matrix
(PDF, images, Word, Markdown, HTML, TXT) with **LibreOffice for the
docx→PDF fidelity path** (accepting ~500–600 MB image growth), and the light
pandoc/weasyprint stack for everything else.

## Conversion matrix (v1)

| From ↓ / To → | pdf | png/jpeg | docx | md | html | txt |
|---|---|---|---|---|---|---|
| pdf    | —  | ✅ gs, zipped | ✅ pdf2docx | ✅ text extraction | ✗ | ✅ pdfminer |
| image  | ✅ img2pdf (multi, ordered) | — | ✗ | ✗ | ✗ | ✗ |
| docx   | ✅ **LibreOffice** | ✗ | — | ✅ pandoc | ✅ pandoc | ✅ pandoc |
| md     | ✅ pandoc→html + weasyprint | ✗ | ✅ pandoc | — | ✅ pandoc | ✅ pandoc |
| html   | ✅ weasyprint | ✗ | ✅ pandoc | ✅ pandoc | — | ✅ pandoc |
| txt    | ✅ `<pre>` + weasyprint | ✗ | ✅ pandoc | ✅ pandoc | ✅ pandoc | — |

- `target` enum: `pdf | docx | md | html | txt | png | jpeg`. `png`/`jpeg`
  valid only from pdf; `dpi ∈ {72, 150, 300}` (default 150) valid only with
  png/jpeg.
- Source kinds: `pdf | image | docx | md | html | txt`. TXT sources are
  treated as Markdown-compatible plain text when pandoc reads them
  (documented behavior).
- PDF→md is plain text extraction saved as `.md` (no structure inference in
  v1); PDF→html deferred (output quality too poor to ship).
- Invalid pair → 400 `Cannot convert <source-kind> to <target>.`

## Engines & dependencies

- Python (uv): `img2pdf`, `pdf2docx`, `weasyprint`, `pdfminer.six`.
- System (Dockerfile, `--no-install-recommends`): `pandoc`,
  `libreoffice-writer`, weasyprint's `libpango-1.0-0 libpangocairo-1.0-0
  libgdk-pixbuf-2.0-0`, `fonts-liberation`. Ghostscript already present.
- Engine invocations (all subprocesses run with a **180 s timeout**; timeout
  → job fails with `'<name>' took too long to convert.`):
  - LibreOffice: `soffice --headless --convert-to pdf --outdir <dir> <input>`
    with a per-job isolated profile
    (`-env:UserInstallation=file://<workspace>/lo-profile`) so three
    concurrent jobs never share a profile lock.
  - pandoc: `pandoc <input> -f <reader> -t <writer> -o <output>`
    (readers: docx, markdown, html; txt read as markdown).
  - Ghostscript: `-sDEVICE=png16m|jpeg -r<dpi> -o page-%d.<ext>`, outputs
    zipped as `page-1.<ext> …` preserving order.
  - md→pdf: pandoc md→standalone html, then weasyprint html→pdf.
    txt→pdf: minimal `<html><pre>…</pre></html>` then weasyprint.
- **Licensing note:** pdf2docx depends on PyMuPDF (AGPL-3.0). This service is
  MIT-licensed, open-source, and uses PyMuPDF unmodified — the full
  application source is public, which satisfies AGPL's network-use spirit.
  Recorded here deliberately.
- Honest quality note: PDF→Word is inherently imperfect on scanned or
  layout-heavy PDFs; docx→PDF via LibreOffice is the best self-hosted
  fidelity available.

## API

### Source validation (generalizes the PDF-only upload validator)

New streaming validator in `api/app/routers/pdf.py` accepting a declared
source kind: magic bytes for binary kinds (pdf `%PDF`; png
`\x89PNG\r\n\x1a\n`; jpeg `\xFF\xD8\xFF`; docx `PK\x03\x04` + `.docx`
extension), extension + no-NUL-bytes-in-first-chunk for text kinds
(`.md/.markdown`, `.html/.htm`, `.txt`). Size cap unchanged (200 MB).
Mismatch → 400 `'<name>' does not look like a <kind> file.` Source kind is
derived from the (safe) filename extension; files without a recognized
extension → 400 `Unsupported file type.`

### Endpoint — `POST /pdf/convert`

- Multipart `files` (1..N) + form `target` + optional `dpi`.
- Multi-file allowed ONLY when every file is an image AND target is `pdf`
  (order = page order); otherwise 400
  `Convert takes one file at a time (multiple images can be combined into a PDF).`
- Pair/dpi validation per the matrix (400s above); then the usual
  `_accept_job(tool="convert", params={"target", "names", "source_kind",
  "dpi"?})` → 202. Inputs stored as `input-{i}.<original ext>`.

### Service — `api/app/services/convert.py`

- `ConvertError(RuntimeError)` (user-facing copy).
- `convert_files(workspace, names, source_kind, target, dpi) -> ConvertOutput`
  where `ConvertOutput = (result_path, download_name, media_type)`; internally
  a registry `{(source_kind, target): converter}`.
- PDF sources are pre-opened with pikepdf to map encryption to the standard
  `'<name>' is password-protected — unlock it first.`; corrupt →
  `'<name>' could not be read as a PDF.` Engine failures →
  `'<name>' could not be converted.`
- Output naming: single output `<stem>.<target ext>` (`.docx` for Word);
  pdf→images `<stem>-pages.zip`. Media types: pdf `application/pdf`; docx
  `application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
  md `text/markdown`; html `text/html`; txt `text/plain`; zip
  `application/zip`.

### Worker

`_run_convert` in `_RUNNERS` under `"convert"`; `ConvertError` joins
`_KNOWN_ERRORS`.

## CI & local dev

- `.github/workflows/ci.yml` api job gains an apt step installing
  `pandoc libreoffice-writer ghostscript libpango-1.0-0 libpangocairo-1.0-0
  libgdk-pixbuf-2.0-0 fonts-liberation` so conversion tests run for real.
- Engine-dependent tests are marked `skipif` on missing binaries
  (`shutil.which("pandoc"/"soffice"/"gs")`), so the owner's local pytest run
  stays green without installing LibreOffice on the Mac. Pure-Python paths
  (pdf→txt/md, images→pdf, pdf→docx) always run.

## Web

- `/convert` route + `useConvertStore` (zustand, same pattern as the other
  five): `files, target, dpi, status, result, error, progress, reset`.
- Dropzone accepts `.pdf,.png,.jpg,.jpeg,.docx,.md,.html,.htm,.txt`; source
  kind detected from extension; the target picker shows only the matrix row
  for that kind (compress-style option cards); DPI preset cards appear for
  png/jpeg targets; multi-image uploads show the merge-style ordered list
  (▲▼, order = page order). Inputs freeze while a job runs (established
  pattern).
- `convertFiles(files, target, dpi, onProgress)` in `lib/api.ts` via
  `runJobFlow` with `tool: "convert"`.
- Homepage Convert tile → Live; queue board `TOOL_LABELS` gains
  `convert: "Convert"`; typed client regenerated.

## Testing

- Service tests per pair with in-test fixtures: pdf via pikepdf; png/jpeg as
  hardcoded tiny valid byte strings; md/html/txt as literals; docx generated
  by pandoc (skipif pandoc missing). Encrypted-pdf and timeout copy tested;
  invalid pair tested at the endpoint.
- Endpoint tests: pair matrix validation, multi-file rules, dpi rules,
  params shape. Worker test uses the engine-free pdf→txt pair.
- Gates: full pytest (CI runs all engines), vitest, typecheck, build.
  **NO browser testing** (owner directive).

## Delivery

Branch `convert-tool` → subagent tasks with reviews → final whole-branch
review → PR → checks → merge → auto-deploy (api image grows ~500–600 MB —
expect a noticeably longer first build) → curl-based prod verification
(submit md→pdf and pdf→png jobs, verify outputs by magic bytes; `/convert`
page 200).

## Accepted deviations & tracked residual risk (final review)

- `dpi` with a non-numeric value returns FastAPI's standard 422 rather than
  the 400 "Invalid DPI." — accepted; the web client only sends preset ints.
- **Resolved fast-follow (2026-07-03):** LibreOffice link fetching is now
  double-mitigated — `TargetMode="External"` relationships are stripped from
  the docx before conversion, and the per-job profile is seeded with link
  updating disabled (`registrymodifications.xcu`).
