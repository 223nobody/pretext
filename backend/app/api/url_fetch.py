from __future__ import annotations

from fastapi import APIRouter

from app.models.requests import UrlFetchRequest
from app.services.url_service import UrlService

router = APIRouter()
url_service = UrlService()


@router.post("/fetch")
async def fetch_url(request: UrlFetchRequest) -> dict:
    data = await url_service.fetch(
        url=str(request.url),
        max_chars=request.options.max_chars,
        timeout_ms=request.options.timeout_ms,
    )
    return {"success": True, "data": data}
