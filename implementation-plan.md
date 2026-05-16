# Implementation Plan

## Overview
This implementation plan breaks the Helpdesk AI-powered ticket management system into phases with small, actionable tasks. The goal is to deliver a strong MVP first, then layer in AI, routing, notifications, reporting, and deployment.

---

## Phase 0 — Setup & Foundation

1. Project setup
   - Finalize MVP scope from `project-scope.md` and `specification.md`
   - Confirm the technology stack documented in `tech-stack.md`
2. Repository scaffolding
   - Create ASP.NET Core backend solution
   - Create React + TypeScript frontend with Vite
   - Add Docker Compose for Postgres, Redis, MailHog, and optional search
3. Core infrastructure
   - Configure PostgreSQL, Redis, and attachment storage
   - Add EF Core migrations and database connection setup
   - Create API and frontend build/run scripts
4. Authentication and roles
   - Implement ASP.NET Identity + JWT auth
   - Enable email/password login
   - Add Google / SSO support
   - Add roles: Admin, Agent, Student

---

## Phase 1 — Core Ticket Flow

1. Ticket data model
   - Define tickets, ticket threads, messages, attachments
   - Add categories, priority, status, routing metadata
   - Add student accounts and ticket ownership
2. Email ingestion
   - Implement IMAP polling for Gmail
   - Build inbound email parsing and ticket creation
   - Thread repeated student emails into existing tickets
   - Store attachments and expose them in ticket details
3. Ticket lifecycle
   - Implement Open → In Progress → Resolved → Closed states
   - Support re-opening closed tickets
   - Add audit logging for state changes
4. Ticket UI
   - Build ticket list with filters: status, category, priority, agent, date
   - Build ticket detail page with conversation history and attachments
   - Add full-text search over ticket subject/body
5. Admin controls
   - Add category and priority management pages
   - Add agent queue / workload configuration

---

## Phase 2 — AI & Knowledge Base

1. AI classification
   - Integrate Anthropic Claude for ticket classification
   - Auto-tag tickets into billing, enrollment, technical, refund, general
   - Use AI to suggest priority and routing
2. AI summarization
   - Generate short ticket summaries for agents
   - Store summaries in ticket metadata
3. AI reply assistant
   - Present AI-generated reply suggestions to agents
   - Allow editing before send
   - Support auto-send for high-confidence replies
   - Add confidence threshold and manual-handling fallback
4. Knowledge base
   - Store FAQs, structured KB articles, and resolved ticket content
   - Provide in-app KB create/edit functionality for agents
   - Use KB context in AI responses
5. Feedback loop
   - Add agent rating/correction for AI replies
   - Store feedback for future model tuning

---

## Phase 3 — Notifications, Routing & Reporting

1. Notifications
   - Add in-app notification bell for new/updated tickets
   - Send email notifications for ticket creation, updates, and replies
   - Send student acknowledgement and resolution notifications
2. Routing & SLA
   - Add configurable routing rules in admin UI
   - Implement agent assignment by workload / round-robin
   - Track SLA by priority
   - Add escalation and reminder logic for idle tickets
3. Dashboard & reporting
   - Build dashboard metrics: open ticket count, first-response time, resolution time, ticket volume, agent workload, AI acceptance rate
   - Add real-time refresh behavior
   - Add report export to CSV / PDF
4. Saved views
   - Allow agents to save filter presets (e.g. "My open tickets")
   - Default list behavior to self-assigned tickets

---

## Phase 4 — Polish, QA & Deployment

1. Security and compliance
   - Enforce HTTPS and secure API access
   - Redact or avoid sending PII to AI
   - Add audit logs for user and ticket actions
2. Testing
   - Add backend unit and integration tests
   - Add frontend component and UI tests
   - Add end-to-end tests for login, ticket creation, reply, and search flows
3. Reliability and performance
   - Validate IMAP polling and retry behavior
   - Verify search indexing performance
   - Test attachment upload/download reliability
4. Deployment
   - Dockerize backend and frontend
   - Add CI pipeline for build, test, and lint
   - Deploy to cloud with managed database and Redis
   - Add monitoring and logging

---

## Suggested Sprint Breakdown

- Sprint 1: Setup, auth, core ticket model
- Sprint 2: Email ingestion, ticket list/detail
- Sprint 3: AI classification and summaries
- Sprint 4: AI reply assistant and knowledge base
- Sprint 5: Notifications, routing, SLA
- Sprint 6: Dashboard, reporting, exports
- Sprint 7: QA, hardening, deployment
