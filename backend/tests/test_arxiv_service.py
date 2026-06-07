from __future__ import annotations

import asyncio
import xml.etree.ElementTree as ET

import aiohttp
import pytest

from app.services.arxiv_service import ATOM_NS, ArxivService, _pdf_url
from app.services.validation_service import FileValidationError


class _FailingResponse:
    def __init__(self, error: Exception):
        self.error = error

    async def __aenter__(self):
        raise self.error

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False


class _TextResponse:
    def __init__(self, text: str):
        self._text = text

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def raise_for_status(self) -> None:
        return None

    async def text(self) -> str:
        return self._text


class _FailingSession:
    def __init__(self, *args, error: Exception, **kwargs):
        self.error = error

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def get(self, _url: str):
        return _FailingResponse(self.error)


class _TextSession:
    def __init__(self, *args, text: str, **kwargs):
        self.text = text

    async def __aenter__(self):
        return self

    async def __aexit__(self, _exc_type, _exc, _tb):
        return False

    def get(self, _url: str):
        return _TextResponse(self.text)


def test_pdf_url_prefers_atom_pdf_link() -> None:
    entry = ET.fromstring(
        """
        <entry xmlns="http://www.w3.org/2005/Atom">
          <link href="https://arxiv.org/abs/2301.12345" rel="alternate" />
          <link href="https://arxiv.org/pdf/2301.12345" title="pdf" type="application/pdf" />
        </entry>
        """
    )

    assert _pdf_url(entry) == "https://arxiv.org/pdf/2301.12345"


def test_pdf_url_returns_none_without_pdf_link() -> None:
    entry = ET.Element(f"{{{ATOM_NS['atom']}}}entry")

    assert _pdf_url(entry) is None


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (asyncio.TimeoutError(), "ARXIV_TIMEOUT"),
        (aiohttp.ClientConnectionError("offline"), "ARXIV_FETCH_FAILED"),
        (
            aiohttp.ClientResponseError(
                request_info=None,
                history=(),
                status=502,
                message="bad gateway",
            ),
            "ARXIV_FETCH_FAILED",
        ),
    ],
)
async def test_arxiv_service_maps_fetch_errors(monkeypatch, error: Exception, code: str) -> None:
    def session_factory(*args, **kwargs):
        return _FailingSession(*args, error=error, **kwargs)

    monkeypatch.setattr(aiohttp, "ClientSession", session_factory)

    with pytest.raises(FileValidationError) as exc:
        await ArxivService().get_paper("2301.12345")

    assert exc.value.code == code


async def test_arxiv_service_maps_malformed_feed(monkeypatch) -> None:
    def session_factory(*args, **kwargs):
        return _TextSession(*args, text="<feed", **kwargs)

    monkeypatch.setattr(aiohttp, "ClientSession", session_factory)

    with pytest.raises(FileValidationError) as exc:
        await ArxivService().get_paper("2301.12345")

    assert exc.value.code == "ARXIV_FETCH_FAILED"
