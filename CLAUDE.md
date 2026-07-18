# CLAUDE.md — Helpdesk Project

## Project Overview

AI-powered helpdesk ticketing system for educational institutions. Students submit tickets via email or web; agents manage them through a dashboard with AI-assisted classification, summarization, and reply suggestions.

## Architecture

- **Backend**: ASP.NET Core 10 Minimal API (`backend/Helpdesk.Api/`)
- **Frontend**: React 19 + TypeScript + Vite (`frontend/`)
- **Database**: PostgreSQL via EF Core (Npgsql provider)
- **Cache**: Redis (StackExchange.Redis)
- **Auth**: ASP.NET Identity + JWT Bearer
- **AI**: Anthropic Claude (planned — Phase 2)

## Key Files

- [backend/Helpdesk.Api/Program.cs](backend/Helpdesk.Api/Program.cs) — all API endpoints (Minimal API style)
- [backend/Helpdesk.Api/Data/HelpdeskDbContext.cs](backend/Helpdesk.Api/Data/HelpdeskDbContext.cs) — EF Core DbContext
- [backend/Helpdesk.Api/Entities/](backend/Helpdesk.Api/Entities/) — domain entities (ApplicationUser, Ticket)
- [backend/Helpdesk.Api/Models/](backend/Helpdesk.Api/Models/) — request/response models and settings
- [frontend/src/App.tsx](frontend/src/App.tsx) — React app entry
- [frontend/src/main.tsx](frontend/src/main.tsx) — React root mount

## Roles

Three roles defined in the system: `Admin`, `Agent`, `Student`.

## API Endpoints (implemented)

- `GET /api/health` — health check (anonymous)
- `POST /api/auth/register` — register a new user (anonymous, assigns Agent role)
- `POST /api/auth/login` — login, returns JWT (anonymous)
- `GET /api/tickets` — list all tickets (requires auth)
- `POST /api/tickets` — create a ticket (requires auth)

## Dev Scripts

- [dev.ps1](dev.ps1) — PowerShell script to start the full dev environment
- Backend: `dotnet run` from `backend/Helpdesk.Api/`
- Frontend: `npm run dev` from `frontend/` (runs on Vite default port)
- Backend runs on `http://localhost:5000`

## Project Documents

| File | Purpose |
|------|---------|
| [project-scope.md](project-scope.md) | Problem statement, solution summary, and feature list |
| [specification.md](specification.md) | Detailed requirements Q&A — email ingestion, AI behaviour, roles, SLA, compliance, tech stack |
| [tech-stack.md](tech-stack.md) | Chosen technologies with rationale — backend, frontend, DB, cache, email, AI, DevOps |
| [implementation-plan.md](implementation-plan.md) | Phased delivery plan with sprint breakdown |

## Implementation Phases

See [implementation-plan.md](implementation-plan.md) for the full breakdown:
- **Phase 0** (done): project setup, EF Core, JWT auth, Redis, basic ticket CRUD
- **Phase 1**: email ingestion, ticket lifecycle, ticket UI, admin controls
- **Phase 2**: AI classification, summarization, reply assistant, knowledge base
- **Phase 3**: notifications, routing, SLA, dashboard/reporting
- **Phase 4**: QA, security hardening, deployment

## Testing

### Testing philosophy

Rely mostly on component tests; reach for e2e only when necessary. Concretely:

- Default to a component test for anything that can be verified with a mocked `api` module: rendering logic, columns/rows/badges, loading/error/empty states, form validation, client-side sorting/filtering.
- Only add (or keep) an e2e test for behavior a mocked component test structurally cannot verify — real backend contracts (e.g. DB-level ordering, auth/JWT flow, role-based access, cross-page navigation) or genuine multi-system integration.
- When a feature needs both, write the component test first for the rendering/logic surface, and let the e2e test cover only the remaining real-backend gap — don't duplicate the same assertion in both layers.
- When reviewing or trimming an existing e2e spec, ask "would a mocked component test prove this just as well?" — if yes, move it to Vitest and delete the e2e version.

### Component tests (React Testing Library + Vitest)

