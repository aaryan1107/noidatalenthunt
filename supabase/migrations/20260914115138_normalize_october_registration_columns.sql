-- Replaces generic JSON payloads in the active October session with named,
-- exportable columns. July's archived table is intentionally untouched.

drop view if exists public.registrations_october_2026_duplicate_entries;
drop view if exists public.registrations_october_2026_pending_payments;
drop view if exists public.registrations_october_2026_export;
drop view if exists public.registrations_october_2026_event_rows;

alter table public.registrations_october_2026
  add column if not exists selected_events text[] not null default '{}',
  add column if not exists partner_name text,
  add column if not exists fide_id text,
  add column if not exists fide_rating text,
  add column if not exists swimming_group text,
  add column if not exists academy_name text,
  add column if not exists shooting_age_category text,
  add column if not exists shooting_entry_type text,
  add column if not exists team_member_names text;

update public.registrations_october_2026
set
  selected_events = coalesce(
    array(
      select item ->> 'label'
      from jsonb_array_elements(
        case
          when jsonb_typeof(form_data -> 'cart_items') = 'array' then form_data -> 'cart_items'
          when jsonb_typeof(selected_options -> 'cart_items') = 'array' then selected_options -> 'cart_items'
          else '[]'::jsonb
        end
      ) as item
    ),
    array[event]
  ),
  partner_name = coalesce(partner_name, form_data ->> 'partner_name'),
  fide_id = coalesce(fide_id, form_data ->> 'fide_id'),
  fide_rating = coalesce(fide_rating, form_data ->> 'fide_rating'),
  swimming_group = coalesce(swimming_group, form_data ->> 'swimming_group'),
  academy_name = coalesce(academy_name, form_data ->> 'academy_name'),
  shooting_age_category = coalesce(shooting_age_category, form_data ->> 'shooting_age_category'),
  shooting_entry_type = coalesce(shooting_entry_type, form_data ->> 'shooting_entry_type'),
  team_member_names = coalesce(team_member_names, form_data ->> 'team_member_names');

alter table public.registrations_october_2026
  drop column selected_options,
  drop column form_data;

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
    r.partner_name,
    r.fide_id,
    r.fide_rating,
    r.swimming_group,
    r.academy_name,
    r.shooting_age_category,
    r.shooting_entry_type,
    r.team_member_names,
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
      coalesce(contact, '') || '|' ||
      coalesce(dob::text, '') || '|' ||
      coalesce(category_slug, '') || '|' ||
      lower(regexp_replace(coalesce(selected_category_or_event, ''), '[^a-z0-9]+', '', 'g'))
      as entry_identity
  from expanded_entries
),
ranked_entries as (
  select
    identified_entries.*,
    row_number() over (
      partition by entry_identity
      order by
        case
          when payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL') then 0
          when payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') then 1
          else 2
        end,
        created_at,
        registration_id
    ) as canonical_rank,
    bool_or(payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL')) over (
      partition by entry_identity
    ) as has_confirmed_match
  from identified_entries
)
select
  registration_id,
  session_name,
  event,
  category_slug,
  participant_name,
  contact as phone,
  email,
  school,
  address,
  dob,
  age,
  gender,
  age_group,
  id_number,
  partner_name,
  fide_id,
  fide_rating,
  swimming_group,
  academy_name,
  shooting_age_category,
  shooting_entry_type,
  team_member_names,
  selected_category_or_event,
  payment_status,
  payment_method,
  amount_paise / 100.0 as amount_inr,
  created_at as submitted_at,
  payment_captured_at,
  razorpay_order_id,
  razorpay_payment_id,
  canonical_rank,
  has_confirmed_match
from ranked_entries;

create or replace view public.registrations_october_2026_export as
select
  row_number() over (partition by event order by submitted_at, registration_id) as "S.No.",
  event as "Event",
  participant_name as "Participant Name",
  phone as "Phone",
  email as "Email",
  school as "School / Academy",
  address as "Address",
  dob as "Date of Birth",
  age as "Age",
  gender as "Gender",
  age_group as "Age Group",
  selected_category_or_event as "Selected Category / Event",
  partner_name as "Doubles Partner / Team Members",
  fide_id as "FIDE ID",
  fide_rating as "FIDE Rating",
  swimming_group as "Swimming Group",
  academy_name as "Gymnastics Academy / Team",
  shooting_age_category as "Shooting Age Category",
  shooting_entry_type as "Shooting Entry Type",
  team_member_names as "Shooting Team Members",
  payment_status as "Payment Status",
  amount_inr as "Amount (INR)",
  payment_method as "Payment Method",
  submitted_at as "Submitted At",
  payment_captured_at as "Payment Captured At",
  razorpay_order_id as "Razorpay Order ID",
  razorpay_payment_id as "Razorpay Payment ID",
  registration_id as "Registration ID"
from public.registrations_october_2026_event_rows
where payment_status in ('PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL')
  and canonical_rank = 1
order by "Event", "S.No.";

create or replace view public.registrations_october_2026_pending_payments as
select
  event as "Event",
  participant_name as "Participant Name",
  phone as "Phone",
  email as "Email",
  school as "School / Academy",
  address as "Address",
  dob as "Date of Birth",
  age_group as "Age Group",
  selected_category_or_event as "Selected Category / Event",
  payment_status as "Payment Status",
  amount_inr as "Amount (INR)",
  submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID",
  registration_id as "Registration ID"
from public.registrations_october_2026_event_rows
where payment_status in ('PENDING_PAYMENT', 'AUTHORIZED')
  and not has_confirmed_match
order by "Submitted At" desc;

create or replace view public.registrations_october_2026_duplicate_entries as
select
  event as "Event",
  participant_name as "Participant Name",
  phone as "Phone",
  selected_category_or_event as "Selected Category / Event",
  payment_status as "Payment Status",
  amount_inr as "Amount (INR)",
  submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID",
  razorpay_payment_id as "Razorpay Payment ID",
  registration_id as "Registration ID",
  case
    when payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and has_confirmed_match
      then 'retry_superseded_by_confirmed_payment'
    when canonical_rank > 1 then 'duplicate_selected_event'
    else 'duplicate_review'
  end as "Duplicate Reason"
from public.registrations_october_2026_event_rows
where canonical_rank > 1
   or (payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and has_confirmed_match)
order by "Submitted At" desc;

comment on column public.registrations_october_2026.selected_events is
  'One value per selected, billable sport event/category.';

comment on view public.registrations_october_2026_export is
  'Clean October 2026 export: confirmed, deduplicated, one row per selected sport event, with no JSON columns.';

comment on view public.registrations_october_2026_pending_payments is
  'October 2026 payment follow-up queue. Attempts with a matching confirmed registration are excluded.';

comment on view public.registrations_october_2026_duplicate_entries is
  'October 2026 duplicate/retry review queue. Confirmed payment takes priority over matching earlier attempts.';

revoke all on public.registrations_october_2026_event_rows from anon, authenticated;
revoke all on public.registrations_october_2026_export from anon, authenticated;
revoke all on public.registrations_october_2026_pending_payments from anon, authenticated;
revoke all on public.registrations_october_2026_duplicate_entries from anon, authenticated;
