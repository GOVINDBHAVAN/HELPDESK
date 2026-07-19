/**
 * e2e/tests/tickets/ticket-list.spec.ts
 *
 * Narrow e2e coverage for the ticket list at /tickets (frontend/src/pages/
 * TicketsPage.tsx -> frontend/src/components/TicketTable.tsx), backed by
 * GET /api/tickets (Program.cs ~line 220-239).
 *
 * Scope note (2026-07-18): this file used to also cover column rendering
 * (Subject/Student/Status/Priority/Category) and the "No tickets found."
 * empty state, but those only ever asserted on markup driven by mocked/
 * seeded data — no different from mocking `api.get` directly. That coverage
 * moved to frontend/src/pages/TicketsPage.test.tsx (Vitest + React Testing
 * Library component tests), which is faster and doesn't need a live
 * backend/DB. See that file for: loading skeleton, row rendering with
 * newest-first data order, Student column showing studentEmail, status/
 * priority/category badges, empty state, error message, page heading, and
 * table column headers.
 *
 * What's left here is the one thing a mocked component test genuinely
 * cannot verify: that the real backend orders `GET /api/tickets` newest
 * first. TicketTable.tsx does no client-side sorting — it renders rows in
 * whatever order the API response arrives in — so this test seeds two real
 * rows sequentially in the actual `helpdesk_test` DB and asserts on the
 * backend's `.OrderByDescending(t => t.CreatedAt)` (Program.cs) via a real
 * browser render.
 *
 * Server-side sorting (2026-07-19): GET /api/tickets now accepts
 * `sortBy`/`sortDir` and switches its `OrderBy`/`OrderByDescending` column at
 * the DB level (Program.cs ~line 220-245). The frontend switched
 * TicketTable.tsx to @tanstack/react-table with `manualSorting: true` —
 * clicking a column header button just changes React Query's `queryKey` and
 * refetches; it does NOT reorder rows client-side. Component tests
 * (frontend/src/pages/TicketsPage.test.tsx, mocked `api.get`) already cover
 * that clicking a header sends the right `sortBy`/`sortDir` params and shows
 * the right sort icon — that only proves the frontend *asks* correctly. The
 * "Server-side sorting by Subject" describe block below is the one thing
 * that can't be mocked: that the real Postgres `ORDER BY subject` actually
 * reorders real rows, for both asc and desc. Verified empirically (not
 * assumed) that TicketTable's `SortableHeader` calls
 * `column.toggleSorting(sorted === 'asc')` — TanStack Table's
 * `toggleSorting(desc?)` applies the boolean literally (not as a
 * cycle-through-states toggle) whenever `desc` is a boolean rather than
 * `undefined`, so clicking an unsorted column always goes to ascending
 * first, then descending, then back to ascending — never an "unsorted"
 * third state. Only Subject is covered here per the project's testing
 * philosophy — Status/Priority/Category sort alphabetically-not-by-severity
 * (enums stored as text via `.HasConversion<string>()`), which is the same
 * code path already proven correct on Subject, so it isn't worth a second
 * e2e round-trip.
 *
 * Server-side pagination (2026-07-19): GET /api/tickets now also accepts
 * `page`/`pageSize` and returns a paged envelope — `{ items, totalCount,
 * page, pageSize }` — instead of a bare array (Program.cs ~line 220-262,
 * Models/AuthModels.cs's `PagedTicketsResponse`). TicketTable.tsx switched to
 * `manualPagination: true` with `rowCount: data?.totalCount`; a Previous/Next
 * footer ("Showing A-B of N tickets" / "Page X of Y") only renders when
 * `totalCount > 0`. Component tests (TicketsPage.test.tsx's
 * `describe('pagination', ...)` block, mocked `api.get`) already cover the
 * footer text, Previous disabled on page 1, Next/Previous sending the right
 * `page` param, and sort resetting `pageIndex` to 0 — all of which only
 * prove the frontend *asks* for the right page. The "server-side pagination"
 * describe block below is the one thing that can't be mocked: that the real
 * Postgres `Skip`/`Take` actually slices distinct rows per page and
 * `CountAsync()` reports a correct total. Because the `helpdesk_test` DB is
 * shared across parallel spec files/describe blocks (`fullyParallel: true`)
 * and may already hold other tickets, expected page sizes and footer text
 * are always computed from the *actual* response body's own `totalCount` at
 * the time of each request rather than hardcoded from the seed count — only
 * invariants that hold regardless of DB noise are asserted (page 1's item
 * count is `min(pageSize, totalCount)`; page 2's items are disjoint by id
 * from page 1's).
 *
 * Architecture notes (see e2e/fixtures/* and .claude/agent-memory):
 *  - JWT lives in localStorage under "helpdesk_token"; storage state is
 *    built manually via buildStorageState(), not request.storageState().
 *  - All direct API calls use http://127.0.0.1:5000 (IPv4 gotcha).
 *  - /tickets has no AdminRoute wrapper — any authenticated role can view
 *    it, so this test just uses the agent storage state.
 *  - POST /api/tickets only requires .RequireAuthorization() (no specific
 *    role) — fixtures/tickets.ts's createTestTicket seeds rows with a
 *    unique per-test studentEmail (fixtures/webhook.ts's uniqueStudentEmail)
 *    so parallel tests (fullyParallel: true) never collide, and rows are
 *    cleaned up via fixtures/db.ts's deleteTicketsForStudentEmail in a
 *    `finally` block.
 *  - shadcn Table renders a real <table>/<tr>; getByRole('row').filter({hasText})
 *    is the reliable way to scope assertions to one row (row accessible-name
 *    computation is unreliable when a row contains elements with their own
 *    aria-label).
 *  - No waitForTimeout() anywhere — only waitForResponse/toBeVisible.
 */

