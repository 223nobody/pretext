from __future__ import annotations

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import api_router
from app.config import settings
from app.middleware.logging import RequestLoggingMiddleware, setup_json_logging
from app.middleware.rate_limit import RateLimitMiddleware
from app.services.validation_service import FileValidationError


def create_app() -> FastAPI:
    setup_json_logging()

    app = FastAPI(title=settings.app_name, version="0.1.0")

    # Middleware order: outermost first → innermost last
    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.api_prefix)

    @app.exception_handler(FileValidationError)
    async def file_validation_exception_handler(
        _request: Request, exc: FileValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"success": False, "error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "success": False,
                "error": {
                    "code": detail.get("code", "HTTP_ERROR"),
                    "message": detail.get("message", "Request failed"),
                },
            },
        )

    return app


app = create_app()
