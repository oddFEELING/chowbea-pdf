"""Routes for PDF actions. The first action is compression."""

from __future__ import annotations

import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask

from app.core.config import settings
from app.services.compress import (
    CompressionError,
    CompressionQuality,
    CompressionStats,
    GhostscriptNotInstalledError,
    compress_pdf_file,
)
from app.services.unlock import (
    IncorrectPasswordError,
    NotEncryptedError,
    UnlockError,
    unlock_pdf_file,
)

router = APIRouter(prefix="/pdf", tags=["pdf"])

# Guard rail so a single request can't exhaust the server.
_MAX_UPLOAD_BYTES = settings.max_upload_mb * 1024 * 1024

# Uploads are streamed to disk in chunks of this size to keep memory bounded.
_CHUNK_SIZE = 1024 * 1024


async def _stream_upload_to_disk(file: UploadFile, dest: Path) -> None:
    """Write an uploaded file to `dest` in chunks, validating it as a PDF.

    Enforces the PDF magic bytes and the size limit while streaming, so we never
    hold the whole file in memory and reject oversized uploads early.
    """
    size = 0
    is_first_chunk = True
    with dest.open("wb") as out:
        while True:
            chunk = await file.read(_CHUNK_SIZE)
            if not chunk:
                break
            if is_first_chunk:
                # PDFs always start with the '%PDF' magic bytes.
                if not chunk.startswith(b"%PDF"):
                    raise HTTPException(
                        status_code=400, detail=f"'{file.filename}' is not a valid PDF."
                    )
                is_first_chunk = False
            size += len(chunk)
            if size > _MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"'{file.filename}' exceeds the {settings.max_upload_mb} MB limit.",
                )
            out.write(chunk)

    if size == 0:
        raise HTTPException(status_code=400, detail=f"'{file.filename}' is empty.")


def _safe_name(filename: str | None, fallback: str) -> str:
    """Reduce an uploaded filename to a safe basename for use on disk and in ZIPs."""
    name = Path(filename or fallback).name
    return name or fallback


@router.post(
    "/compress",
    summary="Compress one or more PDF files",
    response_class=FileResponse,
)
async def compress(
    files: List[UploadFile] = File(..., description="One or more PDF files to compress."),
    quality: CompressionQuality = Form(
        CompressionQuality.ebook,
        description="Compression preset; 'screen' is smallest, 'prepress' is highest quality.",
    ),
) -> FileResponse:
    """Compress the uploaded PDFs and stream back the result.

    A single file is returned as a PDF; multiple files are returned as a ZIP archive.
    Aggregate size stats are exposed via response headers so the UI can show savings.
    Uploads and the response are streamed via a temp directory that is cleaned up
    once the response has been sent.
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files were uploaded.")

    # A working directory for this request; removed after the response is sent.
    work_dir = Path(tempfile.mkdtemp(prefix="chowbea-compress-"))
    cleanup = BackgroundTask(shutil.rmtree, work_dir, ignore_errors=True)

    try:
        outputs: List[tuple[Path, str]] = []
        total_original = 0
        total_compressed = 0

        for index, file in enumerate(files):
            name = _safe_name(file.filename, f"document-{index + 1}.pdf")
            input_path = work_dir / f"input-{index}.pdf"
            output_path = work_dir / f"output-{index}.pdf"

            await _stream_upload_to_disk(file, input_path)
            stats: CompressionStats = compress_pdf_file(input_path, output_path, quality)

            total_original += stats.original_size
            total_compressed += stats.compressed_size
            outputs.append((output_path, name))

        headers = {
            "X-Original-Size": str(total_original),
            "X-Compressed-Size": str(total_compressed),
        }

        if len(outputs) == 1:
            output_path, name = outputs[0]
            return FileResponse(
                output_path,
                media_type="application/pdf",
                filename=name,
                headers=headers,
                background=cleanup,
            )

        # Bundle multiple compressed PDFs into a single ZIP archive on disk.
        archive_path = work_dir / "compressed-pdfs.zip"
        with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as archive:
            for output_path, name in outputs:
                archive.write(output_path, arcname=name)

        return FileResponse(
            archive_path,
            media_type="application/zip",
            filename="compressed-pdfs.zip",
            headers=headers,
            background=cleanup,
        )
    except GhostscriptNotInstalledError as exc:
        # The compression engine is unavailable on this host: surface as 503.
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except CompressionError as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        # Any other failure (including the validation HTTPExceptions above) must
        # still clean up the temp directory before propagating.
        shutil.rmtree(work_dir, ignore_errors=True)
        raise


@router.post(
    "/unlock",
    summary="Remove the password from a PDF file",
    response_class=FileResponse,
)
async def unlock(
    file: UploadFile = File(..., description="A password-protected PDF to unlock."),
    password: str = Form(..., description="The password that opens the PDF."),
) -> FileResponse:
    """Decrypt a single uploaded PDF with the given password and stream it back.

    Returns the same document with its encryption removed. The temp directory is
    cleaned up once the response has been sent.
    """
    # A working directory for this request; removed after the response is sent.
    work_dir = Path(tempfile.mkdtemp(prefix="chowbea-unlock-"))
    cleanup = BackgroundTask(shutil.rmtree, work_dir, ignore_errors=True)

    try:
        name = _safe_name(file.filename, "document.pdf")
        input_path = work_dir / "input.pdf"
        output_path = work_dir / "output.pdf"

        await _stream_upload_to_disk(file, input_path)
        unlock_pdf_file(input_path, output_path, password)

        # Prefix the original name so the download is recognisably "unlocked".
        download_name = name if name.startswith("unlocked-") else f"unlocked-{name}"

        return FileResponse(
            output_path,
            media_type="application/pdf",
            filename=download_name,
            background=cleanup,
        )
    except NotEncryptedError as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except IncorrectPasswordError as exc:
        # 401-style situation, but the upload itself was fine; use 422 for a
        # consistent "we couldn't process this" contract with the UI.
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except UnlockError as exc:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception:
        shutil.rmtree(work_dir, ignore_errors=True)
        raise
