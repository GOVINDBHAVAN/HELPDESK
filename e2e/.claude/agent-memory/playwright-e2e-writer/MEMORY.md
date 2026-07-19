# Memory Index

- [E2E architecture](e2e_architecture.md) — e2e/ folder layout, globalSetup lifecycle, fixtures, the 5 setup gotchas, how to run tests
- [Known flaky pagination test](known_flaky_pagination_test.md) — pre-existing backend race (CountAsync + Skip/Take not transactional) causes intermittent page-2 off-by-one failures under concurrent seeding; not fixable from e2e layer
- [ticket-list.spec.ts conventions](ticket_list_spec_conventions.md) — reusable helpers (collectRowsUntilFound, waitForXResponse pattern), seeding/cleanup/distractor-row conventions for that file
