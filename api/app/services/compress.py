"""PDF compression backed by Ghostscript.

Ghostscript is the industry-standard tool for shrinking PDFs: it can downsample
embedded images and re-encode page content, which yields far better results than
pure structural compression for the common image-heavy PDF.

Compression operates on files on disk (not in-memory buffers) so that large
uploads can be streamed straight through without loading them into memory.
"""

from __future__ import annotations

import shutil
import subprocess
from dataclasses import dataclass
from enum import Enum
from pathlib import Path


class CompressionQuality(str, Enum):
    """Quality presets that map directly to Ghostscript's -dPDFSETTINGS values.

    Lower quality means smaller files: `screen` is the most aggressive,
    `prepress` preserves the most detail.
    """

    screen = "screen"
    ebook = "ebook"
    printer = "printer"
    prepress = "prepress"


class GhostscriptNotInstalledError(RuntimeError):
    """Raised when the `gs` binary cannot be found on the host."""


class CompressionError(RuntimeError):
    """Raised when Ghostscript fails to process a PDF."""


@dataclass
class CompressionStats:
    """Size accounting for a single compressed PDF."""

    original_size: int
    compressed_size: int

    @property
    def ratio(self) -> float:
        """Fraction of the original size that was removed (0.0 - 1.0)."""
        if self.original_size == 0:
            return 0.0
        return 1 - (self.compressed_size / self.original_size)


def _ghostscript_binary() -> str:
    """Locate the Ghostscript executable, raising a clear error if it is missing."""
    binary = shutil.which("gs")
    if binary is None:
        raise GhostscriptNotInstalledError(
            "Ghostscript (gs) is not installed. Install it with 'brew install ghostscript' "
            "or 'apt-get install ghostscript'."
        )
    return binary


def compress_pdf_file(
    input_path: Path,
    output_path: Path,
    quality: CompressionQuality,
) -> CompressionStats:
    """Compress a PDF on disk, writing the result to `output_path`.

    Reads from and writes to files so the data never has to be held in memory.
    Returns the original and resulting sizes.
    """
    binary = _ghostscript_binary()
    original_size = input_path.stat().st_size

    # Re-distill the PDF through Ghostscript's pdfwrite device using the selected
    # quality preset. The flags disable interactive prompts and pin a broadly
    # compatible output version.
    command = [
        binary,
        "-sDEVICE=pdfwrite",
        "-dCompatibilityLevel=1.4",
        f"-dPDFSETTINGS=/{quality.value}",
        "-dNOPAUSE",
        "-dQUIET",
        "-dBATCH",
        f"-sOutputFile={output_path}",
        str(input_path),
    ]

    try:
        subprocess.run(command, check=True, capture_output=True)
    except subprocess.CalledProcessError as exc:
        detail = exc.stderr.decode("utf-8", errors="replace").strip()
        raise CompressionError(
            f"Ghostscript failed to compress '{input_path.name}': {detail or 'unknown error'}"
        ) from exc

    compressed_size = output_path.stat().st_size

    # Ghostscript can occasionally produce a larger file than the original (already
    # optimized PDFs); in that case keep the original so we never inflate.
    if compressed_size >= original_size:
        shutil.copyfile(input_path, output_path)
        compressed_size = original_size

    return CompressionStats(original_size=original_size, compressed_size=compressed_size)
