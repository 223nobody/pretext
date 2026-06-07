from __future__ import annotations

from dataclasses import dataclass

import chardet


@dataclass(frozen=True)
class EncodingDetection:
    encoding: str
    confidence: float


def detect_encoding(raw: bytes) -> EncodingDetection:
    if not raw:
        return EncodingDetection("utf-8", 1.0)

    detected = chardet.detect(raw[:100_000])
    encoding = detected.get("encoding") or "utf-8"
    confidence = float(detected.get("confidence") or 0)

    if encoding.lower() in {"ascii", "us-ascii"}:
        encoding = "utf-8"

    return EncodingDetection(encoding, confidence)
