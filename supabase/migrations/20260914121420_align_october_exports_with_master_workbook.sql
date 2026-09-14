-- Uses the July master workbook's sport-sheet column order for October exports.
-- Sport-specific fields are explicit and always contain a value; NA means that
-- the field does not apply to the selected sport or entry.

drop view if exists public.registrations_october_2026_badminton_export;
drop view if exists public.registrations_october_2026_chess_export;
drop view if exists public.registrations_october_2026_swimming_export;
drop view if exists public.registrations_october_2026_shooting_export;
drop view if exists public.registrations_october_2026_gymnastics_export;
drop view if exists public.registrations_october_2026_table_tennis_export;
drop view if exists public.registrations_october_2026_duplicate_entries;
drop view if exists public.registrations_october_2026_pending_payments;
drop view if exists public.registrations_october_2026_export;
drop view if exists public.registrations_october_2026_event_rows;

alter table public.registrations_october_2026
  add column if not exists entry_type text,
  add column if not exists performance_requirement_details text;

update public.registrations_october_2026
set
  partner_name = case
    when category_slug = 'badminton' then coalesce(nullif(btrim(partner_name), ''), 'NA')
    else 'NA'
  end,
  fide_id = case
    when category_slug = 'chess' then coalesce(nullif(btrim(fide_id), ''), 'NA')
    else 'NA'
  end,
  fide_rating = case
    when category_slug = 'chess' then coalesce(nullif(btrim(fide_rating), ''), 'NA')
    else 'NA'
  end,
  swimming_group = case
    when category_slug = 'swimming' then coalesce(nullif(btrim(swimming_group), ''), 'NA')
    else 'NA'
  end,
  academy_name = case
    when category_slug = 'gymnastics' then coalesce(nullif(btrim(academy_name), ''), 'NA')
    else 'NA'
  end,
  shooting_age_category = case
    when category_slug = 'shooting' then coalesce(nullif(btrim(shooting_age_category), ''), 'NA')
    else 'NA'
  end,
  shooting_entry_type = case
    when category_slug = 'shooting' then coalesce(nullif(btrim(shooting_entry_type), ''), 'NA')
    else 'NA'
  end,
  team_member_names = case
    when category_slug = 'shooting' then coalesce(nullif(btrim(team_member_names), ''), 'NA')
    else 'NA'
  end,
  entry_type = case
    when category_slug = 'badminton' and exists (
      select 1 from unnest(selected_events) as selected_event where selected_event ilike '%Doubles%'
    ) then 'Doubles'
    when category_slug = 'badminton' then 'Singles'
    when category_slug = 'shooting' then coalesce(nullif(btrim(shooting_entry_type), ''), 'NA')
    when category_slug in ('table-tennis', 'chess', 'swimming', 'gymnastics') then 'Individual Entry'
    else 'NA'
  end,
  performance_requirement_details = case
    when category_slug = 'shooting' and coalesce(nullif(btrim(shooting_entry_type), ''), 'NA') = 'Team Entry'
      then coalesce(nullif(btrim(team_member_names), ''), 'NA')
    else 'NA'
  end;

alter table public.registrations_october_2026
  alter column partner_name set default 'NA',
  alter column partner_name set not null,
  alter column fide_id set default 'NA',
  alter column fide_id set not null,
  alter column fide_rating set default 'NA',
  alter column fide_rating set not null,
  alter column swimming_group set default 'NA',
  alter column swimming_group set not null,
  alter column academy_name set default 'NA',
  alter column academy_name set not null,
  alter column shooting_age_category set default 'NA',
  alter column shooting_age_category set not null,
  alter column shooting_entry_type set default 'NA',
  alter column shooting_entry_type set not null,
  alter column team_member_names set default 'NA',
  alter column team_member_names set not null,
  alter column entry_type set default 'NA',
  alter column entry_type set not null,
  alter column performance_requirement_details set default 'NA',
  alter column performance_requirement_details set not null;

create or replace view public.registrations_october_2026_event_rows as
with expanded_entries as (
  select
    r.id as registration_id,
    r.session_name,
    r.event,
    r.category_slug,
    r.participant_name,
    r.contact,
    r.email,
    r.school,
    r.address,
    r.dob,
    r.age,
    r.gender,
    r.age_group,
    r.id_number,
    r.entry_type,
    r.partner_name,
    r.fide_id,
    r.fide_rating,
    r.swimming_group,
    r.academy_name,
    r.shooting_age_category,
    r.shooting_entry_type,
    r.team_member_names,
    r.performance_requirement_details,
    r.payment_status,
    r.payment_method,
    r.created_at,
    r.payment_captured_at,
    r.razorpay_order_id,
    r.razorpay_payment_id,
    selected_event as selected_category_or_event,
    r.amount / greatest(cardinality(r.selected_events), 1) as amount_paise
  from public.registrations_october_2026 r
  cross join lateral unnest(r.selected_events) as selected_event
),
identified_entries as (
  select
    expanded_entries.*,
    lower(regexp_replace(coalesce(participant_name, ''), '[^a-z0-9]+', '', 'g')) || '|' ||
      coalesce(contact, '') || '|' || coalesce(dob::text, '') || '|' ||
      coalesce(category_slug, '') || '|' ||
      lower(regexp_replace(coalesce(selected_category_or_event, ''), '[^a-z0-9]+', '', 'g')) as entry_identity
  from expanded_entries
),
ranked_entries as (
  select
    identified_entries.*,
    row_number() over (
      partition by entry_identity
      order by case
        when payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') then 0
        when payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') then 1
        else 2
      end, created_at, registration_id
    ) as canonical_rank,
    bool_or(payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL')) over (
      partition by entry_identity
    ) as has_confirmed_match
  from identified_entries
)
select
  registration_id, session_name, event, category_slug, participant_name, contact as phone,
  email, school, address, dob, age, gender, age_group, id_number, entry_type,
  partner_name, fide_id, fide_rating, swimming_group, academy_name,
  shooting_age_category, shooting_entry_type, team_member_names,
  performance_requirement_details, selected_category_or_event, payment_status,
  payment_method, amount_paise / 100.0 as amount_inr, created_at as submitted_at,
  payment_captured_at, razorpay_order_id, razorpay_payment_id,
  canonical_rank, has_confirmed_match
