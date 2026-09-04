-- Per-coupon active redemption counts in one grouped query.
--
-- listAdminCoupons used to pull every unreleased redemption row into Node and
-- count in JS. Redemption history only grows, so this moves the GROUP BY into
-- Postgres and returns a compact {coupon_id: count} map.

create or replace function admin_coupon_usage()
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select jsonb_object_agg(coupon_id::text, cnt)
     from (select coupon_id, count(*)::int as cnt
           from coupon_redemptions
           where released_at is null
           group by coupon_id) s),
    '{}'::jsonb
  );
$$;

revoke all on function admin_coupon_usage() from public;
