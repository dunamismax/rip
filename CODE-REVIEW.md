# Code Review — rip

**Date:** 2026-03-03
**Scope:** Full repository review — all source files in `app/`, `backend/`, `scripts/`
**Tooling results:** `bun run lint` clean, `bun run typecheck` clean, `bun run build` succeeds

---

## Summary

Rip is a well-structured, compact video download UI wrapping yt-dlp. The code is clean, readable, and strongly typed. Architecture decisions (Hono + Bun.serve, React SPA with WebSocket progress, subprocess-based yt-dlp wrapper) are solid for the stated purpose. The main issues are security gaps for any network-exposed deployment, dead dependencies, duplicated types, and missing tests.

**Verdict:** Good foundation. ~~Needs a security pass and dependency cleanup before any non-localhost deployment.~~ Security pass and dependency cleanup completed.

---

## 1. Architecture

**Strengths:**
- Clean two-process split: Hono API (port 3001) + React SPA (Vite dev / static in prod)
- Vite proxy in dev unifies both behind port 3000 — zero CORS friction locally
- `DownloadManager` encapsulates queue, concurrency, and lifecycle well
- WebSocket for real-time progress avoids polling
- Zod validation on both env config and API inputs
- SPA mode (`ssr: false`) is correct for a local tool

**Issues:**

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| A1 | Medium | `app/lib/types.ts`, `backend/types.ts` | **Duplicated type definitions.** These two files are byte-for-byte identical. A change in one will silently diverge from the other. Should be a single shared file (e.g., `shared/types.ts`) imported by both sides. | **RESOLVED** — Consolidated into `shared/types.ts`. `app/lib/types.ts` re-exports, `backend/types.ts` deleted. |
| A2 | Low | `backend/types.ts:63-64` | **Unused WsMessage variants.** `status` and `completed` message types are defined but never emitted by the server. Only `progress` and `downloads` are broadcast. Dead type branches add confusion. | **RESOLVED** — Removed unused `status` and `completed` variants from `WsMessage` in `shared/types.ts`. |
| A3 | Low | `backend/types.ts:34` | **`processing` status defined but never set.** The `DownloadStatus` union includes `'processing'` but no code path assigns it. The merger/extract-audio stage in `ytdlp.ts:143-151` sets percentage to 100 but keeps status as `'downloading'`. | Open — kept in type for forward-compatibility with UI styling. |

---

## 2. Security

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| S1 | **High** | `backend/index.ts:42` | **Wide-open CORS.** `cors()` with no config allows any origin. Fine for localhost dev, dangerous if exposed to a network. Should restrict to the frontend origin or omit CORS entirely when served same-origin. | **RESOLVED** — CORS restricted to localhost origin in production, wildcard only in dev. |
| S2 | **High** | `backend/routes.ts` | **No rate limiting.** `/api/extract` spawns a yt-dlp subprocess per request. An attacker (or even a misbehaving browser tab) can exhaust server resources by spamming extract requests. Needs per-IP or global rate limiting. | **RESOLVED** — Added `RateLimiter` class (`backend/rate-limit.ts`). Extract: 10 req/min/IP, Download: 20 req/min/IP. |
| S3 | Medium | `backend/routes.ts:23` | **Uncaught JSON parse error.** `c.req.json()` is called outside try/catch. Malformed request bodies (non-JSON) will throw an unhandled error and return a 500 with a stack trace. Wrap in try/catch or use Hono middleware to handle parse failures. | **RESOLVED** — Added `safeJson()` wrapper that returns null on parse failure; routes return 400. |
| S4 | Medium | `backend/index.ts:42` | **No request body size limit.** Neither Hono nor the route handlers enforce a max body size. Large payloads could cause memory pressure. | **RESOLVED** — Added middleware rejecting `Content-Length > 1 MB` with 413. |
| S5 | Low | `backend/download-manager.ts` | **No limit on total queued downloads.** `add()` accepts unlimited items. A flood of download requests will grow the queue unbounded. | **RESOLVED** — Route rejects downloads when `queueSize() >= 50`. |

---

## 3. Reliability & Error Handling

