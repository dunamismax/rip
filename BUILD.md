# BUILD.md

This is the primary operational handoff document for `rip`.

This file is a living document. Every future agent or developer who touches this repository is responsible for keeping it accurate, current, and up to date. If code, scripts, dependencies, workflows, infrastructure assumptions, or risks change, update this file in the same pass.

## Verification Snapshot

- Last reviewed: 2026-03-18
- Reviewer: Codex
- Repository root: `/Users/sawyer/github/rip`
- Verified locally in this review:
  - `node v24.13.1`
  - `pnpm 10.32.1`
  - `yt-dlp 2026.02.21`
  - `ffmpeg 8.0.1`
  - `psql 17.9`
- Important local condition during review:
  - No PostgreSQL server was running on `127.0.0.1:5432` at the start of the review.
  - Database workflows were verified against a temporary local PostgreSQL instance on port `55432`, not against the default `.env.example` port.

## Project Baseline

### What the application currently does

`rip` is a self-hosted authenticated control deck for `yt-dlp`.

Current implemented flow:

1. A user signs up or signs in with email/password.
2. The frontend calls the API to inspect a media URL with `yt-dlp`.
3. The user chooses a returned format and desired output container.
4. The API persists a queued download in PostgreSQL.
5. In-process workers spawn `yt-dlp`, track progress, update the database, and expose queue state back to the UI.
6. The API can also serve the built SPA from `apps/web/dist` in production-style runs.

### Major components, services, modules, and entry points

- `apps/web`
  - Vite/React SPA.
  - Browser entry: `apps/web/src/main.tsx`
  - Router: `apps/web/src/router.tsx`
  - Main authenticated/signed-out split: `apps/web/src/features/home-page.tsx`
  - Auth UI: `apps/web/src/features/auth/auth-panel.tsx`
  - Queue/dashboard UI: `apps/web/src/features/dashboard/dashboard-page.tsx`
  - API client: `apps/web/src/lib/api.ts`
- `apps/api`
  - Hono HTTP server plus Better Auth plus download orchestration.
  - Server entry: `apps/api/src/index.ts`
  - Route registration and SPA static serving: `apps/api/src/app.ts`
  - Runtime env parsing/validation: `apps/api/src/env.ts`
  - Better Auth wiring: `apps/api/src/lib/auth.ts`
  - Queue implementation: `apps/api/src/lib/download-manager.ts`
  - `yt-dlp` integration and progress parsing: `apps/api/src/lib/ytdlp.ts`
- `packages/contracts`
  - Shared Zod schemas/types used by both web and API.
  - Entry: `packages/contracts/src/index.ts`
  - Download shapes: `packages/contracts/src/downloads.ts`
  - Session shapes: `packages/contracts/src/session.ts`
- `packages/db`
  - Prisma schema, migrations, and client access.
  - Prisma schema: `packages/db/prisma/schema.prisma`
  - Prisma config: `packages/db/prisma.config.ts`
  - Client bootstrap: `packages/db/src/client.ts`
- `tests/e2e`
  - Playwright smoke coverage for the SPA only.
  - Entry: `tests/e2e/app.spec.ts`
- CI
  - GitHub Actions workflow: `.github/workflows/ci.yml`

### Current implemented state

Implemented and visible in code:

- Email/password auth via Better Auth and Prisma-backed tables.
- Protected endpoints for session, metadata extraction, queueing, listing, cancellation, and clearing completed items.
- Shared Zod contracts across browser and API.
- Persistent queue state in PostgreSQL.
- Concurrent download workers inside the API process.
- Download progress parsing from `yt-dlp --progress-template`.
- Output remux/extract handling for audio/video targets.
- Vite development server with `/api` proxying to the API.
- Hono production-style static serving of built SPA assets.

Not implemented or not present in the repo:

- No seed script or seed data workflow.
- No Dockerfile / docker-compose / container workflow.
- No password reset, email verification, or admin flows.
- No API integration test suite using a real database.
- No end-to-end test that exercises the real backend/auth/database/download path.