from ranked_entries;

create or replace view public.registrations_october_2026_export as
select
  row_number() over (partition by event order by submitted_at, registration_id) as "S.No.",
  event as "Event", participant_name as "Participant Name", phone as "Phone", email as "Email",
  school as "School / Academy", address as "Address", age as "Age", dob as "Date of Birth",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Selected Category / Event",
  entry_type as "Entry Type", partner_name as "Doubles Partner / Team Members",
  fide_id as "FIDE ID", fide_rating as "FIDE Rating", swimming_group as "Swimming Group",
  academy_name as "Gymnastics Academy / Team", shooting_age_category as "Shooting Age Category",
  shooting_entry_type as "Shooting Entry Type", team_member_names as "Shooting Team Members",
  performance_requirement_details as "Performance / Requirement Details",
  payment_status as "Payment Status", amount_inr as "Amount (INR)",
  'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID",
  registration_id as "Registration ID"
from public.registrations_october_2026_event_rows
where payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1
order by "Event", "S.No.";

create or replace view public.registrations_october_2026_badminton_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address", age as "Age",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Badminton Event(s)",
  entry_type as "Entry Type", payment_status as "Payment Status", amount_inr as "Amount (INR)",
  'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Badminton' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_chess_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address", age as "Age",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Chess Category",
  fide_id as "FIDE ID", fide_rating as "FIDE Rating", payment_status as "Payment Status",
  amount_inr as "Amount (INR)", 'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Chess' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_swimming_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address",
  case when dob is not null then concat_ws(' | ', nullif('Age ' || age, 'Age '), 'DOB ' || dob::text) else age end as "Age/DOB",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Swimming Event(s)",
  payment_status as "Payment Status", amount_inr as "Amount (INR)",
  'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Swimming' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_shooting_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address", age as "Age",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Shooting Event / Discipline",
  entry_type as "Entry Type", performance_requirement_details as "Performance / Requirement Details",
  payment_status as "Payment Status", amount_inr as "Amount (INR)",
  'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Shooting' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_gymnastics_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address", age as "Age",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Gymnastics Category",
  academy_name as "Gymnastics Academy / Team", payment_status as "Payment Status",
  amount_inr as "Amount (INR)", 'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Gymnastics' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_table_tennis_export as
select
  row_number() over (order by submitted_at, registration_id) as "S.No.", participant_name as "Participant Name",
  phone as "Phone", email as "Email", school as "School", address as "Address", age as "Age",
  gender as "Gender", age_group as "Age Group", selected_category_or_event as "Table Tennis Event(s)",
  entry_type as "Entry Type", payment_status as "Payment Status", amount_inr as "Amount (INR)",
  'Website/Supabase'::text as "Source", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID"
from public.registrations_october_2026_event_rows
where event = 'Table Tennis' and payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') and canonical_rank = 1;

create or replace view public.registrations_october_2026_pending_payments as
select
  event as "Event", participant_name as "Participant Name", phone as "Phone", email as "Email",
  school as "School / Academy", address as "Address", dob as "Date of Birth", age_group as "Age Group",
  selected_category_or_event as "Selected Category / Event", payment_status as "Payment Status",
  amount_inr as "Amount (INR)", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", registration_id as "Registration ID"
from public.registrations_october_2026_event_rows
where payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and not has_confirmed_match
order by "Submitted At" desc;

create or replace view public.registrations_october_2026_duplicate_entries as
select
  event as "Event", participant_name as "Participant Name", phone as "Phone",
  selected_category_or_event as "Selected Category / Event", payment_status as "Payment Status",
  amount_inr as "Amount (INR)", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", razorpay_payment_id as "Razorpay Payment ID",
  registration_id as "Registration ID",
  case when payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and has_confirmed_match
    then 'retry_superseded_by_confirmed_payment'
    when canonical_rank > 1 then 'duplicate_selected_event'
    else 'duplicate_review' end as "Duplicate Reason"
from public.registrations_october_2026_event_rows
where canonical_rank > 1 or (payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and has_confirmed_match)
order by "Submitted At" desc;

revoke all on public.registrations_october_2026_event_rows from anon, authenticated;
revoke all on public.registrations_october_2026_export from anon, authenticated;
revoke all on public.registrations_october_2026_badminton_export from anon, authenticated;
revoke all on public.registrations_october_2026_chess_export from anon, authenticated;
revoke all on public.registrations_october_2026_swimming_export from anon, authenticated;
revoke all on public.registrations_october_2026_shooting_export from anon, authenticated;
revoke all on public.registrations_october_2026_gymnastics_export from anon, authenticated;
revoke all on public.registrations_october_2026_table_tennis_export from anon, authenticated;
revoke all on public.registrations_october_2026_pending_payments from anon, authenticated;
revoke all on public.registrations_october_2026_duplicate_entries from anon, authenticated;
