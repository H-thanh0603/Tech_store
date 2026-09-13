-- DB hardening batch 2026-09-14:
-- 1) deleted_at timeline (giữ is_archived/is_active để tương thích)
-- 2) audit payload versioning
-- 3) retention tối thiểu pháp lý (kế toán VN giữ chứng từ lâu; free-tier giữ nóng 1 năm + export lạnh)
-- 4) catalog matview cho >5k SP (trigger khi BACKLOG §C-D1)

-- 1) deleted_at
alter table products add column if not exists deleted_at timestamptz;
alter table product_variants add column if not exists deleted_at timestamptz;
alter table categories add column if not exists deleted_at timestamptz;
alter table brands add column if not exists deleted_at timestamptz;

create index if not exists products_deleted_idx on products (deleted_at) where deleted_at is not null;
create index if not exists variants_deleted_idx on product_variants (deleted_at) where deleted_at is not null;

-- 2) audit payload version/schema
alter table admin_audit_logs add column if not exists payload_version smallint not null default 1;
alter table admin_audit_logs add column if not exists payload_schema text not null default 'v1';
alter table admin_audit_logs drop constraint if exists admin_audit_logs_payload_version_chk;
alter table admin_audit_logs add constraint admin_audit_logs_payload_version_chk check (payload_version between 1 and 99);

-- 3) retention: nâng mặc định audit lên 365 ngày (tối thiểu 90).
-- Free-tier không giữ 10 năm; job purge chỉ xóa sau khi export lạnh vào Storage (xem docs/ops/BACKUP.md).
create or replace function purge_expired_logs(
  p_audit_days integer default 365,
  p_analytics_days integer default 90,
  p_rate_limit_days integer default 2,
  p_outbox_days integer default 30,
  p_cart_days integer default 90
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_audit_deleted int;
  v_analytics_deleted int;
  v_rate_deleted int;
  v_outbox_deleted int;
  v_cart_deleted int;
  v_cart_deleted2 int;
begin
  if p_audit_days < 90 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Audit log phải giữ ít nhất 90 ngày (khuyến nghị 365).');
  end if;
  if p_analytics_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Analytics phải giữ ít nhất 7 ngày.');
  end if;
  if p_rate_limit_days < 1 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Rate limit phải giữ ít nhất 1 ngày.');
  end if;
  if p_outbox_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Outbox phải giữ ít nhất 7 ngày.');
  end if;
  if p_cart_days < 7 then
    return jsonb_build_object('code', 'VALIDATION_ERROR', 'message', 'Cart phải giữ ít nhất 7 ngày.');
  end if;

  delete from admin_audit_logs
  where created_at < now() - (p_audit_days || ' days')::interval;
  get diagnostics v_audit_deleted = row_count;

  delete from analytics_events
  where received_at < now() - (p_analytics_days || ' days')::interval;
  get diagnostics v_analytics_deleted = row_count;

  delete from request_rate_limits
  where bucket_started_at < now() - (p_rate_limit_days || ' days')::interval;
  get diagnostics v_rate_deleted = row_count;

  delete from notification_outbox
  where status in ('sent', 'skipped', 'failed')
    and queued_at < now() - (p_outbox_days || ' days')::interval;
  get diagnostics v_outbox_deleted = row_count;

  delete from carts
  where status = 'open'
    and updated_at < now() - (p_cart_days || ' days')::interval
    and not exists (select 1 from cart_items where cart_id = carts.id);
  get diagnostics v_cart_deleted = row_count;

  delete from carts
  where status = 'open'
    and updated_at < now() - ((p_cart_days * 2) || ' days')::interval;
  get diagnostics v_cart_deleted2 = row_count;
  v_cart_deleted := v_cart_deleted + v_cart_deleted2;

  return jsonb_build_object(
    'code', 'OK',
    'auditDeleted', v_audit_deleted,
    'analyticsDeleted', v_analytics_deleted,
    'rateLimitDeleted', v_rate_deleted,
    'outboxDeleted', v_outbox_deleted,
    'cartDeleted', v_cart_deleted
  );
end;
$$;

revoke all on function purge_expired_logs(integer, integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function purge_expired_logs(integer, integer, integer, integer, integer) to service_role;

-- 4) catalog matview: refresh thủ công / cron khi catalog >5000 SP hoặc DB latency >500ms.
-- Mặc định view thường vẫn dùng; matview là đường tắt đọc nhanh.
create materialized view if not exists catalog_products_cached as
select * from catalog_products;

create unique index if not exists catalog_cached_id_idx on catalog_products_cached (id);
create index if not exists catalog_cached_slug_idx on catalog_products_cached (slug);
create index if not exists catalog_cached_category_idx on catalog_products_cached (category_slug);

create or replace function refresh_catalog_cache()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  refresh materialized view concurrently catalog_products_cached;
exception when others then
  refresh materialized view catalog_products_cached;
end;
$$;

revoke all on function refresh_catalog_cache() from public, anon, authenticated;
grant execute on function refresh_catalog_cache() to service_role;
