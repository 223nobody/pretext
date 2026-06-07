from __future__ import annotations

from fastapi import APIRouter

from app.services.arxiv_service import ArxivService

router = APIRouter()
arxiv_service = ArxivService()


@router.get("/{arxiv_id}")
async def get_arxiv(arxiv_id: str) -> dict:
    data = await arxiv_service.get_paper(arxiv_id)
    return {"success": True, "data": data}
