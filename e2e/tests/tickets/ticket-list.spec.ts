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

      await expect(
        page.getByRole('row').filter({ hasText: newerSubject }),
        'newer ticket row should be visible'
      ).toBeVisible();
      await expect(
        page.getByRole('row').filter({ hasText: olderSubject }),
        'older ticket row should be visible'
      ).toBeVisible();

      const rowTexts = await page.locator('table tbody tr').allTextContents();
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
