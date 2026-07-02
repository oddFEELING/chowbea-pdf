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
