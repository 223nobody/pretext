from __future__ import annotations

from fastapi import APIRouter

from app.services.cache_service import CacheService

router = APIRouter()
cache_service = CacheService()


@router.delete("")
async def cleanup_cache() -> dict:
    data = cache_service.cleanup_expired()
    return {"success": True, "data": data}


@router.delete("/{key}")
async def delete_cache_entry(key: str) -> dict:
    deleted = cache_service.delete(key)
    return {"success": True, "data": {"key": key, "deleted": deleted}}
