from __future__ import annotations

import pytest

from app.services.extraction_service import ExtractionService
from app.services.validation_service import FileValidationError


@pytest.mark.parametrize("extension", [".pdf", ".txt", ".md", ".docx", ".epub", ".html", ".htm", ".tex"])
def test_extractor_dispatch_covers_supported_extensions(extension: str) -> None:
    extractor = ExtractionService()._get_extractor(extension)

    assert callable(extractor)


def test_extractor_dispatch_rejects_unknown_extension() -> None:
    with pytest.raises(FileValidationError) as exc:
      ExtractionService()._get_extractor(".rtf")

    assert exc.value.code == "UNSUPPORTED_FORMAT"


@pytest.mark.asyncio
async def test_extract_txt(tmp_path) -> None:
    path = tmp_path / "note.txt"
    path.write_text("Hello\n\nReader", encoding="utf-8")

    data = await ExtractionService().extract(path, ".txt", "utf-8")

    assert data["text"] == "Hello\n\nReader"
    assert data["char_count"] == len("Hello\n\nReader")


@pytest.mark.asyncio
async def test_extract_markdown_title(tmp_path) -> None:
    path = tmp_path / "note.md"
    path.write_text("# Title\n\nSome **bold** text.", encoding="utf-8")

    data = await ExtractionService().extract(path, ".md", "utf-8")

    assert "Some" in data["text"]
    assert data["metadata"]["title"] == "Title"
