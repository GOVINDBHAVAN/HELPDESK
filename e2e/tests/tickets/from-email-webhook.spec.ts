/**
 * e2e/tests/tickets/from-email-webhook.spec.ts
 *
 * Coverage for POST /api/tickets/from-email — the inbound-email-ingestion
 * webhook (Program.cs ~line 266-328):
 *  - Auth boundary: request is rejected without/with the wrong
 *    X-Webhook-Secret header (WebhookSecretFilter), before any validation
 *    or ticket logic runs.
 *  - Validation: 400 when FromEmail or Subject is missing/whitespace.
 *  - New ticket creation for an unseen FromEmail/Subject pair.
 *  - Threading: a follow-up email with the same FromEmail and a
 *    normalized-matching Subject (e.g. "Re: ..." prefix stripped) appends to
 *    the existing non-Closed ticket's Description instead of creating a new
 *    ticket.
 *  - A Closed ticket is excluded from threading — a matching follow-up
 *    creates a brand new ticket instead.
 *
 * This is a webhook fired by an external email-ingestion service, not a
 * browser flow — every test here uses the `request` fixture directly
 * (APIRequestContext), no `page` navigation. This mirrors the API-only test
 * group already established in tests/admin/delete-user.spec.ts (Group 4:
 * "Agent JWT calling DELETE /api/users/{id} directly").
 *
 * Architecture notes (see e2e/fixtures/* and .claude/agent-memory):
 *  - All direct API calls use http://127.0.0.1:5000 (IPv4 gotcha).
 *  - The endpoint is anonymous and has no authenticated caller of its own,
 *    so "was the ticket really persisted" is cross-checked via
 *    GET /api/tickets using an Agent bearer token (fetchToken from
 *    fixtures/auth.ts), not just by trusting the webhook's own response echo.
 *  - The product has NO PATCH/PUT endpoint to change a ticket's status and
 *    NO DELETE /api/tickets/{id} endpoint. fixtures/db.ts talks to Postgres
 *    directly (mirroring global-setup.ts's connection handling) to force a
 *    ticket to Closed for the non-matching scenario, and to clean up every
 *    ticket this spec creates.
 *  - Enums serialize as their C# names over JSON (JsonStringEnumConverter
 *    registered in Program.cs) — see the TICKET_* constants in
 *    fixtures/webhook.ts instead of hardcoding string literals.
 *  - No waitForTimeout() anywhere.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import { TEST_CREDENTIALS, fetchToken } from '../../fixtures/auth';
import { closeTicket, deleteTicketsForStudentEmail } from '../../fixtures/db';
import {
  API_BASE,
  TICKET_CATEGORY_GENERAL,
  TICKET_PRIORITY_MEDIUM,
  TICKET_STATUS_CLOSED,
  TICKET_STATUS_OPEN,
  postIncomingEmail,
  uniqueStudentEmail,
  type TicketResponseBody,
} from '../../fixtures/webhook';

/** Fetch every ticket for a given StudentEmail via the authenticated agent view. */
async function getTicketsForStudentEmail(
  request: APIRequestContext,
  agentToken: string,
  email: string
): Promise<TicketResponseBody[]> {
  const res = await request.get(`${API_BASE}/api/tickets`, {
    headers: { Authorization: `Bearer ${agentToken}` },
  });
  const tickets = (await res.json()) as TicketResponseBody[];
  return tickets.filter((t) => t.studentEmail === email);
}

