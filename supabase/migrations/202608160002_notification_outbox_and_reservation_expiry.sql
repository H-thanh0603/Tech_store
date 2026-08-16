-- Notification outbox + restock alerts + reservation expiry.
--
-- Email/notification producers write rows to notification_outbox inside the
-- same transaction that changes state (order created, payment received,
-- restock). A server cron drains the outbox via Resend; with no RESEND_API_KEY
-- rows simply stay pending. This decouples email delivery failures from the
-- checkout/store writes that must never block.

-- ─── notification_outbox ─────────────────────────────────────────────────────

create table if not exists notification_outbox (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in (
    'order_confirmation', 'order_transfer_paid', 'restock_alert', 'review_request'
  )),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  retry_count integer not null default 0,
  error text,
  queued_at timestamptz not null default now(),
  sent_at timestamptz,
  next_retry_at timestamptz
);

create index if not exists notification_outbox_pending_idx
  on notification_outbox (status, next_retry_at)
  where status = 'pending';

alter table notification_outbox enable row level security;

revoke all on table notification_outbox from public, anon, authenticated;
grant all on table notification_outbox to service_role;

-- ─── product_restock_requests (customer waitlist) ────────────────────────────

create table if not exists product_restock_requests (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references product_variants (id) on delete cascade,
  email text not null,
  status text not null default 'active' check (status in ('active', 'notified', 'unsubscribed')),
  created_at timestamptz not null default now(),
  constraint product_restock_requests_email_valid check (
    email <> '' and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  )
);

create unique index product_restock_requests_active_uniq
  on product_restock_requests (variant_id, lower(email))
  where status = 'active';

create index product_restock_requests_variant_idx
  on product_restock_requests (variant_id, status);

alter table product_restock_requests enable row level security;

-- Only inserting an email for someone is allowed; nobody may read the waitlist.
create policy product_restock_requests_insert_anon
  on product_restock_requests
  for insert to anon, authenticated
  with check (email <> '');

revoke all on table product_restock_requests from public;
-- Inserts flow through RLS; no select granted to browser roles.
grant insert on table product_restock_requests to anon, authenticated;
grant all on table product_restock_requests to service_role;

-- ─── triggers: enqueue on order created / paid / restock ─────────────────────

create function notify_order_created()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.customer_email is not null and new.customer_email <> '' then
    insert into notification_outbox (type, payload)
    values (
      'order_confirmation',
      jsonb_build_object(
        'email', new.customer_email,
        'orderCode', new.order_code,
        'customerName', new.customer_name,
        'total', new.total,
        'paymentMethod', new.payment_method
      )
    );
  end if;
  return new;
end;
$$;

create trigger orders_notify_created
after insert on orders
for each row
execute function notify_order_created();

create function notify_order_paid()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.payment_status <> 'paid' and new.payment_status = 'paid'
     and new.payment_method <> 'cod'
     and new.customer_email is not null and new.customer_email <> '' then
    insert into notification_outbox (type, payload)
    values (
      'order_transfer_paid',
      jsonb_build_object(
        'email', new.customer_email,
        'orderCode', new.order_code,
        'customerName', new.customer_name,
        'total', new.total,
        'paymentRef', new.payment_ref
      )
    );
  end if;
  return new;
end;
$$;

create trigger orders_notify_paid
after update of payment_status on orders
for each row
execute function notify_order_paid();

create function notify_restock()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.reason_code = 'restock' then
    insert into notification_outbox (type, payload)
    select 'restock_alert',
      jsonb_build_object('email', r.email, 'variantId', new.variant_id)
    from product_restock_requests r
    where r.variant_id = new.variant_id
      and r.status = 'active'
      and new.delta > 0;

    update product_restock_requests
    set status = 'notified'
    where variant_id = new.variant_id
      and status = 'active'
      and new.delta > 0;
  end if;
  return new;
end;
$$;

create trigger inventory_adjustments_notify_restock
after insert on inventory_adjustments
for each row
execute function notify_restock();

-- ─── release_expired_reservations: cron sweep ────────────────────────────────

create or replace function release_expired_reservations()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer := 0;
  v_order record;
begin
  for v_order in
    select id, order_code, order_status, payment_status
    from orders
    where order_status = 'awaiting_payment'
      and payment_status = 'pending'
      and transfer_expires_at is not null
      and transfer_expires_at <= now()
      and (select count(*) from inventory_reservations ir
           where ir.order_id = orders.id and ir.released_at is null) > 0
    order by id
    for update
  loop
    update orders
    set order_status = 'expired',
        payment_status = 'expired',
        updated_at = now()
    where id = v_order.id;

    update inventory_reservations
    set released_at = now()
    where order_id = v_order.id and released_at is null;

    update coupon_redemptions
    set released_at = now()
    where order_id = v_order.id and released_at is null;

    insert into order_status_events (order_id, event_type, from_status, to_status, reason)
    values (v_order.id, 'order_status', v_order.order_status, 'expired', 'payment_timeout');

    v_count := v_count + 1;
  end loop;

  return jsonb_build_object('code', 'OK', 'expired', v_count);
end;
$$;

revoke all on function release_expired_reservations() from public;
revoke all on function release_expired_reservations() from anon, authenticated;
grant execute on function release_expired_reservations() to service_role;
