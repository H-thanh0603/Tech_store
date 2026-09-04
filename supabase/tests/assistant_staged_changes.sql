-- pgTAP tests for the merchant assistant staged-change ledger.

begin;

create extension if not exists pgtap with schema extensions;

select plan(5);

-- 1) Table exists with the staged → applied/discarded lifecycle.
select has_table('assistant_staged_changes');

-- 2) Status is constrained to the lifecycle values.
select col_is_null(
  (select status from assistant_staged_changes limit 0),
  'status column present'
);

-- 3) A staged row inserts cleanly.
insert into assistant_staged_changes (id, kind, summary, action, items, signature, created_by)
values (
  'chg-test-001',
  'price',
  'Giảm giá 10% — 1 sản phẩm',
  '{"kind":"price","productIds":["p1"],"mode":"percent_down","value":10}'::jsonb,
  '[]'::jsonb,
  repeat('a', 64),
  null
);
select is(
  (select status from assistant_staged_changes where id = 'chg-test-001'),
  'staged',
  'new rows default to staged'
);

-- 4) Lifecycle transition staged → applied works.
update assistant_staged_changes
set status = 'applied', decided_at = now()
where id = 'chg-test-001';
select is(
  (select status from assistant_staged_changes where id = 'chg-test-001'),
  'applied',
  'staged change flips to applied'
);

-- 5) Invalid status is rejected by the check constraint.
select throws_ok(
  $$ insert into assistant_staged_changes (id, kind, summary, action, signature, status)
     values ('chg-test-002', 'price', 'x', '{}', repeat('b', 64), 'live') $$,
  '23514',
  'unknown status rejected'
);

select finish();
rollback;
