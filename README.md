# rip

`rip` is a Bun + TypeScript monorepo for authenticated, self-hosted `yt-dlp` downloads.

## Stack

- Runtime: Bun
- Workspace: Bun
- App: TanStack Start + TanStack Router + TanStack Query
- Domain contracts: Zod
- Auth: Better Auth
- Database: PostgreSQL + Drizzle ORM
- Observability: OpenTelemetry
- Lint/format: Biome
- Tests: Vitest

## Workspace

```text
apps/web            TanStack Start app, API routes, downloader UI, and auth
packages/contracts  Shared Zod contracts
packages/db         Drizzle schema, client, and migrations
```

## Prerequisites

- Bun 1.3+
- PostgreSQL
- `yt-dlp`
- `ffmpeg`

macOS example:

```bash
brew install bun yt-dlp ffmpeg postgresql
```

## Quick Start

```bash
cp .env.example .env
bun install
bun run db:migrate
bun run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

## Environment

Required:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`

Important optional values:

- `DOWNLOAD_DIR`
- `MAX_CONCURRENT_DOWNLOADS`
- `MAX_INCOMPLETE_DOWNLOADS`
- `YTDLP_PATH`
- `FFMPEG_PATH`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

## Commands

```bash
bun run dev
bun run build
bun run test
bun run check
bun run db:generate
bun run db:migrate
bun run db:push
bun run db:studio
```

## Features

- Better Auth email/password sign-in
- Persistent download queue stored in PostgreSQL
- Format inspection and output remux/extract choices
- Concurrent `yt-dlp` workers with cancellation
- OpenTelemetry tracing around extract/download workflows

## Verification

```bash
bun run test
bun run check
bun run build
```

## License

[MIT](LICENSE)
