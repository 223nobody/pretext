from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from app.services.cache_service import CacheService


def test_set_get_updates_cached_until(tmp_path) -> None:
    service = CacheService(cache_dir=tmp_path)
    data = {
        "file_id": "abc",
        "text": "cached text",
        "cached_until": "placeholder",
    }

    expires_at = service.set("abc", data)
    cached = service.get("abc")

    assert cached is not None
    assert cached["file_id"] == "abc"
    assert cached["text"] == "cached text"
    assert cached["cached_until"] == expires_at.isoformat()


def test_get_removes_expired_entry(tmp_path) -> None:
    service = CacheService(cache_dir=tmp_path)
    expired = datetime.now(timezone.utc) - timedelta(seconds=1)
    path = tmp_path / "expired-key.json"
    path.write_text(
        json.dumps({"expires_at": expired.isoformat(), "data": {"value": 1}}),
        encoding="utf-8",
    )

    assert service.get("expired-key") is None
    assert not path.exists()


def test_cleanup_expired_removes_expired_and_corrupt_entries(tmp_path) -> None:
    service = CacheService(cache_dir=tmp_path)
    expired = datetime.now(timezone.utc) - timedelta(seconds=1)
    active = datetime.now(timezone.utc) + timedelta(hours=1)

    (tmp_path / "expired.json").write_text(
        json.dumps({"expires_at": expired.isoformat(), "data": {"value": 1}}),
        encoding="utf-8",
    )
    (tmp_path / "active.json").write_text(
        json.dumps({"expires_at": active.isoformat(), "data": {"value": 2}}),
        encoding="utf-8",
    )
    (tmp_path / "corrupt.json").write_text("{not json", encoding="utf-8")

    result = service.cleanup_expired()

    assert result == {"scanned": 3, "deleted": 2}
    assert not (tmp_path / "expired.json").exists()
    assert not (tmp_path / "corrupt.json").exists()
    assert (tmp_path / "active.json").exists()