import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE_PATHS,
  TEST_CREDENTIALS,
  fetchToken,
  saveStorageState,
} from '../../fixtures/auth';
import { deleteTicketsForStudentEmail } from '../../fixtures/db';
import { uniqueStudentEmail } from '../../fixtures/webhook';
import { createTestTicket, type TicketResponseBody } from '../../fixtures/tickets';

test.beforeAll(async ({ request }) => {
  // Idempotent — safe even if another spec file already wrote this file.
  await saveStorageState(request, 'agent');
});

/** Wait for the ticket table's own data fetch to complete after navigation. */
async function waitForTicketsResponse(page: import('@playwright/test').Page) {
  await page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/tickets') &&
      resp.request().method() === 'GET' &&
      resp.status() === 200
  );
}

/**
 * Collect table row texts across pages (clicking "Next") until every target
 * substring has been seen at least once, or there are no more pages.
 *
 * Needed because of server-side pagination (2026-07-19): the default
 * rendered view is now truncated to `pageSize` (10) rows, and this spec
 * shares the `helpdesk_test` DB with every other concurrently-running test
 * (`fullyParallel: true`) — a test that seeds only a couple of tickets is no
 * longer guaranteed those rows land on page 1 of whatever sort is active
 * (e.g. another test seeding a burst of tickets can outrank them on the
 * default CreatedAt-desc view, or alphabetically outrank them on a
 * Subject-desc view). Concatenating rows page-by-page preserves the real
 * global order — each page is a contiguous slice of one server-sorted
 * sequence — so relative-order assertions (`indexOf(a) < indexOf(b)`) on the
 * returned array remain exactly as valid as they were before pagination
 * existed.
 */
async function collectRowsUntilFound(
  page: import('@playwright/test').Page,
  targets: string[],
  options: { maxPages?: number; waitForNextPage?: () => Promise<unknown> } = {}
): Promise<string[]> {
  const maxPages = options.maxPages ?? 25;
  const waitForNextPage = options.waitForNextPage ?? (() => waitForTicketsResponse(page));
  let collected: string[] = [];

  for (let i = 0; i < maxPages; i++) {
    const rowTexts = await page.locator('table tbody tr').allTextContents();
    collected = collected.concat(rowTexts);

    if (targets.every((target) => collected.some((row) => row.includes(target)))) {
      return collected;
    }

    const nextButton = page.getByRole('button', { name: /Next/i });
    if (!(await nextButton.isEnabled())) {
      return collected;
    }

    await Promise.all([waitForNextPage(), nextButton.click()]);
  }

  return collected;
}

