-- October only. Keep original checkout attempts and gateway IDs for audit.
alter table public.registrations_october_2026
  add column if not exists payment_reconciliation jsonb;
comment on column public.registrations_october_2026.payment_reconciliation is
  'Receipt evidence or explicit superseded checkout link from organiser reconciliation; never a fabricated Razorpay payment ID.';

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
    r.payment_reconciliation,
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
    regexp_replace(lower(coalesce(participant_name, '')), '[^a-z0-9]+', '', 'g') || '|' ||
      coalesce(contact, '') || '|' || coalesce(dob::text, '') || '|' ||
      coalesce(category_slug, '') || '|' ||
      regexp_replace(lower(coalesce(selected_category_or_event, '')), '[^a-z0-9]+', '', 'g') as entry_identity
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
    ) or payment_reconciliation->>'superseded_by' is not null as has_confirmed_match
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

create or replace view public.registrations_october_2026_pending_payments as
select
  event as "Event", participant_name as "Participant Name", phone as "Phone", email as "Email",
  school as "School / Academy", address as "Address", dob as "Date of Birth", age_group as "Age Group",
  selected_category_or_event as "Selected Category / Event", payment_status as "Payment Status",
  amount_inr as "Amount (INR)", submitted_at as "Submitted At",
  razorpay_order_id as "Razorpay Order ID", registration_id as "Registration ID"
from public.registrations_october_2026_event_rows
where payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and not has_confirmed_match and canonical_rank = 1
order by "Submitted At" desc;
