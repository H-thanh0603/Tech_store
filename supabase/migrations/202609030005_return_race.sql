-- DB-011: two concurrent request_order_return calls both passed the EXISTS
-- guard, then one died on the unique(order_id) constraint with a 500 instead
-- of a jsonb code. The insert is now ON CONFLICT DO NOTHING: the loser
-- cleanly reports RETURN_ALREADY_REQUESTED. Function body is otherwise
-- identical to 202608300001_order_returns.sql.

create or replace function request_order_return(
  p_order_code text,
  p_access_token_hash text,
  p_phone text,
  p_reason_code text,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order orders%rowtype;
  v_not_found constant jsonb := jsonb_build_object('code', 'ORDER_NOT_FOUND');
  v_bucket timestamptz;
  v_attempts integer;
  v_phone_digits text;
  v_return_id uuid;
begin
  if p_access_token_hash !~ '^[a-f0-9]{64}$' then
    return v_not_found;
  end if;
  if p_reason_code not in ('defective', 'wrong_item', 'not_as_described', 'changed_mind', 'other') then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if p_customer_note is not null and length(p_customer_note) > 1000 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Rate limit: keyed on the caller's identity hash (cart token).
  v_bucket := date_bin(interval '15 minutes', now(), '2000-01-01T00:00:00Z'::timestamptz);
  insert into request_rate_limits (action_name, identity_hash, bucket_started_at, attempt_count)
  values ('return_request', p_access_token_hash, v_bucket, 1)
  on conflict (action_name, identity_hash, bucket_started_at)
  do update set attempt_count = request_rate_limits.attempt_count + 1
  returning attempt_count into v_attempts;
  if v_attempts > 2 then
    return jsonb_build_object('code', 'RATE_LIMITED');
  end if;

  v_phone_digits := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  if v_phone_digits = '' then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  select * into v_order
  from orders
  where order_code = upper(trim(p_order_code))
    and regexp_replace(customer_phone, '\D', '', 'g') = v_phone_digits
    and access_token_hash = p_access_token_hash;
  if not found then
    return v_not_found;
  end if;

  -- Duplicate check first: once a request exists the order sits in
  -- return_requested, and reporting NOT_RETURNABLE for a repeat call
  -- would mask the real reason (already requested).
  if exists (select 1 from order_returns where order_id = v_order.id) then
    return jsonb_build_object('code', 'RETURN_ALREADY_REQUESTED');
  end if;

  if v_order.order_status not in ('shipping', 'completed') then
    return jsonb_build_object('code', 'NOT_RETURNABLE');
  end if;

  -- The EXISTS guard above cannot win a race: two concurrent callers both
  -- pass it, and the loser must get a code, not a 500 from unique(order_id).
  insert into order_returns (order_id, requested_by_phone, reason_code, customer_note)
  values (v_order.id, v_order.customer_phone, p_reason_code, p_customer_note)
  on conflict (order_id) do nothing
  returning id into v_return_id;
  if not found then
    return jsonb_build_object('code', 'RETURN_ALREADY_REQUESTED');
  end if;

  update orders set order_status = 'return_requested', updated_at = now()
  where id = v_order.id;

  return jsonb_build_object('code', 'OK', 'orderCode', v_order.order_code);
end;
$$;

revoke all on function request_order_return(text, text, text, text, text) from public;
grant execute on function request_order_return(text, text, text, text, text) to anon, authenticated;