| # | Severity | File:Line | Issue | Status |
|---|----------|-----------|-------|--------|
| R1 | **High** | `app/hooks/use-websocket.ts:20-21` | **WebSocket reconnect leak.** On `onclose`, a `setTimeout(connect, 2000)` fires unconditionally. If the component unmounts during the 2s window, the reconnect creates an orphaned WebSocket. The timeout ref is never cleared in the cleanup function. Fix: track the timeout ID in a ref, clear it on unmount. | **RESOLVED** — `reconnectTimerRef` tracked and cleared on unmount. |
| R2 | Medium | `app/hooks/use-websocket.ts:21` | **No exponential backoff on reconnect.** Fixed 2s retry interval. If the server is down for minutes, the client hammers it every 2 seconds. Should implement exponential backoff with a max delay. | **RESOLVED** — Exponential backoff (1s base, 30s max) with jitter. Resets on successful connect. |
| R3 | Medium | `backend/download-manager.ts:76-82` | **`clearCompleted()` doesn't broadcast.** Items are removed from the map, but no WebSocket message is sent. Other connected clients won't see the change until the next unrelated broadcast. Add `this.broadcastAll()` at the end. | **RESOLVED** — `broadcastAll()` called at end of `clearCompleted()`. |
| R4 | Medium | `backend/download-manager.ts:114` | **Unhandled rejection possible in `startNext`.** `processQueue()` calls `startNext()` without awaiting it. If `ensureDir()` throws (e.g., permission denied), the error propagates as an unhandled promise rejection. The try/catch on line 133 only covers the download phase, not `ensureDir`. | **RESOLVED** — `ensureDir()` wrapped in its own try/catch; failure marks item as `failed`. |
| R5 | Low | `backend/download-manager.ts` | **Downloads never expire from memory.** Completed/failed items persist in the Map forever unless the user clicks "Clear finished." A long-running server will accumulate items. Consider auto-expiry (e.g., remove after 24h). | Open |
| R6 | Low | `backend/index.ts:107-118` | **No graceful drain on shutdown.** SIGINT/SIGTERM handlers kill downloads and call `process.exit(0)` immediately without waiting for in-flight HTTP responses to complete. | Open |
| R7 | Low | `backend/download-manager.ts:8` | **Tilde expansion fallback.** `process.env.HOME ?? ''` — if HOME is undefined, the download dir becomes `/Downloads/Rip` (filesystem root). Unlikely on macOS/Linux, but a silent failure mode. | Open |

---

## 4. Dead Dependencies & Unused Code

| # | Severity | Item | Detail | Status |
|---|----------|------|--------|--------|
| D1 | Medium | `@tanstack/react-query` | Installed, `QueryClientProvider` wraps the app in `root.tsx`, but **zero** queries or mutations use it. All API calls go through raw `apiFetch`. Either adopt it or remove it. | **RESOLVED** — Removed package and `QueryClientProvider` wrapper from `root.tsx`. |
| D2 | Medium | `shadcn` (dependency) + `components.json` | shadcn/ui is configured and the dependency is installed, but no `components/ui/` directory exists and no shadcn components are used. All components are hand-rolled. Remove unless planned for immediate use. | **RESOLVED** — Removed `shadcn` dep, `components.json`, and `class-variance-authority`. |
| D3 | Low | `lucide-react` | Installed but never imported. All icons are inline SVGs. | **RESOLVED** — Removed. |
| D4 | Low | `isbot` | Installed but never imported anywhere. Likely leftover from an SSR template. | Open — `react-router typegen` auto-installs it as a required peer dep of `@react-router/node`. Not truly dead. |
| D5 | Low | CSS variables | `app.css` defines a full shadcn variable set (`--background`, `--foreground`, `--card`, `--sidebar-*`, `--chart-*`, etc.) that nothing references. Components use the `--ovd-*` variables exclusively. The shadcn variables are dead weight. | **RESOLVED** — Removed all shadcn variable declarations, `@import "shadcn/tailwind.css"`, and `@theme inline` / `@layer base` blocks. |

---

## 5. TypeScript & Code Quality

| # | Severity | File:Line | Issue | Status |
|---|----------|-----------|-------|--------|
| T1 | Low | `backend/ytdlp.ts:26,30-31` | **`JSON.parse` on untyped stdout.** `JSON.parse(stdout)` returns `any` implicitly. `mapMetadata` accepts `Record<string, unknown>` which is better, but the raw parse has no error handling for malformed JSON. If yt-dlp outputs a warning before the JSON, this throws an opaque `SyntaxError`. | **RESOLVED** — Wrapped in try/catch with descriptive error message. |
| T2 | Low | `app/lib/utils.ts:24-26` | **`formatSpeed(0)` returns `'--'`.** The check `if (!bytesPerSecond)` is falsy for 0, so a 0 B/s speed (paused) shows as '--' rather than '0 B/s'. Use `=== null` or `=== undefined` instead. | **RESOLVED** — Changed to `=== null \|\| === undefined`. |
| T3 | Low | `app/lib/utils.ts:8-13` | **`formatBytes` doesn't guard negative input.** `Math.log(negative)` returns `NaN`. Not likely in practice but a defensive check is cheap. | **RESOLVED** — Changed `=== 0` to `<= 0`. |
| T4 | Low | `app/lib/api.ts:16` | **API base URL not configurable.** `fetch(path, init)` uses relative paths, which works same-origin but fails if the SPA is served from a different origin than the API. Consider an env-driven base URL. | Open |
| T5 | Info | `app/components/download-item.tsx:9` | **`statusColors` keyed by `string`.** Could be `Record<DownloadStatus, string>` to catch missing/extra keys at compile time. | **RESOLVED** — Typed as `Record<DownloadStatus, string>`. |

---

## 6. Frontend Patterns

