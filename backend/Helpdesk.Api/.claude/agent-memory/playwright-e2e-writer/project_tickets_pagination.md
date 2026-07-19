---
name: project_tickets_pagination
description: GET /api/tickets response shape change to a paged envelope (2026-07-19), and the resulting pagination coverage/fixes in ticket-list.spec.ts and from-email-webhook.spec.ts
metadata:
  type: project
---

`GET /api/tickets` (Program.cs ~line 220-262) gained `page`/`pageSize` query
params on top of the existing `sortBy`/`sortDir`. This is a **breaking
response-shape change**: the endpoint now returns an object —
`{ items: TicketResponse[], totalCount: number, page: number, pageSize: number }`
(`Models/AuthModels.cs`'s `PagedTicketsResponse`) — instead of a bare array.
Default `page=1`, `pageSize=10` (`pageSize is > 0 and <= 100 ? pageSize.Value
: 10`), matching `TicketTable.tsx`'s own `useState<PaginationState>({
pageIndex: 0, pageSize: 10 })` default and `manualPagination: true`.

**Found and fixed one other caller of the old array shape**:
`e2e/tests/tickets/from-email-webhook.spec.ts`'s `getTicketsForStudentEmail`
helper was doing `(await res.json()) as TicketResponseBody[]` directly. Fixed
to read `.items` and pass `params: { pageSize: 100 }` (Program.cs's max) so
that spec's 1-2 seeded tickets can't be pushed past the default pageSize-10
response by concurrent activity elsewhere in the shared DB. Before assuming
`GET /api/tickets` returns a raw array anywhere else in this suite, grep for
`res.json()` / `.json()` near `/api/tickets` calls — this is exactly the kind
of assumption that silently breaks on a backend response-shape change.

Added a new `test.describe('Ticket list — server-side pagination', ...)`
block to `e2e/tests/tickets/ticket-list.spec.ts` (per
[[feedback_narrow_spec_files]]) proving the real Postgres `Skip`/`Take` +
`CountAsync()` — the one thing TicketsPage.test.tsx's mocked `describe('pagination', ...)`
component tests can't verify. Seeds 12 tickets (guarantees totalCount >= 12 >
pageSize 10, so page 2 always exists regardless of DB noise), then asserts
via the **actual response JSON bodies** (not the seed count) — page 1's item
count is `min(pageSize, totalCount)`, page 2's items are disjoint by `id`
from page 1's, and footer text (`Showing A-B of N tickets` / `Page X of Y`)
is computed from each response's own `totalCount`. See
[[project_pagination_broke_existing_tests]] for a bigger, related finding
this test's first run surfaced.
