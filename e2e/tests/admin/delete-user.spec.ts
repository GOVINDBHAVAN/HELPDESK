/**
 * e2e/tests/admin/delete-user.spec.ts
 *
 * Coverage for the "delete user" (soft-delete) feature:
 *  - Admin can delete a non-admin user from the Users table; the row
 *    disappears and GET /api/users no longer returns it.
 *  - The delete affordance is disabled for Admin rows and never opens the
 *    confirmation dialog.
 *  - Cancelling the confirmation dialog performs no deletion.
 *  - The Agent role is rejected by the DELETE endpoint itself (403) and
 *    never reaches the Users page UI in the first place (AdminRoute).
 *
 * Architecture notes (see e2e/fixtures/auth.ts and .claude/agent-memory):
 *  - JWT lives in localStorage under "helpdesk_token"; storage state is
 *    built manually via buildStorageState(), not request.storageState().
 *  - All direct API calls use http://127.0.0.1:5000 (IPv4 gotcha).
 *  - POST /api/auth/register requires an Admin bearer token, so every test
 *    user is seeded via e2e/fixtures/users.ts using a freshly fetched admin
 *    token rather than the shared agent@test.helpdesk.local fixture user —
 *    this avoids deleting/mutating a user other spec files depend on.
 *  - No waitForTimeout() — only waitForResponse/waitForURL/toBeVisible.
 */

import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE_PATHS,
  TEST_CREDENTIALS,
  fetchToken,
  saveStorageState,
} from '../../fixtures/auth';
import {
  API_BASE,
  createTestUser,
  deleteTestUser,
  listUsers,
  type TestUser,
} from '../../fixtures/users';

test.beforeAll(async ({ request }) => {
  // Idempotent — safe even if auth/login.spec.ts already wrote these files.
  await Promise.all([
    saveStorageState(request, 'agent'),
    saveStorageState(request, 'admin'),
  ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Admin happy path — delete a non-admin user
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Delete user — Admin happy path', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.admin });

  test('Admin deletes a non-admin user: confirmation names the user, row disappears, GET /api/users no longer returns it', async ({
    page,
    request,
  }) => {
    const adminToken = await fetchToken(
      request,
      TEST_CREDENTIALS.admin.email,
      TEST_CREDENTIALS.admin.password
    );
    const testUser = await createTestUser(request, adminToken);

    await page.goto('/users');
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/users') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200
    );

    const row = page.getByRole('row').filter({ hasText: testUser.email });
    await expect(row, 'seeded user row should appear in the table').toBeVisible();

    await row
      .getByRole('button', { name: `Delete ${testUser.displayName}` })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog, 'confirmation dialog should open').toBeVisible();
    await expect(
      dialog.getByText(`Are you sure you want to delete ${testUser.displayName}?`, {
        exact: false,
      }),
      'dialog description should name the target user'
    ).toBeVisible();

    const [deleteResponse] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes(`/api/users/${testUser.id}`) &&
          resp.request().method() === 'DELETE'
      ),
      dialog.getByRole('button', { name: 'Delete' }).click(),
    ]);
    expect(deleteResponse.status(), '204 expected from DELETE /api/users/{id}').toBe(
      204
    );

    await expect(dialog, 'dialog should close after successful delete').not.toBeVisible();
    await expect(
      page.getByRole('row').filter({ hasText: testUser.email }),
      'row should disappear from the table'
    ).toHaveCount(0);

    // Confirm the soft-delete query filter excludes the user from GET /api/users.
    const users = await listUsers(request, adminToken);
    expect(
      users.some((u) => u.id === testUser.id),
      'deleted user must not be returned by GET /api/users'
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Admin rows cannot be deleted
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Delete user — Admin rows are protected', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.admin });

  test('the delete button on the Admin row is disabled and never opens the confirmation dialog', async ({
    page,
  }) => {
    await page.goto('/users');
    await page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/users') &&
        resp.request().method() === 'GET' &&
        resp.status() === 200
    );

    const adminRow = page
      .getByRole('row')
      .filter({ hasText: TEST_CREDENTIALS.admin.email });
    const deleteButton = adminRow.getByRole('button', { name: /^Delete /i });

    await expect(
      deleteButton,
      'delete button for the Admin row should be disabled'
    ).toBeDisabled();

    // Disabled native buttons ignore dispatched click events even with
    // force:true, so this proves the dialog genuinely cannot open —
    // it's not just that Playwright's actionability check refused to click.
    await deleteButton.click({ force: true }).catch(() => {});
    await expect(
      page.getByRole('dialog'),
      'confirmation dialog must not appear for a disabled delete button'
    ).not.toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Cancel performs no deletion
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Delete user — Cancel', () => {
  test.use({ storageState: STORAGE_STATE_PATHS.admin });

  test('clicking Cancel in the confirmation dialog closes it and leaves the user in the table', async ({
    page,
    request,
  }) => {
    const adminToken = await fetchToken(
      request,
      TEST_CREDENTIALS.admin.email,
      TEST_CREDENTIALS.admin.password
    );
    let testUser: TestUser | undefined;

    try {
      testUser = await createTestUser(request, adminToken);

      await page.goto('/users');
      await page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/users') &&
          resp.request().method() === 'GET' &&
          resp.status() === 200
      );

      const row = page.getByRole('row').filter({ hasText: testUser.email });
      await expect(row).toBeVisible();

      await row
        .getByRole('button', { name: `Delete ${testUser.displayName}` })
        .click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(dialog, 'dialog should close on Cancel').not.toBeVisible();

      // No DELETE request should have fired — row is still present.
      await expect(
        page.getByRole('row').filter({ hasText: testUser.email }),
        'row must remain in the table after Cancel'
      ).toBeVisible();

      const users = await listUsers(request, adminToken);
      expect(
        users.some((u) => u.id === testUser!.id),
        'user must still exist server-side after Cancel'
      ).toBe(true);
    } finally {
      if (testUser) await deleteTestUser(request, adminToken, testUser.id);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Agent role is rejected — both at the API and via route guarding
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Delete user — Agent role cannot delete users', () => {
  test('Agent JWT calling DELETE /api/users/{id} directly is forbidden and the user remains', async ({
    request,
  }) => {
    const adminToken = await fetchToken(
      request,
      TEST_CREDENTIALS.admin.email,
      TEST_CREDENTIALS.admin.password
    );
    const agentToken = await fetchToken(
      request,
      TEST_CREDENTIALS.agent.email,
      TEST_CREDENTIALS.agent.password
    );
    const testUser = await createTestUser(request, adminToken);

    try {
      const deleteRes = await request.delete(
        `${API_BASE}/api/users/${testUser.id}`,
        { headers: { Authorization: `Bearer ${agentToken}` } }
      );
      expect(
        deleteRes.status(),
        'Agent role must be forbidden from deleting users (RequireRole Admin)'
      ).toBe(403);

      const users = await listUsers(request, adminToken);
      expect(
        users.some((u) => u.id === testUser.id),
        'user must still exist after a forbidden delete attempt'
      ).toBe(true);
    } finally {
      await deleteTestUser(request, adminToken, testUser.id);
    }
  });

  test('Agent navigating to /users is redirected to / and never sees the delete affordance', async ({
    page,
  }) => {
    // Mirrors the AdminRoute coverage in auth/login.spec.ts — included here
    // too since it's the precondition that makes the delete-user UI
    // unreachable for non-admins in practice.
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/users');

    await page.waitForURL('/');
    await expect(page).toHaveURL('/');
    await expect(page).not.toHaveURL('/users');
  });
});
