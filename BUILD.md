# rip — Build Tracker

**Status:** Release Prep
**Last Updated:** 2026-03-07

## Scope

Small self-hosted video downloader. Paste a URL, inspect yt-dlp metadata, pick a grouped format, and queue a download. No accounts, no remote services, no platform ambitions.

## Current Behavior

- React Router SPA on `:3000`, Hono API on `:3001`
- Metadata extraction via `POST /api/extract`
- Download queue with configurable concurrency and a hard cap of 50 active + queued items
- Progress updates over `/api/ws`
- Cancel active/queued downloads and clear finished entries
- Finished entries remain visible until cleared, then also auto-expire from server memory after one hour
- `bun run doctor` checks `yt-dlp`, `ffmpeg`, and that the resolved download directory is writable
- `bun run smoke` verifies the API contract in-process by default; with `RIP_BASE_URL` it also checks a running server and WebSocket ping/pong

## Repo Map

```
app/                    # SPA UI
backend/                # API, queue manager, yt-dlp wrapper
shared/types.ts         # Shared frontend/backend types
scripts/cli.ts          # doctor command
scripts/smoke.ts        # In-process API smoke checks; live mode via RIP_BASE_URL
```

## Verification

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- `bun run build`
- `bun run smoke`

## Constraints

- Keep changes small and local
- Prefer correctness over feature growth
- Preserve the repo as a self-hosted utility, not a service platform
