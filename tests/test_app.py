from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient

from rip.app import create_app
from rip.config import Settings
from rip.models import VideoMetadata
from rip.ytdlp import YtdlpError


def build_settings() -> Settings:
    return Settings(
        host="127.0.0.1",
        port=3000,
        download_dir=(Path.cwd() / ".tmp-downloads"),
        max_concurrent_downloads=1,
        max_incomplete_downloads=50,
        ytdlp_path="yt-dlp",
        ffmpeg_path="ffmpeg",
    )


async def fake_extractor(url: str, _settings: Settings) -> VideoMetadata:
    if "bad" in url:
        raise YtdlpError("boom")
    return VideoMetadata(
        id="abc123",
        title="Example Video",
        thumbnail=None,
        duration=30,
        uploader="Example",
        upload_date="20260101",
        view_count=1,
        description=None,
        webpage_url=url,
        extractor="Example",
        formats=[],
    )


def test_health() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


def test_downloads_initially_empty() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.get("/api/downloads")
        assert response.status_code == 200
        assert response.json() == {"downloads": []}


def test_invalid_extract_json() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/extract", content="{", headers={"content-type": "application/json"})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid JSON body."


def test_invalid_extract_url() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/extract", json={"url": "not-a-url"})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid URL."


def test_invalid_download_payload() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.post("/api/download", json={})
        assert response.status_code == 400
        assert response.json()["error"] == "Invalid download request."


def test_oversized_body_rejected() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        oversized = "x" * (1024 * 1024 + 1)
        body = {"url": "https://example.com", "formatId": oversized, "title": "x"}
        response = client.post("/api/download", json=body)
        assert response.status_code == 413
        assert response.json()["error"] == "Request body too large."


def test_cancel_missing_download() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.delete("/api/download/missing")
        assert response.status_code == 404
        assert response.json()["error"] == "Download not found."


def test_clear_completed() -> None:
    with TestClient(create_app(build_settings(), extractor=fake_extractor)) as client:
        response = client.delete("/api/downloads/completed")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
