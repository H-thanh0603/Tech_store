-- Capture a customer email on an open cart so the abandoned-cart reminder
-- (202608300002) has an address to send to. The checkout form already
-- collects an optional email; this RPC persists it on the cart the moment
-- the customer submits checkout — before place_order converts the row —
-- so a cart abandoned mid-checkout still gets its one reminder.

create or replace function cart_capture_email(
  p_cart_token_hash text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text;
begin
  if p_cart_token_hash !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  v_email := lower(trim(coalesce(p_email, '')));
  if v_email = '' then
    return jsonb_build_object('code', 'OK', 'stored', false);
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;

  -- Only open carts are worth remembering; converted carts already have
  -- an order email.
  update carts set email = v_email
  where token_hash = p_cart_token_hash and status = 'open';

  return jsonb_build_object('code', 'OK', 'stored', found);
end;
$$;

revoke all on function cart_capture_email(text, text) from public;
grant execute on function cart_capture_email(text, text) to anon, authenticated;