## Verified Build And Run Workflow

### Prerequisites

Repository-declared prerequisites:

- Node.js `>=20` from `package.json`
- `pnpm@10.32.1` from `package.json`
- PostgreSQL
- `yt-dlp`
- `ffmpeg`

Files that define runtime expectations:

- `.env.example`
- `apps/api/src/env.ts`
- `packages/db/prisma.config.ts`

### Environment variables

Minimum practical env vars for backend startup:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`

Commonly needed:

- `APP_URL`
- `API_URL`
- `BETTER_AUTH_URL`
- `PORT`
- `DOWNLOAD_DIR`
- `YTDLP_PATH`
- `FFMPEG_PATH`
- `MAX_CONCURRENT_DOWNLOADS`
- `MAX_INCOMPLETE_DOWNLOADS`
- `REQUEST_BODY_LIMIT_BYTES`
- `COMPLETED_EXPIRY_SECONDS`

Important note:

- `apps/api/src/env.ts` is the authoritative runtime validator.
- `.env.example` is a good starting point, but not the only source of truth.

### Verified commands run successfully in this review

These commands were actually executed successfully on 2026-03-18.

| Purpose | Command | Result |
| --- | --- | --- |
| Install dependencies | `pnpm install --frozen-lockfile` | Passed |
| Generate Prisma client | `pnpm db:generate` | Passed |
| Lint | `pnpm lint` | Passed |
| Type/lint checks | `pnpm check` | Passed |
| Unit/component tests | `pnpm test` | Passed |
| Workspace build | `pnpm build` | Passed |
| Playwright smoke tests | `pnpm test:e2e` | Passed |
| Dev migration against temp Postgres | `env DATABASE_URL=postgresql://postgres@127.0.0.1:55432/rip pnpm db:migrate` | Passed |
| Deploy migration against temp Postgres | `env DATABASE_URL=postgresql://postgres@127.0.0.1:55432/rip_deploy pnpm db:deploy` | Passed |
| API health check via direct entrypoint | `pnpm exec node --import tsx src/index.ts` from `apps/api` with inline env vars | Server started; `curl http://127.0.0.1:3001/api/health` returned `{"status":"ok"}` |
| Web dev server | `pnpm --filter @rip/web dev` | Vite served on `http://127.0.0.1:3000` |
| Web-to-API proxy check | `curl http://127.0.0.1:3000/api/health` while web + API were running | Returned `{"status":"ok"}` |
| API serving built SPA assets | `curl http://127.0.0.1:3001/` after `pnpm build` and direct API start | Returned built `index.html` |

### Commands that are likely correct but were not verified end-to-end here

| Command | Status | Why it is not fully verified here |
| --- | --- | --- |
| `cp .env.example .env` | Likely correct | Not run during review because verification used inline env vars and a temporary Postgres instance |
| `pnpm dev` | Likely correct after real `.env` setup | Not run successfully as-is in this environment |
| `pnpm --filter @rip/api dev` | Likely correct after real `.env` setup | Not run successfully as-is in this environment |
| `pnpm --filter @rip/api start` | Likely correct after real `.env` setup | Verified to fail if root `.env` is missing |
| `pnpm --filter @rip/web preview` | Likely correct | Not explicitly run |
| `pnpm db:studio` | Likely correct | Not explicitly run |

### Verified failure / gotcha

This was directly observed and should be treated as operationally important:

- `pnpm --filter @rip/api start` failed with `node: ../../.env: not found` when `.env` was missing, even though equivalent environment variables were passed inline.
- Root `pnpm dev` almost certainly has the same prerequisite because `apps/api/package.json` hardcodes `node --env-file ../../.env`.
- `pnpm install --frozen-lockfile` printed a warning that build scripts for `@prisma/engines`, `esbuild`, and `prisma` were ignored and suggested `pnpm approve-builds`.
  - This did not block `pnpm db:generate`, `pnpm build`, or tests in this environment.
  - Treat it as a setup warning worth re-checking on a fresh machine.

