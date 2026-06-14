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

Use the **`playwright-e2e-writer` agent** for all end-to-end test writing — do not write Playwright tests inline. Trigger it after implementing any UI feature or API endpoint:

```
Agent({ subagent_type: "playwright-e2e-writer", ... })
```

The agent knows the project's e2e setup (globalSetup architecture, `helpdesk_test` DB, storage state per role, IPv4 gotcha, etc.) and maintains its own memory across conversations.

## Documentation

Use the **context7 MCP server** for all library and framework documentation lookups — do not rely on training data for API syntax or configuration. This covers:
- ASP.NET Core / EF Core / Identity / JWT
- React / Vite / TypeScript
- StackExchange.Redis / Npgsql
- Tailwind CSS, React Query, Zustand (planned)
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
- Frontend has no routing or state management libraries yet — add React Router and React Query as Phase 1 begins
- **All enums are stored as text in the database** — use `.HasConversion<string>()` in `OnModelCreating` for every enum property (e.g. `TicketStatus`, `TicketPriority`, `TicketCategory`)
- **UI components use shadcn/ui** — run `npx shadcn@latest add <component>` from `frontend/` to add components; they land in `src/components/ui/`. Use the `cn()` helper from `@/lib/utils` for conditional class merging. Use shadcn semantic color tokens (`bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `text-destructive`, `border-border`, etc.) — never hardcode Tailwind gray/color values directly.
- **All forms use React Hook Form + Zod** — define a `z.object` schema, pass it via `zodResolver`, and spread `{...register('field')}` onto inputs. Never use uncontrolled `useState` for form fields.
