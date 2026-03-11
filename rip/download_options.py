from __future__ import annotations

from typing import Literal

AudioExtension = Literal["aac", "alac", "flac", "m4a", "mp3", "opus", "vorbis", "wav"]
VideoExtension = Literal["avi", "flv", "gif", "mkv", "mov", "mp4", "webm"]
OutputKind = Literal["audio", "video"]

AUDIO_EXTENSIONS: tuple[AudioExtension, ...] = ("aac", "alac", "flac", "m4a", "mp3", "opus", "vorbis", "wav")
VIDEO_EXTENSIONS: tuple[VideoExtension, ...] = ("avi", "flv", "gif", "mkv", "mov", "mp4", "webm")
AUDIO_EXTENSION_SET = set(AUDIO_EXTENSIONS)
VIDEO_EXTENSION_SET = set(VIDEO_EXTENSIONS)


def normalize_extension(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip().lower().lstrip(".")


def validate_output_extension(value: str, *, source_ext: str | None = None) -> str:
    normalized = normalize_extension(value)
    if not normalized:
        raise ValueError("Output format is required.")

    normalized_source = normalize_extension(source_ext)
    if normalized == normalized_source:
        return normalized
    if normalized in AUDIO_EXTENSION_SET or normalized in VIDEO_EXTENSION_SET:
        return normalized
    raise ValueError(f"Unsupported output format '{normalized}'.")


def output_kind(value: str) -> OutputKind:
    normalized = validate_output_extension(value)
    if normalized in AUDIO_EXTENSION_SET:
        return "audio"
    if normalized in VIDEO_EXTENSION_SET:
        return "video"
    raise ValueError(f"Unsupported output format '{normalized}'.")


def output_extensions(*, source_ext: str | None, has_video: bool, has_audio: bool) -> list[str]:
    values: list[str] = []
    normalized_source = normalize_extension(source_ext)
    if normalized_source:
        values.append(normalized_source)
    if has_video:
        values.extend(VIDEO_EXTENSIONS)
    if has_audio:
        values.extend(AUDIO_EXTENSIONS)

    seen: set[str] = set()
    ordered: list[str] = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        ordered.append(value)
    return ordered
