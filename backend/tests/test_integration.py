"""Integration tests for the Pretext Reader API.

Tests the full upload→validate→extract→cache pipeline, error handling,
concurrent uploads, and rate limiting.
"""

from __future__ import annotations

import asyncio
import io

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# File upload integration
# ---------------------------------------------------------------------------

def test_upload_txt_returns_text_and_metadata() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("note.txt", b"Hello from integration test", "text/plain")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["file_name"] == "note.txt"
    assert payload["data"]["text"] == "Hello from integration test"
    assert payload["data"]["char_count"] == 27
    assert payload["data"]["mime_type"] in ("text/plain", "application/octet-stream")
    assert "preview" in payload["data"]


def test_upload_pdf_returns_extracted_text() -> None:
    """Upload a minimal valid PDF and verify text extraction."""
    # Minimal valid PDF with readable text
    pdf_bytes = (
        b"%PDF-1.4\n"
        b"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
        b"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"
        b"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]"
        b"/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n"
        b"4 0 obj<</Length 44>>stream\n"
        b"BT /F1 12 Tf 100 700 Td (Hello PDF) Tj ET\n"
        b"endstream\nendobj\n"
        b"5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\n"
        b"xref\n0 6\n"
        b"trailer<</Size 6/Root 1 0 R>>\n"
        b"startxref\n"
    )

    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("test.pdf", pdf_bytes, "application/pdf")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "Hello PDF" in payload["data"]["text"]


def test_upload_rejects_unsupported_extension() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("tool.exe", b"MZ\x00\x00", "application/x-msdownload")},
    )

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "UNSUPPORTED_FORMAT"


def test_upload_rejects_empty_file() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("empty.txt", b"", "text/plain")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "EMPTY_CONTENT"


def test_upload_rejects_script_injection() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("bad.html", b"<script>alert('xss')</script>", "text/html")},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "CONTENT_REJECTED"


def test_upload_markdown_extracts_title() -> None:
    response = client.post(
        "/api/v1/file/upload",
        files={"file": ("readme.md", b"# Integration Test\n\nSome content.", "text/markdown")},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "Integration Test" in payload["data"]["metadata"]["title"]
    assert "Some content" in payload["data"]["text"]


def test_upload_caches_result() -> None:
    """Upload the same content twice; second request should hit cache."""
    content = b"Cached content for integration test"

    first = client.post(
        "/api/v1/file/upload",
        files={"file": ("cache.txt", content, "text/plain")},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/v1/file/upload",
        files={"file": ("cache.txt", content, "text/plain")},
    )
    assert second.status_code == 200
    # Both should return the same file_id (SHA-256 of content)
    assert first.json()["data"]["file_id"] == second.json()["data"]["file_id"]


# ---------------------------------------------------------------------------
# Text extraction integration
# ---------------------------------------------------------------------------

def test_text_extract_strips_html() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "Hello <b>world</b>", "max_chars": 50},
    )

    assert response.status_code == 200
    assert response.json()["data"]["text"] == "Hello world"


def test_text_extract_truncates_long_text() -> None:
    response = client.post(
        "/api/v1/text/extract",
        json={"text": "A" * 200, "max_chars": 10},
    )

    assert response.status_code == 200
    data = response.json()["data"]
    assert len(data["text"]) == 10
    assert data["truncated"] is True


# ---------------------------------------------------------------------------
# Cache integration
# ---------------------------------------------------------------------------

def test_cache_cleanup_returns_counts() -> None:
    response = client.delete("/api/v1/cache")

    assert response.status_code == 200
    data = response.json()["data"]
    assert "scanned" in data
    assert "deleted" in data


def test_cache_delete_nonexistent_key() -> None:
    response = client.delete("/api/v1/cache/nonexistent-key-12345")

    assert response.status_code == 200
    assert response.json()["data"]["deleted"] is False


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def test_rate_limit_returns_429_after_exceeding() -> None:
    """Send many text extraction requests and verify rate limiting kicks in."""
    responses = []
    for _ in range(35):  # Limit is 30/min for /api/v1/text/extract
        resp = client.post(
            "/api/v1/text/extract",
            json={"text": "Rate limit test"},
        )
        responses.append(resp)

    # At least one of the later responses should be rate-limited
    statuses = [r.status_code for r in responses]
    assert 429 in statuses, f"Expected 429 in responses, got {set(statuses)}"


# ---------------------------------------------------------------------------
# Concurrent uploads
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_concurrent_uploads() -> None:
    """Verify that concurrent uploads do not interfere with each other."""
    async def upload_one(index: int) -> int:
        content = f"Concurrent upload {index}".encode()
        import httpx

        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
            resp = await ac.post(
                "/api/v1/file/upload",
                files={"file": (f"concurrent_{index}.txt", content, "text/plain")},
            )
        return resp.status_code

    tasks = [upload_one(i) for i in range(5)]
    results = await asyncio.gather(*tasks)

    assert all(code == 200 for code in results)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

def test_health_returns_ok() -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json()["data"]["status"] == "ok"