| # | Severity | File | Issue | Status |
|---|----------|------|-------|--------|
| F1 | Low | `app/routes/home.tsx` | **All state is local.** Five `useState` calls in one component. Fine at this scale, but combined with the unused TanStack Query setup in root.tsx, suggests an incomplete migration. The extract flow (loading, error, data) is a textbook `useQuery` or `useMutation` use case. | Open — TanStack Query removed; local state is appropriate at this scale. |
| F2 | Low | `app/hooks/use-theme.ts:7-10` | **SSR-unsafe `localStorage` access in initializer.** The `typeof window === 'undefined'` guard works, but React 19 with SPA mode means this guard is dead code. Not a bug, just noise. | Open |
| F3 | Info | `app/components/format-selector.tsx:75-89` | **Video-only formats only shown when no combined formats exist.** This logic means YouTube videos (which have combined formats at low resolutions AND separate high-res video tracks) will hide the higher-quality video-only options. Users can't access 4K if 720p combined exists. | Open |

---

## 7. Naming & Branding

| # | Severity | Detail | Status |
|---|----------|--------|--------|
| N1 | Low | CSS variables use `--ovd-*` prefix (open-video-downloader). The repo was renamed to `rip`. Consider renaming to `--rip-*` for consistency. | Open |
| N2 | Low | yt-dlp progress template uses `ovd-progress:` and `ovd-output:` prefixes in `ytdlp.ts:77,95`. Same legacy naming. | Open |
| N3 | Info | The README mentions `.env.example` but no such file exists in the repo. | Open |

---

## 8. Testing

| # | Severity | Detail | Status |
|---|----------|--------|--------|
| TE1 | **High** | **No unit tests.** Zero test files. No test framework configured. Business logic (`DownloadManager`, `parseProgressLine`, `mapMetadata`, `formatBytes`, etc.) is eminently testable but untested. | Open |
| TE2 | Medium | **Smoke tests require a running server.** `scripts/smoke.ts` is an integration test that assumes `localhost:3001` is up. Not CI-friendly without a setup step. | Open |
| TE3 | Low | **No `test` script in package.json.** Standard convention (`bun test` or similar) is missing. | Open |

---

## 9. Prioritized Improvements

### P0 — Do before any non-localhost exposure
1. ~~**Add rate limiting** to `/api/extract` and `/api/download` (S2)~~ **DONE**
2. ~~**Restrict CORS** to expected origin or remove it (S1)~~ **DONE**
3. ~~**Catch JSON parse errors** in route handlers (S3)~~ **DONE**
4. ~~**Fix WebSocket reconnect leak** — clear timeout on unmount (R1)~~ **DONE**

### P1 — Should do soon
5. ~~**Deduplicate types** — single shared types file (A1)~~ **DONE**
6. **Add unit tests** for `DownloadManager`, progress parsing, format utilities (TE1)
7. ~~**Remove dead dependencies** — `@tanstack/react-query` (or adopt it), `shadcn`, `lucide-react`, `isbot` (D1-D4)~~ **DONE** (isbot kept — required by react-router)
8. ~~**Broadcast after clearCompleted** (R3)~~ **DONE**
9. ~~**Wrap `ensureDir` in try/catch** inside `startNext` (R4)~~ **DONE**

### P2 — Nice to have
10. ~~**Exponential backoff** on WebSocket reconnect (R2)~~ **DONE**
11. ~~**Cap max queued downloads** (S5)~~ **DONE**
12. **Auto-expire old download records** from memory (R5)
13. **Rename `--ovd-*` prefix** to `--rip-*` (N1, N2)
14. ~~**Clean up unused CSS variables** from shadcn boilerplate (D5)~~ **DONE**
15. **Show video-only high-res formats** even when combined formats exist (F3)
16. **Add `.env.example`** (N3)
17. **Add graceful shutdown drain** (R6)

### Additional fixes applied
- **S4** — Added 1 MB request body size limit middleware
- **T1** — Wrapped `JSON.parse(stdout)` in try/catch with descriptive error
- **T2** — `formatSpeed(0)` now returns `'0 B/s'` instead of `'--'`
- **T3** — `formatBytes` guards negative input
- **T5** — `statusColors` typed as `Record<DownloadStatus, string>`
- **A2** — Removed unused `status` and `completed` WsMessage variants
- **D2** — Also removed `class-variance-authority` (shadcn dependency)

---

## 10. What's Done Well

- **Clean file layout.** Backend and frontend are clearly separated. Files are small and focused.
- **Zod everywhere it matters.** Env config and API input validation both use Zod schemas.
- **yt-dlp wrapper is solid.** Progress parsing, cancel support, output file detection — all work correctly.
- **WebSocket protocol is simple and effective.** Full-state broadcast on connect, incremental progress updates thereafter.
- **Strict TypeScript.** `strict: true`, no `any` types in source code.
- **Biome config is tight.** Recommended rules, consistent formatting, single quotes, semicolons.
- **Concurrency control works.** Queue + active set pattern in DownloadManager is correct.
- **Smoke test exists.** Not common at this project stage — shows good testing instinct.
- **README is thorough.** Architecture diagram, all commands, env vars, API reference.
