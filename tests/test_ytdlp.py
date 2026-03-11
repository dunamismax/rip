from __future__ import annotations

from pathlib import Path

from tests.support import build_settings
from rip.ytdlp import build_download_args


def test_build_download_args_uses_ffmpeg_location_and_remuxes_video() -> None:
    settings = build_settings(ffmpeg_path="/opt/homebrew/bin/ffmpeg")

    args = build_download_args(
        settings,
        "https://example.com/watch?v=abc123",
        "137+140",
        Path("/tmp/downloads"),
        "mkv",
        source_ext="mp4",
        has_video=True,
        has_audio=True,
    )

    assert "--ffmpeg-location" in args
    assert args[args.index("--ffmpeg-location") + 1] == "/opt/homebrew/bin/ffmpeg"
    assert "--remux-video" in args
    assert args[args.index("--remux-video") + 1] == "mkv"
    assert "--no-playlist" in args


def test_build_download_args_extracts_audio_when_requested() -> None:
    args = build_download_args(
        build_settings(),
        "https://example.com/watch?v=abc123",
        "251",
        Path("/tmp/downloads"),
        "mp3",
        source_ext="webm",
        has_video=False,
        has_audio=True,
    )

    assert "--extract-audio" in args
    assert args[args.index("--audio-format") + 1] == "mp3"


def test_build_download_args_skips_postprocessing_when_source_matches_output() -> None:
    args = build_download_args(
        build_settings(),
        "https://example.com/watch?v=abc123",
        "22",
        Path("/tmp/downloads"),
        "mp4",
        source_ext="mp4",
        has_video=True,
        has_audio=True,
    )

    assert "--extract-audio" not in args
    assert "--remux-video" not in args
