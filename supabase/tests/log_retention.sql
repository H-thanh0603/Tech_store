-- pgTAP tests for purge_expired_logs retention guards.

begin;

create extension if not exists pgtap with schema extensions;

select plan(3);

-- 1) Refuses to shorten audit retention below 30 days.
select is(
  (select (purge_expired_logs(7, 90, 2)) ->> 'code'),
  'VALIDATION_ERROR',
  'audit retention below 30 days is rejected'
);

-- 2) Refuses analytics retention below 7 days.
select is(
  (select (purge_expired_logs(180, 1, 2)) ->> 'code'),
  'VALIDATION_ERROR',
  'analytics retention below 7 days is rejected'
);

-- 3) Defaults (180/90/2) pass validation and return OK.
select is(
  (select (purge_expired_logs()) ->> 'code'),
  'OK',
  'default retention runs and returns OK'
);

select finish();
rollback;
