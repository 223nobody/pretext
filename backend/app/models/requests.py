from __future__ import annotations

from pydantic import BaseModel, Field, HttpUrl


class UploadOptions(BaseModel):
    max_chars: int = Field(default=500_000, ge=1, le=1_000_000)
    preserve_paragraphs: bool = True
    extract_metadata: bool = True


class UrlFetchOptions(BaseModel):
    max_chars: int = Field(default=300_000, ge=1, le=1_000_000)
    timeout_ms: int = Field(default=15_000, ge=1_000, le=30_000)


class UrlFetchRequest(BaseModel):
    url: HttpUrl
    options: UrlFetchOptions = Field(default_factory=UrlFetchOptions)


class TextExtractRequest(BaseModel):
    text: str = Field(min_length=1)
    max_chars: int = Field(default=500_000, ge=1, le=1_000_000)
