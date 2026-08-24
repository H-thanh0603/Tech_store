-- The public checkout RPC is a trust boundary: direct Supabase callers must
-- receive the same validation guarantees as the Next.js form.

begin;
select plan(8);
set local role anon;

select is(
  place_order(repeat('a', 64), gen_random_uuid(), repeat('1', 64),
    '{"customerName":"A","customerPhone":"0901234567","province":"HN","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'rejects a customer name shorter than two characters'
);

select is(
  place_order(repeat('b', 64), gen_random_uuid(), repeat('2', 64),
    '{"customerName":"Valid Name","customerPhone":"123","province":"HN","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'rejects an invalid Vietnamese mobile number'
);

select is(
  place_order(repeat('c', 64), gen_random_uuid(), repeat('3', 64),
    '{"customerName":"Valid Name","customerPhone":"0901234567","customerEmail":"not-an-email","province":"HN","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'rejects an invalid email address'
);

select is(
  place_order(repeat('d', 64), gen_random_uuid(), repeat('4', 64),
    '{"customerName":"Valid Name","customerPhone":"0901234567","province":"","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'delivery requires a province'
);

select is(
  place_order(repeat('e', 64), gen_random_uuid(), repeat('5', 64),
    '{"customerName":"Valid Name","customerPhone":"0901234567","province":"HN","district":"HK","ward":"1","streetAddress":"123"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'delivery requires a usable street address'
);

select is(
  place_order(repeat('f', 64), gen_random_uuid(), repeat('6', 64),
    '{"customerName":"Valid Name","customerPhone":"0901234567","fulfillmentMethod":"pickup"}'::jsonb,
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'pickup requires a store identifier'
);

select is(
  place_order(repeat('7', 64), gen_random_uuid(), repeat('7', 64),
    jsonb_build_object(
      'customerName', 'Valid Name', 'customerPhone', '0901234567',
      'province', 'HN', 'district', 'HK', 'ward', '1', 'streetAddress', '12345',
      'note', repeat('x', 501)
    ),
    'cod', null)->>'code',
  'VALIDATION_ERROR',
  'rejects an oversized checkout note'
);

-- Five attempts are allowed per cart token in a 15-minute bucket.
select place_order(repeat('8', 64), gen_random_uuid(), repeat('8', 64),
  '{"customerName":"Valid Name","customerPhone":"0901234567","province":"HN","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
  'cod', null)
from generate_series(1, 5);

select is(
  place_order(repeat('8', 64), gen_random_uuid(), repeat('9', 64),
    '{"customerName":"Valid Name","customerPhone":"0901234567","province":"HN","district":"HK","ward":"1","streetAddress":"12345"}'::jsonb,
    'cod', null)->>'code',
  'RATE_LIMITED',
  'rate limits repeated checkout attempts for the same cart token'
);

select * from finish();
rollback;
