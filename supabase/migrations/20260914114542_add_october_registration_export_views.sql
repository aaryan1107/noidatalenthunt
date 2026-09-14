-- Creates export-ready October 2026 registration views. Raw order payloads stay
-- on the source table for payment audit, while exports use ordinary columns.

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
    r.payment_status,
    r.payment_method,
    r.created_at,
    r.payment_captured_at,
    r.razorpay_order_id,
    r.razorpay_payment_id,
    entry.item ->> 'label' as selected_category_or_event,
    coalesce(nullif(entry.item ->> 'amount', '')::integer, r.amount) as amount_paise
  from public.registrations_october_2026 r
  cross join lateral jsonb_array_elements(
    case
      when jsonb_typeof(r.form_data -> 'cart_items') = 'array'
        and jsonb_array_length(r.form_data -> 'cart_items') > 0
        then r.form_data -> 'cart_items'
      when jsonb_typeof(r.selected_options -> 'cart_items') = 'array'
        and jsonb_array_length(r.selected_options -> 'cart_items') > 0
        then r.selected_options -> 'cart_items'
      else jsonb_build_array(jsonb_build_object('label', coalesce(r.event, 'Selected event'), 'amount', r.amount))
    end
  ) as entry(item)
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

comment on view public.registrations_october_2026_event_rows is
  'One row per selected October 2026 sport event. Internal source view for export and payment triage.';

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

comment on view public.registrations_october_2026_export is
  'Clean October 2026 export: confirmed, deduplicated, one row per selected sport event, with no JSON columns.';

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

comment on view public.registrations_october_2026_pending_payments is
  'October 2026 payment follow-up queue. Attempts with a matching confirmed registration are excluded.';

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
    when canonical_rank > 1
      then 'duplicate_selected_event'
    else 'duplicate_review'
  end as "Duplicate Reason"
from public.registrations_october_2026_event_rows
where canonical_rank > 1
   or (payment_status in ('PENDING_PAYMENT', 'AUTHORIZED') and has_confirmed_match)
order by "Submitted At" desc;

comment on view public.registrations_october_2026_duplicate_entries is
  'October 2026 duplicate/retry review queue. Confirmed payment takes priority over matching earlier attempts.';

revoke all on public.registrations_october_2026_event_rows from anon, authenticated;
revoke all on public.registrations_october_2026_export from anon, authenticated;
revoke all on public.registrations_october_2026_pending_payments from anon, authenticated;
revoke all on public.registrations_october_2026_duplicate_entries from anon, authenticated;
