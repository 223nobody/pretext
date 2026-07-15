"""Structured JSON logging middleware with request ID tracking."""

from __future__ import annotations

import json
import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class _JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "timestamp": self.formatTime(record),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if hasattr(record, "request_id"):
            entry["request_id"] = record.request_id
        if hasattr(record, "client_ip"):
            entry["client_ip"] = record.client_ip
        if record.exc_info and record.exc_info[1]:
            entry["exception"] = str(record.exc_info[1])
        return json.dumps(entry, ensure_ascii=False)


def setup_json_logging() -> None:
    """Configure the root logger to emit JSON-structured log lines."""
    handler = logging.StreamHandler()
    handler.setFormatter(_JsonFormatter())
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.INFO)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Injects an X-Request-ID header (generating one if absent) and logs every
    request with its method, path, status code, and duration in milliseconds.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        request_id = request.headers.get("X-Request-ID", uuid.uuid4().hex[:12])
        request.state.request_id = request_id

        start = time.monotonic()
        response = await call_next(request)
        duration_ms = (time.monotonic() - start) * 1000

        response.headers["X-Request-ID"] = request_id

        # Attach extra context to the logger via a LoggerAdapter-style approach
        log = logging.getLogger("pretext.request")
        log.info(
            "%s %s → %s (%dms)",
            request.method,
            request.url.path,
            response.status_code,
            round(duration_ms),
        )

        # Warn about slow requests (> 3 seconds)
        if duration_ms > 3000:
            log.warning(
                "Slow request: %s %s took %dms",
                request.method,
                request.url.path,
                round(duration_ms),
            )

        return response
