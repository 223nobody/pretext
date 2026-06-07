from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup


async def extract_html(file_path: Path, encoding: str) -> tuple[str, dict]:
    html = file_path.read_bytes().decode(encoding, errors="replace")
    soup = BeautifulSoup(html, "html.parser")
    for element in soup(["script", "style", "noscript", "iframe"]):
        element.decompose()

    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    text = soup.get_text("\n", strip=True)
    return text, {"title": title} if title else {}
