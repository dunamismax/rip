# Rip

A self-hosted web app for downloading videos from 1700+ sites. Paste a URL, pick a format, and download. Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org).

Supports YouTube, Vimeo, Internet Archive, Twitter/X, Reddit, TikTok, Twitch, SoundCloud, Bandcamp, and [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

## Features

- **Universal video extraction** — paste any supported URL, get title, thumbnail, available formats
- **Format selection** — choose grouped video+audio, video-only, or audio-only options without hidden default mismatches
- **Real-time progress** — live download speed, ETA, and percentage via WebSocket
- **Concurrent downloads** — queue multiple downloads with configurable concurrency (default 3)
- **Bounded work queue** — caps active + queued downloads at 50 to keep the app responsive
- **Dark/light theme** — toggle with localStorage persistence
- **Cancel & cleanup** — cancel active downloads, clear finished items, auto-expire old finished entries from memory

## Prerequisites

[Bun](https://bun.sh) runtime plus two CLI tools:

```bash
# macOS
brew install yt-dlp ffmpeg

# Verify
bun run doctor
```

`bun run doctor` exits non-zero until `yt-dlp`, `ffmpeg`, and the configured download directory are ready.

## Quick Start

```bash
git clone https://github.com/dunamismax/rip.git
cd rip
bun install
# optional: customize ports, download path, or API origin
cp .env.example .env
bun run doctor
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The API runs on port 3001. In dev, React Router proxies `/api` to the API server; in production, the SPA talks to the API directly on port 3001 by default.

## Production

```bash
bun run build
bun run start
```

`bun run start` serves the built SPA on `WEB_PORT` (default `3000`) and the API on `PORT` (default `3001`). If the browser will reach the API on a different origin, set `WEB_ORIGIN` for API CORS and `VITE_RIP_API_URL` before `bun run build`.

## Commands

| Command | Description |
|---|---|
| `bun run dev` | Start frontend + API dev servers |
| `bun run dev:web` | Start only the Vite dev server |
| `bun run dev:api` | Start only the API server (with watch) |
| `bun run build` | Production build |
| `bun run start` | Start production API (`:3001`) + static web server (`:3000`) |
| `bun run lint` | Biome lint check |
| `bun run format` | Biome auto-format |
| `bun run typecheck` | TypeScript type check |
| `bun run doctor` | Verify prerequisites and that the download directory is writable |
| `bun run smoke` | Smoke test the API contract in-process; add `RIP_BASE_URL` to validate a running server too |

## Configuration

Environment variables (optional — defaults work out of the box):

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | API server port |
| `WEB_PORT` | `3000` | Static web server port for `bun run start` |
| `WEB_ORIGIN` | `http://localhost:3000` | Allowed browser origin for API CORS in production |
| `VITE_RIP_API_URL` | inferred | Build-time override for the frontend API origin |
| `DOWNLOAD_DIR` | `~/Downloads/Rip` | Where downloaded files are saved |
| `MAX_CONCURRENT_DOWNLOADS` | `3` | Max simultaneous downloads |
| `YTDLP_PATH` | `yt-dlp` | Path to yt-dlp binary |

Copy `.env.example` to `.env` to customize.

## Verification

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run smoke
```

`bun run smoke` runs in-process by default so it works in CI and restricted environments. To also validate a running API server and WebSocket endpoint, set `RIP_BASE_URL`, for example:

```bash
RIP_BASE_URL=http://localhost:3001 bun run smoke
```

## Architecture

```
Browser (React SPA on :3000)
    ↕ REST + WebSocket
Hono API (Bun.serve on :3001)
    ↕ subprocess (spawn)
yt-dlp + ffmpeg
    → ~/Downloads/Rip/
```

### Stack

- **Runtime**: Bun
- **Frontend**: React 19 · React Router 7 (SPA mode, `ssr: false`) · Tailwind CSS v4
- **Backend**: Hono on Bun.serve() · WebSocket via `hono/bun`
- **Validation**: Zod
- **Tooling**: Biome (lint + format) · TypeScript 5.9

### Project Structure

```
app/                    # React frontend
  components/           # UI components (url-input, video-card, download-queue, etc.)
  hooks/                # Custom hooks (use-downloads, use-websocket, use-theme)
  lib/                  # Utilities, API client, shared type re-exports
  routes/home.tsx       # Main page
backend/                # Hono API server
  index.ts              # Server entry + WebSocket
  routes.ts             # API route handlers
  download-manager.ts   # Download queue + concurrency control
  ytdlp.ts              # yt-dlp subprocess wrapper
  env.ts                # Environment config (Zod)
  rate-limit.ts         # Lightweight per-IP rate limiting
shared/
  types.ts              # Shared type definitions
scripts/                # CLI tools
  cli.ts                # doctor command
  smoke.ts              # In-process API smoke tests, optional live-server mode
```

### API

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/extract` | Extract video metadata from URL |
| `POST` | `/api/download` | Start a download |
| `DELETE` | `/api/download/:id` | Cancel a download |
| `GET` | `/api/downloads` | List all downloads |
| `DELETE` | `/api/downloads/completed` | Clear finished downloads |
| `GET` | `/api/ws` | WebSocket for real-time progress |
| `GET` | `/health` | Health check |

## License

[MIT](LICENSE)
