-- Email alerts: active flagged products expiring in the current month.
-- Delivery is performed only by the server-side Edge Function. Browser users
-- can configure the pharmacy-level switch but cannot read delivery history.

begin;

create table public.email_alert_settings (
  pharmacy_id uuid primary key references public.pharmacies(id) on delete cascade,
  current_month_expiry_enabled boolean not null default false,
  timezone text not null default 'America/Toronto',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint email_alert_settings_timezone_check check (timezone = 'America/Toronto')
);

alter table public.email_alert_settings enable row level security;

grant select, insert, update on public.email_alert_settings to authenticated;

create policy email_alert_settings_select_pharmacy_members
on public.email_alert_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles member
    where member.id = (select auth.uid())
      and member.pharmacy_id = email_alert_settings.pharmacy_id
  )
);

create policy email_alert_settings_insert_pharmacy_owners
on public.email_alert_settings
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles member
    where member.id = (select auth.uid())
      and member.pharmacy_id = email_alert_settings.pharmacy_id
      and member.role in ('owner', 'admin')
  )
);

create policy email_alert_settings_update_pharmacy_owners
on public.email_alert_settings
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles member
    where member.id = (select auth.uid())
      and member.pharmacy_id = email_alert_settings.pharmacy_id
      and member.role in ('owner', 'admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles member
    where member.id = (select auth.uid())
      and member.pharmacy_id = email_alert_settings.pharmacy_id
      and member.role in ('owner', 'admin')
  )
);

create table public.email_alert_deliveries (
  id uuid primary key default gen_random_uuid(),
  pharmacy_id uuid not null references public.pharmacies(id) on delete cascade,
  alert_type text not null check (alert_type = 'current_month_expiry'),
  local_alert_date date not null,
  recipient_email text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  provider_message_id text,
  created_at timestamptz not null default timezone('utc', now()),
  unique (pharmacy_id, alert_type, local_alert_date, recipient_email)
);

alter table public.email_alert_deliveries enable row level security;

create index email_alert_deliveries_dedup_idx
on public.email_alert_deliveries (pharmacy_id, alert_type, local_alert_date, recipient_email);

commit;
