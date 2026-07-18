---
name: playwright-e2e-setup
description: e2e folder layout, helpdesk_test DB, globalSetup architecture, storage state strategy, and critical gotchas for the Helpdesk Playwright suite
metadata:
  type: project
---

## Architecture

- Config: `e2e/playwright.config.ts` — `testDir: './tests'`, `baseURL: 'http://localhost:5173'`
- Global setup: `e2e/global-setup.ts` — drops/recreates `helpdesk_test` DB, kills port 5000 via PowerShell `Get-NetTCPConnection`, starts backend with `ASPNETCORE_ENVIRONMENT=Testing`, waits for `http://127.0.0.1:5000/api/health` to return `{ environment: 'Testing' }`
- Backend managed in `globalSetup` (NOT by Playwright's `webServer`) — frontend Vite dev server IS managed by `webServer`
- Tests live in `e2e/tests/<feature>/`; shared fixtures in `e2e/fixtures/`; storage state files in `e2e/storageState/`

## 5 Critical Gotchas

1. **Launch profile**: Backend started with `--no-launch-profile` + env var `ASPNETCORE_ENVIRONMENT=Testing` in globalSetup
2. **IPv4**: All direct API calls use `http://127.0.0.1:5000` — never `http://localhost:5000` (IPv6 resolution issues on Windows)
3. **Port kill**: globalSetup kills port 5000 via `powershell Get-NetTCPConnection` + `taskkill /F /PID` before starting backend
4. **No `webServer` for backend**: Backend lifecycle is entirely in globalSetup/teardown; only Vite frontend is in `webServer`
5. **Env check**: globalSetup reads `appsettings.Testing.json` for DB connection string and verifies `{ environment: 'Testing' }` from health endpoint before proceeding

## Storage State Strategy

The JWT is stored in `localStorage` (key: `helpdesk_token`) — NOT in cookies. Therefore `request.storageState()` does NOT capture it automatically.

Strategy:
1. `e2e/fixtures/auth.ts` — `fetchToken()` calls `POST http://127.0.0.1:5000/api/auth/login`, then `buildStorageState()` constructs the Playwright storage state JSON manually with `origins[].localStorage`
2. `saveStorageState(request, role)` writes the file to `e2e/storageState/{role}.json`
3. Tests call `saveStorageState` in `beforeAll` (once per run), then apply with `page.context().setStorageState(path)`
4. `test.use({ storageState: { cookies: [], origins: [] } })` resets to unauthenticated for validation/error groups

## Seed Users (appsettings.Testing.json)

| Role  | Email                        | Password       |
|-------|------------------------------|----------------|
| Admin | admin@test.helpdesk.local    | AdminPass123!  |
| Agent | agent@test.helpdesk.local    | AgentPass123!  |

## Key UI Facts

- Email input on the login form: `type="text"` (not `type="email"`) — browser validation bypassed, Zod handles it. NOTE: `CreateUserForm.tsx`'s email field IS `type="email"` — that form doesn't hit the same gotcha because it isn't being tested for Zod email-format errors yet.
- Error border class: `border-destructive` (shadcn token, NOT `border-red-500`)
- Error paragraphs: `role="alert"`
- Submit button: "Sign in" idle / "Signing in…" submitting
- Token localStorage key: `helpdesk_token`
- `AdminRoute`: unauthenticated → `/login`; authenticated non-Admin → `/` (not `/login`)
- shadcn `Dialog` (Radix) renders with accessible `role="dialog"` — `page.getByRole('dialog')` works directly, no testid needed
- shadcn `Table` renders real `<table>`/`<tr>` — `page.getByRole('row').filter({ hasText: ... })` is the reliable way to scope to one row (row accessible-name computation via `getByRole('row', {name})` is unreliable when the row contains an icon button with its own aria-label; use `.filter({hasText})` instead)

## Users / Delete-user feature (added 2026-07-12)

- `POST /api/auth/register` now `RequireAuthorization(RequireRole(Admin))` — it is NO LONGER anonymous (CLAUDE.md's endpoint table is stale on this point). Any test that seeds a user must attach an admin bearer token as an `Authorization` header when calling it directly via `request.post`.
- New helper file `e2e/fixtures/users.ts`: `createTestUser(request, adminToken, overrides?)`, `deleteTestUser(request, adminToken, id)`, `listUsers(request, adminToken)`. Always creates users with a `Date.now()-random` suffixed email/displayName to avoid collisions under `fullyParallel: true`. Use this instead of touching the shared `agent@test.helpdesk.local` fixture user when a test needs to delete something.
- `/api/auth/register` always assigns the Agent role — no way to seed a fresh Student/Admin via that endpoint.
- Soft-delete: `DELETE /api/users/{id}` sets `IsDeleted`/`DeletedAt`; EF Core `HasQueryFilter` then excludes the row from `GET /api/users` automatically. 204 on success, 404 for not-found/already-deleted id, 400 `{ error: "Admin users cannot be deleted." }` when target has the Admin role, 403 when caller isn't Admin.
- `UserTable.tsx` delete icon button: ghost icon `Button`, `aria-label="Delete {displayName || email}"`, `disabled` when `role === 'Admin'`. Disabled shadcn/native buttons ignore even `click({ force: true })` — good way to prove "cannot be opened", not just "attribute is disabled".
- `DeleteUserModal.tsx` description text: `Are you sure you want to delete {name}? This action cannot be undone by the user.` — match on the leading question, not the whole string, in case wording shifts.
- Test file: `e2e/tests/admin/delete-user.spec.ts`.

**Why:** JWT in localStorage (not cookies) requires manual storage state construction.
**How to apply:** Always use `buildStorageState()` from `e2e/fixtures/auth.ts` when creating authenticated test contexts; never rely on `request.storageState()` alone.

## Inbound email webhook / ticket API-only tests (added 2026-07-18)

- `POST /api/tickets/from-email` (Program.cs ~line 266) is `.AllowAnonymous().AddEndpointFilter<WebhookSecretFilter>()` — auth is a custom endpoint filter requiring header `X-Webhook-Secret` to match `WebhookSettings:InboundEmailSecret`. Testing value: `test-inbound-email-webhook-secret` in `appsettings.Testing.json`. Filter runs before the handler, so a bad/missing secret 401s even with a fully valid body.
- **No JsonStringEnumConverter is registered anywhere in Program.cs** — `TicketResponse.Status/Priority/Category` serialize as raw C# enum **ordinal integers** over JSON, not strings (e.g. `status: 0` for Open, `3` for Closed). Don't assert on string values for these fields. Named constants live in `e2e/fixtures/webhook.ts` (`TICKET_STATUS_OPEN`, `TICKET_STATUS_CLOSED`, `TICKET_PRIORITY_MEDIUM`, `TICKET_CATEGORY_GENERAL`) — extend that list rather than hardcoding new magic numbers per spec file.
- **Product gap**: there is no PATCH/PUT endpoint to change a ticket's Status, and no DELETE /api/tickets/{id}. New file `e2e/fixtures/db.ts` talks directly to Postgres (`pg` package, already a devDependency) to (a) force a ticket to `Closed` via raw SQL (`closeTicket(id)`) and (b) clean up webhook-created tickets (`deleteTicketsForStudentEmail(email)`), since the webhook has no authenticated creator/token to act through. Table/columns are snake_case (EF `UseSnakeCaseNamingConvention`): table `tickets`, column `student_email`; status stored as the enum **name** as text in the DB (`'Closed'`) even though it serializes as an integer over JSON — two different representations, don't confuse them.
- `NormalizeSubject` (Program.cs ~line 371) strips a leading `re:`/`fwd:`/`fw:` prefix (case-insensitive) and lowercases/trims before matching — a good single test can exercise both by sending `RE: {ORIGINAL SUBJECT IN CAPS}` as the follow-up subject.
- Matching query: `Tickets.Where(t => t.StudentEmail == request.FromEmail && t.Status != TicketStatus.Closed)` then in-memory `FirstOrDefault` on normalized subject — confirms Closed tickets are excluded at the DB-query level, not just filtered after.
- New fixture `e2e/fixtures/webhook.ts`: `postIncomingEmail(request, payload, secret?)` (secret defaults to the correct value; pass `undefined` to omit the header, or a wrong string to test mismatch), `uniqueStudentEmail(label)` (timestamp+random suffixed, same pattern as `users.ts`'s unique-email helper), plus the `TICKET_*` enum-ordinal constants above.
- Test file: `e2e/tests/tickets/from-email-webhook.spec.ts` — pure API-only spec (only the `request` fixture, no `page`/`storageState` at all), following the same pattern as delete-user.spec.ts's Group 4. Cross-verifies webhook-created/threaded tickets via `GET /api/tickets` with an Agent bearer token (fetched via `fetchToken` from `auth.ts`) rather than trusting the webhook's own response echo.

## Sandbox execution limitation

This dev sandbox does not have PostgreSQL running/installed (port 5432 refuses connections), so `global-setup.ts` fails at step 1 (drop/recreate `helpdesk_test`) before the backend or frontend ever start. Full `npx playwright test` runs cannot be executed live here.
**How to apply:** Validate new specs with `npx playwright test --list` (catches import/syntax errors) and typecheck with `frontend/node_modules/.bin/tsc --noEmit -p e2e/tsconfig.json --ignoreDeprecations 6.0` (e2e/ has no local `tsc`; borrow the frontend's). Tell the user a live run is still needed on a machine with Postgres + dotnet available.
