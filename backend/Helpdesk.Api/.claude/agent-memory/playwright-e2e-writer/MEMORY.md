# Memory Index

- [e2e/ architecture](project_playwright_setup.md) — globalSetup, storageState pattern, fixtures (auth/tickets/webhook/db), spec file inventory
- [Docker infra gotcha](project_e2e_infra.md) — Postgres/Redis/Mailpit run via docker-compose, NOT globalSetup; ECONNREFUSED ::1:5432 means start Docker Desktop first
- [Extend, don't fork, narrow spec files](feedback_narrow_spec_files.md) — add a new describe block to an existing scope-noted spec file for same-page coverage instead of a new file
- [TicketTable sort toggle behavior](project_tanstack_table_sort_toggle.md) — SortableHeader always passes an explicit boolean to toggleSorting, so clicks cycle asc/desc only, never an unsorted third state
- [GET /api/tickets pagination](project_tickets_pagination.md) — paged envelope `{items,totalCount,page,pageSize}` (breaking shape change), new pagination describe block, fixed other array-shape caller
- [Pagination broke existing tests](project_pagination_broke_existing_tests.md) — fullyParallel + small-batch seeding tests can be pushed off page 1; fixed via collectRowsUntilFound helper, apply to future TicketTable specs
