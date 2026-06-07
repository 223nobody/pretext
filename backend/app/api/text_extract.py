from __future__ import annotations

from fastapi import APIRouter

from app.config import settings
from app.models.requests import TextExtractRequest
from app.services.security_service import find_unsafe_pattern, sanitize_text
from app.services.validation_service import FileValidationError

router = APIRouter()


@router.post("/extract")
async def extract_text(request: TextExtractRequest) -> dict:
    if find_unsafe_pattern(request.text):
        raise FileValidationError("CONTENT_REJECTED", "Text contains unsafe script-like markup")

    text = sanitize_text(request.text)
    if not text:
        raise FileValidationError("EMPTY_CONTENT", "Text content is empty")

    max_chars = min(request.max_chars, settings.max_text_chars)
    truncated = len(text) > max_chars
    if truncated:
        text = text[:max_chars].rstrip()

    return {
        "success": True,
        "data": {
            "text": text,
            "char_count": len(text),
            "preview": text[: settings.max_preview_chars],
            "truncated": truncated,
            "metadata": {"source": "text"},
        },
    }
