from __future__ import annotations

import os
from pathlib import Path


class Settings:
    app_name = os.getenv("APP_NAME", "Pretext Reader API")
    api_prefix = "/api/v1"
    max_file_size = int(os.getenv("MAX_FILE_SIZE", str(50 * 1024 * 1024)))
    max_text_chars = int(os.getenv("MAX_TEXT_CHARS", "1000000"))
    max_preview_chars = int(os.getenv("MAX_PREVIEW_CHARS", "500"))
    cache_ttl = int(os.getenv("CACHE_TTL", "86400"))
    enable_ocr = os.getenv("ENABLE_OCR", "false").lower() in {"1", "true", "yes", "on"}
    ocr_language = os.getenv("OCR_LANGUAGE", "eng")
    url_fetch_user_agent = os.getenv("URL_FETCH_USER_AGENT", "PretextReader/0.1")
    verify_ssl = os.getenv("VERIFY_SSL", "true").lower() not in {"0", "false", "no", "off"}
    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "ALLOWED_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000,http://127.0.0.1:3000",
        ).split(",")
        if origin.strip()
    ]
    root_dir = Path(__file__).resolve().parents[2]
    cache_dir = Path(os.getenv("CACHE_DIR", str(root_dir / "cache")))
    upload_dir = Path(os.getenv("UPLOAD_DIR", str(root_dir / "uploads")))


settings = Settings()
