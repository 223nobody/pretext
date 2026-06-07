from __future__ import annotations

import pytest

from app.services.validation_service import FileValidationError, ValidationService


def test_validation_accepts_text_file() -> None:
    result = ValidationService().validate("note.txt", b"hello world")

    assert result.extension == ".txt"
    assert result.encoding == "utf-8"


def test_validation_rejects_unsupported_extension() -> None:
    with pytest.raises(FileValidationError) as exc:
        ValidationService().validate("tool.exe", b"MZ")

    assert exc.value.code == "UNSUPPORTED_FORMAT"


def test_validation_rejects_script_markup() -> None:
    with pytest.raises(FileValidationError) as exc:
        ValidationService().validate("note.html", b"<script>alert(1)</script>")

    assert exc.value.code == "CONTENT_REJECTED"
