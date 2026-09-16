# October 2026 organiser portal

Open `/organiser.html` on the deployed Pages site. The portal is protected by a
same-origin, signed, HttpOnly session cookie and reads the October event-row
view through Pages Functions only. The browser never receives Supabase keys or
the raw registration JSON payload.

## Cloudflare Pages secrets

Configure these as encrypted production secrets:

- `ORGANISER_PORTAL_PASSWORD`: a long, unique organiser password.
- `ORGANISER_PORTAL_SESSION_SECRET`: a separate random value used to sign the
  eight-hour session cookie.

The existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and Razorpay secrets
remain unchanged. Do not put any of these values in Vite variables or client
code.

## Required Cloudflare edge controls

Before exposing the portal in production, configure Cloudflare rate limiting
rules at the edge:

- `/api/organiser-login`: limit failed attempts per IP (for example, five per
  minute) and temporarily block or challenge repeat attempts.
- `/api/create-order`: rate-limit requests per IP and use a managed challenge
  or Turnstile before this public endpoint if registrations are being targeted
  by automated traffic.

These controls cannot be safely replaced with in-memory state in a Pages
Function because requests can run on different Cloudflare isolates.

## Supabase migration

Apply migrations in timestamp order, including
`20260915133000_harden_registration_security_and_archived_view.sql`. It:

- pins `prevent_july_registration_inserts()` to `pg_catalog` and preserves the
  archived-write exception;
- makes `registrations_july_2026` `security_invoker` and removes Data API
  grants;
- enables and forces RLS on both registration tables with no public policies,
  so direct `anon`/`authenticated` access is denied;
- leaves the service-role Pages Functions path intact.

Verify on the linked project with:

```bash
supabase db lint --linked --schema public --fail-on error
supabase migration list --linked
```

Then confirm the table/view grants and RLS flags in the Supabase Dashboard's
Security Advisor. The first command requires an authenticated, linked Supabase
CLI project; it was not runnable in the local checkout used to prepare this
change because no project link or local Docker database was available.
