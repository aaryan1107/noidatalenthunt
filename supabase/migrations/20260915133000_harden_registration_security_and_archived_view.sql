-- Security hardening for the archived July session and active October session.
-- The Pages Functions use SUPABASE_SERVICE_ROLE_KEY; public browser roles do not.

-- Supabase's security advisor flags functions with a mutable search_path. This
-- trigger only raises an exception, so it needs no application schema lookup.
create or replace function public.prevent_july_registration_inserts()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'July 2026 registrations are archived. Write new entries to public.registrations_october_2026.';
end;
$$;

-- The alias is intentionally retained for archive reporting, but it must obey
-- the invoker's RLS context and must not be reachable through the Data API.
alter view public.registrations_july_2026 set (security_invoker = true);
revoke all on public.registrations_july_2026 from anon, authenticated;

-- Empty RLS policy sets deny direct API access. The service role used only by
-- Cloudflare Pages Functions bypasses RLS, while anon/authenticated retain no
-- table or view grants. This preserves the server-side Razorpay flow.
alter table public.registrations enable row level security;
alter table public.registrations force row level security;
alter table public.registrations_october_2026 enable row level security;
alter table public.registrations_october_2026 force row level security;

revoke all on public.registrations from anon, authenticated;
revoke all on public.registrations_october_2026 from anon, authenticated;

comment on table public.registrations is
  'Archived July 2026 registration session. Direct API access is denied by RLS; use the organiser/server-side workflows.';
comment on table public.registrations_october_2026 is
  'Active October 2026 registration session. Direct API access is denied by RLS; Cloudflare Pages Functions use the service role.';
