-- Missing hot-path indexes: account order history + SKU sales lookup.
-- Forward-only, idempotent.

create index if not exists orders_user_created_idx
  on orders (user_id, created_at desc)
  where user_id is not null;

create index if not exists order_items_variant_idx
  on order_items (variant_id);
