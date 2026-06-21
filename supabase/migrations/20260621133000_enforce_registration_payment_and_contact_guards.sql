alter table public.registrations
  add constraint registrations_payment_status_allowed
  check (payment_status in ('PENDING_PAYMENT', 'PAID_CONFIRMED', 'PAID_CONFIRMED_MANUAL', 'AUTHORIZED', 'FAILED'))
  not valid;

alter table public.registrations
  add constraint registrations_contact_mobile_format
  check (contact ~ '^[6-9][0-9]{9}$')
  not valid;

alter table public.registrations
  add constraint registrations_amount_positive
  check (amount > 0)
  not valid;

alter table public.registrations
  add constraint registrations_currency_inr
  check (currency = 'INR')
  not valid;

revoke execute on function public.rls_auto_enable() from anon, authenticated, public;
