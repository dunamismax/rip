from __future__ import annotations

import asyncio
import json
import shutil
from pathlib import Path
from typing import Any

from .config import Settings
from .download_options import normalize_extension, output_extensions, output_kind, validate_output_extension
from .models import VideoFormat, VideoMetadata

PROGRESS_PREFIX = "rip-progress:"
OUTPUT_PREFIX = "rip-output:"


class YtdlpError(RuntimeError):
    pass


async def extract_metadata(url: str, settings: Settings) -> VideoMetadata:
    process = await asyncio.create_subprocess_exec(
        settings.ytdlp_path,
        "--dump-single-json",
        "--no-download",
        "--no-playlist",
        "--no-warnings",
        url,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        message = stderr.decode("utf-8", errors="replace").strip() or "yt-dlp failed to extract metadata."
        raise YtdlpError(message)

    try:
        raw = json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as exc:
        raise YtdlpError("Failed to parse yt-dlp output.") from exc

    return map_metadata(raw)


def build_download_args(
    settings: Settings,
    url: str,
    format_id: str,
    output_dir: Path,
    preferred_ext: str,
    *,
    source_ext: str | None = None,
    has_video: bool | None = None,
    has_audio: bool | None = None,
) -> list[str]:
    output_template = str(output_dir / "%(title).200s [%(id)s].%(ext)s")
    args = [
        settings.ytdlp_path,
        "-f",
        format_id,
        "-o",
        output_template,
        "--ffmpeg-location",
        settings.ffmpeg_path,
        "--newline",
        "--progress-template",
        (
            "download:"
            f"{PROGRESS_PREFIX}"
            "%(progress.downloaded_bytes)s|%(progress.total_bytes)s|%(progress.total_bytes_estimate)s|"
            "%(progress.speed)s|%(progress.eta)s|%(progress.status)s"
        ),
        "--print",
        f"after_move:{OUTPUT_PREFIX}%(filepath)s",
        "--no-warnings",
        "--no-playlist",
        "--restrict-filenames",
    ]
    args.extend(
        _build_output_args(
            preferred_ext,
            source_ext=source_ext,
            has_video=has_video,
            has_audio=has_audio,
        )
    )
    args.append(url)
    return args


def parse_progress_line(line: str) -> dict[str, Any] | None:
    parts = line.split("|")
    if len(parts) < 6:
        return None

    downloaded_bytes = _parse_num(parts[0]) or 0
    total_bytes = _parse_num(parts[1])
    total_bytes_estimate = _parse_num(parts[2])
    speed = _parse_num(parts[3])
    eta = _parse_num(parts[4])
    effective_total = total_bytes or total_bytes_estimate
    percentage = 0.0
    if effective_total and effective_total > 0:
        percentage = min(100.0, round((downloaded_bytes / effective_total) * 1000) / 10)

    return {
        "downloaded_bytes": int(downloaded_bytes),
        "total_bytes": int(effective_total) if effective_total else None,
        "speed": speed,
        "eta": int(eta) if eta is not None else None,
        "percentage": percentage,
    }


def map_metadata(raw: dict[str, Any]) -> VideoMetadata:
    formats = [
        mapped
        for entry in raw.get("formats", [])
        if isinstance(entry, dict)
        for mapped in [map_format(entry)]
        if mapped.format_id != "storyboard" and "storyboard" not in (mapped.format_note or "")
    ]

    duration = raw.get("duration")
    view_count = raw.get("view_count")
    return VideoMetadata(
        id=str(raw.get("id") or ""),
        title=str(raw.get("title") or "Untitled"),
        thumbnail=_as_string(raw.get("thumbnail")),
        duration=int(duration) if isinstance(duration, (int, float)) else None,
        uploader=_as_string(raw.get("uploader")) or _as_string(raw.get("channel")),
        upload_date=_as_string(raw.get("upload_date")),
        view_count=int(view_count) if isinstance(view_count, (int, float)) else None,
        description=_as_string(raw.get("description")),
        webpage_url=str(raw.get("webpage_url") or raw.get("url") or ""),
        extractor=str(raw.get("extractor_key") or raw.get("extractor") or "unknown"),
        formats=formats,
    )


def map_format(raw: dict[str, Any]) -> VideoFormat:
    vcodec = _as_string(raw.get("vcodec"))
    acodec = _as_string(raw.get("acodec"))
    has_video = bool(vcodec and vcodec != "none")
    has_audio = bool(acodec and acodec != "none")
    ext = str(raw.get("ext") or "mp4")

    return VideoFormat(
        format_id=str(raw.get("format_id") or ""),
        ext=ext,
        resolution=_as_string(raw.get("resolution")),
        filesize=_as_int(raw.get("filesize")),
        filesize_approx=_as_int(raw.get("filesize_approx")),
        vcodec=vcodec if has_video else None,
        acodec=acodec if has_audio else None,
        fps=_as_float(raw.get("fps")),
        tbr=_as_float(raw.get("tbr")),
        format_note=_as_string(raw.get("format_note")),
        has_video=has_video,
        has_audio=has_audio,
        output_extensions=output_extensions(source_ext=ext, has_video=has_video, has_audio=has_audio),
    )


async def check_ytdlp(settings: Settings) -> str | None:
    return await _check_binary([settings.ytdlp_path, "--version"])


async def check_ffmpeg(settings: Settings) -> str | None:
    return await _check_binary([settings.ffmpeg_path, "-version"])


def _build_output_args(
    preferred_ext: str,
    *,
    source_ext: str | None,
    has_video: bool | None,
    has_audio: bool | None,
) -> list[str]:
    normalized_ext = validate_output_extension(preferred_ext, source_ext=source_ext)
    normalized_source = normalize_extension(source_ext)
    if normalized_source and normalized_ext == normalized_source:
        return []

    kind = output_kind(normalized_ext)
    if kind == "audio":
        if has_audio is False:
            raise ValueError("The selected format does not contain audio.")
        return ["--extract-audio", "--audio-format", normalized_ext]

    if has_video is False:
        raise ValueError("The selected format does not contain video.")
    return ["--remux-video", normalized_ext]


async def _check_binary(argv: list[str]) -> str | None:
    if shutil.which(argv[0]) is None and not Path(argv[0]).exists():
        return None

    try:
        process = await asyncio.create_subprocess_exec(
            *argv,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
    except OSError:
        return None

    stdout, _stderr = await process.communicate()
    if process.returncode != 0:
        return None
    return stdout.decode("utf-8", errors="replace").splitlines()[0].strip() or "ok"


def _parse_num(raw: str | None) -> float | None:
    if raw is None:
        return None
    text = raw.strip()
    if not text or text in {"NA", "N/A", "None"}:
        return None
    try:
        return float(text)
    except ValueError:
        return None


def _as_string(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _as_int(value: Any) -> int | None:
    return int(value) if isinstance(value, (int, float)) else None


def _as_float(value: Any) -> float | None:
    return float(value) if isinstance(value, (int, float)) else None
