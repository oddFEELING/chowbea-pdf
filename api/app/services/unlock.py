"""Remove the password / encryption from a PDF using pikepdf.

pikepdf wraps libqpdf and is purpose-built for this: given the correct password
it opens the document and writes an exact, unencrypted copy without re-rendering
the pages, so the output is byte-for-byte equivalent in content to the input
(just without the encryption layer).

Like the compression service, this operates on files on disk so large uploads
can be streamed straight through without being held in memory.
"""

from __future__ import annotations

from pathlib import Path

import pikepdf


class IncorrectPasswordError(RuntimeError):
    """Raised when the supplied password does not open the PDF."""


class NotEncryptedError(RuntimeError):
    """Raised when the PDF has no password to remove."""


class UnlockError(RuntimeError):
    """Raised when the PDF cannot be opened for some other reason."""


def unlock_pdf_file(input_path: Path, output_path: Path, password: str) -> None:
    """Decrypt `input_path` with `password`, writing an unencrypted PDF to `output_path`.

    Raises a specific error for the common, user-facing failure modes so the
    router can map them to clear HTTP responses.
    """
    # First try to open without a password. This tells us whether the PDF even
    # needs one, and handles the case where only an owner password is set (the
    # file opens freely but is still encrypted).
    try:
        with pikepdf.open(str(input_path)) as pdf:
            if not pdf.is_encrypted:
                # Nothing to remove — tell the user rather than returning a copy.
                raise NotEncryptedError("This PDF isn't password protected.")
            # Owner-only encryption: opens without a password, so just strip it.
            pdf.save(str(output_path))
            return
    except pikepdf.PasswordError:
        # The file needs a user (open) password; fall through and try the one given.
        pass
    except pikepdf.PdfError as exc:
        raise UnlockError(f"Could not open the PDF: {exc}") from exc

    # The PDF has an open password — decrypt it with the supplied one.
    try:
        with pikepdf.open(str(input_path), password=password) as pdf:
            # Saving without an `encryption` argument drops the encryption entirely.
            pdf.save(str(output_path))
    except pikepdf.PasswordError as exc:
        raise IncorrectPasswordError("Incorrect password for this PDF.") from exc
    except pikepdf.PdfError as exc:
        raise UnlockError(f"Could not open the PDF: {exc}") from exc
