-- Carrier shipment tracking columns on orders.
--
-- The shop ships via GHN/GHTK/internal. Until live carrier keys exist the
-- checkout keeps the internal rate table; these columns let admin attach a
-- tracking code manually and let the storefront show it.
-- No behavior change for existing rows: all columns nullable/default.

alter table orders
  add column if not exists carrier text check (carrier in ('ghn', 'ghtk', 'internal')),
  add column if not exists carrier_service text check (length(carrier_service) <= 120),
  add column if not exists tracking_code text check (length(tracking_code) <= 64),
  add column if not exists shipping_fee_actual numeric(12, 2) check (shipping_fee_actual is null or shipping_fee_actual >= 0),
  add column if not exists ship_state text not null default 'not_created' check (
    ship_state in ('not_created', 'created', 'in_transit', 'delivered', 'cancelled')
  ),
  add column if not exists carrier_payload jsonb check (
    carrier_payload is null or octet_length(carrier_payload::text) <= 20000
  );

create index if not exists orders_tracking_code_idx on orders (tracking_code)
  where tracking_code is not null;
