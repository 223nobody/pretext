from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from app.config import settings
from app.services.security_service import find_unsafe_pattern
from app.utils.encoding import detect_encoding

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx", ".epub", ".html", ".htm", ".tex"}
TEXT_EXTENSIONS = {".txt", ".md", ".html", ".htm", ".tex"}

EXTENSION_MIME = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".html": "text/html",
    ".htm": "text/html",
    ".tex": "application/x-tex",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".epub": "application/epub+zip",
}

STATUS_BY_CODE = {
    "UNSUPPORTED_FORMAT": 400,
    "FILE_TOO_LARGE": 413,
    "ENCODING_ERROR": 422,
    "CONTENT_REJECTED": 422,
    "EMPTY_CONTENT": 422,
    "URL_TIMEOUT": 504,
    "URL_FETCH_FAILED": 502,
    "ARXIV_TIMEOUT": 504,
    "ARXIV_FETCH_FAILED": 502,
}


class FileValidationError(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = STATUS_BY_CODE.get(code, 400)


@dataclass(frozen=True)
class ValidationResult:
    extension: str
    mime_type: str
    encoding: str
    size: int
    warnings: list[str]


class ValidationService:
    def validate(self, file_name: str, content: bytes) -> ValidationResult:
        extension = Path(file_name).suffix.lower()
        warnings: list[str] = []

        if extension not in ALLOWED_EXTENSIONS:
            supported = ", ".join(sorted(ext.lstrip(".") for ext in ALLOWED_EXTENSIONS))
            raise FileValidationError(
                "UNSUPPORTED_FORMAT",
                f"Unsupported file format {extension or '(none)'}. Supported: {supported}",
            )

        size = len(content)
        if size > settings.max_file_size:
            raise FileValidationError(
                "FILE_TOO_LARGE",
                f"File size {_format_bytes(size)} exceeds limit {_format_bytes(settings.max_file_size)}",
            )

        if size == 0:
            raise FileValidationError("EMPTY_CONTENT", "File is empty")

        detected_mime = detect_mime(content, extension)
        expected_mime = EXTENSION_MIME.get(extension, "application/octet-stream")
        if detected_mime != expected_mime and extension not in {".txt", ".md", ".tex"}:
            warnings.append(
                f"MIME looks like {detected_mime}, expected {expected_mime}; parsing will continue"
            )

        encoding_detection = detect_encoding(content)
        encoding = encoding_detection.encoding
        if encoding_detection.confidence < 0.5 and extension in TEXT_EXTENSIONS:
            warnings.append(
                f"Encoding confidence is low ({encoding_detection.confidence:.0%}); using {encoding}"
            )

        if extension in TEXT_EXTENSIONS:
            try:
                decoded = content.decode(encoding, errors="replace")
            except LookupError as exc:
                raise FileValidationError(
                    "ENCODING_ERROR", f"Unsupported encoding detected: {encoding}"
                ) from exc
            unsafe = find_unsafe_pattern(decoded)
            if unsafe:
                raise FileValidationError(
                    "CONTENT_REJECTED", "File content contains unsafe script-like markup"
                )

        return ValidationResult(
            extension=extension,
            mime_type=detected_mime,
            encoding=encoding,
            size=size,
            warnings=warnings,
        )


def detect_mime(content: bytes, extension: str) -> str:
    head = content[:512].lstrip()
    if head.startswith(b"%PDF"):
        return "application/pdf"
    if head.startswith(b"PK\x03\x04"):
        return EXTENSION_MIME.get(extension, "application/zip")
    lower_head = head.lower()
    if lower_head.startswith(b"<!doctype html") or lower_head.startswith(b"<html"):
        return "text/html"
    if extension in EXTENSION_MIME:
        return EXTENSION_MIME[extension]
    return "application/octet-stream"


def _format_bytes(n: int) -> str:
    value = float(n)
    for unit in ["B", "KB", "MB", "GB"]:
        if value < 1024:
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{value:.1f} TB"
