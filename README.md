# rip

`rip` is a self-hosted `yt-dlp` control deck built on a split stack:

- Frontend: Node.js + pnpm + TypeScript + Vite + React + TanStack Router + TanStack Query + TanStack Form + Zod + shadcn/ui + Radix UI + Biome + Vitest + Playwright
- Backend: Hono + PostgreSQL + Prisma + Prisma Migrate + Better Auth + Zod

## Workspace

```text
apps/web            Vite React SPA
apps/api            Hono API, Better Auth, download queue orchestration
packages/contracts  Shared Zod contracts and API shapes
packages/db         Prisma schema, client, and migrations
```

## Features

- Email/password auth with Better Auth
- Persistent PostgreSQL-backed download queue
- Format extraction and output remux/extract options via `yt-dlp`
- Concurrent download workers with cancellation
- SPA frontend with TanStack Router, Query, and Form
- Vitest unit/component coverage and Playwright e2e smoke tests

## Prerequisites

- Node.js 20+
- pnpm 10+
- PostgreSQL
- `yt-dlp`
- `ffmpeg`

macOS example:

```bash
brew install node pnpm yt-dlp ffmpeg postgresql
```

## Quick Start

```bash
cp .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Frontend: [http://127.0.0.1:3000](http://127.0.0.1:3000)

Backend API: [http://127.0.0.1:3001](http://127.0.0.1:3001)

## Environment

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`

Useful defaults live in [.env.example](.env.example). The main variables are:

- `APP_URL`
- `API_URL`
- `PORT`
- `DOWNLOAD_DIR`
- `MAX_CONCURRENT_DOWNLOADS`
- `MAX_INCOMPLETE_DOWNLOADS`
- `YTDLP_PATH`
- `FFMPEG_PATH`
- `REQUEST_BODY_LIMIT_BYTES`
- `COMPLETED_EXPIRY_SECONDS`

## Startup Notes

- `pnpm dev` starts both the API and the Vite web app.
- The API will load a repo-root `.env` automatically when it exists.
- If `.env` is absent, `pnpm --filter @rip/api dev` and `pnpm --filter @rip/api start` now work with inline/exported environment variables instead.

## Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm test:e2e
pnpm check
pnpm db:generate
pnpm db:migrate
pnpm db:deploy
pnpm db:studio
```

## Notes

- The Vite app proxies `/api/*` to Hono during local development.
- In production, the Hono server serves the built SPA from `apps/web/dist`.
- Prisma 7 uses `packages/db/prisma.config.ts` for datasource configuration.

## Verification

```bash
pnpm check
pnpm test
pnpm test:e2e
pnpm build
```

## License

[MIT](LICENSE)
