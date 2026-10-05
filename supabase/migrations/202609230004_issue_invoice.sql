-- Issue an internal invoice for an order (one row per order).
-- Numbered INV-YYYYMMDD-###### with per-day sequence under advisory lock
-- so concurrent issues never collide on invoice_number.

create or replace function issue_invoice(
  p_order_id uuid,
  p_tax_code text default null,
  p_company_name text default null,
  p_actor_label text default 'admin'
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_existing invoices%rowtype;
  v_day text := to_char(now(), 'YYYYMMDD');
  v_seq integer;
  v_number text;
  v_vat numeric(12, 2);
  v_tax text := nullif(trim(coalesce(p_tax_code, '')), '');
  v_company text := nullif(trim(coalesce(p_company_name, '')), '');
  v_actor text := coalesce(nullif(trim(p_actor_label), ''), 'admin');
begin
  if p_order_id is null then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if v_tax is not null and v_tax !~ '^[0-9]{10}(-[0-9]{3})?$' then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if v_company is not null and length(v_company) > 200 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order from orders where id = p_order_id for update;
  if not found then
    return jsonb_build_object('code', 'NOT_FOUND');
  end if;
  if v_order.total is null or v_order.total <= 0 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_existing from invoices where order_id = p_order_id;
  if found then
    return jsonb_build_object('code', 'ALREADY_ISSUED', 'invoiceNumber', v_existing.invoice_number);
  end if;

  -- Per-day sequence serialized across concurrent issuers.
  perform pg_advisory_xact_lock(hashtext('invoice:' || v_day));
  select count(*) + 1 into v_seq
  from invoices
  where invoice_number like 'INV-' || v_day || '-%';
  v_number := 'INV-' || v_day || '-' || lpad(v_seq::text, 6, '0');
  v_vat := round((v_order.total * 0.1) / 1.1, 2);

  begin
    insert into invoices (order_id, invoice_number, total, vat_rate, vat_amount,
      customer_name, tax_code, company_name, created_by_label)
    values (p_order_id, v_number, v_order.total, 0.1, v_vat,
      v_order.customer_name, v_tax, v_company, v_actor);
  exception when unique_violation then
    select * into v_existing from invoices where order_id = p_order_id;
    if found then
      return jsonb_build_object('code', 'ALREADY_ISSUED', 'invoiceNumber', v_existing.invoice_number);
    end if;
    return jsonb_build_object('code', 'INTERNAL_ERROR');
  end;

  insert into admin_audit_logs (action, entity_type, entity_id, payload, actor_label)
  values ('issue_invoice', 'order', v_order.order_code,
    jsonb_build_object('invoiceNumber', v_number, 'total', v_order.total,
      'taxCode', v_tax, 'companyName', v_company), v_actor);

  return jsonb_build_object('code', 'OK', 'invoiceNumber', v_number);
end;
$$;

revoke all on function issue_invoice(uuid, text, text, text) from public;
revoke all on function issue_invoice(uuid, text, text, text) from anon, authenticated;
grant execute on function issue_invoice(uuid, text, text, text) to service_role;
