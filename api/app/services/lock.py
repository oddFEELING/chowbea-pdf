"""Add a password (encrypt) to a PDF using pikepdf.

The inverse of the unlock service: given a PDF and a password, write an encrypted
copy that can't be opened without that password. pikepdf wraps libqpdf, so the
page content is copied exactly — only an encryption layer is added.

The user-entered password becomes the document's *user* (open) password. A random
*owner* password is generated so the permission flags actually stick: without the
owner password a viewer can't re-grant the permissions we disabled. The single
password the user knows is all they ever need to open the file (and our own
unlock tool can still strip the encryption with it).

Like the other services this operates on files on disk so large uploads stream
straight through without being held in memory.
"""

from __future__ import annotations

import secrets
from enum import Enum
from pathlib import Path

import pikepdf


class EncryptionLevel(str, Enum):
    """Encryption strength presets exposed by the API."""

    aes128 = "aes-128"
    aes256 = "aes-256"


class AlreadyProtectedError(RuntimeError):
    """Raised when the input PDF already needs a password to open."""


class LockError(RuntimeError):
    """Raised when the PDF cannot be opened or encrypted for some other reason."""


# pikepdf revision numbers: R=6 is AES-256, R=4 (with aes=True) is AES-128.
_REVISION_BY_LEVEL = {
    EncryptionLevel.aes256: 6,
    EncryptionLevel.aes128: 4,
}


def lock_pdf_file(
    input_path: Path,
    output_path: Path,
    password: str,
    *,
    allow_printing: bool = True,
    allow_copying: bool = False,
    allow_editing: bool = False,
    encryption: EncryptionLevel = EncryptionLevel.aes256,
) -> None:
    """Encrypt `input_path` with `password`, writing the protected PDF to `output_path`.

    Raises a specific error for the common, user-facing failure modes so the
    router can map them to clear HTTP responses.
    """
    if not password:
        raise LockError("A password is required to lock the PDF.")

    # Permissions default to all-allowed; we switch off whatever the caller didn't
    # grant. Accessibility (screen-reader extraction) stays on regardless.
    permissions = pikepdf.Permissions(
        accessibility=True,
        extract=allow_copying,
        modify_annotation=allow_editing,
        modify_assembly=allow_editing,
        modify_form=allow_editing,
        modify_other=allow_editing,
        print_highres=allow_printing,
        print_lowres=allow_printing,
    )

    encryption_spec = pikepdf.Encryption(
        owner=secrets.token_urlsafe(24),
        user=password,
        R=_REVISION_BY_LEVEL[encryption],
        allow=permissions,
    )

    # Open without a password first. If the file already requires one we can't
    # (and shouldn't silently) re-encrypt it; tell the user to unlock it first.
    try:
        with pikepdf.open(str(input_path)) as pdf:
            pdf.save(str(output_path), encryption=encryption_spec)
    except pikepdf.PasswordError as exc:
        raise AlreadyProtectedError(
            "This PDF is already password protected. Unlock it first."
        ) from exc
    except pikepdf.PdfError as exc:
        raise LockError(f"Could not lock the PDF: {exc}") from exc
