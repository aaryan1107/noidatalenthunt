do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name = 'Gymnastics'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'registrations'
      and column_name = 'event'
  ) then
    alter table public.registrations rename column "Gymnastics" to event;
  end if;
end $$;
