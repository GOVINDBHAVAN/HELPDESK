---
name: e2e_architecture
description: Layout of the e2e/ folder, globalSetup lifecycle, fixtures, and the 5 critical setup gotchas for this project's Playwright suite
metadata:
  type: project
---

## Folder layout (as of 2026-07-19)

- `e2e/playwright.config.ts` — `testDir: './tests'`, `fullyParallel: true`, `baseURL: 'http://localhost:5173'`. `webServer` only starts the **frontend** (`npm run dev` in `../frontend`) — the backend is NOT started here (see globalSetup below).
- `e2e/global-setup.ts` — see "globalSetup lifecycle" below.
- `e2e/tests/auth/login.spec.ts`, `e2e/tests/admin/delete-user.spec.ts`, `e2e/tests/tickets/from-email-webhook.spec.ts`, `e2e/tests/tickets/ticket-list.spec.ts` — current spec files, one per feature area.
- `e2e/fixtures/auth.ts` — `fetchToken`, `saveStorageState`, `STORAGE_STATE_PATHS` (`agent`/`admin`), `TEST_CREDENTIALS`. JWT lives in **localStorage** (`helpdesk_token` key, origin `http://localhost:5173`), not cookies, so storage state is built manually (`buildStorageState`) rather than via `request.storageState()`.
- `e2e/fixtures/tickets.ts` — `createTestTicket` via authenticated `POST /api/tickets` (any authenticated role — `.RequireAuthorization()` with no role restriction). `CreateTicketRequest` only accepts `subject`, `description`, `priority`, `category`, `studentEmail` — **no `status`**, tickets always default to `Status = Open` at creation. There is no PATCH/PUT endpoint to change status either.
- `e2e/fixtures/webhook.ts` — `postIncomingEmail`, `uniqueStudentEmail(label)` (the standard per-test unique-studentEmail generator used across all ticket-seeding fixtures, not just the webhook one), `WEBHOOK_SECRET`.
- `e2e/fixtures/db.ts` — direct `pg` client against `helpdesk_test`, connection string parsed from `backend/Helpdesk.Api/appsettings.Testing.json`. Provides `closeTicket(id)` (force status to Closed — only way to test Closed-ticket behavior since no status-change API exists) and `deleteTicketsForStudentEmail(email)` (best-effort cleanup, safe because every test seeds a unique per-test email).
- `e2e/storageState/*.json` — generated at runtime by `saveStorageState`, gitignored.

## globalSetup lifecycle (`e2e/global-setup.ts`)

Runs once before the whole suite:
1. Connects to Postgres as the `postgres` superuser db, terminates any existing backends on `helpdesk_test`, `DROP DATABASE IF EXISTS` + `CREATE DATABASE` — **the test DB is fully wiped and recreated every run**. This means dev-seeded data (the ~101 tickets mentioned in manual QA notes) is never present in e2e runs — only what tests themselves seed, plus whatever other tests are seeding concurrently.
2. Force-kills whatever is listening on port 5000 via a PowerShell `Get-NetTCPConnection` + `taskkill` (the "port kill" gotcha) — waits 1s for the OS to release it.
3. Spawns the backend itself: `dotnet run --project <path> --no-launch-profile` with `ASPNETCORE_ENVIRONMENT=Testing` (the "launch profile" gotcha — `--no-launch-profile` is required or `launchSettings.json`'s own environment/port config wins).
4. Polls `http://127.0.0.1:5000/api/health` (IPv4, not `localhost` — the IPv6 gotcha) until it responds AND `body.environment === 'Testing'` (the "env check" gotcha — this is what proves `EnsureCreated()` + seed users have finished, not just that the process is listening).
5. Returns a teardown closure that kills the backend process after the whole run.

Docker services (`postgres`, `redis`, `mailpit`) are NOT managed by this — they must already be running (`docker compose up -d postgres redis mailpit`) before `npx playwright test`.

## Running tests

From `e2e/`: `npx playwright test` (full suite), `npx playwright test tests/tickets/ticket-list.spec.ts -g "<test name>"` to target one test, `--reporter=line` for compact output. No local `tsc` — the repo doesn't have a bare `typescript` devDependency in `e2e/`, so use `npx playwright test --list` to validate syntax instead of trying `npx tsc`.

See [[known_flaky_pagination_test]] for a DB-race flake found in the pagination test, and [[ticket_list_spec_conventions]] for the seeding/assertion patterns established in `ticket-list.spec.ts` that new tests in that file should follow.
