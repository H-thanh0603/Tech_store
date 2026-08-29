-- Bulk price and stock adjustments for the admin product list.
--
-- Flash-sale prep needs "raise every iPhone price by 5%" or "set stock
-- to 50 for these 30 SKUs" without clicking each product. Two SECURITY
-- DEFINER functions follow the same contract as the existing
-- admin_adjust_inventory: validate inputs, apply in one statement,
-- log to admin_audit_logs, return a jsonb code.

-- 1) Bulk price adjustment on active variants of the given products.
--    Modes:
--      percent_up   : regular_price *= (1 + value/100)
--      percent_down : regular_price *= (1 - value/100)
--      set_sale_off : sale_price = null (clear discount)
--    value is a percentage between 0 and 100. Prices are rounded to
--    2 decimals and clamped so sale_price <= regular_price keeps holding.

create or replace function admin_bulk_adjust_price(
  p_product_ids uuid[],
  p_mode text,
  p_value numeric,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
  v_percent numeric;
begin
  if p_product_ids is null or array_length(p_product_ids, 1) is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Chọn ít nhất một sản phẩm.');
  end if;
  if p_mode not in ('percent_up', 'percent_down', 'set_sale_off') then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Chế độ chỉnh giá không hợp lệ.');
  end if;
  if p_mode = 'set_sale_off' then
    v_percent := 0;
  elsif p_value is null or p_value <= 0 or p_value > 100 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Phần trăm phải từ 1 đến 100.');
  else
    v_percent := p_value;
  end if;

  if p_mode = 'set_sale_off' then
    update product_variants
    set sale_price = null, updated_at = now()
    where product_id = any(p_product_ids) and is_active = true;
  elsif p_mode = 'percent_up' then
    update product_variants
    set regular_price = round(regular_price * (1 + v_percent / 100.0), 2),
        -- keep a proportional discount if one exists
        sale_price = case
          when sale_price is not null
            then least(
              round(sale_price * (1 + v_percent / 100.0), 2),
              round(regular_price * (1 + v_percent / 100.0), 2)
            )
          else null
        end,
        updated_at = now()
    where product_id = any(p_product_ids) and is_active = true;
  else
    update product_variants
    set regular_price = round(regular_price * (1 - v_percent / 100.0), 2),
        sale_price = case
          when sale_price is not null
            then least(round(sale_price * (1 - v_percent / 100.0), 2), regular_price)
          else null
        end,
        updated_at = now()
    where product_id = any(p_product_ids) and is_active = true;
  end if;

  get diagnostics v_count = row_count;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'product_bulk_price_adjust',
    'product',
    null,
    jsonb_build_object('mode', p_mode, 'value', v_percent, 'products', cardinality(p_product_ids), 'variantsUpdated', v_count),
    coalesce(p_actor_label, 'admin')
  );

  return jsonb_build_object(
    'code', 'OK',
    'variantsUpdated', v_count,
    'products', cardinality(p_product_ids)
  );
end;
$$;

-- 2) Bulk stock set on every active variant of the given products.
--    Sets quantity = p_quantity when it does not break the
--    quantity - reserved_quantity >= 0 constraint; reserved quantity is
--    respected (floor at reserved_quantity).

create or replace function admin_bulk_set_stock(
  p_product_ids uuid[],
  p_quantity integer,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count int;
begin
  if p_product_ids is null or array_length(p_product_ids, 1) is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Chọn ít nhất một sản phẩm.');
  end if;
  if p_quantity is null or p_quantity < 0 or p_quantity > 1_000_000 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Số lượng phải từ 0 đến 1.000.000.');
  end if;

  update inventory inv
  set quantity = greatest(p_quantity, inv.reserved_quantity),
      updated_at = now()
  from product_variants v
  where v.id = inv.variant_id
    and v.product_id = any(p_product_ids)
    and v.is_active = true;

  get diagnostics v_count = row_count;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'product_bulk_set_stock',
    'product',
    null,
    jsonb_build_object('quantity', p_quantity, 'products', cardinality(p_product_ids), 'variantsUpdated', v_count),
    coalesce(p_actor_label, 'admin')
  );

  return jsonb_build_object(
    'code', 'OK',
    'variantsUpdated', v_count,
    'products', cardinality(p_product_ids)
  );
end;
$$;

revoke execute on function admin_bulk_adjust_price(uuid[], text, numeric, text) from public, anon, authenticated;
revoke execute on function admin_bulk_set_stock(uuid[], integer, text) from public, anon, authenticated;
grant execute on function admin_bulk_adjust_price(uuid[], text, numeric, text) to service_role;
grant execute on function admin_bulk_set_stock(uuid[], integer, text) to service_role;
