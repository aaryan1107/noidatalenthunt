create unique index if not exists registrations_razorpay_order_id_unique
  on public.registrations (razorpay_order_id)
  where razorpay_order_id is not null and razorpay_order_id <> '';

create unique index if not exists registrations_razorpay_payment_id_unique
  on public.registrations (razorpay_payment_id)
  where razorpay_payment_id is not null and razorpay_payment_id <> '';

create index if not exists registrations_payment_status_created_at_idx
  on public.registrations (payment_status, created_at desc);

alter table public.registrations
  validate constraint registrations_payment_status_allowed;

alter table public.registrations
  validate constraint registrations_amount_positive;

alter table public.registrations
  validate constraint registrations_currency_inr;
