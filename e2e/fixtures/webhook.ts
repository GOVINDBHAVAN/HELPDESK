/**
 * e2e/fixtures/webhook.ts
 *
 * Helpers for POST /api/tickets/from-email — the inbound-email-ingestion
 * webhook (Program.cs ~line 266). The endpoint is `.AllowAnonymous()` but
 * gated by `WebhookSecretFilter`, which requires an `X-Webhook-Secret`
 * header matching `WebhookSettings:InboundEmailSecret` from config. The
 * Testing environment's value lives in
 * backend/Helpdesk.Api/appsettings.Testing.json.
 *
 * Response shape (TicketResponse): the C# properties are PascalCase but
 * ASP.NET Core's default System.Text.Json options camelCase them over the
 * wire (matches every other endpoint in this suite, e.g. auth.ts's
 * `{ email, password }` login payload). Program.cs registers a global
 * JsonStringEnumConverter (ConfigureHttpJsonOptions), so `status`/`priority`/
 * `category` serialize as their C# enum **names**, e.g. `"Closed"` — see the
 * TICKET_* constants below rather than hardcoding string literals in specs.
 */

import type { APIRequestContext, APIResponse } from '@playwright/test';

export const API_BASE = 'http://127.0.0.1:5000';

/** Must match WebhookSettings:InboundEmailSecret in appsettings.Testing.json */
export const WEBHOOK_SECRET = 'test-inbound-email-webhook-secret';

// Enum names as serialized over JSON (JsonStringEnumConverter registered in
// Program.cs), matching backend/Helpdesk.Api/Entities/Ticket.cs.
export const TICKET_STATUS_OPEN = 'Open';
export const TICKET_STATUS_CLOSED = 'Closed';
export const TICKET_PRIORITY_MEDIUM = 'Medium';
export const TICKET_CATEGORY_GENERAL = 'General';

export interface IncomingEmailPayload {
  fromEmail: string;
  subject: string;
  body: string;
}

export interface TicketResponseBody {
  id: number;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  studentEmail: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * POST to the webhook endpoint.
 *
 * @param secret - Header value to send. Pass `null` to omit the header
 *   entirely (simulates a caller that forgot it). Defaults to the correct
 *   Testing-environment secret so call sites only need to override it for
 *   the auth-failure test cases. IMPORTANT: must be `null`, not `undefined`
 *   — a default parameter only kicks in when the argument is `undefined`,
 *   so passing `undefined` here would silently fall back to the correct
 *   secret instead of omitting the header.
 * @param payload - Partial on purpose so validation tests can omit fields
 *   (they're missing from the JSON body, not just empty strings).
 */
export async function postIncomingEmail(
  request: APIRequestContext,
  payload: Partial<IncomingEmailPayload>,
  secret: string | null = WEBHOOK_SECRET
): Promise<APIResponse> {
  const headers: Record<string, string> = {};
  if (secret !== null) {
    headers['X-Webhook-Secret'] = secret;
  }

  return request.post(`${API_BASE}/api/tickets/from-email`, {
    headers,
    data: payload,
  });
}

/**
 * Unique per-test student email so parallel tests (fullyParallel: true)
 * never collide on the webhook's same-email/same-subject threading match.
 */
export function uniqueStudentEmail(label: string): string {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${label}-${unique}@student.test.helpdesk.local`;
}
