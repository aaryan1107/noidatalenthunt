alter table public.registrations
  add column if not exists parent_name text;

comment on column public.registrations.parent_name is 'Parent, guardian, or coach name submitted with the registration form.';
