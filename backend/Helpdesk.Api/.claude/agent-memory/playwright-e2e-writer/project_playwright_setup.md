---
name: project_playwright_setup
description: e2e/ folder architecture — globalSetup, storageState, fixtures — verified against the actual files as of 2026-07-19
metadata:
  type: project
---

Verified structure of `e2e/` (repo root, sibling of `backend/` and
`frontend/`):

- `e2e/global-setup.ts` — the ONLY thing that starts the backend for e2e
  runs. It: (1) drops+recreates the `helpdesk_test` Postgres DB via a raw
  `pg` client, reading the connection string out of
  `backend/Helpdesk.Api/appsettings.Testing.json`; (2) force-kills whatever
  is listening on port 5000 via a PowerShell `Get-NetTCPConnection` +
  `taskkill` one-liner; (3) spawns `dotnet run --project <backendDir>
  --no-launch-profile` with `ASPNETCORE_ENVIRONMENT=Testing`; (4) polls
  `GET http://127.0.0.1:5000/api/health` until the JSON body's `environment`
  field equals `"Testing"` (confirms `EnsureCreated()` + seed users finished,
  not just that the process is listening). Returns a teardown fn that kills
  the backend process.
- `e2e/playwright.config.ts` — `webServer` only manages the Vite frontend
  (`npm run dev` in `../frontend`, url `http://localhost:5173`). The backend
  is deliberately NOT a `webServer` entry — globalSetup owns its lifecycle.
  `fullyParallel: true`, single `chromium` project, `baseURL:
  'http://localhost:5173'`.
- Postgres/Redis/Mailpit themselves are NOT started by globalSetup — see
  [[project_e2e_infra]] for that gotcha (Docker Desktop / docker-compose).
- Auth: JWT lives in `localStorage['helpdesk_token']`, not cookies, so
  `request.storageState()` can't capture it. `e2e/fixtures/auth.ts` instead
  POSTs `/api/auth/login` for a raw token and hand-builds a Playwright
  `StorageState` object with `origins: [{ origin: 'http://localhost:5173',
  localStorage: [{ name: 'helpdesk_token', value: token }] }]`, written to
  `e2e/storageState/{admin,agent}.json`. Specs call
  `saveStorageState(request, role)` in a `beforeAll` (idempotent) and
  `test.use({ storageState: STORAGE_STATE_PATHS[role] })` per describe block.
  Test credentials (`admin@test.helpdesk.local` / `agent@test.helpdesk.local`)
  are seeded by the backend itself on startup per
  `appsettings.Testing.json`'s `Seed` section — fixtures just reference them,
  don't create them.
- `e2e/fixtures/tickets.ts` — `createTestTicket` via authenticated
  `POST /api/tickets` (any role, just needs `.RequireAuthorization()`).
- `e2e/fixtures/webhook.ts` — `postIncomingEmail` via anonymous
  `POST /api/tickets/from-email`, gated by an `X-Webhook-Secret` header
  (`WEBHOOK_SECRET` constant, must match
  `WebhookSettings:InboundEmailSecret` in the Testing appsettings). Also
  exports `uniqueStudentEmail(label)` used by essentially every ticket-
  seeding test for isolation under `fullyParallel`.
- `e2e/fixtures/db.ts` — raw `pg` client helpers for things with no API
  surface: `closeTicket(id)` (force a ticket to `Closed` status — no
  PATCH/PUT endpoint exists) and `deleteTicketsForStudentEmail(email)`
  (cleanup, best-effort, always called from a spec's `finally` block).
- All direct API/db calls use `http://127.0.0.1:5000`, never `localhost`
  (IPv6 resolution gotcha — confirmed again in [[project_e2e_infra]], same
  class of issue hit Postgres too via `Host=localhost` in the connection
  string resolving to `::1`).
- Existing spec files as of 2026-07-19: `e2e/tests/auth/login.spec.ts`,
  `e2e/tests/admin/delete-user.spec.ts`,
  `e2e/tests/tickets/from-email-webhook.spec.ts`,
  `e2e/tests/tickets/ticket-list.spec.ts`. See
  [[feedback_narrow_spec_files]] for the convention of extending
  `ticket-list.spec.ts` rather than forking new files for closely related
  `/tickets` coverage, and [[project_tanstack_table_sort_toggle]] for a
  TicketTable-specific interaction quirk discovered while extending it.
