from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup
from markdown_it import MarkdownIt


async def extract_markdown(file_path: Path, encoding: str) -> tuple[str, dict]:
    markdown = file_path.read_bytes().decode(encoding, errors="replace")
    html = MarkdownIt("commonmark").render(markdown)
    soup = BeautifulSoup(html, "html.parser")
    title = ""
    heading = soup.find(["h1", "h2"])
    if heading:
        title = heading.get_text(" ", strip=True)
    return soup.get_text("\n", strip=True), {"title": title} if title else {}
