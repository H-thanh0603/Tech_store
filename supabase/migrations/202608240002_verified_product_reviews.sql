-- One verified review per purchased product and customer.

create unique index if not exists product_reviews_user_product_uniq
  on product_reviews (user_id, product_id)
  where user_id is not null;

create or replace function customer_submit_product_review(
  p_product_id uuid,
  p_rating integer,
  p_title text,
  p_body text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_author text;
begin
  if v_user_id is null then
    return jsonb_build_object('code', 'UNAUTHORIZED');
  end if;
  if p_rating not between 1 and 5
     or length(trim(coalesce(p_body, ''))) not between 1 and 2000
     or length(coalesce(p_title, '')) > 120 then
    return jsonb_build_object('code', 'VALIDATION_ERROR');
  end if;
  if not exists (
    select 1
    from orders o
    join order_items oi on oi.order_id = o.id
    join product_variants v on v.id = oi.variant_id
    where o.user_id = v_user_id
      and v.product_id = p_product_id
      and o.order_status not in ('cancelled', 'expired')
  ) then
    return jsonb_build_object('code', 'NOT_PURCHASED');
  end if;

  select coalesce(nullif(trim(cp.full_name), ''), split_part(u.email, '@', 1), 'Khách hàng')
    into v_author
  from auth.users u
  left join customer_profiles cp on cp.user_id = u.id
  where u.id = v_user_id;

  insert into product_reviews (product_id, user_id, author_name, rating, title, body)
  values (p_product_id, v_user_id, v_author, p_rating, nullif(trim(coalesce(p_title, '')), ''), trim(p_body));
  return jsonb_build_object('code', 'OK');
exception
  when unique_violation then return jsonb_build_object('code', 'ALREADY_REVIEWED');
end;
$$;

revoke all on function customer_submit_product_review(uuid, integer, text, text) from public;
grant execute on function customer_submit_product_review(uuid, integer, text, text) to authenticated;
