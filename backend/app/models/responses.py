from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class ApiError(BaseModel):
    code: str
    message: str


class ApiResponse(BaseModel):
    success: bool
    data: Any | None = None
    error: ApiError | None = None
    warnings: list[str] = []


class FileUploadData(BaseModel):
    file_id: str
    file_name: str
    file_size: int
    mime_type: str
    detected_encoding: str
    text: str
    char_count: int
    metadata: dict[str, Any]
    preview: str
    cached_until: datetime
