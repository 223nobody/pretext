from __future__ import annotations

from pathlib import Path


async def extract_txt(file_path: Path, encoding: str) -> tuple[str, dict]:
    text = file_path.read_bytes().decode(encoding, errors="replace")
    return normalize_text(text), {}


def normalize_text(text: str) -> str:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    return "\n".join(lines).strip()
