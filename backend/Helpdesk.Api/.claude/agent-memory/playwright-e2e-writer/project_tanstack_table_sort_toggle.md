---
name: project_tanstack_table_sort_toggle
description: This project's shadcn+TanStack Table SortableHeader click behavior — asc/desc only, no unsorted third state, confirmed via context7 docs
metadata:
  type: project
---

`frontend/src/components/TicketTable.tsx`'s `SortableHeader` calls
`column.toggleSorting(sorted === 'asc')` on every header click — always
passing an explicit boolean, never `undefined`. Per TanStack Table's
`column.toggleSorting(desc?, multi?)` (confirmed via context7,
`/tanstack/table`), when `desc` is a boolean it is applied literally as the
new sort direction for that column, NOT run through the library's normal
asc→desc→unsorted cycle logic (`column_getNextSortingOrder`) that kicks in
when `desc` is omitted.

**Why:** This matters for writing/predicting e2e assertions on any sortable
column in this app: clicking an unsorted column's header always goes to
**ascending** first (since `sorted === 'asc'` is `false` when unsorted, so
`toggleSorting(false)` fires), then the second click goes to **descending**,
and it alternates asc/desc forever — there is no third "click again to clear
sorting" state to account for, unlike TanStack Table's own default
three-state cycle.

**How to apply:** When adding e2e coverage for any other sortable
`TicketTable` column (or any future table built with the same
`SortableHeader` pattern), assume click 1 = ascending, click 2 = descending,
click 3 = ascending again — don't add a test expecting an "unsorted" state
to reappear. See [[feedback_narrow_spec_files]] for where this kind of test
was added (`ticket-list.spec.ts`, "server-side sorting by Subject" block,
2026-07-19).
