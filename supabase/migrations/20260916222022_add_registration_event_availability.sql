create table public.registration_event_availability (
  session_name text not null,
  category_slug text not null,
  is_open boolean not null default true,
  slots_available integer,
  updated_at timestamptz not null default now(),
  primary key (session_name, category_slug),
  constraint registration_event_availability_slots_check check (slots_available is null or slots_available >= 0)
);

alter table public.registration_event_availability enable row level security;
alter table public.registration_event_availability force row level security;

revoke all on table public.registration_event_availability from anon, authenticated;

insert into public.registration_event_availability (session_name, category_slug, is_open, slots_available)
values
  ('October 2026', 'badminton', true, null),
  ('October 2026', 'table-tennis', true, null),
  ('October 2026', 'chess', true, null),
  ('October 2026', 'swimming', true, null),
  ('October 2026', 'gymnastics', true, null),
  ('October 2026', 'shooting', true, null);

comment on table public.registration_event_availability is
  'Server-managed October 2026 registration availability. Direct API access is denied; Cloudflare Pages Functions use the service role.';
