-- Read-only alias so July data stays queryable under a session-scoped name.
-- Recorded remotely as 20260910093112.

create or replace view public.registrations_july_2026 as
select *
from public.registrations;

comment on view public.registrations_july_2026 is
  'Read-only alias for archived July 2026 registration data.';
