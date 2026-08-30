-- Flash offer scheduling: an offer may go live in the future, so admins can
-- stage a sale before it starts. starts_at NULL means live immediately.
alter table flash_offers
  add column if not exists starts_at timestamptz;

drop policy flash_offers_public_read on flash_offers;
create policy flash_offers_public_read on flash_offers
  for select to anon, authenticated
  using (
    is_active = true
    and ends_at > now()
    and (starts_at is null or starts_at <= now())
  );
