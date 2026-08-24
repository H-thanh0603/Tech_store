-- Account-backed wishlist and compare, with compact snapshots for fast hydration.

create table customer_saved_products (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references products (id) on delete cascade,
  list_type text not null check (list_type in ('wishlist', 'compare')),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object' and pg_column_size(snapshot) <= 4096),
  saved_at timestamptz not null default now(),
  primary key (user_id, product_id, list_type)
);

alter table customer_saved_products enable row level security;
grant select on customer_saved_products to authenticated;
create policy customer_saved_products_select_own on customer_saved_products
  for select to authenticated using (user_id = auth.uid());

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

  delete from customer_saved_products where user_id = v_user_id;
  insert into customer_saved_products (user_id, product_id, list_type, snapshot, saved_at)
  select v_user_id, (entry->>'id')::uuid, source.list_type,
    entry - 'savedAt', to_timestamp((entry->>'savedAt')::double precision / 1000)
  from (
    select 'wishlist'::text as list_type, value as entry from jsonb_array_elements(p_lists->'wishlist')
    union all
    select 'compare', value from jsonb_array_elements(p_lists->'compare')
  ) source;
  return jsonb_build_object('code', 'OK');
exception when foreign_key_violation or invalid_text_representation then
  return jsonb_build_object('code', 'VALIDATION_ERROR');
end;
$$;

revoke all on function customer_sync_saved_products(jsonb) from public;
grant execute on function customer_sync_saved_products(jsonb) to authenticated;
