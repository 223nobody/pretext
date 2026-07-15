from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"


def test_text_extract_endpoint() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "Hello <b>reader</b>", "max_chars": 20},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["text"] == "Hello reader"
    assert payload["char_count"] == len("Hello reader")


def test_text_extract_truncates_and_reports_metadata() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "alpha beta gamma", "max_chars": 10},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["text"] == "alpha beta"
    assert payload["char_count"] == len("alpha beta")
    assert payload["preview"] == "alpha beta"
    assert payload["truncated"] is True
    assert payload["metadata"] == {"source": "text"}


def test_text_extract_rejects_empty_after_sanitization() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "   "},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EMPTY_CONTENT"


def test_text_extract_rejects_script() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "<script>alert(1)</script>"},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CONTENT_REJECTED"


def test_upload_txt_endpoint() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("note.txt", b"Hello from upload", "text/plain")},
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["file_name"] == "note.txt"
    assert payload["text"] == "Hello from upload"


def test_cache_delete_endpoint() -> None:
    response = client.delete("/api/v1/cache/missing-key")

    assert response.status_code == 200
    assert response.json()["data"] == {"key": "missing-key", "deleted": False}


def test_cache_cleanup_endpoint() -> None:
    response = client.delete("/api/v1/cache")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert "scanned" in payload
    assert "deleted" in payload
