-- Wishlist/compare sync hardening: the full-delete + reinsert in
-- customer_sync_saved_products drops saved_at ordering (every row gets
-- now()) and churns the table on each keystroke-debounced sync.
-- Upsert per (user, product, list): keep the NEWEST saved_at so merge order
-- survives, prune rows absent from the payload so un-hearts disappear.

create or replace function customer_sync_saved_products(p_lists jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then return jsonb_build_object('code', 'UNAUTHORIZED'); end if;
  if jsonb_typeof(p_lists->'wishlist') <> 'array'
     or jsonb_array_length(p_lists->'wishlist') > 200
     or jsonb_typeof(p_lists->'compare') <> 'array'
     or jsonb_array_length(p_lists->'compare') > 4 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Upsert: newest saved_at wins per key (client merge already dedupes, this
  -- is the server-side belt-and-braces for racing devices).
  insert into customer_saved_products (user_id, product_id, list_type, snapshot, saved_at)
  select v_user_id, (entry->>'id')::uuid, source.list_type,
    entry - 'savedAt', to_timestamp((entry->>'savedAt')::double precision / 1000)
  from (
    select 'wishlist'::text as list_type, value as entry from jsonb_array_elements(p_lists->'wishlist')
    union all
    select 'compare', value from jsonb_array_elements(p_lists->'compare')
  ) source
  on conflict (user_id, product_id, list_type) do update
    set snapshot = excluded.snapshot,
        saved_at = greatest(customer_saved_products.saved_at, excluded.saved_at);

  -- Prune rows no longer present in either list (un-hearted / un-compared).
  delete from customer_saved_products
  where user_id = v_user_id
    and (product_id, list_type) not in (
      select (entry->>'id')::uuid, source.list_type
      from (
        select 'wishlist'::text as list_type, value as entry from jsonb_array_elements(p_lists->'wishlist')
        union all
        select 'compare', value from jsonb_array_elements(p_lists->'compare')
      ) source
    );

  return jsonb_build_object('code', 'OK');
exception when foreign_key_violation or invalid_text_representation then
  return jsonb_build_object('code', 'VALIDATION_ERROR');
end;
$$;

revoke all on function customer_sync_saved_products(jsonb) from public;
grant execute on function customer_sync_saved_products(jsonb) to authenticated;

-- GDPR erasure missed saved lists: CASCADE covers user delete, but the
-- anonymize path (keep orders) must also drop wishlist/compare rows.
create or replace function customer_delete_my_data()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_orders integer;
  v_reviews integer;
  v_restock integer;
  v_profile integer;
  v_saved integer;
begin
  if v_uid is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;
  v_email := lower(coalesce(auth.jwt() ->> 'email', ''));

  update orders set user_id = null where user_id = v_uid;
  get diagnostics v_orders = row_count;

  update product_reviews set user_id = null where user_id = v_uid;
  get diagnostics v_reviews = row_count;

  delete from product_restock_requests
  where v_email <> '' and lower(email) = v_email;
  get diagnostics v_restock = row_count;

  delete from customer_profiles where user_id = v_uid;
  get diagnostics v_profile = row_count;

  delete from customer_saved_products where user_id = v_uid;
  get diagnostics v_saved = row_count;

  return jsonb_build_object(
    'code', 'OK',
    'ordersAnonymized', v_orders,
    'reviewsAnonymized', v_reviews,
    'restockRequestsDeleted', v_restock,
    'profileDeleted', v_profile,
    'savedListsDeleted', v_saved
  );
end;
$$;

revoke all on function customer_delete_my_data() from public;
grant execute on function customer_delete_my_data() to authenticated;
