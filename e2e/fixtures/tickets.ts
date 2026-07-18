/**
 * e2e/fixtures/tickets.ts
 *
 * Seeding helper for POST /api/tickets (Program.cs ~line 241) — the
 * authenticated ticket-creation endpoint used by the ticket-list UI tests.
 * Unlike POST /api/tickets/from-email (see fixtures/webhook.ts), this
 * endpoint just requires `.RequireAuthorization()` with no specific role —
 * any authenticated Agent/Admin/Student token can create a ticket.
 *
 * Priority/Category are sent as their C# enum *names* as JSON strings
 * ("High", "Technical", etc.) — Program.cs registers a global
 * JsonStringEnumConverter (ConfigureHttpJsonOptions), so minimal API model
 * binding accepts these string names directly into the TicketPriority /
 * TicketCategory enum properties on CreateTicketRequest, and TicketResponse
 * serializes them back out the same way. See backend/Helpdesk.Api/Entities/Ticket.cs
 * for the full enum member lists.
 *
 * Cleanup reuses fixtures/db.ts's deleteTicketsForStudentEmail — the
 * `tickets.student_email` column is populated the same way regardless of
 * which endpoint created the row.
 */

import type { APIRequestContext } from '@playwright/test';

export const API_BASE = 'http://127.0.0.1:5000';

export type TicketPriorityName = 'Low' | 'Medium' | 'High';
export type TicketCategoryName =
  | 'Billing'
  | 'Enrollment'
  | 'Technical'
  | 'Refund'
  | 'General';

export interface CreateTicketOptions {
  subject: string;
  description?: string;
  priority?: TicketPriorityName;
  category?: TicketCategoryName;
  studentEmail: string;
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
 * Create a ticket via POST /api/tickets using `token` as the bearer.
 * Description/priority/category default to values matching the backend's
 * own defaults on CreateTicketRequest so call sites only need to specify
 * `subject` + `studentEmail` for the common case.
 */
export async function createTestTicket(
  request: APIRequestContext,
  token: string,
  options: CreateTicketOptions
): Promise<TicketResponseBody> {
  const res = await request.post(`${API_BASE}/api/tickets`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      subject: options.subject,
      description: options.description ?? 'Seeded by e2e tests.',
      priority: options.priority ?? 'Medium',
      category: options.category ?? 'General',
      studentEmail: options.studentEmail,
    },
  });

  if (!res.ok()) {
    throw new Error(
      `Failed to create test ticket "${options.subject}": HTTP ${res.status()} — ${await res.text()}`
    );
  }

  return res.json();
}