// ─────────────────────────────────────────────────────────────────────────────
// Newest-first ordering
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Ticket list — newest-first ordering', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.agent });

  test('the more recently created ticket appears above the older one', async ({
    page,
    request,
  }) => {
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const studentEmail = uniqueStudentEmail('ticket-list-order');
    const olderSubject = `Older refund request ${Date.now()}`;
    const newerSubject = `Newer refund request ${Date.now()}`;

    let older: TicketResponseBody | undefined;
    let newer: TicketResponseBody | undefined;

    try {
      // Sequential (not Promise.all) so `newer` is guaranteed a
      // strictly-later CreatedAt than `older` — the backend stamps
      // CreatedAt = DateTime.UtcNow at insert time.
      older = await createTestTicket(request, agentToken, {
        subject: olderSubject,
        studentEmail,
        category: 'Refund',
      });
      newer = await createTestTicket(request, agentToken, {
        subject: newerSubject,
        studentEmail,
        category: 'Refund',
      });

      expect(
        new Date(newer.createdAt).getTime(),
        'the second-created ticket must have a createdAt at or after the first'
      ).toBeGreaterThanOrEqual(new Date(older.createdAt).getTime());

      await page.goto('/tickets');
      await waitForTicketsResponse(page);

      // Page forward if needed (see collectRowsUntilFound doc comment) —
      // pagination means these two rows aren't guaranteed to be on page 1
      // when other tests are concurrently seeding tickets of their own.
      const rowTexts = await collectRowsUntilFound(page, [newerSubject, olderSubject]);
      const newerIndex = rowTexts.findIndex((text) => text.includes(newerSubject));
      const olderIndex = rowTexts.findIndex((text) => text.includes(olderSubject));

      expect(newerIndex, 'newer ticket row must be found in the table').toBeGreaterThanOrEqual(0);
      expect(olderIndex, 'older ticket row must be found in the table').toBeGreaterThanOrEqual(0);
      expect(
        newerIndex,
        'the newer ticket must be ordered ABOVE the older ticket (newest-first)'
      ).toBeLessThan(olderIndex);
    } finally {
      await deleteTicketsForStudentEmail(studentEmail);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-side sorting by Subject (real backend/DB reordering)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for the /api/tickets GET response for a specific sortBy/sortDir
 * combination. Must be started via Promise.all alongside the action that
 * triggers the request (e.g. a header click) — see call sites below — so the
 * listener is attached before the response can arrive.
 */
function waitForSortedTicketsResponse(
  page: import('@playwright/test').Page,
  sortBy: string,
  sortDir: 'asc' | 'desc'
) {
  return page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/tickets') &&
      resp.url().includes(`sortBy=${sortBy}`) &&
      resp.url().includes(`sortDir=${sortDir}`) &&
      resp.request().method() === 'GET' &&
      resp.status() === 200
  );
}

test.describe('Ticket list — server-side sorting by Subject', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.agent });

  test('clicking the Subject header re-sorts rows via the real backend (asc), and clicking again reverses it (desc)', async ({
    page,
    request,
  }) => {
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const studentEmail = uniqueStudentEmail('ticket-list-sort-subject');

    // Prefixed A-/B-/C- so plain string comparison is decided by the first
    // character alone, regardless of the random suffix — guarantees a known
    // alphabetical order (A < B < C) without depending on DB collation
    // subtleties beyond basic ASCII letter comparison.
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const subjectA = `A-SortSubjectTest-${suffix}`;
    const subjectB = `B-SortSubjectTest-${suffix}`;
    const subjectC = `C-SortSubjectTest-${suffix}`;

    try {
      // Seed out of alphabetical order (C, then B, then A) so the two
      // orderings under test — CreatedAt-desc (default) and Subject-asc —
      // don't coincidentally look the same, which would leave a stale
      // client-side render able to pass this test by accident.
      await createTestTicket(request, agentToken, {
        subject: subjectC,
        studentEmail,
        category: 'General',
      });
      await createTestTicket(request, agentToken, {
        subject: subjectB,
        studentEmail,
        category: 'General',
      });
      await createTestTicket(request, agentToken, {
        subject: subjectA,
        studentEmail,
        category: 'General',
      });

      await page.goto('/tickets');
      await waitForTicketsResponse(page);

      const subjectHeaderButton = page.getByRole('button', { name: /Subject/i });
      await expect(
        subjectHeaderButton,
        'Subject column header button should be visible'
      ).toBeVisible();

      // First click: TicketTable's SortableHeader calls
      // column.toggleSorting(sorted === 'asc'). Subject isn't sorted yet, so
      // that's toggleSorting(false) -> TanStack Table applies `false`
      // literally -> ascending.
      const [ascResponse] = await Promise.all([
        waitForSortedTicketsResponse(page, 'subject', 'asc'),
        subjectHeaderButton.click(),
      ]);
      expect(
        ascResponse.url(),
        'first click on Subject header must request ascending sort'
      ).toContain('sortDir=asc');

      // Page forward if needed (see collectRowsUntilFound doc comment) —
      // these three rows aren't guaranteed to land on page 1 of the
      // Subject-ascending view when other tests are concurrently seeding
      // tickets of their own.
      let rowTexts = await collectRowsUntilFound(page, [subjectA, subjectB, subjectC], {
        waitForNextPage: () => waitForSortedTicketsResponse(page, 'subject', 'asc'),
      });
      let indexA = rowTexts.findIndex((text) => text.includes(subjectA));
      let indexB = rowTexts.findIndex((text) => text.includes(subjectB));
      let indexC = rowTexts.findIndex((text) => text.includes(subjectC));

      expect(indexA, 'subject A row must be present after ascending sort').toBeGreaterThanOrEqual(0);
      expect(indexB, 'subject B row must be present after ascending sort').toBeGreaterThanOrEqual(0);
      expect(indexC, 'subject C row must be present after ascending sort').toBeGreaterThanOrEqual(0);
      expect(indexA, 'A must be ordered above B when sorted ascending').toBeLessThan(indexB);
      expect(indexB, 'B must be ordered above C when sorted ascending').toBeLessThan(indexC);

      // Second click: Subject is now sorted 'asc', so toggleSorting(true) ->
      // descending.
      const [descResponse] = await Promise.all([
        waitForSortedTicketsResponse(page, 'subject', 'desc'),
        subjectHeaderButton.click(),
      ]);
      expect(
        descResponse.url(),
        'second click on Subject header must request descending sort'
      ).toContain('sortDir=desc');

      rowTexts = await collectRowsUntilFound(page, [subjectA, subjectB, subjectC], {
        waitForNextPage: () => waitForSortedTicketsResponse(page, 'subject', 'desc'),
      });
      indexA = rowTexts.findIndex((text) => text.includes(subjectA));
      indexB = rowTexts.findIndex((text) => text.includes(subjectB));
      indexC = rowTexts.findIndex((text) => text.includes(subjectC));

      expect(indexA, 'subject A row must be present after descending sort').toBeGreaterThanOrEqual(0);
      expect(indexB, 'subject B row must be present after descending sort').toBeGreaterThanOrEqual(0);
      expect(indexC, 'subject C row must be present after descending sort').toBeGreaterThanOrEqual(0);
      expect(indexC, 'C must be ordered above B when sorted descending').toBeLessThan(indexB);
      expect(indexB, 'B must be ordered above A when sorted descending').toBeLessThan(indexA);
    } finally {
      await deleteTicketsForStudentEmail(studentEmail);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Server-side pagination (real backend Skip/Take + CountAsync)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for the /api/tickets GET response for a specific `page` query param.
 * Parses the response URL's query string (rather than substring-matching
 * `page=${n}`) so `page=1` can never accidentally match `page=10`.
 */
function waitForTicketsPageResponse(
  page: import('@playwright/test').Page,
  pageNumber: number
) {
  return page.waitForResponse((resp) => {
    if (
      !resp.url().includes('/api/tickets') ||
      resp.request().method() !== 'GET' ||
      resp.status() !== 200
    ) {
      return false;
    }
    return new URL(resp.url()).searchParams.get('page') === String(pageNumber);
  });
}

interface PagedTicketsBody {
  items: TicketResponseBody[];
  totalCount: number;
  page: number;
  pageSize: number;
}

test.describe('Ticket list — server-side pagination', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.agent });

  test('page 1 shows only a page-size worth of rows, and Next loads a distinct, non-overlapping page 2', async ({
    page,
    request,
  }) => {
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const studentEmail = uniqueStudentEmail('ticket-list-pagination');
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // 12 rows guarantees the real totalCount is >= 12, comfortably above the
    // default pageSize of 10 (TicketTable.tsx's
    // `useState<PaginationState>({ pageIndex: 0, pageSize: 10 })`), so page 1
    // is always full and a page 2 always exists — regardless of whatever
    // else is already sitting in the shared helpdesk_test DB.
    const seededSubjects = Array.from(
      { length: 12 },
      (_, i) => `Pagination test ticket ${String(i + 1).padStart(2, '0')} ${suffix}`
    );

    try {
      for (const subject of seededSubjects) {
        await createTestTicket(request, agentToken, {
          subject,
          studentEmail,
          category: 'General',
        });
      }

      const [page1Response] = await Promise.all([
        waitForTicketsPageResponse(page, 1),
        page.goto('/tickets'),
      ]);
      const page1Body = (await page1Response.json()) as PagedTicketsBody;

      expect(page1Body.page, 'first load must request page 1').toBe(1);
      expect(page1Body.pageSize, 'default page size must be 10').toBe(10);
      expect(
        page1Body.totalCount,
        'seeding 12 tickets must push the real DB total to at least 12'
      ).toBeGreaterThanOrEqual(12);

      // totalCount >= 12 and pageSize is 10, so this is always exactly 10 —
      // not dependent on how much other data is in the DB.
      const expectedPage1Count = Math.min(page1Body.pageSize, page1Body.totalCount);
      expect(
        page1Body.items,
        'page 1 response must be sliced to pageSize, not every row in the DB'
      ).toHaveLength(expectedPage1Count);

      await expect(
        page.locator('table tbody tr'),
        'the rendered table must show exactly one page worth of rows, not all seeded rows at once'
      ).toHaveCount(expectedPage1Count);

      const totalCount = page1Body.totalCount;
      const pageCount = Math.ceil(totalCount / page1Body.pageSize);

      await expect(
        page.getByText(`Showing 1-${expectedPage1Count} of ${totalCount} tickets`),
        'footer range text must reflect the real totalCount from the API, not the seed count'
      ).toBeVisible();
      await expect(
        page.getByText(`Page 1 of ${pageCount}`),
        'footer page text must reflect the real page count from the API'
      ).toBeVisible();

      const previousButton = page.getByRole('button', { name: /Previous/i });
      const nextButton = page.getByRole('button', { name: /Next/i });
      await expect(previousButton, 'Previous must be disabled on page 1').toBeDisabled();
      // totalCount >= 12 with pageSize 10 guarantees a page 2 exists.
      await expect(nextButton, 'Next must be enabled when a page 2 exists').toBeEnabled();

      const [page2Response] = await Promise.all([
        waitForTicketsPageResponse(page, 2),
        nextButton.click(),
      ]);
      const page2Body = (await page2Response.json()) as PagedTicketsBody;

      expect(page2Body.page, 'clicking Next must request page 2').toBe(2);

      // Recomputed from page2Body's OWN totalCount (not page1Body's) — the
      // shared DB may have gained/lost unrelated rows from other parallel
      // tests between the two requests, so each response's slice is only
      // ever checked against its own reported total.
      const expectedPage2Count = Math.min(
        page2Body.pageSize,
        Math.max(0, page2Body.totalCount - page2Body.pageSize)
      );
      expect(
        page2Body.items,
        'page 2 must contain the remainder of the rows, computed from the real totalCount'
      ).toHaveLength(expectedPage2Count);

      await expect(
        page.locator('table tbody tr'),
        'page 2 must render exactly its own slice of rows'
      ).toHaveCount(expectedPage2Count);

      // The core Skip/Take proof: no ticket id straddles both pages, and
      // page 2 itself has no internal duplicates.
      const page1Ids = new Set(page1Body.items.map((t) => t.id));
      const page2Ids = page2Body.items.map((t) => t.id);
      for (const id of page2Ids) {
        expect(
          page1Ids.has(id),
          `ticket id ${id} appeared on both page 1 and page 2 — Skip/Take is not slicing distinct rows`
        ).toBe(false);
      }
      expect(new Set(page2Ids).size, 'page 2 must not contain duplicate rows').toBe(
        page2Ids.length
      );

      const rangeStart2 = page1Body.pageSize + 1;
      const rangeEnd2 = page1Body.pageSize + expectedPage2Count;
      await expect(
        page.getByText(
          `Showing ${rangeStart2}-${rangeEnd2} of ${page2Body.totalCount} tickets`
        ),
        'footer range text must advance on page 2'
      ).toBeVisible();
      await expect(
        page.getByText(`Page 2 of ${Math.ceil(page2Body.totalCount / page2Body.pageSize)}`),
        'footer page text must advance to page 2'
      ).toBeVisible();
      await expect(previousButton, 'Previous must be enabled once on page 2').toBeEnabled();

      // Sanity: our own seeded rows are actually discoverable in the real
      // data, not just that the pagination math holds in a vacuum.
      const ownTicketCount = [...page1Body.items, ...page2Body.items].filter(
        (t) => t.studentEmail === studentEmail
      ).length;
      expect(
        ownTicketCount,
        'at least some of the 12 seeded tickets must be visible across pages 1-2'
      ).toBeGreaterThan(0);
    } finally {
      await deleteTicketsForStudentEmail(studentEmail);
    }
  });
});
