from __future__ import annotations

import asyncio
import re
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

import ssl

import aiohttp

from app.config import settings
from app.services.extractors.pdf_extractor import extract_pdf
from app.services.validation_service import FileValidationError


def _make_connector() -> aiohttp.TCPConnector:
    if settings.verify_ssl:
        return aiohttp.TCPConnector(ssl=True)
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    return aiohttp.TCPConnector(ssl=ssl_context)

ARXIV_RE = re.compile(r"^\d{4}\.\d{4,5}(v\d+)?$|^[a-z-]+(?:\.[A-Z]{2})?/\d{7}(v\d+)?$")
ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


class ArxivService:
    async def get_paper(self, arxiv_id: str) -> dict:
        if not ARXIV_RE.match(arxiv_id):
            raise FileValidationError("UNSUPPORTED_FORMAT", "Invalid ArXiv ID format")

        url = f"https://export.arxiv.org/api/query?id_list={arxiv_id}"
        timeout = aiohttp.ClientTimeout(total=20)
        headers = {"User-Agent": "PretextReader/0.1 (mailto:pretext@example.com)"}
        connector = _make_connector()
        try:
            async with aiohttp.ClientSession(timeout=timeout, headers=headers, connector=connector) as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    payload = await response.text()

                try:
                    root = ET.fromstring(payload)
                except ET.ParseError as exc:
                    raise FileValidationError(
                        "ARXIV_FETCH_FAILED", "ArXiv returned an unreadable feed"
                    ) from exc

                entry = root.find("atom:entry", ATOM_NS)
                if entry is None:
                    raise FileValidationError("EMPTY_CONTENT", "No ArXiv paper found for this ID")

                title = _text(entry, "atom:title")
                abstract = _text(entry, "atom:summary")
                authors = [
                    _text(author, "atom:name")
                    for author in entry.findall("atom:author", ATOM_NS)
                    if _text(author, "atom:name")
                ]
                published = _text(entry, "atom:published")[:10]
                categories = [
                    item.attrib.get("term", "")
                    for item in entry.findall("atom:category", ATOM_NS)
                    if item.attrib.get("term")
                ]
                pdf_url = _pdf_url(entry)
                abstract_text = " ".join(abstract.split())
                full_text = abstract_text
                full_text_source = "abstract"

                if pdf_url:
                    extracted = await self._extract_pdf_full_text(session, pdf_url)
                    if extracted:
                        full_text = extracted
                        full_text_source = "pdf"
        except asyncio.TimeoutError as exc:
            raise FileValidationError("ARXIV_TIMEOUT", "ArXiv fetch timed out") from exc
        except aiohttp.ClientResponseError as exc:
            raise FileValidationError(
                "ARXIV_FETCH_FAILED",
                f"ArXiv returned HTTP {exc.status}",
            ) from exc
        except aiohttp.ClientConnectorError as exc:
            raise FileValidationError(
                "ARXIV_FETCH_FAILED",
                f"Cannot connect to ArXiv — check your network or set VERIFY_SSL=false: {exc}",
            ) from exc
        except aiohttp.ClientError as exc:
            raise FileValidationError(
                "ARXIV_FETCH_FAILED",
                f"ArXiv fetch failed: {exc}",
            ) from exc

        return {
            "arxiv_id": arxiv_id,
            "title": " ".join(title.split()),
            "authors": authors,
            "abstract": abstract_text,
            "full_text": full_text,
            "full_text_source": full_text_source,
            "pdf_url": pdf_url,
            "published": published,
            "categories": categories,
        }

    async def _extract_pdf_full_text(self, session: aiohttp.ClientSession, pdf_url: str) -> str:
        try:
            async with session.get(pdf_url) as response:
                response.raise_for_status()
                content = await response.read()

            if not content.startswith(b"%PDF"):
                return ""

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as temp_file:
                temp_file.write(content)
                temp_path = Path(temp_file.name)

            try:
                text, _metadata = await extract_pdf(temp_path, "utf-8")
                return " ".join(text.split())
            finally:
                temp_path.unlink(missing_ok=True)
        except Exception:
            return ""


def _text(element: ET.Element, path: str) -> str:
    child = element.find(path, ATOM_NS)
    return child.text.strip() if child is not None and child.text else ""


def _pdf_url(entry: ET.Element) -> str | None:
    for link in entry.findall("atom:link", ATOM_NS):
        title = link.attrib.get("title", "").lower()
        media_type = link.attrib.get("type", "").lower()
        href = link.attrib.get("href", "")
        if href and (title == "pdf" or media_type == "application/pdf"):
            return href
    return None