// ─────────────────────────────────────────────────────────────────────────────
// Group 1: Auth boundary — X-Webhook-Secret
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/tickets/from-email — webhook secret', () => {
  test('request without the X-Webhook-Secret header is rejected with 401', async ({
    request,
  }) => {
    const email = uniqueStudentEmail('no-secret-header');

    const res = await postIncomingEmail(
      request,
      { fromEmail: email, subject: 'Cannot access my account', body: 'Help please.' },
      null // omit header entirely
    );

    expect(res.status(), 'missing X-Webhook-Secret header must be rejected').toBe(401);
  });

  test('request with a wrong X-Webhook-Secret value is rejected with 401', async ({
    request,
  }) => {
    const email = uniqueStudentEmail('wrong-secret-header');

    const res = await postIncomingEmail(
      request,
      { fromEmail: email, subject: 'Cannot access my account', body: 'Help please.' },
      'this-is-not-the-configured-secret'
    );

    expect(res.status(), 'wrong X-Webhook-Secret value must be rejected').toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 2: Validation — FromEmail / Subject required
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/tickets/from-email — validation', () => {
  test('missing FromEmail returns 400', async ({ request }) => {
    const res = await postIncomingEmail(request, {
      subject: 'Cannot access my account',
      body: 'Help please.',
    });

    expect(res.status(), 'missing FromEmail must be rejected with 400').toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error, 'error message should mention the missing fields').toMatch(
      /FromEmail/i
    );
  });

  test('missing Subject returns 400', async ({ request }) => {
    const res = await postIncomingEmail(request, {
      fromEmail: uniqueStudentEmail('missing-subject'),
      body: 'Help please.',
    });

    expect(res.status(), 'missing Subject must be rejected with 400').toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error, 'error message should mention the missing fields').toMatch(
      /Subject/i
    );
  });

  test('whitespace-only FromEmail and Subject returns 400', async ({ request }) => {
    const res = await postIncomingEmail(request, {
      fromEmail: '   ',
      subject: '   ',
      body: 'Help please.',
    });

    expect(
      res.status(),
      'whitespace-only fields must be treated as missing (IsNullOrWhiteSpace)'
    ).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 3: New ticket creation
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/tickets/from-email — new ticket creation', () => {
  test('an email from an unseen student/subject creates a new ticket with default Priority/Category', async ({
    request,
  }) => {
    const email = uniqueStudentEmail('new-ticket');
    const subject = `Question about enrollment ${Date.now()}`;

    try {
      const res = await postIncomingEmail(request, {
        fromEmail: email,
        subject,
        body: 'I have not received my enrollment confirmation.',
      });

      expect(res.status(), 'a brand-new email must create a ticket (201)').toBe(201);
      const created = (await res.json()) as TicketResponseBody;

      expect(created.subject).toBe(subject);
      expect(created.description).toBe(
        'I have not received my enrollment confirmation.'
      );
      expect(created.studentEmail).toBe(email);
      expect(created.status, 'new tickets default to Open').toBe(TICKET_STATUS_OPEN);
      expect(created.priority, 'webhook-created tickets default to Medium priority').toBe(
        TICKET_PRIORITY_MEDIUM
      );
      expect(created.category, 'webhook-created tickets default to General category').toBe(
        TICKET_CATEGORY_GENERAL
      );

      // Cross-check persistence through an authenticated view, not just the
      // webhook's own response echo.
      const agentToken = await fetchToken(
        request,
        TEST_CREDENTIALS.agent.email,
        TEST_CREDENTIALS.agent.password
      );
      const persisted = await getTicketsForStudentEmail(request, agentToken, email);
      expect(persisted, 'ticket must actually be persisted to the DB').toHaveLength(1);
      expect(persisted[0].id).toBe(created.id);
      expect(persisted[0].subject).toBe(subject);
    } finally {
      await deleteTicketsForStudentEmail(email);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 4: Threading — follow-up on a non-Closed ticket appends instead of
// creating a new ticket
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/tickets/from-email — threading into an existing open ticket', () => {
  test('a follow-up email with matching FromEmail + normalized Subject appends to the existing ticket', async ({
    request,
  }) => {
    const email = uniqueStudentEmail('thread-open');
    const originalSubject = `Cannot log into student portal ${Date.now()}`;

    try {
      const firstRes = await postIncomingEmail(request, {
        fromEmail: email,
        subject: originalSubject,
        body: 'Initial message: my login keeps failing.',
      });
      expect(firstRes.status(), 'first email creates the ticket').toBe(201);
      const original = (await firstRes.json()) as TicketResponseBody;

      // "Re: " prefix + different casing exercises NormalizeSubject's
      // re/fwd-stripping and lower-casing in one go.
      const followUpRes = await postIncomingEmail(request, {
        fromEmail: email,
        subject: `RE: ${originalSubject.toUpperCase()}`,
        body: 'Follow-up: still broken, tried resetting my password too.',
      });

      expect(
        followUpRes.status(),
        'a matching follow-up must thread into the existing ticket (200), not create a new one'
      ).toBe(200);
      const updated = (await followUpRes.json()) as TicketResponseBody;

      expect(updated.id, 'threaded reply must return the SAME ticket id').toBe(
        original.id
      );
      expect(
        updated.description,
        'original message must be preserved in the appended description'
      ).toContain('Initial message: my login keeps failing.');
      expect(
        updated.description,
        'new message must be appended with the --- separator'
      ).toContain('Follow-up: still broken, tried resetting my password too.');
      expect(updated.description).toMatch(/\n\n---\n.+\n/);
      expect(
        new Date(updated.updatedAt).getTime(),
        'UpdatedAt must be bumped by the append'
      ).toBeGreaterThanOrEqual(new Date(original.updatedAt).getTime());

      // Exactly one ticket must exist for this student — no duplicate created.
      const agentToken = await fetchToken(
        request,
        TEST_CREDENTIALS.agent.email,
        TEST_CREDENTIALS.agent.password
      );
      const persisted = await getTicketsForStudentEmail(request, agentToken, email);
      expect(
        persisted,
        'threading must not create a second ticket for the same student/subject'
      ).toHaveLength(1);
      expect(persisted[0].description).toContain('Follow-up: still broken');
    } finally {
      await deleteTicketsForStudentEmail(email);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Group 5: Threading — a Closed ticket must NOT match; a new ticket is
// created instead
// ─────────────────────────────────────────────────────────────────────────────

test.describe('POST /api/tickets/from-email — a Closed ticket is excluded from threading', () => {
  test('a follow-up matching a Closed ticket creates a new ticket rather than reopening/appending', async ({
    request,
  }) => {
    const email = uniqueStudentEmail('thread-closed');
    const originalSubject = `Refund request ${Date.now()}`;

    try {
      const firstRes = await postIncomingEmail(request, {
        fromEmail: email,
        subject: originalSubject,
        body: 'Initial message: please refund my last payment.',
      });
      expect(firstRes.status()).toBe(201);
      const original = (await firstRes.json()) as TicketResponseBody;

      // No PATCH/PUT endpoint exists yet to close a ticket — force it
      // directly in Postgres (see fixtures/db.ts doc comment).
      await closeTicket(original.id);

      const followUpRes = await postIncomingEmail(request, {
        fromEmail: email,
        subject: `Re: ${originalSubject}`,
        body: 'Follow-up: any update on my refund?',
      });

      expect(
        followUpRes.status(),
        'matching subject on a Closed ticket must NOT thread — a new ticket is created (201)'
      ).toBe(201);
      const newTicket = (await followUpRes.json()) as TicketResponseBody;

      expect(
        newTicket.id,
        'a genuinely new ticket must be created, distinct from the closed one'
      ).not.toBe(original.id);
      expect(
        newTicket.description,
        'the new ticket must contain only the follow-up body, nothing appended from the closed ticket'
      ).toBe('Follow-up: any update on my refund?');
      expect(newTicket.status, 'the new ticket defaults to Open').toBe(
        TICKET_STATUS_OPEN
      );

      // Both tickets must exist independently: the original still Closed,
      // and a second, separate Open ticket for the same student/subject.
      const agentToken = await fetchToken(
        request,
        TEST_CREDENTIALS.agent.email,
        TEST_CREDENTIALS.agent.password
      );
      const persisted = await getTicketsForStudentEmail(request, agentToken, email);
      expect(
        persisted,
        'two independent tickets must exist for this student after the closed-ticket follow-up'
      ).toHaveLength(2);

      const closedOne = persisted.find((t) => t.id === original.id);
      const newOne = persisted.find((t) => t.id === newTicket.id);
      expect(closedOne?.status, 'original ticket remains Closed').toBe(
        TICKET_STATUS_CLOSED
      );
      expect(newOne?.status, 'new ticket is Open').toBe(TICKET_STATUS_OPEN);
    } finally {
      await deleteTicketsForStudentEmail(email);
    }
  });
});
