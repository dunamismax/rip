from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator

from .download_options import normalize_extension, output_kind, validate_output_extension


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
    output_extensions: list[str] = Field(default_factory=list)


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
    source_ext: str | None = None
    has_video: bool | None = None
    has_audio: bool | None = None
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
    source_ext: str | None = None
    has_video: bool | None = None
    has_audio: bool | None = None

    @field_validator("ext")
    @classmethod
    def normalize_ext(cls, value: str) -> str:
        normalized = normalize_extension(value)
        if not normalized:
            raise ValueError("Output format is required.")
        return normalized

    @field_validator("source_ext")
    @classmethod
    def normalize_source_ext(cls, value: str | None) -> str | None:
        normalized = normalize_extension(value)
        return normalized or None

    @model_validator(mode="after")
    def validate_requested_output(self) -> DownloadRequest:
        self.ext = validate_output_extension(self.ext, source_ext=self.source_ext)
        if self.source_ext and self.ext == self.source_ext:
            return self

        kind = output_kind(self.ext)
        if kind == "video" and self.has_video is False:
            raise ValueError("The selected format does not contain video.")
        if kind == "audio" and self.has_audio is False:
            raise ValueError("The selected format does not contain audio.")
        return self
