/**
 * Test-user seeding/cleanup helpers for the "delete user" feature.
 *
 * POST /api/auth/register now requires an Admin bearer token (it is no longer
 * anonymous), so every seeded user must be created with an admin JWT attached
 * as an Authorization header. These helpers exist so individual delete-user
 * tests can create a disposable non-admin user (always lands in the Agent
 * role — see Program.cs) instead of mutating the shared `agent@test.helpdesk.local`
 * fixture user that auth/login.spec.ts and other suites depend on.
 *
 * All calls use 127.0.0.1 (not localhost) per the project's IPv4 gotcha.
 */

import type { APIRequestContext } from '@playwright/test';

const API_BASE = 'http://127.0.0.1:5000';

export interface TestUser {
  id: string;
  email: string;
  displayName: string;
  password: string;
}

/**
 * Create a disposable non-admin user via POST /api/auth/register.
 * The endpoint always assigns the Agent role (see Program.cs) — there is no
 * way to request a specific role at creation time.
 *
 * Emails/display names are suffixed with a timestamp + random string so
 * concurrent/parallel tests never collide.
 */
export async function createTestUser(
  request: APIRequestContext,
  adminToken: string,
  overrides: Partial<Pick<TestUser, 'displayName' | 'email' | 'password'>> = {}
): Promise<TestUser> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const displayName = overrides.displayName ?? `E2E Delete Target ${unique}`;
  const email = overrides.email ?? `delete-target-${unique}@test.helpdesk.local`;
  const password = overrides.password ?? 'DeleteMe123!';

  const res = await request.post(`${API_BASE}/api/auth/register`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { displayName, email, password },
  });

  if (!res.ok()) {
    throw new Error(
      `Failed to create test user ${email}: HTTP ${res.status()} — ${await res.text()}`
    );
  }

  const body = (await res.json()) as { id: string; email: string };
  return { id: body.id, email, displayName, password };
}

/**
 * Best-effort cleanup via DELETE /api/users/{id}. Swallows errors so that a
 * test which already deleted the user through the UI (or failed before
 * creating it) doesn't blow up in an afterEach/finally block.
 */
export async function deleteTestUser(
  request: APIRequestContext,
  adminToken: string,
  userId: string
): Promise<void> {
  try {
    await request.delete(`${API_BASE}/api/users/${userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
  } catch {
    // best-effort — ignore
  }
}

/** Fetch the current /api/users list as the given bearer token (must be Admin). */
export async function listUsers(
  request: APIRequestContext,
  adminToken: string
): Promise<Array<{ id: string; email: string; displayName: string; role: string }>> {
  const res = await request.get(`${API_BASE}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  return res.json();
}

export { API_BASE };
