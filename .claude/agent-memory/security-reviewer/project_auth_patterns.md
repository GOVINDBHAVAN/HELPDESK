---
name: project-auth-patterns
description: Security patterns, weaknesses, and conventions found in the auth/authorization implementation during Phase 0 review
metadata:
  type: project
---

Auth and authorization security state as of Phase 0 review (2026-06-07):

**Secrets committed to git in appsettings.json** — JWT secret, DB password, seed admin/agent passwords, and Redis connection string are all committed in `appsettings.json`. The file is tracked across 5+ commits. `appsettings.Development.json` is not gitignored (no entry in `.gitignore`). Critical — requires git history scrub.

**Why:** The project convention says secrets go in `appsettings.Development.json` (not committed), but the actual secrets ended up in `appsettings.json` which is committed. The `.gitignore` does not exclude either settings file.

**How to apply:** Flag any future appsettings changes. Remind that `appsettings.json` must never contain real secrets; `appsettings.Development.json` should be in `.gitignore`.

---

**Role claim type mismatch (broken RBAC)** — Roles are written to JWT tokens using the custom claim name `"role"` (lowercase string literal). ASP.NET Core's `RequireRole()` reads `ClaimTypes.Role` which maps to `http://schemas.microsoft.com/ws/2008/06/identity/claims/role`. The two do not match, so `RequireAuthorization(policy => policy.RequireRole("Admin"))` on `/api/auth/register` silently grants access to all authenticated users — not just Admins.

**Why:** `new Claim("role", role)` vs `new Claim(ClaimTypes.Role, role)` — a one-word difference with critical impact.

**How to apply:** When reviewing any `RequireRole()` authorization, verify the claim type used during token generation matches the claim type the authorization middleware reads.

---

**JWT secret has a weak fallback in JwtSettings.cs** — `JwtSettings.cs` defaults `Secret` to `"SuperSecretLocalDevKey123!"`. If configuration binding fails or a key is absent, the application silently falls back to this known-plaintext secret. Any token signed with the fallback would be accepted as valid.

---

**Token stored in localStorage (XSS risk)** — `AuthContext.tsx` stores the JWT in `localStorage` under the key `helpdesk_token`. This makes the token accessible to any JavaScript running on the page, including injected scripts.

---

**`/api/me` endpoint echoes the raw Bearer token in the response body** — `Program.cs` line 199 reads the Authorization header and returns it in the JSON response. This makes token exfiltration trivial if the endpoint is ever called from an XSS context.

---

**No rate limiting on login endpoint** — `/api/auth/login` has no rate limiting. Password brute-force and credential stuffing are unrestricted.

---

**CORS not configured** — No `AddCors`/`UseCors` middleware exists. In development Kestrel allows all origins by default; there is no restrictive CORS policy for production.

---

**Token lifetime is 8 hours with no refresh mechanism** — `ExpiryMinutes: 480`. There is no refresh token endpoint, no token revocation, and no short-lived access token pattern. Stolen tokens remain valid for 8 hours.

---

**Health endpoint leaks environment name** — `/api/health` returns `environment = app.Environment.EnvironmentName` which in production would confirm the environment name to unauthenticated callers.

---

**Seed credentials in appsettings.json are weak and default** — `admin@example.com / Password@123` and `agent@example.com / Password@123` are committed in plaintext and are predictable default credentials.

---

**Security strengths confirmed in Phase 0:**
- ASP.NET Identity password hashing is used correctly (not bypassed).
- `RequireUniqueEmail = true` prevents duplicate account registration.
- Issuer and Audience validation are both enabled in `TokenValidationParameters`.
- `ClockSkew` is reduced to 1 minute (good).
- `ValidateIssuerSigningKey = true` is set.
- `HMAC-SHA256` signing algorithm is used (appropriate for symmetric JWT).
- All protected endpoints use `.RequireAuthorization()` — no accidentally-public routes found.
- `/api/auth/register` correctly restricts registration to Admins (intent is correct, but broken by claim type mismatch).
- `EmailConfirmed = true` is set on seeded users.
- EF Core parameterized queries used throughout — no raw SQL found.
- All enum properties use `.HasConversion<string>()` in `OnModelCreating`.
- Input validation is manual in the register endpoint (basic null/empty check — not using Data Annotations or FluentValidation).
