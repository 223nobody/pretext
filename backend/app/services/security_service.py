from __future__ import annotations

import re

import bleach

FORBIDDEN_PATTERNS = [
    re.compile(r"<script[^>]*>.*?</script>", re.IGNORECASE | re.DOTALL),
    re.compile(r"javascript\s*:", re.IGNORECASE),
    re.compile(r"on\w+\s*=\s*[\"'].*?[\"']", re.IGNORECASE | re.DOTALL),
    re.compile(r"<iframe[^>]*>", re.IGNORECASE),
]


def find_unsafe_pattern(text: str) -> str | None:
    for pattern in FORBIDDEN_PATTERNS:
        if pattern.search(text):
            return pattern.pattern
    return None


def sanitize_text(text: str) -> str:
    cleaned = bleach.clean(text, tags=[], attributes={}, strip=True)
    return cleaned.replace("\x00", "").strip()
