from __future__ import annotations

import asyncio
from urllib.parse import urlparse

import aiohttp
from bs4 import BeautifulSoup

from app.config import settings
from app.services.security_service import sanitize_text
from app.services.validation_service import FileValidationError


class UrlService:
    async def fetch(self, url: str, max_chars: int, timeout_ms: int) -> dict:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            raise FileValidationError("UNSUPPORTED_FORMAT", "Only http and https URLs are supported")

        timeout = aiohttp.ClientTimeout(total=timeout_ms / 1000)
        headers = {"User-Agent": settings.url_fetch_user_agent}
        try:
            async with aiohttp.ClientSession(timeout=timeout, headers=headers) as session:
                async with session.get(url) as response:
                    response.raise_for_status()
                    html = await response.text(errors="replace")
        except asyncio.TimeoutError as exc:
            raise FileValidationError("URL_TIMEOUT", "URL fetch timed out") from exc
        except aiohttp.ClientResponseError as exc:
            raise FileValidationError(
                "URL_FETCH_FAILED",
                f"URL returned HTTP {exc.status}",
            ) from exc
        except aiohttp.ClientError as exc:
            raise FileValidationError("URL_FETCH_FAILED", "URL fetch failed") from exc

        metadata_soup = BeautifulSoup(html, "html.parser")
        title = metadata_soup.title.get_text(" ", strip=True) if metadata_soup.title else ""
        author = _meta_content(metadata_soup, "author") or _meta_content(metadata_soup, "article:author")
        site_name = _meta_content(metadata_soup, "og:site_name") or parsed.netloc

        try:
            from readability import Document

            doc = Document(html)
            title = doc.short_title() or ""
            html = doc.summary(html_partial=True)
        except Exception:
            pass

        soup = BeautifulSoup(html, "html.parser")
        for element in soup(["script", "style", "noscript", "iframe"]):
            element.decompose()
        if not title and soup.title:
            title = soup.title.get_text(" ", strip=True)

        text = sanitize_text(soup.get_text("\n", strip=True))
        if not text:
            raise FileValidationError("EMPTY_CONTENT", "No readable article text was found")
        text = text[:max_chars]
        return {
            "url": url,
            "title": title or site_name,
            "author": author,
            "site_name": site_name,
            "text": text,
            "char_count": len(text),
            "excerpt": text[:500],
        }


def _meta_content(soup: BeautifulSoup, key: str) -> str:
    tag = soup.find(attrs={"name": key}) or soup.find(attrs={"property": key})
    value = tag.get("content", "") if tag else ""
    return value.strip()
