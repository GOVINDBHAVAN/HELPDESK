---
name: project_pagination_broke_existing_tests
description: Adding GET /api/tickets pagination made two pre-existing narrow ticket-list.spec.ts tests genuinely flaky under fullyParallel — fixed with a page-forward-until-found helper (collectRowsUntilFound)
metadata:
  type: project
---

When `/api/tickets` gained server-side pagination (see
[[project_tickets_pagination]]), the pre-existing "newest-first ordering" and
"server-side sorting by Subject" tests in `e2e/tests/tickets/ticket-list.spec.ts`
started failing when run in the same `npx playwright test` invocation as a
new 12-ticket pagination test (confirmed by re-running the old tests alone —
they passed; re-running them alongside the new pagination test — they
failed, reproducibly).

**Root cause**: those two tests always used to work by seeding a couple of
tickets and asserting their *relative* order in the rendered table, trusting
that the (then-unpaginated) endpoint rendered every row — absolute position
never mattered. Once the endpoint truncates to `pageSize` (10) by default,
only the top-10 rows of whatever sort is active get rendered. Under
`fullyParallel: true` with a shared `helpdesk_test` DB, any concurrently
running test that seeds a burst of tickets can push another test's own
handful of rows off page 1 — e.g. the pagination test's 12 tickets (subjects
starting `"Pagination test ticket ..."`, i.e. `"P..."`) outrank
`"C-SortSubjectTest-..."` on a Subject-**descending** sort purely
alphabetically, and being freshly created they always win a CreatedAt-desc
default sort too. This is a **structural** risk for any future test that
seeds few rows and expects them on the default page — not specific to the
one pagination test that happened to trigger it here.

**Fix applied**: added `collectRowsUntilFound(page, targets, { maxPages,
waitForNextPage })` to `ticket-list.spec.ts` — clicks "Next" (bounded, default
25 pages) accumulating `table tbody tr` row texts until every target
substring has been seen, then returns the concatenated array. Concatenating
page-by-page preserves the true global order (each page is a contiguous
slice of one server-sorted sequence), so existing `indexOf(a) < indexOf(b)`
assertions work unchanged on the returned array — this is a page-spanning
drop-in replacement for the old single-page `page.locator('table tbody
tr').allTextContents()` calls. Both fixed tests now pass reliably alongside
the new pagination test (verified via 3 full-suite runs).

**How to apply**: any new e2e test added to `ticket-list.spec.ts` (or a
similar `TicketTable`-backed page, should one appear) that seeds only a few
rows and needs to find them in the rendered table must use
`collectRowsUntilFound` instead of a bare single-page
`allTextContents()`/`getByRole('row')` check — don't assume seeded rows land
on page 1. The one exception is the pagination test itself
([[project_tickets_pagination]]), which deliberately seeds enough rows (12,
comfortably over pageSize 10) that it doesn't need this — it's asserting
page-1-vs-page-2 behavior directly, not searching for specific rows.
