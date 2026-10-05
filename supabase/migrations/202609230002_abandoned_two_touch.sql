-- Abandoned-cart two-touch reminders: first nudge at 2h idle, second at
-- ~24h after the first. remind_count replaces the one-shot reminded_at
-- dedupe (reminded_at kept as the last-touch timestamp).
-- No new cron needed: the 5-min health cron already calls this RPC; the
-- timing gates live here so frequency stays decoupled from scheduling.

alter table carts
  add column if not exists remind_count integer not null default 0;

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
  v_reminder integer;
begin
  if p_idle_minutes is null or p_idle_minutes < 0
     or p_batch_size is null or p_batch_size < 1 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  for v_cart in
    select c.id, c.token_hash, c.email, c.remind_count
    from carts c
    where c.status = 'open'
      and c.email is not null and c.email <> ''
      and (
        -- First touch: idle past the threshold, never reminded.
        (c.remind_count = 0
         and c.updated_at <= now() - (p_idle_minutes || ' minutes')::interval)
        -- Second touch: ~22h after the first nudge, still idle.
        or (c.remind_count = 1
            and c.reminded_at is not null
            and c.reminded_at <= now() - interval '22 hours'
            and c.updated_at <= now() - (p_idle_minutes || ' minutes')::interval)
      )
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

    v_reminder := v_cart.remind_count + 1;

    insert into notification_outbox (type, payload)
    values (
      'abandoned_cart',
      jsonb_build_object(
        'email', v_cart.email,
        'cartToken', v_cart.token_hash,
        'itemCount', v_item_count,
        'subtotal', v_subtotal,
        'reminder', v_reminder
      )
    );

    update carts
    set reminded_at = now(), remind_count = v_reminder
    where id = v_cart.id;

    v_queued := v_queued + 1;
  end loop;

  select count(*) into v_skipped
  from carts c
  where c.status = 'open'
    and c.remind_count >= 2
    and c.email is not null and c.email <> ''
    and c.updated_at <= now() - (p_idle_minutes || ' minutes')::interval
    and exists (select 1 from cart_items ci where ci.cart_id = c.id);

  return jsonb_build_object('code', 'OK', 'queued', v_queued, 'skipped', v_skipped);
end;
$$;

revoke all on function queue_abandoned_cart_emails(integer, integer) from public;
revoke all on function queue_abandoned_cart_emails(integer, integer) from anon, authenticated;
grant execute on function queue_abandoned_cart_emails(integer, integer) to service_role;
