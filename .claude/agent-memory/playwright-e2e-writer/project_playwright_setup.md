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

- Email input: `type="text"` (not `type="email"`) — browser validation bypassed, Zod handles it
- Error border class: `border-destructive` (shadcn token, NOT `border-red-500`)
- Error paragraphs: `role="alert"`
- Submit button: "Sign in" idle / "Signing in…" submitting
- Token localStorage key: `helpdesk_token`
- `AdminRoute`: unauthenticated → `/login`; authenticated non-Admin → `/` (not `/login`)

**Why:** JWT in localStorage (not cookies) requires manual storage state construction.
**How to apply:** Always use `buildStorageState()` from `e2e/fixtures/auth.ts` when creating authenticated test contexts; never rely on `request.storageState()` alone.
