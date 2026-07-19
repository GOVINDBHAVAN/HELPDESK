---
name: feedback_narrow_spec_files
description: Extend an existing narrowly-scoped e2e spec file with a new describe block rather than creating a sibling file, when the new test covers the same page/feature
metadata:
  type: feedback
---

When a spec file already carries a "scope note" doc comment explaining why
it was trimmed down to one real-backend-only assertion (e.g.
`e2e/tests/tickets/ticket-list.spec.ts`'s comment about column
rendering/empty-state moving to Vitest, leaving only newest-first ordering),
and a new feature needs a similar narrow real-backend check on the *same*
page, extend that file with a new `test.describe` block instead of creating
a new file. Update the file's header comment to explain the addition and why
it too is narrow (what a mocked component test already covers vs. what's
left).

**Why:** [[project_playwright_setup]]'s existing pattern (see the
`ticket-list.spec.ts` doc comment) treats each spec file as a curated,
deliberately-trimmed record of "the one thing a mocked component test can't
prove" for a given page — not a general dumping ground per PR. Splitting
closely related backend-ordering assertions (e.g. default CreatedAt sort vs.
column-header-driven Subject sort, both on `/tickets`) into separate files
would duplicate the `waitForTicketsResponse`-style setup and storage-state
boilerplate for no isolation benefit, since Playwright's `fullyParallel`
already isolates tests via unique per-test `studentEmail` + `db.ts` cleanup,
not via file boundaries.

**How to apply:** Before creating a new `*.spec.ts` file, check whether an
existing file already covers the same page/feature and has this kind of
scope-note comment. If yes, add a new `test.describe` there (with its own
`waitFor*Response` helper if needed) and extend the header comment; only
create a new file for a genuinely different page or user flow (e.g. a new
`e2e/admin/` feature, not another `/tickets` behavior).
