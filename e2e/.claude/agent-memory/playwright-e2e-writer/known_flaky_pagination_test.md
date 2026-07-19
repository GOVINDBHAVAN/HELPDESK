---
name: known_flaky_pagination_test
description: The "server-side pagination" test in ticket-list.spec.ts flakes under concurrent DB writes from other parallel tests, due to a real (pre-existing, unfixed) backend race in GET /api/tickets
metadata:
  type: project
---

`e2e/tests/tickets/ticket-list.spec.ts`'s `Ticket list — server-side pagination` test (`page 1 shows only a page-size worth of rows, and Next loads a distinct, non-overlapping page 2`) intermittently fails with an off-by-one row count on page 2 (e.g. "Expected 9, Received 10") **whenever it runs concurrently with other tests in the same file that seed tickets** (confirmed: it fails reliably — 3/3 runs — when run alongside `server-side sorting` + `newest-first ordering`, even with zero involvement from any newer test added later; it passes 100% of the time in isolation).

**Root cause**: `Program.cs`'s `GET /api/tickets` handler (~line 220-289) runs `CountAsync()` and the `Skip/Take/ToListAsync()` select as **two separate, un-transacted round-trips** to Postgres:
```csharp
var totalCount = await filteredTickets.CountAsync();
// ... sortedTickets built from filteredTickets ...
var tickets = await sortedTickets.Skip(...).Take(...).ToListAsync();
```
If another test's `INSERT`/`DELETE` on the `tickets` table lands in the gap between these two queries, `totalCount` and the actual page slice become inconsistent by however many rows changed in that window — under `fullyParallel: true` with several tests each seeding/cleaning up tickets, that window gets hit often enough to be a real, reproducible flake, not a one-off.

**Why:** This is a genuine backend concurrency bug (missing snapshot isolation / no single transaction wrapping count+select), not a test-authoring mistake — the pagination test's own math (recomputing `expectedPage2Count` from `page2Body`'s own `totalCount`) is already correct *given* that `totalCount` and the selected rows came from a consistent snapshot; the bug is that they don't.

**How to apply:**
- Do not "fix" this by weakening the pagination test's assertions (e.g. switching to `collectRowsUntilFound`-style fuzzy presence checks) — that test's whole point is proving exact Skip/Take slicing, so precise counts are the correct design; loosening it would mask the real bug.
- Do not treat a red run of this specific test as evidence that a new/unrelated e2e change broke something — always first try re-running it, and if still red, run `npx playwright test tests/tickets/ticket-list.spec.ts -g "server-side pagination"` alone to confirm it passes in isolation before concluding the new change is at fault.
- Actually fixing this requires a backend change (e.g. wrap count+select in one `IDbContextTransaction` with a consistent snapshot, or compute both from a single query), which is out of scope for e2e test authoring — flag it to the user/backend owner rather than attempting a backend fix from this agent.
- Confirmed 2026-07-19 while adding the `server-side filtering` test to the same file — that new test does not increase the flake rate beyond what already existed (verified by running the pre-existing tests without it, 3/3 times, and reproducing the same failure).
