from __future__ import annotations

from pathlib import Path

from bs4 import BeautifulSoup


async def extract_epub(file_path: Path, _encoding: str) -> tuple[str, dict]:
    from ebooklib import ITEM_DOCUMENT, epub

    book = epub.read_epub(str(file_path))
    parts: list[str] = []
    metadata = {}
    title = book.get_metadata("DC", "title")
    creator = book.get_metadata("DC", "creator")
    if title:
        metadata["title"] = title[0][0]
    if creator:
        metadata["author"] = [item[0] for item in creator]

    for item in book.get_items_of_type(ITEM_DOCUMENT):
        soup = BeautifulSoup(item.get_content(), "html.parser")
        for element in soup(["script", "style"]):
            element.decompose()
        text = soup.get_text("\n", strip=True)
        if text:
            parts.append(text)
    return "\n\n".join(parts), metadata
