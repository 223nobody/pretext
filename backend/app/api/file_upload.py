from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, UploadFile

from app.config import settings
from app.models.requests import UploadOptions
from app.services.cache_service import CacheService
from app.services.extraction_service import ExtractionService
from app.services.validation_service import FileValidationError, ValidationService

router = APIRouter()

validation_service = ValidationService()
extraction_service = ExtractionService()
cache_service = CacheService()


@router.post("/upload")
async def upload_file(file: UploadFile = File(...), options: str | None = Form(None)) -> dict:
    upload_options = _parse_options(options)
    content = await file.read()
    file_name = file.filename or "upload"
    validation = validation_service.validate(file_name, content)
    file_id = hashlib.sha256(content).hexdigest()

    cached = cache_service.get(file_id)
    if cached:
        cached["file_name"] = file_name
        cached["file_size"] = validation.size
        return {"success": True, "data": cached, "warnings": validation.warnings}

    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    file_path = settings.upload_dir / f"{file_id}{validation.extension}"
    file_path.write_bytes(content)

    extracted = await extraction_service.extract(
        file_path=file_path,
        extension=validation.extension,
        encoding=validation.encoding,
        max_chars=upload_options.max_chars,
    )

    data = {
        "file_id": file_id,
        "file_name": file_name,
        "file_size": validation.size,
        "mime_type": validation.mime_type,
        "detected_encoding": validation.encoding,
        "text": extracted["text"],
        "char_count": extracted["char_count"],
        "metadata": {
            **extracted.get("metadata", {}),
            "source": "file",
            "truncated": extracted["truncated"],
        },
        "preview": extracted["preview"],
        "cached_until": datetime.now(timezone.utc).isoformat(),
    }
    expires_at = cache_service.set(file_id, data)
    data["cached_until"] = expires_at.isoformat()

    return {"success": True, "data": data, "warnings": validation.warnings}


def _parse_options(options: str | None) -> UploadOptions:
    if not options:
        return UploadOptions()
    try:
        payload = json.loads(options)
        return UploadOptions.model_validate(payload)
    except (json.JSONDecodeError, ValueError) as exc:
        raise FileValidationError("UNSUPPORTED_FORMAT", "Invalid upload options JSON") from exc
