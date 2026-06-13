import type { FullConfig } from '@playwright/test';
import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { spawn, execSync, execFileSync } from 'child_process';

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


function killProcessOnPort(port: number): void {
  try {
    const pid = execFileSync('powershell', [
      '-NonInteractive',
      '-Command',
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty OwningProcess`,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

    if (pid && /^\d+$/.test(pid)) {
      console.log(`[globalSetup] Stopping PID ${pid} on port ${port}`);
      execFileSync('taskkill', ['/F', '/PID', pid], { stdio: 'ignore' });
    }
  } catch {
    // port is free — nothing to do
  }
}

async function waitForTestingBackend(url: string, timeoutMs = 120_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) {
        const body = (await res.json()) as { environment?: string };
        if (body.environment === 'Testing') return;
      }
    } catch {
      // still starting up
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `Backend at ${url} did not respond with environment=Testing within ${timeoutMs}ms`
  );
}

export default async function globalSetup(_config: FullConfig) {
  // 1. Drop and recreate the test database
  const settingsPath = path.resolve(
    __dirname,
    '../backend/Helpdesk.Api/appsettings.Testing.json'
  );
  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  const params = parseNpgsqlConnStr(settings.ConnectionStrings.DefaultConnection);
  const dbName = params['database'];

  const pg = new Client({
    host: params['host'] ?? 'localhost',
    port: parseInt(params['port'] ?? '5432', 10),
    user: params['username'],
    password: params['password'],
    database: 'postgres',
  });
  await pg.connect();
  await pg.query(
    `SELECT pg_terminate_backend(pid)
     FROM pg_stat_activity
     WHERE datname = $1 AND pid <> pg_backend_pid()`,
    [dbName]
  );
  await pg.query(`DROP DATABASE IF EXISTS "${dbName}"`);
  await pg.query(`CREATE DATABASE "${dbName}"`);
  await pg.end();
  console.log(`[globalSetup] Recreated test database: ${dbName}`);

  // 2. Free port 5000 unconditionally so the test backend can bind
  killProcessOnPort(5000);
  await new Promise((r) => setTimeout(r, 1000)); // let the OS release the port

  // 3. Start the backend in Testing mode
  //    EnsureCreated() builds the schema; the seed block creates admin + agent users.
  const backendDir = path.resolve(__dirname, '../backend/Helpdesk.Api');
  const backend = spawn('dotnet', ['run', '--project', backendDir, '--no-launch-profile'], {
    env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Testing' },
    stdio: 'pipe',
    shell: true,
  });
  backend.stdout?.on('data', (d) => process.stdout.write(d));
  backend.stderr?.on('data', (d) => process.stderr.write(d));

  // 4. Wait until the health endpoint confirms Testing mode
  //    (health only responds after EnsureCreated + seed have finished)
  await waitForTestingBackend('http://127.0.0.1:5000/api/health');
  console.log('[globalSetup] Backend ready — schema and seed users created.');

  // 5. Return teardown: Playwright calls this after all tests finish
  return async () => {
    backend.kill();
    console.log('[globalTeardown] Backend stopped.');
  };
}
