# Helpdesk Ticket Management System

This repository contains the Phase 0 foundation for an AI-powered helpdesk ticket management system.

## What is included

- ASP.NET Core backend scaffold with Identity, JWT auth, and ticket data model
- React + TypeScript frontend scaffold with Vite
- Local `docker-compose.yml` for PostgreSQL, Redis, Mailpit, backend, and frontend development
- Root `.gitignore`

## Run locally

### Backend
1. Open `backend/Helpdesk.Api` in a terminal.
2. Run `dotnet restore`.
3. Run `dotnet run --project backend/Helpdesk.Api/Helpdesk.Api.csproj`.

### Frontend
1. Open `frontend` in a terminal.
2. Run `npm install`.
3. Run `npm run dev`.

### Docker Compose

To start the local stack:

```bash
docker compose up -d
```

Then open:

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`
- Mailpit: `http://localhost:8025`

## Next steps

- Build ticket list/detail UI
- Add email ingestion support
- Add AI classification and response generation
- Add user management and roles
