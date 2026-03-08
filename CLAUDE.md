# CLAUDE.md

Repo-local instructions for code agents working on `rip`.

## Repo Rules

- Target stack: Python with FastAPI, server-rendered HTML, plain CSS, and minimal JavaScript.
- Keep the repo self-hosted and local-first. No hosted service assumptions.
- Prefer `uv` commands for install, run, and test flows.
- Run `uv run pytest` before committing when tests are available.
- Run `uv run python -m compileall rip tests` when changing Python source layout.
- Do not add Bun, Node, TypeScript, Go, or C tooling back into this repo.
- Do not add AI attribution to commits.
