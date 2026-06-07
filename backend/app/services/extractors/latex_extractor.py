from __future__ import annotations

import re
from pathlib import Path


async def extract_latex(file_path: Path, encoding: str) -> tuple[str, dict]:
    source = file_path.read_bytes().decode(encoding, errors="replace")
    metadata = {}
    title_match = re.search(r"\\title\{([^}]*)\}", source, re.DOTALL)
    if title_match:
        metadata["title"] = title_match.group(1).strip()

    try:
        from pylatexenc.latex2text import LatexNodes2Text

        text = LatexNodes2Text().latex_to_text(source)
    except Exception:
        text = re.sub(r"\\[a-zA-Z]+\*?(?:\[[^\]]*\])?(?:\{([^}]*)\})?", r"\1", source)
        text = re.sub(r"[%].*", "", text)
    return text, metadata
