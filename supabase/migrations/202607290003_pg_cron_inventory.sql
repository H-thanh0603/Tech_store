-- Enable pg_cron extension if it doesn't exist
create extension if not exists pg_cron;

-- Schedule the expiration cron job to run every 1 minute
-- The expire_pending_orders function was defined in 202607290001_inventory_reservation_ssot.sql
select cron.schedule(
  'expire-pending-orders',
  '* * * * *',
  $$
    select public.expire_pending_orders(15);
  $$
);
