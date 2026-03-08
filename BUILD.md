# rip — Build Tracker

**Status:** Checkpoint Ready
**Last Updated:** 2026-03-08

## Objective

Rewrite the repo from the Bun/TypeScript SPA + API stack into a Python web app built around FastAPI and server-rendered HTML while preserving the repo's main utility: self-hosted `yt-dlp` extraction, format selection, queued downloads, and download management.

## Current Migration Plan

1. Replace the Bun/Hono/React implementation with a FastAPI application that serves HTML and JSON from one Python process.
2. Rebuild the download queue manager in Python with bounded concurrency, cancellation, completion cleanup, and `yt-dlp` progress parsing.
3. Keep the repo self-hosted and local-first: no accounts, no external services, no browser build pipeline.
4. Replace Bun commands, lockfiles, CI references, and docs with Python `uv` workflows.
5. Remove obsolete TypeScript/Bun source, config, and helper files once the Python app is in place.
6. Verify the migrated app with the smallest truthful Python-based checks available, then create a local commit if the checkpoint is coherent.

## Target Repo Shape

```
rip/                   # FastAPI app package
  templates/           # Jinja templates
  static/              # Plain CSS and small JS helpers
tests/                 # Python tests / smoke coverage
pyproject.toml         # Python project metadata
README.md              # Python usage and operations
```

## Verification Plan

- `python -m compileall rip tests`
- `pytest`

Status on 2026-03-08:
- `python -m compileall rip tests` passed
- `pytest` is currently blocked because the sandbox does not have project dependencies installed and network access is unavailable for `uv sync`
- A local git commit is also blocked by sandbox write restrictions on the parent repository's worktree metadata

## Constraints

- Python-only implementation for this repo
- No changes outside this worktree
- No stale Bun/TypeScript operational guidance left behind after migration
