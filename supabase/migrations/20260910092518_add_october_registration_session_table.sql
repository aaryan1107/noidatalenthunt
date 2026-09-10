-- Splits the registration store into an archived July session and an active
-- October session. Recorded remotely as 20260910092518.

alter table public.registrations
  add column if not exists session_name text not null default 'July 2026',
  add column if not exists address text;

comment on table public.registrations is
  'Archived July 2026 registration session. The October 2026 public site writes to public.registrations_october_2026.';

comment on column public.registrations.session_name is
  'Registration session label. Existing rows belong to the July 2026 session.';

comment on column public.registrations.address is
  'Participant address submitted with the registration form when collected.';

create table if not exists public.registrations_october_2026 (
  like public.registrations including all
);

alter table public.registrations_october_2026
  alter column session_name set default 'October 2026';

comment on table public.registrations_october_2026 is
  'Active October 2026 registration session. New public registrations are stored here.';

comment on column public.registrations_october_2026.session_name is
  'Registration session label for the October 2026 edition.';
