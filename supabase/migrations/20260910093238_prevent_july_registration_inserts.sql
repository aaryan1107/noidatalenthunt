-- Hard stop against new writes landing in the archived July table.
-- Recorded remotely as 20260910093238.

create or replace function public.prevent_july_registration_inserts()
returns trigger
language plpgsql
as $$
begin
  raise exception 'July 2026 registrations are archived. Write new entries to public.registrations_october_2026.';
end;
$$;

drop trigger if exists registrations_prevent_archived_inserts on public.registrations;

create trigger registrations_prevent_archived_inserts
before insert on public.registrations
for each row
execute function public.prevent_july_registration_inserts();
