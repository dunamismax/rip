from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _read_int(name: str, default: int, *, minimum: int | None = None, maximum: int | None = None) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        value = default
    else:
        value = int(raw)

    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be >= {minimum}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be <= {maximum}")
    return value


def _read_csv(name: str) -> tuple[str, ...]:
    raw = os.getenv(name, "").strip()
    if not raw:
        return ()
    return tuple(part.strip() for part in raw.split(",") if part.strip())


@dataclass(slots=True)
class Settings:
    host: str
    port: int
    download_dir: Path
    max_concurrent_downloads: int
    max_incomplete_downloads: int
    ytdlp_path: str
    ffmpeg_path: str
    trusted_proxy_hosts: tuple[str, ...] = ()
    request_body_limit_bytes: int = 1024 * 1024
    completed_expiry_seconds: int = 60 * 60


def load_settings() -> Settings:
    download_dir = Path(os.getenv("DOWNLOAD_DIR", "~/Downloads/Rip")).expanduser()
    return Settings(
        host=os.getenv("HOST", "127.0.0.1"),
        port=_read_int("PORT", 3000, minimum=1),
        download_dir=download_dir,
        max_concurrent_downloads=_read_int("MAX_CONCURRENT_DOWNLOADS", 3, minimum=1, maximum=10),
        max_incomplete_downloads=_read_int("MAX_INCOMPLETE_DOWNLOADS", 50, minimum=1, maximum=500),
        ytdlp_path=os.getenv("YTDLP_PATH", "yt-dlp").strip() or "yt-dlp",
        ffmpeg_path=os.getenv("FFMPEG_PATH", "ffmpeg").strip() or "ffmpeg",
        trusted_proxy_hosts=_read_csv("TRUSTED_PROXY_HOSTS"),
    )
