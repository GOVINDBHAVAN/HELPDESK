/**
 * Auth fixture helpers.
 *
 * Because the app stores the JWT in localStorage (not cookies), Playwright's
 * `request.storageState()` does NOT capture it automatically.  Instead we:
 *   1. POST to the login API to get a token string.
 *   2. Build the storageState JSON ourselves, embedding the token under the
 *      correct `origin` so that `test.use({ storageState })` injects it into
 *      localStorage before the page loads.
 *   3. Persist each role's state file once per test run (generated lazily in
 *      beforeAll blocks inside the spec, so tests can reference them cheaply).
 */

import type { APIRequestContext } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const API_BASE = 'http://127.0.0.1:5000';
const FRONTEND_ORIGIN = 'http://localhost:5173';
const TOKEN_KEY = 'helpdesk_token';

export const STORAGE_STATE_DIR = path.resolve(__dirname, '../storageState');

export const STORAGE_STATE_PATHS = {
  agent: path.join(STORAGE_STATE_DIR, 'agent.json'),
  admin: path.join(STORAGE_STATE_DIR, 'admin.json'),
} as const;

export type Role = keyof typeof STORAGE_STATE_PATHS;

/** Seed credentials that match appsettings.Testing.json */
export const TEST_CREDENTIALS = {
  admin: { email: 'admin@test.helpdesk.local', password: 'AdminPass123!' },
  agent: { email: 'agent@test.helpdesk.local', password: 'AgentPass123!' },
} as const satisfies Record<Role, { email: string; password: string }>;

/**
 * Call POST /api/auth/login and return the raw JWT string.
 * Throws if the response is not 2xx.
 */
export async function fetchToken(
  request: APIRequestContext,
  email: string,
  password: string
): Promise<string> {
  const res = await request.post(`${API_BASE}/api/auth/login`, {
    data: { email, password },
  });

  if (!res.ok()) {
    const body = await res.text();
    throw new Error(
      `Login failed for ${email}: HTTP ${res.status()} — ${body}`
    );
  }

  const json = (await res.json()) as { token: string };
  return json.token;
}

/**
 * Build a Playwright StorageState object (the shape Playwright persists to
 * disk) with the JWT pre-loaded into localStorage for the frontend origin.
 */
function buildStorageState(token: string): object {
  return {
    cookies: [],
    origins: [
      {
        origin: FRONTEND_ORIGIN,
        localStorage: [{ name: TOKEN_KEY, value: token }],
      },
    ],
  };
}

/**
 * Obtain a JWT for `role` via the API, then write the storage state file
 * that can be referenced by `test.use({ storageState: STORAGE_STATE_PATHS[role] })`.
 *
 * Safe to call concurrently for different roles.
 */
export async function saveStorageState(
  request: APIRequestContext,
  role: Role
): Promise<void> {
  const creds = TEST_CREDENTIALS[role];
  const token = await fetchToken(request, creds.email, creds.password);
  const state = buildStorageState(token);
  fs.mkdirSync(STORAGE_STATE_DIR, { recursive: true });
  fs.writeFileSync(STORAGE_STATE_PATHS[role], JSON.stringify(state, null, 2));
}
