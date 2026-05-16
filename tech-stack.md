# Tech Stack — Helpdesk System

This document organizes the chosen technologies for the v1 Helpdesk ticketing system.

## Overview
- Backend: ASP.NET Core (Minimal APIs) with C#.
- Frontend: React (TypeScript) with Vite and Tailwind CSS.
- Database: PostgreSQL.
- Cache / Queue: Redis.
- Search: Elasticsearch or lightweight MeiliSearch (optional).
- DevOps: Docker + GitHub Actions; cloud deployment (Azure preferred).

## Backend
- Framework: ASP.NET Core (Minimal API style) targeting .NET 8+.
- ORM: Entity Framework Core (use migrations, strong typing).
- Auth: ASP.NET Identity for user management + JWT for API auth; optional SSO via Google/OAuth/OIDC.
- Background jobs: Hangfire (in-process / dashboard) or Azure Functions for serverless tasks.
- Attachments: store in object storage (Azure Blob / S3) and reference URLs in DB.

## Frontend
- Framework: React with TypeScript.
- Tooling: Vite for fast builds; React Router for routing.
- Styling: Tailwind CSS (utility-first) + optional component library (MUI or Ant Design).
- State: React Query for server state / caching; local state via Context or Zustand as needed.

## Data & Storage
- Primary DB: PostgreSQL for relational data (tickets, users, audit log).
- Search index: Elasticsearch (if complex search needed) or MeiliSearch for simpler full-text search.
- Attachments: Blob storage (Azure Blob / S3) or local storage for dev.

## Caching, Queues & Background
- Cache: Redis for session caching, rate limiting, and short-lived data.
- Queue / jobs: Hangfire (for .NET) or Redis-backed job queue for email retries, escalations, SLA checks.

## Email & Ingestion
- Inbound: IMAP polling from Gmail (dev) per spec; consider switching to an inbound webhook/email provider for scale.
- Outbound: SMTP via Gmail (dev) or transactional email provider (SendGrid, Mailgun) in prod.
- Dev testing: MailHog or SMTP capture in local environment.

## AI & Knowledge Base
- AI provider: Anthropic (Claude) as specified.
- KB: combination of static markdown articles, structured articles in DB, and previous resolved tickets.
- PII handling: mask/anonymize PII before sending prompts to AI.

## Security & Compliance
- TLS for all endpoints; enforce HTTPS.
- Data privacy: GDPR / FERPA / HIPAA considerations — encrypt sensitive fields at rest, redact PII sent to AI, provide data retention controls.
- Audit logs: persist user actions (who, what, when) in DB.

## Testing & Quality
- Unit tests: xUnit for backend; React Testing Library + Jest for frontend.
- E2E: Playwright for critical flows (login, create ticket, reply, search).
- Linting & formatting: dotnet-format / Roslyn analyzers; ESLint + Prettier + TypeScript rules for frontend.

## DevOps & Deployment
- Containerization: Docker (backend, frontend, local Postgres, Redis, search for dev).
- CI: GitHub Actions for build/test and container image publishing.
- Hosting: Azure App Service / AKS for backend; static hosting (Azure Storage / CDN or Vercel) for frontend. Alternatives: AWS ECS / Cloud Run.
- Observability: Application Insights (Azure) or Prometheus + Grafana; centralized logs (ELK or Azure Monitor).

## Local Development
- Docker Compose with services: api, web, postgres, redis, mailhog, (optional) elastic/meilisearch.
- Seed script to create admin user and sample tickets.

## Recommendations & Next Steps
1. Commit this `tech-stack.md` to project docs.
2. Scaffold a minimal solution: ASP.NET Core Minimal API + Vite React app + Docker Compose.
3. Add CI pipeline skeleton (lint, unit tests, build image).
4. Implement PII redaction utilities before any AI calls.

---
Generated from `specification.md` tech choices and project requirements.
