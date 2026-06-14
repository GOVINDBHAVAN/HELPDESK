/**
 * e2e/tests/auth/login.spec.ts
 *
 * Comprehensive authentication tests covering:
 *  - Zod validation errors (no API call made)
 *  - API error responses (wrong credentials)
 *  - Happy-path login for Agent and Admin roles
 *  - Already-authenticated redirect
 *  - Auth persistence across page reload
 *  - Logout behaviour
 *  - ProtectedRoute / AdminRoute access control
 *
 * Architecture notes:
 *  - JWT is stored in localStorage under key "helpdesk_token".
 *  - Storage state files are written once in beforeAll via the API (no UI login).
 *  - All direct API calls use http://127.0.0.1:5000 (not localhost) to avoid
 *    IPv6 resolution issues.
 *  - No waitForTimeout() anywhere — only waitForURL, waitForResponse, or
 *    toBeVisible() assertions.
 */

import { test, expect } from '@playwright/test';
import {
  STORAGE_STATE_PATHS,
  TEST_CREDENTIALS,
  saveStorageState,
} from '../../fixtures/auth';

// ─── Selectors / constants ────────────────────────────────────────────────────

const TOKEN_KEY = 'helpdesk_token';

// ─── Storage state generation ─────────────────────────────────────────────────
//
// We generate storage state files once before ALL tests in this file.
// Other spec files can reuse the same files — they will already exist.

