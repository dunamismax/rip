# rip

`rip` is now a Bun + TypeScript monorepo for authenticated, self-hosted `yt-dlp` downloads.

## Stack

- Runtime: Bun
- Workspace: pnpm
- App: TanStack Start + TanStack Router + TanStack Query
- Domain contracts: Effect + Effect Schema
- Auth: Better Auth
- Database: PostgreSQL + Drizzle ORM
- AI UX: TanStack AI
- Observability: OpenTelemetry
- Lint/format: Biome
- Tests: Vitest

## Workspace

```text
apps/web         TanStack Start app, API routes, downloader UI, auth, AI advisor
packages/contracts  Shared Effect Schema contracts
packages/db         Drizzle schema, client, and migrations
```

## Prerequisites

- Bun 1.3+
- pnpm 10+
- PostgreSQL
- `yt-dlp`
- `ffmpeg`

macOS example:

```bash
brew install bun pnpm yt-dlp ffmpeg postgresql
```

## Quick Start

```bash
cp .env.example .env
pnpm install
pnpm db:migrate
pnpm dev
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
- `AI_PROVIDER`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

The AI format advisor is disabled unless `AI_PROVIDER=openai`, `OPENAI_API_KEY`, and `OPENAI_MODEL` are set.

## Commands

```bash
pnpm dev
pnpm build
pnpm test
pnpm check
pnpm db:generate
pnpm db:migrate
pnpm db:push
pnpm db:studio
```

## Features

- Better Auth email/password sign-in
- Persistent download queue stored in PostgreSQL
- Format inspection and output remux/extract choices
- Concurrent `yt-dlp` workers with cancellation
- TanStack AI format advisor for choosing the right output
- OpenTelemetry tracing around extract/download workflows

## Verification

```bash
pnpm test
pnpm check
pnpm build
```

## License

[MIT](LICENSE)
