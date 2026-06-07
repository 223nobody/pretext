from __future__ import annotations

from app.config import settings


def test_default_allowed_origins_include_dev_and_compose_frontends() -> None:
    assert "http://localhost:5173" in settings.allowed_origins
    assert "http://127.0.0.1:5173" in settings.allowed_origins
    assert "http://localhost:3000" in settings.allowed_origins
    assert "http://127.0.0.1:3000" in settings.allowed_origins


def test_default_url_fetch_user_agent_has_no_release_placeholder() -> None:
    assert settings.url_fetch_user_agent == "PretextReader/0.1"
    assert "example.local" not in settings.url_fetch_user_agent
