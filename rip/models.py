from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.title() for part in rest)


class CamelModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


DownloadStatus = Literal["queued", "downloading", "processing", "completed", "failed", "cancelled"]


class VideoFormat(CamelModel):
    format_id: str
    ext: str = "mp4"
    resolution: str | None = None
    filesize: int | None = None
    filesize_approx: int | None = None
    vcodec: str | None = None
    acodec: str | None = None
    fps: float | None = None
    tbr: float | None = None
    format_note: str | None = None
    has_video: bool
    has_audio: bool


class VideoMetadata(CamelModel):
    id: str
    title: str
    thumbnail: str | None = None
    duration: int | None = None
    uploader: str | None = None
    upload_date: str | None = None
    view_count: int | None = None
    description: str | None = None
    webpage_url: str
    extractor: str
    formats: list[VideoFormat]


class DownloadProgress(CamelModel):
    downloaded_bytes: int = 0
    total_bytes: int | None = None
    speed: float | None = None
    eta: int | None = None
    percentage: float = 0.0


class DownloadItem(CamelModel):
    id: str
    url: str
    title: str
    thumbnail: str | None = None
    format_id: str
    ext: str = "mp4"
    output_path: str | None = None
    status: DownloadStatus
    progress: DownloadProgress
    created_at: int
    completed_at: int | None = None
    error: str | None = None


class ExtractRequest(CamelModel):
    url: HttpUrl


class DownloadRequest(CamelModel):
    url: HttpUrl
    format_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    thumbnail: str | None = None
    ext: str = Field(default="mp4", min_length=1)
