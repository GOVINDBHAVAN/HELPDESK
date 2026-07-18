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
- **CORRECTION (2026-07-18, later same day): a global `JsonStringEnumConverter` IS registered** — `builder.Services.ConfigureHttpJsonOptions(...)` at Program.cs ~line 75-78 adds it. `TicketResponse.Status/Priority/Category` serialize as C# enum **names** as strings (`"Open"`, `"Closed"`, `"High"`, `"Technical"`, ...), not ordinal integers. The note previously here claiming no converter was registered was wrong — confirmed by re-reading Program.cs directly and by `TicketRow` in `frontend/src/components/TicketTable.tsx` typing `status`/`priority`/`category` as `string` and keying badge-color maps off names like `Open`/`InProgress`/`Resolved`/`Closed`. Named constants in `e2e/fixtures/webhook.ts` (`TICKET_STATUS_OPEN`, etc.) are still correct to use — just via string equality, not numeric ordinals. **Always re-verify enum wire format by grepping `ConfigureHttpJsonOptions` in Program.cs before trusting either this note or the older one** — this has apparently changed at least once.
- **Product gap**: there is no PATCH/PUT endpoint to change a ticket's Status, and no DELETE /api/tickets/{id}. New file `e2e/fixtures/db.ts` talks directly to Postgres (`pg` package, already a devDependency) to (a) force a ticket to `Closed` via raw SQL (`closeTicket(id)`) and (b) clean up webhook-created tickets (`deleteTicketsForStudentEmail(email)`), since the webhook has no authenticated creator/token to act through. Table/columns are snake_case (EF `UseSnakeCaseNamingConvention`): table `tickets`, column `student_email`; status stored as the enum **name** as text in the DB (`'Closed'`) even though it serializes as an integer over JSON — two different representations, don't confuse them.
- `NormalizeSubject` (Program.cs ~line 371) strips a leading `re:`/`fwd:`/`fw:` prefix (case-insensitive) and lowercases/trims before matching — a good single test can exercise both by sending `RE: {ORIGINAL SUBJECT IN CAPS}` as the follow-up subject.
- Matching query: `Tickets.Where(t => t.StudentEmail == request.FromEmail && t.Status != TicketStatus.Closed)` then in-memory `FirstOrDefault` on normalized subject — confirms Closed tickets are excluded at the DB-query level, not just filtered after.
- New fixture `e2e/fixtures/webhook.ts`: `postIncomingEmail(request, payload, secret?)` (secret defaults to the correct value; pass `undefined` to omit the header, or a wrong string to test mismatch), `uniqueStudentEmail(label)` (timestamp+random suffixed, same pattern as `users.ts`'s unique-email helper), plus the `TICKET_*` enum-ordinal constants above.
- Test file: `e2e/tests/tickets/from-email-webhook.spec.ts` — pure API-only spec (only the `request` fixture, no `page`/`storageState` at all), following the same pattern as delete-user.spec.ts's Group 4. Cross-verifies webhook-created/threaded tickets via `GET /api/tickets` with an Agent bearer token (fetched via `fetchToken` from `auth.ts`) rather than trusting the webhook's own response echo.

## Ticket list UI tests (added 2026-07-18, trimmed 2026-07-18)

- `GET /api/tickets` (Program.cs ~line 220) just requires `.RequireAuthorization()` — any authenticated role can call it, and the frontend's `/tickets` route (TicketsPage.tsx -> TicketTable.tsx) has no `AdminRoute` wrapper either. So ticket-list UI tests only need the agent storage state, no per-role parity test.
- `POST /api/tickets` (Program.cs ~line 241) also just needs `.RequireAuthorization()` (no role restriction) — `CreateTicketRequest { subject, description, priority, category, studentEmail }`, with `priority`/`category` accepted as enum-name strings (`"High"`, `"Technical"`, etc. — see the enum-serialization correction above). New fixture `e2e/fixtures/tickets.ts`: `createTestTicket(request, token, { subject, studentEmail, description?, priority?, category? })`. Cleanup reuses `db.ts`'s `deleteTicketsForStudentEmail` (same `student_email` column regardless of which endpoint created the row) — always wrap seeding + assertions in try/finally.
- Backend orders `GET /api/tickets` with `.OrderByDescending(t => t.CreatedAt)`. To test this, seed two tickets **sequentially** (`await` each `createTestTicket` call one at a time, not `Promise.all`) so the second genuinely has a later `CreatedAt`, then assert row order via `page.locator('table tbody tr').allTextContents()` and compare `findIndex` positions of each ticket's subject — more robust than `getByRole('row')` positional locators when other shared-DB tickets may also be present in the table.
- **TRIMMED (2026-07-18)**: after the user added component tests in `frontend/src/pages/TicketsPage.test.tsx` (Vitest + RTL, mocked `api.get`) covering loading skeleton, row rendering/column values, badges, empty state, error message, heading, and column headers, `e2e/tests/tickets/ticket-list.spec.ts` was cut down to **only** the newest-first-ordering test. Removed: the "seeded ticket renders correct columns" test and the "multiple tickets each render their own row" test (Group 1 — pure markup-from-data, no different from a mocked component test), and the empty-state test (Group 3 — it already mocked `page.route('**/api/tickets')` to return `[]`, so it wasn't exercising the real backend either). Kept: newest-first ordering, because `TicketTable.tsx` does zero client-side sorting — that test is the only one actually verifying the backend's `.OrderByDescending(t => t.CreatedAt)` contract, which a mocked component test structurally cannot do.
- Because only the ordering test remains, `beforeAll` now calls `saveStorageState(request, 'agent')` alone — the admin storage state save was dead weight (never referenced by any test in this file, even before trimming) and was dropped along with the two removed `test.describe` blocks that used the admin path only via the shared `Promise.all` in beforeAll.
- **General principle for this project**: when review reveals an e2e test only asserts on rendering/markup driven by seeded-and-then-displayed data (no distinct backend behavior like sorting/filtering/computed fields being verified), prefer moving it to a Vitest component test against a mocked API — faster, no DB/backend dependency, and equally strong signal. Reserve e2e for things that specifically require the real backend (query ordering, auth/authorization boundaries, DB constraints, actual network round-trips) or the real browser (routing, real DOM layout).
- Test file: `e2e/tests/tickets/ticket-list.spec.ts` (now single-purpose: ordering only).

## Sandbox execution limitation

PostgreSQL availability in this dev sandbox is inconsistent across sessions — sometimes port 5432 refuses connections (in which case `global-setup.ts` fails at step 1, drop/recreate `helpdesk_test`, before the backend or frontend ever start), other times it's up and a full live run succeeds (confirmed 2026-07-18: `npx playwright test tests/tickets/ticket-list.spec.ts` ran globalSetup, started the backend in `Testing` env, and passed for real against the DB).
**How to apply:** Always check first with `powershell.exe -NoProfile -Command "Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet"` — if `True`, attempt a real `npx playwright test <path> --reporter=list` run rather than assuming it's unavailable. Only fall back to `npx playwright test --list` (syntax/import check) + `frontend/node_modules/.bin/tsc --noEmit -p e2e/tsconfig.json --ignoreDeprecations 6.0` (typecheck; e2e/ has no local `tsc`, borrow the frontend's) when Postgres is confirmed down, and tell the user a live run is still needed elsewhere.
