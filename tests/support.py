from __future__ import annotations

from dataclasses import replace
from pathlib import Path

from rip.config import Settings
from rip.models import VideoMetadata
from rip.ytdlp import YtdlpError


def build_settings(**overrides) -> Settings:
    settings = Settings(
        host="127.0.0.1",
        port=3000,
        download_dir=(Path.cwd() / ".tmp-downloads"),
        max_concurrent_downloads=1,
        max_incomplete_downloads=50,
        ytdlp_path="yt-dlp",
        ffmpeg_path="ffmpeg",
        trusted_proxy_hosts=(),
    )
    return replace(settings, **overrides)


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