### Practical local setup order

Recommended local setup sequence:

1. Install PostgreSQL, `yt-dlp`, and `ffmpeg`.
2. Copy `.env.example` to `.env`.
3. Adjust at least `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `DOWNLOAD_DIR`.
4. Run `pnpm install --frozen-lockfile`.
5. Run `pnpm db:generate`.
6. Run `pnpm db:migrate`.
7. Run `pnpm check`, `pnpm test`, and `pnpm build`.
8. Run `pnpm dev`.

## Source-Of-Truth Notes

### Files and directories to trust first

- `package.json`
  - Canonical workspace-level scripts and toolchain pinning.
- `pnpm-workspace.yaml`
  - Workspace package boundaries.
- `apps/api/src/env.ts`
  - Real backend env validation rules and defaults.
- `packages/db/prisma/schema.prisma`
  - Authoritative database model.
- `packages/db/prisma/migrations/`
  - Applied schema history.
- `packages/contracts/src/`
  - API/browser contract source of truth.
- `apps/api/src/app.ts`
  - Actual API surface and SPA-serving behavior.
- `apps/api/src/lib/download-manager.ts`
  - Real queue semantics and worker behavior.
- `apps/web/src/features/`
  - Current user-visible feature set.
- `.github/workflows/ci.yml`
  - What CI currently verifies.

### Documentation quality and conflicts

- `README.md` is useful but should be treated as secondary to code for operational details.
- There was no pre-existing `BUILD.md` before this review.
- Important env/default conflict:
  - `.env.example` uses `postgres://postgres:postgres@127.0.0.1:5432/rip`
  - `packages/db/prisma.config.ts` fallback uses `postgresql://postgres:postgres@127.0.0.1:5432/rip`
  - `packages/db/src/client.ts` fallback uses `postgresql://postgres@127.0.0.1:5432/rip`
  - The missing password in `packages/db/src/client.ts` is inconsistent with the other two defaults.

### CI reality

`.github/workflows/ci.yml` currently verifies:

- install
- Prisma client generation
- `pnpm check`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

CI does not currently verify:

- running a real PostgreSQL-backed API session
- Better Auth sign-in against a live backend
- real `yt-dlp` extraction/download execution
- disk cleanup behavior for completed/cancelled downloads

## Current Gaps And Known Issues

### Verified from direct inspection or command execution

- API startup scripts hard-require a repo-root `.env` file.
  - Source: `apps/api/package.json`
  - Impact: exported env vars alone are not enough; startup fails fast if `.env` does not exist.
- Backend "build" is only a typecheck.
  - Source: `apps/api/package.json`
  - Impact: `pnpm build` does not emit a compiled backend artifact; production-style runtime still needs source files, `tsx`, and dependencies.
- Playwright coverage is frontend smoke coverage with mocked API routes.
  - Sources: `playwright.config.ts`, `tests/e2e/app.spec.ts`
  - Impact: green e2e does not mean backend/auth/database/download integration works.
- Clearing completed downloads only deletes database rows.
  - Source: `apps/api/src/lib/download-manager.ts`
  - Impact: downloaded files remain on disk in `DOWNLOAD_DIR`.
- Automatic cleanup of expired completed rows also only deletes database rows.
  - Source: `apps/api/src/lib/download-manager.ts`
  - Impact: DB cleanup does not equal filesystem cleanup.
- No seed workflow exists.
  - Source: root `package.json` scripts and workspace packages

### Strong code-based inferences that should be treated as risks

- Single-process queue assumption.
  - Source: `apps/api/src/lib/download-manager.ts`
  - Reason: queue claiming relies on an in-memory mutex plus `findFirst`/`update`, not a database-level lease/lock strategy.
  - Likely impact: running multiple API instances against the same database could race and double-process queued jobs.
- Cancelled/failed downloads may leave partial files behind.
  - Source: `apps/api/src/lib/download-manager.ts`
  - Reason: cancellation/failure updates DB state, but there is no visible file cleanup path.
