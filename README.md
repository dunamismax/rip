# Rip

A self-hosted web app for downloading videos from 1700+ sites. Paste a URL, pick a format, and download. Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and [ffmpeg](https://ffmpeg.org).

Supports YouTube, Vimeo, Internet Archive, Twitter/X, Reddit, TikTok, Twitch, SoundCloud, Bandcamp, and [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md).

## Features

- **Universal video extraction** — paste any supported URL, get title, thumbnail, available formats
- **Format selection** — choose video+audio, video-only, or audio-only at any available quality
- **Real-time progress** — live download speed, ETA, and percentage via WebSocket
- **Concurrent downloads** — queue multiple downloads with configurable concurrency (default 3)
- **Dark/light theme** — toggle with localStorage persistence
- **Cancel & cleanup** — cancel active downloads, clear finished items

## Prerequisites

[Bun](https://bun.sh) runtime plus two CLI tools:

```bash
# macOS
brew install yt-dlp ffmpeg

# Verify
bun run doctor
```

## Quick Start

```bash
git clone https://github.com/dunamismax/rip.git
cd rip
bun install
bun run dev
```

Open [http://localhost:3000](http://localhost:3000). The API runs on port 3001. In dev, React Router proxies `/api` to the API server; in production, the SPA talks to the API directly on port 3001 by default.

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
| `bun run doctor` | Verify prerequisites (yt-dlp, ffmpeg) |
| `bun run smoke` | Smoke test API endpoints (server must be running) |

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
  lib/                  # Utilities, API client, shared types
  routes/home.tsx       # Main page
backend/                # Hono API server
  index.ts              # Server entry + WebSocket
  routes.ts             # API route handlers
  download-manager.ts   # Download queue + concurrency control
  ytdlp.ts              # yt-dlp subprocess wrapper
  env.ts                # Environment config (Zod)
  types.ts              # Shared type definitions
scripts/                # CLI tools
  cli.ts                # doctor command
  smoke.ts              # API smoke tests
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
