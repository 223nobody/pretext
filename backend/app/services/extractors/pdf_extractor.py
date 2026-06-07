from __future__ import annotations

from pathlib import Path

from app.config import settings


async def extract_pdf(file_path: Path, _encoding: str) -> tuple[str, dict]:
    pages: list[str] = []
    metadata: dict = {}

    try:
        import fitz

        with fitz.open(file_path) as document:
            metadata = {k: v for k, v in document.metadata.items() if v}
            metadata["pages"] = document.page_count
            for page in document:
                pages.append(page.get_text("text"))
        text = "\n\n".join(page.strip() for page in pages if page.strip())
        if text or not settings.enable_ocr:
            return text, metadata
        return _extract_pdf_ocr_with_fitz(file_path, metadata)
    except Exception:
        import pdfplumber

        with pdfplumber.open(file_path) as pdf:
            metadata = dict(pdf.metadata or {})
            metadata["pages"] = len(pdf.pages)
            for page in pdf.pages:
                pages.append(page.extract_text() or "")
        text = "\n\n".join(page.strip() for page in pages if page.strip())
        if text or not settings.enable_ocr:
            return text, metadata
        return _extract_pdf_ocr_with_pdfplumber(file_path, metadata)


def _extract_pdf_ocr_with_fitz(file_path: Path, metadata: dict) -> tuple[str, dict]:
    import fitz
    import pytesseract
    from PIL import Image

    text_pages: list[str] = []
    with fitz.open(file_path) as document:
        metadata["pages"] = document.page_count
        metadata["ocr"] = True
        for page in document:
            pixmap = page.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
            text_pages.append(pytesseract.image_to_string(image, lang=settings.ocr_language))
    return "\n\n".join(page.strip() for page in text_pages if page.strip()), metadata


def _extract_pdf_ocr_with_pdfplumber(file_path: Path, metadata: dict) -> tuple[str, dict]:
    import pdfplumber
    import pytesseract

    text_pages: list[str] = []
    with pdfplumber.open(file_path) as pdf:
        metadata["pages"] = len(pdf.pages)
        metadata["ocr"] = True
        for page in pdf.pages:
            image = page.to_image(resolution=180).original
            text_pages.append(pytesseract.image_to_string(image, lang=settings.ocr_language))
    return "\n\n".join(page.strip() for page in text_pages if page.strip()), metadata
