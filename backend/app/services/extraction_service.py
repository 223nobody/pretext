from __future__ import annotations

from pathlib import Path
from typing import Any, Awaitable, Callable

from app.config import settings
from app.services.extractors.docx_extractor import extract_docx
from app.services.extractors.epub_extractor import extract_epub
from app.services.extractors.html_extractor import extract_html
from app.services.extractors.latex_extractor import extract_latex
from app.services.extractors.markdown_extractor import extract_markdown
from app.services.extractors.pdf_extractor import extract_pdf
from app.services.extractors.txt_extractor import extract_txt
from app.services.security_service import sanitize_text
from app.services.validation_service import FileValidationError

Extractor = Callable[[Path, str], Awaitable[tuple[str, dict[str, Any]]]]


class ExtractionService:
    async def extract(
        self,
        file_path: Path,
        extension: str,
        encoding: str,
        max_chars: int = 500_000,
    ) -> dict[str, Any]:
        extractor = self._get_extractor(extension)
        text, metadata = await extractor(file_path, encoding)
        cleaned = sanitize_text(text)

        if not cleaned:
            raise FileValidationError("EMPTY_CONTENT", "No usable text could be extracted")

        max_chars = min(max_chars, settings.max_text_chars)
        truncated = len(cleaned) > max_chars
        if truncated:
            cleaned = cleaned[:max_chars].rstrip()

        return {
            "text": cleaned,
            "char_count": len(cleaned),
            "truncated": truncated,
            "preview": cleaned[: settings.max_preview_chars],
            "metadata": metadata,
        }

    def _get_extractor(self, extension: str) -> Extractor:
        extractors: dict[str, Extractor] = {
            ".pdf": extract_pdf,
            ".txt": extract_txt,
            ".md": extract_markdown,
            ".docx": extract_docx,
            ".epub": extract_epub,
            ".html": extract_html,
            ".htm": extract_html,
            ".tex": extract_latex,
        }
        try:
            return extractors[extension]
        except KeyError as exc:
            raise FileValidationError(
                "UNSUPPORTED_FORMAT",
                f"Unsupported extractor for {extension}",
            ) from exc
