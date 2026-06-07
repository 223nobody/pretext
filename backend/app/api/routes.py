from __future__ import annotations

from fastapi import APIRouter

from app.api import arxiv, cache, file_upload, samples, text_extract, url_fetch

api_router = APIRouter()


@api_router.get("/health")
async def health() -> dict:
    return {"success": True, "data": {"status": "ok", "service": "pretext-reader"}}


api_router.include_router(file_upload.router, prefix="/file", tags=["file"])
api_router.include_router(text_extract.router, prefix="/text", tags=["text"])
api_router.include_router(arxiv.router, prefix="/arxiv", tags=["arxiv"])
api_router.include_router(url_fetch.router, prefix="/url", tags=["url"])
api_router.include_router(samples.router, prefix="/samples", tags=["samples"])
api_router.include_router(cache.router, prefix="/cache", tags=["cache"])
