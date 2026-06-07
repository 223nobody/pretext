from __future__ import annotations

from fastapi import APIRouter

from app.services.samples_data import SAMPLES
from app.services.validation_service import FileValidationError

router = APIRouter()


@router.get("")
async def list_samples() -> dict:
    data = [
        {
            "id": item["id"],
            "title": item["title"],
            "author": item["author"],
            "category": item["category"],
            "excerpt": item["text"][:180],
        }
        for item in SAMPLES
    ]
    return {"success": True, "data": data}


@router.get("/{sample_id}")
async def get_sample(sample_id: str) -> dict:
    for item in SAMPLES:
        if item["id"] == sample_id:
            return {"success": True, "data": item}
    raise FileValidationError("EMPTY_CONTENT", "Sample not found")
