/**
 * e2e/fixtures/db.ts
 *
 * Direct PostgreSQL helpers for the inbound-email-webhook e2e suite.
 *
 * The product currently has NO API endpoint to transition a ticket's status
 * (no PATCH/PUT /api/tickets/{id} exists in Program.cs) and NO
 * DELETE /api/tickets/{id} endpoint either. To test the "a Closed ticket
 * must not be threaded into by POST /api/tickets/from-email" behavior, and
 * to clean up tickets that the anonymous webhook creates (CreatedById is
 * null, so there's no owning user/token to act through), tests connect
 * directly to the `helpdesk_test` database with `pg` — mirroring the
 * connection-string parsing already done in e2e/global-setup.ts.
 *
 * Table/column names follow EF Core's snake_case convention
 * (UseSnakeCaseNamingConvention in HelpdeskDbContext): table `tickets`,
 * columns `student_email`, `status`, etc. Status/priority/category are
 * stored as their C# enum *names* as text in the DB
 * (`.HasConversion<string>()` in OnModelCreating) — e.g. `'Closed'`, not a
 * number. This is independent of how the enum is serialized over JSON by
 * TicketResponse (see fixtures/webhook.ts for that distinction).
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

function parseNpgsqlConnStr(connStr: string): Record<string, string> {
  return Object.fromEntries(
    connStr
      .split(';')
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf('=');
        return [part.slice(0, eq).trim().toLowerCase(), part.slice(eq + 1).trim()];
      })
  );
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const settingsPath = path.resolve(
    __dirname,
    '../../backend/Helpdesk.Api/appsettings.Testing.json'
  );
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  const params = parseNpgsqlConnStr(settings.ConnectionStrings.DefaultConnection);

  const client = new Client({
    host: params['host'] ?? 'localhost',
    port: parseInt(params['port'] ?? '5432', 10),
    user: params['username'],
    password: params['password'],
    database: params['database'],
  });

  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Force a ticket straight to Closed status. There is no API for this yet, so
 * this is the only way to set up the "webhook must not thread into a closed
 * ticket" scenario.
 */
export async function closeTicket(ticketId: number): Promise<void> {
  await withClient((client) =>
    client.query(`UPDATE tickets SET status = 'Closed' WHERE id = $1`, [ticketId])
  );
}

/**
 * Best-effort cleanup for tickets created via the anonymous
 * POST /api/tickets/from-email endpoint. Deletes every ticket for a given
 * StudentEmail — safe because tests always seed a unique, per-test email, so
 * this never touches another test's data.
 */
export async function deleteTicketsForStudentEmail(email: string): Promise<void> {
  try {
    await withClient((client) =>
      client.query(`DELETE FROM tickets WHERE student_email = $1`, [email])
    );
  } catch {
    // best-effort — ignore
  }
}