- Test coverage is mostly unit/mock-driven for the backend.
  - Sources: `apps/api/src/lib/*.test.ts`
  - Likely impact: regressions in Prisma wiring, Better Auth integration, and actual child-process execution can slip through.

### Technical debt / ambiguity

- Environment defaults are not fully unified across `.env.example`, Prisma config, and runtime Prisma client fallback.
- Operational startup depends on conventions that are not enforced by scripts beyond failing at runtime.
- Queue lifecycle and retention policy are only partially defined:
  - DB rows can be cleared or expired.
  - Files on disk are retained indefinitely.
- The repo has only one migration (`0001_init`), so future schema changes have not yet been exercised across a longer migration chain.

## Next-Pass Priorities

### Highest impact first

1. Fix local/prod startup ergonomics around `.env`.
   - Best outcome: make API scripts work with inline env vars or fail with a more intentional message.
   - Minimum outcome: document the hard `.env` dependency in `README.md` and keep this file updated.
2. Add at least one real integration path.
   - Suggested first target: a backend integration test that boots against temporary PostgreSQL and exercises auth/session plus one protected route.
3. Decide and implement download file retention/cleanup behavior.
   - Clarify whether "clear completed" should also remove files from disk.
4. Unify database URL defaults.
   - Resolve the mismatch between `packages/db/src/client.ts`, `packages/db/prisma.config.ts`, and `.env.example`.
5. Clarify deployment model.
   - If the API is expected to stay single-instance, say so explicitly.
   - If not, redesign queue claiming around database-safe locking/leases.

### Quick wins

- Add a short startup preflight section to `README.md` once BUILD.md is merged.
- Normalize database fallback URLs.
- Add a note near `apps/api/package.json` scripts about the required root `.env`.
- Add one command or script for bootstrapping local Postgres expectations.

### Deeper refactors

- Move queue claiming to a DB-safe lease/locking model.
- Add true backend integration/e2e coverage.
- Separate worker responsibilities from the API server if multi-instance deployment is a goal.

## Next-Agent Checklist

Follow this in order after opening the repo:

1. Read this file first.
2. Read `README.md` second.
3. Inspect these files in this order:
   - `package.json`
   - `.github/workflows/ci.yml`
   - `.env.example`
   - `apps/api/src/env.ts`
   - `packages/db/prisma/schema.prisma`
   - `apps/api/src/app.ts`
   - `apps/api/src/lib/download-manager.ts`
   - `apps/api/src/lib/ytdlp.ts`
   - `apps/web/src/features/home-page.tsx`
   - `apps/web/src/features/dashboard/dashboard-page.tsx`
4. Confirm toolchain:
   - `node -v`
   - `pnpm -v`
   - `yt-dlp --version`
   - `ffmpeg -version`
   - `pg_isready -h 127.0.0.1 -p 5432`
5. Create a real root `.env` before trusting API start scripts.
6. Run:
   - `pnpm install --frozen-lockfile`
   - `pnpm db:generate`
   - `pnpm db:migrate`
   - `pnpm check`
   - `pnpm test`
   - `pnpm build`
   - `pnpm test:e2e`
7. If working on runtime behavior, validate both:
   - `http://127.0.0.1:3001/api/health`
   - `http://127.0.0.1:3000/api/health`
8. Before changing queue behavior, read `apps/api/src/lib/download-manager.ts` carefully and decide whether your change assumes:
   - single API process
   - multi-process safety
   - file cleanup semantics
9. Before changing schema/auth/contracts, update all of:
   - Prisma schema/migrations
   - shared contracts
   - API handlers
   - frontend client usage
   - tests
   - this file

## Safe Starting Points For The Next Pass

If you need the safest immediate work, start here:

- Unify and document env/database defaults.
- Add a backend integration test using temporary PostgreSQL.
- Decide whether `clear completed` should also remove files.

If you need to avoid risky work for now, do not start with:

- multi-instance queue changes
- auth model changes
- Prisma schema rewrites without adding migration/integration coverage
