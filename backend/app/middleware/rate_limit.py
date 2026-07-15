"""Lightweight in-memory IP-based rate limiter for FastAPI."""

from __future__ import annotations

import time
from collections import defaultdict
from dataclasses import dataclass, field

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


@dataclass
class _Window:
    count: int = 0
    reset_at: float = 0.0


@dataclass
class RateLimitConfig:
    """Rate limit rules keyed by path prefix. Each rule is (max_requests, window_seconds)."""

    rules: dict[str, tuple[int, int]] = field(default_factory=lambda: {
        "/api/v1/file/upload": (10, 60),   # 10 uploads per minute
        "/api/v1/url/fetch": (20, 60),     # 20 URL fetches per minute
        "/api/v1/arxiv": (30, 60),         # 30 ArXiv lookups per minute
        "/api/v1/text/extract": (30, 60),  # 30 text extractions per minute
    })

    # Fallback for paths not in the rules dict
    default_limit: tuple[int, int] = (60, 60)  # 60 requests per minute


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple sliding-window rate limiter keyed by client IP."""

    def __init__(self, app, config: RateLimitConfig | None = None):
        super().__init__(app)
        self.config = config or RateLimitConfig()
        self._store: dict[str, dict[str, _Window]] = defaultdict(
            lambda: defaultdict(_Window),
        )

    async def dispatch(self, request: Request, call_next):
        client_ip = _get_client_ip(request)
        path = request.url.path

        # Determine applicable limit
        limit_rule = self.config.default_limit
        for prefix, rule in self.config.rules.items():
            if path.startswith(prefix):
                limit_rule = rule
                break

        max_requests, window_seconds = limit_rule

        # Check / update window
        now = time.monotonic()
        window = self._store[client_ip][path]

        if now >= window.reset_at:
            window.count = 0
            window.reset_at = now + window_seconds

        window.count += 1

        if window.count > max_requests:
            retry_after = int(window.reset_at - now)
            return JSONResponse(
                status_code=429,
                content={
                    "success": False,
                    "error": {
                        "code": "RATE_LIMITED",
                        "message": (
                            f"Too many requests to {path}. "
                            f"Limit: {max_requests} per {window_seconds}s. "
                            f"Retry after {retry_after}s."
                        ),
                    },
                },
                headers={"Retry-After": str(retry_after)},
            )

        # Clean up old entries periodically (every ~200 requests)
        if window.count % 200 == 0:
            _prune_store(self._store, now)

        return await call_next(request)


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For header."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _prune_store(store: dict[str, dict[str, _Window]], now: float) -> None:
    """Remove expired windows to prevent memory leaks."""
    stale_ips: list[str] = []
    for ip, paths in store.items():
        stale_paths: list[str] = [
            p for p, w in paths.items() if now >= w.reset_at
        ]
        for p in stale_paths:
            del paths[p]
        if not paths:
            stale_ips.append(ip)
    for ip in stale_ips:
        del store[ip]