test.beforeAll(async ({ request }) => {
  // Run both role logins in parallel to keep suite startup fast.
  await Promise.all([
    saveStorageState(request, 'agent'),
    saveStorageState(request, 'admin'),
  ]);
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Login form — Zod validation (no network required)
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login form — Zod validation', () => {
  // These tests need an unauthenticated context.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('empty form submit shows email and password errors with border-destructive', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Sign in' }).click();

    // Both field-level error paragraphs should appear
    const emailError = page.getByRole('alert').filter({
      hasText: 'Enter a valid email address',
    });
    const passwordError = page.getByRole('alert').filter({
      hasText: 'Password is required',
    });

    await expect(emailError, 'email error should be visible').toBeVisible();
    await expect(passwordError, 'password error should be visible').toBeVisible();

    // Email input should carry the error border class
    // The input is inside a <label> whose text starts with "Email".
    const emailInput = page.getByLabel('Email');
    await expect(emailInput, 'email input should have border-destructive').toHaveClass(
      /border-destructive/
    );

    // Password input should carry the error border class
    const passwordInput = page.getByLabel('Password');
    await expect(
      passwordInput,
      'password input should have border-destructive'
    ).toHaveClass(/border-destructive/);

    // No navigation should have occurred
    await expect(page).toHaveURL('/login');
  });

  test('invalid email format shows Zod email error', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('notanemail');
    await page.getByLabel('Password').fill('somepassword');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Enter a valid email address' }),
      'Zod email format error should appear'
    ).toBeVisible();

    await expect(page.getByLabel('Email')).toHaveClass(/border-destructive/);
  });

  test('valid email with empty password shows only password error', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('valid@example.com');
    // Leave password empty
    await page.getByRole('button', { name: 'Sign in' }).click();

    const passwordError = page.getByRole('alert').filter({
      hasText: 'Password is required',
    });
    await expect(passwordError, 'password error should be visible').toBeVisible();

    // Email field should NOT have an error border
    await expect(page.getByLabel('Email')).not.toHaveClass(/border-destructive/);
    // Password field should have an error border
    await expect(page.getByLabel('Password')).toHaveClass(/border-destructive/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Login — API error responses
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — API error responses', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('wrong credentials shows root alert "Invalid email or password."', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_CREDENTIALS.agent.email);
    await page.getByLabel('Password').fill('WrongPassword999!');

    // Wait for the 401 response while clicking submit
    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/auth/login') && resp.status() === 401
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);

    expect(response.status(), '401 expected from login API').toBe(401);

    // Root-level error paragraph (not a field error)
    const rootAlert = page.getByRole('alert').filter({
      hasText: 'Invalid email or password.',
    });
    await expect(rootAlert, 'root error alert should be visible').toBeVisible();

    // Still on login page
    await expect(page).toHaveURL('/login');

    // No token written to localStorage
    const token = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      TOKEN_KEY
    );
    expect(token, 'localStorage should not contain a token').toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: Login — happy paths
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Login — happy paths', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('Agent login stores JWT in localStorage and redirects to /', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_CREDENTIALS.agent.email);
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.agent.password);

    const [response] = await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/auth/login') && resp.status() === 200
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);

    expect(response.status(), '200 expected from login API').toBe(200);

    // Should navigate away from /login
    await page.waitForURL('/');

    // Token must be present in localStorage
    const token = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      TOKEN_KEY
    );
    expect(token, 'JWT token must be written to localStorage').not.toBeNull();
    expect(typeof token, 'token must be a string').toBe('string');
  });

  test('Admin login stores JWT in localStorage and redirects to /', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_CREDENTIALS.admin.email);
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.admin.password);

    await Promise.all([
      page.waitForResponse(
        (resp) =>
          resp.url().includes('/api/auth/login') && resp.status() === 200
      ),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ]);

    await page.waitForURL('/');

    const token = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      TOKEN_KEY
    );
    expect(token, 'JWT token must be written to localStorage').not.toBeNull();
  });

  test('submit button shows "Signing in…" while request is in-flight', async ({
    page,
  }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill(TEST_CREDENTIALS.agent.email);
    await page.getByLabel('Password').fill(TEST_CREDENTIALS.agent.password);

    // Click without awaiting — we want to observe the transient state
    await page.getByRole('button', { name: 'Sign in' }).click();

    // The button text changes to 'Signing in…' during the request.
    // It may be very brief; we assert it becomes visible at some point.
    // After navigation it will be gone, so we check before waitForURL.
    await expect(
      page.getByRole('button', { name: 'Signing in…' })
    ).toBeVisible();

    await page.waitForURL('/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Already-authenticated redirect
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Already authenticated', () => {
  test('authenticated user navigating to /login is immediately redirected to /', async ({
    page,
  }) => {
    // Apply agent storage state so the context starts with a token in localStorage.
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/login');

    // LoginPage renders <Navigate to="/" replace /> when token is set.
    await expect(page).toHaveURL('/');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Auth persistence across reload
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Auth persistence', () => {
  test('token in localStorage survives a full page reload — user stays logged in', async ({
    page,
  }) => {
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/');

    // Should be on the dashboard (ProtectedRoute lets us through)
    await expect(page).toHaveURL('/');

    // Reload the page (simulates browser restart / tab reload)
    await page.reload();

    // Still on the dashboard — ProtectedRoute reads token from localStorage on mount
    await expect(page).toHaveURL('/');

    // Token is still present
    const token = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      TOKEN_KEY
    );
    expect(token, 'token should survive reload').not.toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 6: Logout behaviour
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Logout', () => {
  test('clicking "Sign out" removes token, navigates to /login, and subsequent / visit redirects back to /login', async ({
    page,
  }) => {
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/');

    // Click the sign-out button in the Navbar
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Should land on /login
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');

    // Token must be removed from localStorage
    const token = await page.evaluate(
      (key: string) => window.localStorage.getItem(key),
      TOKEN_KEY
    );
    expect(token, 'token must be removed after logout').toBeNull();

    // Navigating to / without a token should redirect back to /login
    await page.goto('/');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 7: ProtectedRoute — unauthenticated access
// ─────────────────────────────────────────────────────────────────────────────

test.describe('ProtectedRoute — unauthenticated access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('unauthenticated visit to / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated visit to /tickets redirects to /login', async ({
    page,
  }) => {
    await page.goto('/tickets');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated visit to /users redirects to /login', async ({
    page,
  }) => {
    await page.goto('/users');
    await page.waitForURL('/login');
    await expect(page).toHaveURL('/login');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 8: AdminRoute — role-based access control
// ─────────────────────────────────────────────────────────────────────────────

test.describe('AdminRoute — role-based access control', () => {
  test('Agent visiting /users is redirected to / (not /login)', async ({
    page,
  }) => {
    // Agent is authenticated but not Admin — AdminRoute redirects to /
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/users');

    await page.waitForURL('/');
    await expect(page).toHaveURL('/');

    // Confirm we did NOT land on /login
    await expect(page).not.toHaveURL('/login');
  });

  test('Admin visiting /users is allowed through to the Users page', async ({
    page,
  }) => {
    await page.context().setStorageState(STORAGE_STATE_PATHS.admin);
    await page.goto('/users');

    // AdminRoute should let the Admin through — URL stays at /users
    await expect(page).toHaveURL('/users');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 9: Navbar — role-specific UI elements
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Navbar — role-specific UI', () => {
  test('Admin sees a "Users" nav link; Agent does not', async ({ page }) => {
    // Admin
    await page.context().setStorageState(STORAGE_STATE_PATHS.admin);
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Users' }),
      'Admin should see Users link'
    ).toBeVisible();

    // Switch to agent context
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/');
    await expect(
      page.getByRole('link', { name: 'Users' }),
      'Agent should NOT see Users link'
    ).not.toBeVisible();
  });

  test('Navbar displays the logged-in user email', async ({ page }) => {
    await page.context().setStorageState(STORAGE_STATE_PATHS.agent);
    await page.goto('/');

    // The Navbar renders <span>{user?.email}</span>
    await expect(
      page.getByText(TEST_CREDENTIALS.agent.email),
      "Agent's email should appear in the Navbar"
    ).toBeVisible();
  });
});
