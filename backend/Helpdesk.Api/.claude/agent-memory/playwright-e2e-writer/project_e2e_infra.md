---
name: project_e2e_infra
description: How the e2e suite's infra (Postgres/Redis/Mailpit via Docker, backend via globalSetup) is actually started, and what breaks if it isn't running
metadata:
  type: project
---

The e2e suite (`e2e/global-setup.ts`) does NOT start Postgres/Redis itself — it
only drops/recreates the `helpdesk_test` DB via a `pg` client and spawns the
.NET backend (`dotnet run --no-launch-profile`, `ASPNETCORE_ENVIRONMENT=Testing`).
Postgres, Redis, and Mailpit are separate Docker containers defined in
`docker-compose.yml` at the repo root, normally started by `dev.ps1`
(`docker compose up -d postgres redis mailpit`).

**Why:** On 2026-07-19, running `npx playwright test` cold failed with
`Error: connect ECONNREFUSED ::1:5432` — Docker Desktop itself wasn't running
(no `dockerDesktopLinuxEngine` named pipe), so `docker compose up -d` also
failed. Had to launch `C:\Program Files\Docker\Docker\Docker Desktop.exe`,
poll `docker info` until it responded (~10s), then `docker compose up -d
postgres redis mailpit` before globalSetup's `pg` connection would succeed.
Once the containers were up, `docker compose ps` showed they'd actually been
created 7-8 weeks earlier and just needed Docker Desktop itself running — the
containers persist across host reboots, only the Docker daemon needs restarting.

**How to apply:** Before running any e2e test in this repo, if a fresh
`npx playwright test` run fails fast with `ECONNREFUSED ::1:5432` (or similar
for `6379`), don't assume the DB is misconfigured — check
`docker compose ps` first. If Docker Desktop's daemon isn't reachable, start
`Docker Desktop.exe`, wait for `docker info` to succeed, then
`docker compose up -d postgres redis mailpit` (or just run `dev.ps1`, though
that also launches the backend/frontend dev servers which globalSetup starts
itself — no need to run those halves of `dev.ps1` for e2e runs, just the
compose line). See [[project_playwright_setup]] for the rest of the
globalSetup architecture (port-kill, IPv4, env checks).
