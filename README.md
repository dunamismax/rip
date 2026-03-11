# rip

`rip` is a self-hosted web app for downloading videos from `yt-dlp` supported sites. Paste a URL, inspect available formats, and queue downloads from a single FastAPI process that serves both the HTML UI and JSON API.

## Features

- Metadata extraction through `yt-dlp`
- Format selection before download
- Output format selection with audio extraction or video remuxing
- Concurrent download queue with cancellation
- Download progress over JSON polling and `/api/ws`
- Server-rendered HTML with plain CSS and minimal JavaScript
- Local-first operation with files written to a configurable download directory

## Prerequisites

- Python 3.12+
- [`uv`](https://docs.astral.sh/uv/) for dependency management
- `yt-dlp`
- `ffmpeg`

macOS example:

```bash
brew install uv yt-dlp ffmpeg
```

## Quick Start

```bash
git clone https://github.com/dunamismax/rip.git
cd rip
cp .env.example .env
uv sync
uv run python -m rip doctor
uv run python -m rip serve --reload
```

Open `http://127.0.0.1:3000`.

## Commands

```bash
uv sync
uv run python -m rip doctor
uv run python -m rip serve --reload
uv run pytest
uv run python -m compileall rip tests
```

## Configuration

Environment variables are optional.

| Variable | Default | Description |
|---|---|---|
| `HOST` | `127.0.0.1` | Bind host for the FastAPI server |
| `PORT` | `3000` | Bind port for the FastAPI server |
| `DOWNLOAD_DIR` | `~/Downloads/Rip` | Output directory for completed downloads |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Maximum simultaneous `yt-dlp` processes |
| `MAX_INCOMPLETE_DOWNLOADS` | `50` | Combined active + queued download cap |
| `YTDLP_PATH` | `yt-dlp` | Path to the `yt-dlp` executable |
| `FFMPEG_PATH` | `ffmpeg` | Path to the `ffmpeg` executable passed to `yt-dlp --ffmpeg-location` |
| `TRUSTED_PROXY_HOSTS` | empty | Comma-separated proxy IPs allowed to supply `X-Forwarded-For` |

When you pick an output format in the UI or API, audio targets use `yt-dlp --extract-audio` and video targets use `yt-dlp --remux-video`. Selecting the source format's native extension skips post-processing.

## API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/extract` | Extract metadata for a URL |
| `POST` | `/api/download` | Queue a download |
| `DELETE` | `/api/download/{id}` | Cancel a queued or active download |
| `GET` | `/api/downloads` | List all known downloads |
| `DELETE` | `/api/downloads/completed` | Remove finished downloads from memory |
| `GET` | `/health` | Health check |
| `WS` | `/api/ws` | Progress and snapshot updates |

## Verification

```bash
uv run python -m compileall rip tests
uv run pytest
```

These checks do not require live network downloads. Use `uv run python -m rip doctor` before starting the app to confirm `yt-dlp`, `ffmpeg`, and the download directory are ready.

## Architecture

```text
Browser
  ↕ HTML forms + JSON API + WebSocket
FastAPI app
  ↕ asyncio subprocesses
yt-dlp + ffmpeg
  → DOWNLOAD_DIR
```

## License

[MIT](LICENSE)