- **Runner**: Vitest, configured in `frontend/vite.config.ts` (jsdom environment, globals enabled)
- **Setup file**: `frontend/src/test/setup.ts` — imports `@testing-library/jest-dom` matchers
- **Shared render helper**: `frontend/src/test/renderWithProviders.tsx` — wraps any component in `QueryClientProvider` with `retry: false`. Import and use it in every component test instead of bare `render`.
- **Test file location**: co-located with the component, e.g. `src/pages/UsersPage.test.tsx` next to `UsersPage.tsx`
- **Mock the API module** at the top of every test file — never hit a real server:
  ```ts
  vi.mock('../lib/api', () => ({ default: { get: vi.fn() } }))
  import api from '../lib/api'
  const mockedGet = vi.mocked(api.get)
  ```
- **Reset mocks** in `beforeEach` with `vi.resetAllMocks()`
- **Run tests**: `npm run test` from `frontend/` (single run) or `npm run test:watch` (watch mode)

### E2E tests (Playwright)

Use the **`playwright-e2e-writer` agent** for all end-to-end test writing — do not write Playwright tests inline. Per the testing philosophy above, only trigger it when a feature has a real-backend concern component tests can't cover (auth flow, role-based access, DB-level ordering/contracts, cross-page navigation) — not automatically for every UI feature or API endpoint:

```
Agent({ subagent_type: "playwright-e2e-writer", ... })
```

The agent knows the project's e2e setup (globalSetup architecture, `helpdesk_test` DB, storage state per role, IPv4 gotcha, etc.) and maintains its own memory across conversations.

## Documentation

Use the **context7 MCP server** for all library and framework documentation lookups — do not rely on training data for API syntax or configuration. This covers:
- ASP.NET Core / EF Core / Identity / JWT
- React / Vite / TypeScript
- StackExchange.Redis / Npgsql
- Tailwind CSS, TanStack Query, Axios, Zustand (planned)
- Anthropic Claude SDK (Phase 2)

Example usage before writing EF Core migrations or ASP.NET Identity code:
```
mcp__context7__resolve-library-id("entity framework core")
mcp__context7__query-docs(library_id, "migrations add-migration")
```

## Conventions

- All endpoints live in `Program.cs` (Minimal API — no controllers)
- No EF Core migrations yet — `db.Database.EnsureCreated()` is used in dev
- JWT secret and connection strings go in `appsettings.Development.json` (not committed)
- **All API calls use Axios** — import the pre-configured instance from `src/lib/api.ts` (baseURL `/api`, auth header injected via interceptor). Never use raw `fetch` or create a second Axios instance.
- **All server state uses TanStack Query** — use `useQuery` for reads and `useMutation` for writes. Never use `useState` + `useEffect` to fetch data. `QueryClientProvider` is already wired in `App.tsx`.
- **All enums are stored as text in the database** — use `.HasConversion<string>()` in `OnModelCreating` for every enum property (e.g. `TicketStatus`, `TicketPriority`, `TicketCategory`)
- **UI components use shadcn/ui** — run `npx shadcn@latest add <component>` from `frontend/` to add components; they land in `src/components/ui/`. Use the `cn()` helper from `@/lib/utils` for conditional class merging. Use shadcn semantic color tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-destructive`, `border-border`, etc.) — never hardcode Tailwind gray/color values directly.
- **Never write raw HTML `<table>`, `<button>`, `<input>`, `<label>`, `<select>`, `<textarea>`, etc. directly** — always use the corresponding shadcn/ui component (`Table`/`TableHeader`/`TableRow`/`TableCell`, `Button`, `Input`, `Label`, `Badge`, ...) from `src/components/ui/`. If the component doesn't exist yet under `src/components/ui/`, add it with `npx shadcn@latest add <component>` before using it. Note: on this Windows/Git-Bash setup, the shadcn CLI has been observed writing to a literal `@/` directory instead of resolving the `@` alias to `src/` — check `src/components/ui/` after running `add` and move the files manually if this happens.
- **All forms use React Hook Form + Zod** — define a `z.object` schema, pass it via `zodResolver`, and spread `{...register('field')}` onto inputs. Never use uncontrolled `useState` for form fields.
