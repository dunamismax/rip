# rip — Build Tracker

**Status:** Phase 1 — UX & Reliability Polish
**Last Updated:** 2026-03-04
**Branch:** `main`

---

## What This Repo Is

Self-hostable video download tool. Paste a URL, pick a format, download. Clean web UI wrapping yt-dlp with real-time progress via WebSocket. Designed as a personal utility — no accounts, no complexity.

## Architecture Snapshot

```
rip/
├── app/                        # React Router v7 (framework mode)
│   ├── routes/home.tsx         # Main download interface
│   ├── components/
│   │   ├── url-input.tsx       # URL paste + submit
│   │   ├── video-card.tsx      # Video metadata preview
│   │   ├── format-selector.tsx # Quality/format picker
│   │   ├── download-queue.tsx  # Active/completed downloads list
│   │   ├── download-item.tsx   # Individual download progress
│   │   └── theme-toggle.tsx    # Dark/light toggle
│   ├── hooks/
│   │   ├── use-websocket.ts    # Real-time download progress
│   │   ├── use-downloads.ts    # Download state management
│   │   └── use-theme.ts        # Theme persistence
│   └── lib/
│       ├── api.ts              # REST API client
│       ├── types.ts            # Shared types
│       └── utils.ts            # Utilities
├── backend/
│   ├── index.ts                # Hono server entry + WebSocket
│   ├── routes.ts               # API routes (submit URL, get status, download file)
│   ├── download-manager.ts     # Download queue + lifecycle management
│   ├── ytdlp.ts                # yt-dlp process wrapper
│   ├── env.ts                  # Environment config
│   └── rate-limit.ts           # Rate limiting
├── shared/                     # Shared types between frontend/backend
├── scripts/
│   ├── cli.ts                  # Dev CLI (doctor)
│   └── smoke.ts                # Smoke tests
└── public/                     # Static assets
```

**Stack:** React Router v7 + Vite, TypeScript, Tailwind v4, Hono backend, yt-dlp (system dependency), WebSocket for progress, Biome.

---

## Phase Plan

### Phase 0 — Core Download Flow (Complete)

- [x] URL submission → yt-dlp metadata fetch → format selection
- [x] Download execution with yt-dlp subprocess
- [x] Real-time progress via WebSocket
- [x] Download queue with concurrent limit
- [x] File serving for completed downloads
- [x] Dark/light theme
- [x] Rate limiting
- [x] Dev tooling (doctor CLI, smoke tests)

### Phase 1 — UX & Reliability Polish (Current)

**Goal:** Make the tool reliable enough for daily use and pleasant enough to prefer over alternatives.

**Success criteria:** Download 10 videos from different sites consecutively without errors or UI glitches. Progress bars accurate. Files downloadable. Queue clears cleanly.

- [ ] Error handling: surface yt-dlp errors clearly in UI (site unsupported, geo-blocked, age-restricted)
- [ ] Download retry: retry failed downloads with backoff
- [ ] Batch downloads: paste multiple URLs, queue all
- [ ] Clipboard paste detection: auto-detect URL on paste, skip manual submit
- [ ] Download history: persist completed downloads across server restarts (SQLite or JSON)
- [ ] File cleanup: configurable auto-delete after N hours/days
- [ ] yt-dlp auto-update: check for yt-dlp updates on server start or via CLI command
- [ ] Audio-only mode: extract audio (MP3/M4A) as a first-class format option
- [ ] Playlist support: detect playlists, let user pick individual videos or download all

### Phase 2 — Power Features

- [ ] Browser extension / bookmarklet (send URL to rip from any page)
- [ ] Subtitle download and embedding
- [ ] Thumbnail extraction
- [ ] Output filename templates (configurable naming patterns)
- [ ] Scheduled downloads (queue for later)
- [ ] Storage usage display + disk space warnings

### Phase 3 — Deployment

- [ ] Docker Compose (app + yt-dlp pre-installed)
- [ ] Persistent volume for downloads
- [ ] Health check endpoint
- [ ] Mobile-responsive UI polish
- [ ] Tailscale-friendly: works cleanly over Tailscale without extra config

---

## Verification Snapshot

```
bun run lint      ✅  (31 files, no issues)
bun run typecheck ✅
bun run smoke     — (smoke test runner exists)
```

Last verified: 2026-03-04

---

## Agent Instructions

- **System dependency:** `yt-dlp` must be installed and on PATH. Check with `which yt-dlp`.
- Backend is Hono with native Bun WebSocket — `backend/index.ts` handles both HTTP and WS.
- Download manager (`backend/download-manager.ts`) orchestrates the queue — all download logic goes through it.
- `ytdlp.ts` wraps the yt-dlp subprocess — parse its JSON output, don't scrape stdout text.
- Dual server: `dev:api` (Hono) + `dev:web` (React Router) run concurrently via `bun run dev`.
- Update this BUILD.md in the same commit as meaningful changes.
