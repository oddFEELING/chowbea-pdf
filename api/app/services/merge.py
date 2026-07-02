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
