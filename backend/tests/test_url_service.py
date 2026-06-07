from __future__ import annotations

import asyncio

import aiohttp
import pytest

from app.services.url_service import UrlService
from app.services.validation_service import FileValidationError


class _FailingResponse:
    def __init__(self, error: Exception):
        self.error = error

    async def __aenter__(self):
        raise self.error

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False


class _FailingSession:
    def __init__(self, *args, error: Exception, **kwargs):
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def get(self, _url: str):
        return _FailingResponse(self.error)


class _HtmlResponse:
    def __init__(self, html: str):
        self.html = html

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def raise_for_status(self) -> None:
        return None

    async def text(self, **_kwargs) -> str:
        return self.html


class _HtmlSession:
    def __init__(self, *args, html: str, **kwargs):
        self.html = html

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def get(self, _url: str):
        return _HtmlResponse(self.html)


async def test_url_service_extracts_metadata_before_readability(monkeypatch) -> None:
    html = """
    <html>
      <head>
        <title>Readable Test Article</title>
        <meta name="author" content="Ada Writer" />
        <meta property="og:site_name" content="Example Journal" />
      </head>
      <body>
        <article>
          <h1>Readable Test Article</h1>
          <p>This article has enough clean text to exercise the URL extraction path.</p>
          <script>alert("ignored")</script>
        </article>
      </body>
    </html>
    """

    def session_factory(*args, **kwargs):
        return _HtmlSession(*args, html=html, **kwargs)

    monkeypatch.setattr(aiohttp, "ClientSession", session_factory)

    result = await UrlService().fetch("https://example.com/article", max_chars=1000, timeout_ms=1000)

    assert result["title"] == "Readable Test Article"
    assert result["author"] == "Ada Writer"
    assert result["site_name"] == "Example Journal"
    assert "ignored" not in result["text"]
    assert result["char_count"] == len(result["text"])
    assert result["excerpt"] == result["text"][:500]


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (asyncio.TimeoutError(), "URL_TIMEOUT"),
        (aiohttp.ClientConnectionError("offline"), "URL_FETCH_FAILED"),
        (
            aiohttp.ClientResponseError(
                request_info=None,
                history=(),
                status=404,
                message="not found",
            ),
            "URL_FETCH_FAILED",
        ),
    ],
)
async def test_url_service_maps_fetch_errors(monkeypatch, error: Exception, code: str) -> None:
    def session_factory(*args, **kwargs):
        return _FailingSession(*args, error=error, **kwargs)

    monkeypatch.setattr(aiohttp, "ClientSession", session_factory)

    with pytest.raises(FileValidationError) as exc:
        await UrlService().fetch("https://example.com/article", max_chars=1000, timeout_ms=1000)

    assert exc.value.code == code
