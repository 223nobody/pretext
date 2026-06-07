from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.config import settings


class CacheService:
    def __init__(self, cache_dir: Path | None = None):
        self.cache_dir = cache_dir or settings.cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def get(self, key: str) -> dict[str, Any] | None:
        path = self._path(key)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return None
        expires_at = datetime.fromisoformat(payload["expires_at"])
        if expires_at <= datetime.now(timezone.utc):
            path.unlink(missing_ok=True)
            return None
        return payload["data"]

    def set(self, key: str, data: dict[str, Any]) -> datetime:
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.cache_ttl)
        if "cached_until" in data:
            data = {**data, "cached_until": expires_at.isoformat()}
        payload = {"expires_at": expires_at.isoformat(), "data": data}
        self._path(key).write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
        return expires_at

    def delete(self, key: str) -> bool:
        path = self._path(key)
        existed = path.exists()
        path.unlink(missing_ok=True)
        return existed

    def cleanup_expired(self) -> dict[str, int]:
        scanned = 0
        deleted = 0
        now = datetime.now(timezone.utc)
        for path in self.cache_dir.glob("*.json"):
            scanned += 1
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
                expires_at = datetime.fromisoformat(payload["expires_at"])
            except (OSError, json.JSONDecodeError, KeyError, ValueError):
                path.unlink(missing_ok=True)
                deleted += 1
                continue
            if expires_at <= now:
                path.unlink(missing_ok=True)
                deleted += 1
        return {"scanned": scanned, "deleted": deleted}

    def _path(self, key: str) -> Path:
        return self.cache_dir / f"{key}.json"
