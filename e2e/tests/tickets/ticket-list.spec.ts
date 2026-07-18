/**
 * e2e/tests/tickets/ticket-list.spec.ts
 *
 * Coverage for the ticket list at /tickets (frontend/src/pages/TicketsPage.tsx
 * -> frontend/src/components/TicketTable.tsx), backed by
 * GET /api/tickets (Program.cs ~line 220-239):
 *  - Navigating to /tickets as an authenticated user renders a table row for
 *    every seeded ticket, with the correct Subject/Student/Status/Priority/
 *    Category columns.
 *  - Tickets are ordered newest-first by CreatedAt (backend does
 *    `.OrderByDescending(t => t.CreatedAt)`) — verified by seeding two
 *    tickets sequentially and asserting the row order.
 *  - The "No tickets found." empty state renders when the ticket list is
 *    empty.
 *
 * Architecture notes (see e2e/fixtures/* and .claude/agent-memory):
 *  - JWT lives in localStorage under "helpdesk_token"; storage state is
 *    built manually via buildStorageState(), not request.storageState().
 *  - All direct API calls use http://127.0.0.1:5000 (IPv4 gotcha).
 *  - /tickets has no AdminRoute wrapper — any authenticated role can view
 *    it, so these tests just use the agent storage state (no separate
 *    admin/agent-parity test needed here).
 *  - POST /api/tickets only requires .RequireAuthorization() (no specific
 *    role) — fixtures/tickets.ts's createTestTicket seeds rows with a
 *    unique per-test studentEmail (fixtures/webhook.ts's uniqueStudentEmail)
 *    so parallel tests (fullyParallel: true) never collide, and rows are
 *    cleaned up via fixtures/db.ts's deleteTicketsForStudentEmail in a
 *    `finally` block.
 *  - Empty-state note: the helpdesk_test DB is shared across the whole
 *    Playwright run and fullyParallel: true means other spec files may already
 *    have seeded tickets by the time this file runs, so "the ticket list is
 *    genuinely empty" can't be reproduced reliably by deleting rows alone.
 *    Instead this test intercepts GET /api/tickets with page.route and
 *    fulfills an empty JSON array — this deterministically exercises the
 *    frontend's own empty-state rendering without depending on (or
 *    disturbing) whatever else is in the shared table.
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
  // Idempotent — safe even if another spec file already wrote these files.
  await Promise.all([
    saveStorageState(request, 'agent'),
    saveStorageState(request, 'admin'),
  ]);
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
// Group 1: Authenticated view shows seeded tickets with correct columns
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Ticket list — authenticated view shows existing tickets', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.agent });

  test('a freshly seeded ticket appears as a row with the right Subject/Student/Status/Priority/Category', async ({
    page,
    request,
  }) => {
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const studentEmail = uniqueStudentEmail('ticket-list-happy');
    const subject = `Cannot access course materials ${Date.now()}`;

    try {
      await createTestTicket(request, agentToken, {
        subject,
        studentEmail,
        priority: 'High',
        category: 'Technical',
      });

      await page.goto('/tickets');
      await waitForTicketsResponse(page);

      const row = page.getByRole('row').filter({ hasText: subject });
      await expect(row, 'seeded ticket row should be visible').toBeVisible();

      await expect(
        row.getByText(studentEmail),
        'Student column should show the studentEmail'
      ).toBeVisible();
      await expect(
        row.getByText('Open', { exact: true }),
        'Status column should default to Open'
      ).toBeVisible();
      await expect(
        row.getByText('High', { exact: true }),
        'Priority column should reflect the seeded value'
      ).toBeVisible();
      await expect(
        row.getByText('Technical', { exact: true }),
        'Category column should reflect the seeded value'
      ).toBeVisible();
    } finally {
      await deleteTicketsForStudentEmail(studentEmail);
    }
  });

  test('multiple seeded tickets each render their own row', async ({ page, request }) => {
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const studentEmail = uniqueStudentEmail('ticket-list-multi');
    const subjectA = `Billing question A ${Date.now()}`;
    const subjectB = `Billing question B ${Date.now()}`;

    try {
      await createTestTicket(request, agentToken, {
        subject: subjectA,
        studentEmail,
        category: 'Billing',
      });
      await createTestTicket(request, agentToken, {
        subject: subjectB,
        studentEmail,
        category: 'Billing',
      });

      await page.goto('/tickets');
      await waitForTicketsResponse(page);

      await expect(
        page.getByRole('row').filter({ hasText: subjectA }),
        'first seeded ticket row should be visible'
      ).toBeVisible();
      await expect(
        page.getByRole('row').filter({ hasText: subjectB }),
        'second seeded ticket row should be visible'
      ).toBeVisible();
    } finally {
      await deleteTicketsForStudentEmail(studentEmail);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Newest-first ordering
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

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Empty state
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Ticket list — empty state', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.agent });

  test('shows "No tickets found." when GET /api/tickets returns an empty list', async ({
    page,
  }) => {
    // See the file-level doc comment: the shared helpdesk_test DB can't be
    // reliably driven to a genuine zero-ticket state given fullyParallel
    // test execution, so the empty response is mocked at the network layer
    // instead of seeded/deleted. This still exercises the real frontend
    // rendering path (TicketTable's `tickets.length === 0` branch), just
    // without a real empty backend.
    await page.route('**/api/tickets', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }
      await route.fulfill({ json: [] });
    });

    await page.goto('/tickets');

    await expect(
      page.getByText('No tickets found.'),
      'empty state message should render when the ticket list is empty'
    ).toBeVisible();

    // Only the single empty-state row should be present — no ticket rows.
    await expect(page.locator('table tbody tr')).toHaveCount(1);
  });
});
