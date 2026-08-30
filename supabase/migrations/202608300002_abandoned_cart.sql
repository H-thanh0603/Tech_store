-- Abandoned-cart reminders: queue one 'abandoned_cart' outbox row per open
-- cart that has been idle, has items, and has a customer email. Dedupe is a
-- reminded_at flag on carts — each cart is reminded at most once. The outbox
-- drain (process-notifications cron) delivers via Resend like every other
-- type.

-- Carts are guest-scoped by token hash; email is optional and only present
-- when the storefront captured it (carts.email). Guest carts without a
-- captured email can never be reminded — they simply don't match.

alter table carts
  add column if not exists email text,
  add column if not exists reminded_at timestamptz;

alter table carts
  drop constraint if exists carts_email_format;
alter table carts
  add constraint carts_email_format check (
    email is null or (email <> '' and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

create index if not exists carts_abandoned_candidates_idx
  on carts (updated_at)
  where status = 'open' and reminded_at is null and email is not null;

-- Outbox type gains 'abandoned_cart' (check constraint swap, claims pattern).

alter table notification_outbox
  drop constraint if exists notification_outbox_type_check;
alter table notification_outbox
  add constraint notification_outbox_type_check
  check (type in (
    'order_confirmation', 'order_transfer_paid', 'restock_alert',
    'review_request', 'abandoned_cart'
  ));

create or replace function queue_abandoned_cart_emails(
  p_idle_minutes integer default 120,
  p_batch_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_queued integer := 0;
  v_skipped integer := 0;
  v_cart record;
  v_item_count integer := 0;
  v_subtotal numeric(12, 2) := 0;
begin
  if p_idle_minutes is null or p_idle_minutes < 0
     or p_batch_size is null or p_batch_size < 1 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  for v_cart in
    select c.id, c.token_hash, c.email
    from carts c
    where c.status = 'open'
      and c.reminded_at is null
      and c.email is not null and c.email <> ''
      and c.updated_at <= now() - (p_idle_minutes || ' minutes')::interval
      and exists (select 1 from cart_items ci where ci.cart_id = c.id)
    order by c.updated_at, c.id
    for update skip locked
    limit greatest(1, least(p_batch_size, 500))
  loop
    select coalesce(sum(ci.quantity), 0),
           coalesce(sum(coalesce(v.sale_price, v.regular_price) * ci.quantity), 0)
      into v_item_count, v_subtotal
    from cart_items ci
    join product_variants v on v.id = ci.variant_id
    where ci.cart_id = v_cart.id;

    insert into notification_outbox (type, payload)
    values (
      'abandoned_cart',
      jsonb_build_object(
        'email', v_cart.email,
        'cartToken', v_cart.token_hash,
        'itemCount', v_item_count,
        'subtotal', v_subtotal
      )
    );

    update carts set reminded_at = now() where id = v_cart.id;

    v_queued := v_queued + 1;
  end loop;

  select count(*) into v_skipped
  from carts c
  where c.status = 'open'
    and c.reminded_at is not null
    and c.email is not null and c.email <> ''
    and c.updated_at <= now() - (p_idle_minutes || ' minutes')::interval
    and exists (select 1 from cart_items ci where ci.cart_id = c.id);

  return jsonb_build_object('code', 'OK', 'queued', v_queued, 'skipped', v_skipped);
end;
$$;

revoke all on function queue_abandoned_cart_emails(integer, integer) from public;
revoke all on function queue_abandoned_cart_emails(integer, integer) from anon, authenticated;
grant execute on function queue_abandoned_cart_emails(integer, integer) to service_role;
