-- DB-021: add trigram indexes for admin ILIKE searches
-- admin_list_orders/customers use ILIKE '%search%' on order_code, customer_name, phone, email
-- Without GIN trigram, every admin list does seq scan. Partially mitigates until keyset pagination.

create extension if not exists pg_trgm with schema extensions;

-- Orders search (order_code is upper, customer fields are mixed case)
create index if not exists orders_order_code_trgm_idx on orders using gin (order_code gin_trgm_ops);
create index if not exists orders_customer_name_trgm_idx on orders using gin (customer_name gin_trgm_ops);
create index if not exists orders_customer_phone_trgm_idx on orders using gin (customer_phone gin_trgm_ops);
create index if not exists orders_customer_email_trgm_idx on orders using gin (customer_email gin_trgm_ops) where customer_email is not null;

-- Products search for admin product list
create index if not exists products_name_trgm_idx on products using gin (name gin_trgm_ops);
create index if not exists products_slug_trgm_idx on products using gin (slug gin_trgm_ops);
create index if not exists product_variants_sku_trgm_idx on product_variants using gin (sku gin_trgm_ops);

-- Customer profiles search
create index if not exists customer_profiles_full_name_trgm_idx on customer_profiles using gin (full_name gin_trgm_ops) where full_name is not null;
