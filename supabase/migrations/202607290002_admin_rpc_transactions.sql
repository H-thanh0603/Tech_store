-- Phase 5: Transactional Admin Mutations

create or replace function admin_create_product(
  p_product jsonb,
  p_variant jsonb,
  p_inventory jsonb,
  p_image jsonb default null,
  p_actor text default 'Admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product_id uuid;
  v_variant_id uuid;
begin
  -- 1. Insert Product
  insert into products (
    name, slug, description, category_id, brand_id, 
    is_published, is_featured, is_archived
  )
  values (
    p_product->>'name',
    p_product->>'slug',
    p_product->>'description',
    (p_product->>'category_id')::uuid,
    nullif(p_product->>'brand_id', '')::uuid,
    (p_product->>'is_published')::boolean,
    (p_product->>'is_featured')::boolean,
    false
  ) returning id into v_product_id;

  -- 2. Insert Variant
  insert into product_variants (
    product_id, sku, regular_price, sale_price, attributes
  )
  values (
    v_product_id,
    p_variant->>'sku',
    (p_variant->>'regular_price')::integer,
    nullif(p_variant->>'sale_price', '')::integer,
    coalesce(p_variant->'attributes', '{}'::jsonb)
  ) returning id into v_variant_id;

  -- 3. Insert Inventory
  insert into inventory (
    variant_id, quantity, low_stock_threshold
  )
  values (
    v_variant_id,
    (p_inventory->>'quantity')::integer,
    (p_inventory->>'low_stock_threshold')::integer
  );

  -- 4. Insert Image if provided
  if p_image is not null and (p_image->>'url') is not null and (p_image->>'url') != '' then
    insert into product_images (
      product_id, variant_id, url, alt_text, display_order
    )
    values (
      v_product_id,
      v_variant_id,
      p_image->>'url',
      p_image->>'alt_text',
      0
    );
  end if;

  -- 5. Audit Log
  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values (
    'create_product',
    'product',
    v_product_id::text,
    jsonb_build_object('product', p_product, 'variant', p_variant, 'inventory', p_inventory),
    p_actor
  );

  return jsonb_build_object('code', 'OK', 'productId', v_product_id, 'variantId', v_variant_id);
end;
$$;
