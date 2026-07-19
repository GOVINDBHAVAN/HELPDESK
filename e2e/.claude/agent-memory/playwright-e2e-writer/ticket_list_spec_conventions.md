---
name: ticket_list_spec_conventions
description: Established patterns in ticket-list.spec.ts (helpers, seeding, assertion style) that new additions to that file should follow rather than reinventing
metadata:
  type: project
---

`e2e/tests/tickets/ticket-list.spec.ts` covers everything about `GET /api/tickets` that a mocked component test (`frontend/src/pages/TicketsPage.test.tsx`) structurally can't: real DB ordering, real sort/paginate/filter behavior. It has grown by appending one `test.describe` block per backend feature (newest-first ordering -> server-side sorting -> server-side pagination -> server-side filtering), each with its own doc-comment paragraph prepended to the file's top comment explaining what changed and why the coverage belongs in e2e rather than Vitest. Follow this pattern for future additions rather than starting a new file, unless the feature is unrelated to the ticket list.

Reusable helpers already in the file (don't recreate them):
- `waitForTicketsResponse(page)` — waits for any 200 GET `/api/tickets`.
- `collectRowsUntilFound(page, targets, { maxPages?, waitForNextPage? })` — pages forward (clicking "Next") accumulating `table tbody tr` text until every target substring is seen or pages run out. **Required** whenever asserting presence of specific seeded rows, because the DB is shared across all `fullyParallel: true` tests and default `pageSize` is 10 — target rows are not guaranteed to land on page 1. Pass a custom `waitForNextPage` bound to whatever sort/filter response shape is currently active (see `waitForSortedTicketsResponse`, `waitForTicketsPageResponse`, `waitForFilteredTicketsResponse` for examples of the pattern: parse `new URL(resp.url()).searchParams` rather than substring-matching the URL, so e.g. `page=1` never accidentally matches `page=10`).
- Seeding: always via `createTestTicket` (fixtures/tickets.ts) under one `studentEmail` from `uniqueStudentEmail(label)` (fixtures/webhook.ts) per test, cleaned up in a `finally` block via `deleteTicketsForStudentEmail`. Never mutate the DB directly for setup that the API can express (fixtures/db.ts's raw `pg` client is reserved for things genuinely impossible via API — e.g. `closeTicket` for status, since there is no status-change endpoint).
- Distractor-row design for proving AND-not-OR composition (used for both sorting-vs-filtering and the filtering test itself): seed rows that each satisfy a different subset of the criteria under test (e.g. category-match-only, priority-match-only, neither) so a bug that silently turned an AND into an OR would show extra rows, not just miss the target.
- Subject naming: prefix seeded subjects with a `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` suffix (or embed it in a shared prefix when the test needs a substring common to several seeded rows, e.g. for search-composition tests) so parallel runs and repeated local runs never collide.

`status` cannot be seeded via the API (see [[e2e_architecture]]) — any future status-dependent e2e coverage either needs `fixtures/db.ts`'s `closeTicket`-style direct SQL, or should be deferred/noted as a gap rather than invented via a workaround outside the fixtures pattern.

See [[known_flaky_pagination_test]] for a pre-existing DB-race flake in the `server-side pagination` block, unrelated to correctness of new additions.
