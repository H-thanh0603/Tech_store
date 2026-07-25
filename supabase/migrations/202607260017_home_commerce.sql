-- Homepage commerce skeleton (S2): the hero zone, campaign quick links, member
-- block, category grid and deal tabs described in DESIGN_CELLPHONES_INSPIRED.md
-- §4.1–§4.5.
--
-- Nothing about the page order or copy lives in the components: this migration
-- extends the allowed section types, retunes sort_order, and seeds the two
-- collections the deal tabs need. Editors can then reorder or retitle sections
-- without a deploy.

-- ─── section_type allow-list ─────────────────────────────────────────────────

-- A CHECK constraint (not an enum) means adding a type is a plain DDL swap.
alter table homepage_sections
  drop constraint if exists homepage_sections_section_type_check;

alter table homepage_sections
  add constraint homepage_sections_section_type_check check (
    section_type in (
      'hero',
      'banner_grid',
      'campaign_links',
      'member_block',
      'category_mosaic',
      'category_grid',
      'deal_tabs',
      'product_collection',
      'need_selector',
      'brand_strip',
      'editorial',
      'trust',
      'guides',
      'newsletter',
      'flash_sale',
      'recently_viewed'
    )
  );

-- ─── collections for the deal tabs ───────────────────────────────────────────

insert into homepage_collections (id, slug, title, subtitle, collection_type, sort_order)
values
  (
    '43000000-0000-0000-0000-000000000003',
    'dang-giam-gia',
    'Đang giảm giá',
    'Sản phẩm có biến thể đang bán dưới giá niêm yết.',
    'manual',
    30
  ),
  (
    '43000000-0000-0000-0000-000000000004',
    'hang-moi',
    'Hàng mới về',
    'Sản phẩm được thêm vào catalog gần đây nhất.',
    'newest',
    40
  )
on conflict (id) do nothing;

-- Items are derived from the catalog, so a tab can never advertise a product
-- that is unpublished, archived or (for the discount tab) not actually reduced.
insert into homepage_collection_items (collection_id, product_id, sort_order)
select
  '43000000-0000-0000-0000-000000000003',
  p.id,
  (row_number() over (order by p.is_featured desc, p.created_at desc, p.id)) * 10
from products p
join categories c on c.id = p.category_id
where p.is_published
  and not p.is_archived
  and c.is_active
  and exists (
    select 1
    from product_variants v
    where v.product_id = p.id
      and v.is_active
      and v.sale_price is not null
      and v.sale_price < v.regular_price
  )
on conflict (collection_id, product_id) do nothing;

insert into homepage_collection_items (collection_id, product_id, sort_order)
select
  '43000000-0000-0000-0000-000000000004',
  p.id,
  (row_number() over (order by p.created_at desc, p.id)) * 10
from products p
join categories c on c.id = p.category_id
where p.is_published and not p.is_archived and c.is_active
on conflict (collection_id, product_id) do nothing;

-- ─── new sections ────────────────────────────────────────────────────────────

insert into homepage_sections (id, section_key, section_type, eyebrow, title, subtitle, sort_order, config)
values
  (
    '44000000-0000-0000-0000-000000000010',
    'member',
    'member_block',
    'Thành viên',
    'Mua nhanh hơn ở lần sau',
    'Lưu thông tin giao hàng, wishlist và mã đơn ngay trên thiết bị này.',
    25,
    '{}'
  ),
  (
    '44000000-0000-0000-0000-000000000011',
    'deals',
    'deal_tabs',
    'Ưu đãi & khám phá',
    'Deal, hàng mới và sản phẩm nổi bật',
    'Ba nhóm cùng một khu vực — đổi tab để xem, không cần tải lại trang.',
    35,
    '{"tabs":[{"label":"Đang giảm giá","collectionSlug":"dang-giam-gia"},{"label":"Hàng mới","collectionSlug":"hang-moi"},{"label":"Nổi bật","collectionSlug":"noi-bat"}],"limit":8}'
  )
on conflict (id) do nothing;

-- ─── retune the existing page order ──────────────────────────────────────────

-- The hero now also renders the promo banners in its right column, so the
-- standalone promo grid would repeat them.
update homepage_sections
set is_active = false
where section_key = 'promo-grid';

-- Campaign quick links move directly under the hero (§4.2) and get their own
-- renderer instead of the generic banner grid.
update homepage_sections
set section_type = 'campaign_links',
    eyebrow = 'Lối vào nhanh',
    title = 'Đang diễn ra',
    sort_order = 15,
    config = '{"bannerSlot":"home_campaign_strip","limit":6}'
where section_key = 'campaign-strip';

-- Icon/image cards keyed off live categories, not a hard-coded list.
update homepage_sections
set section_type = 'category_grid',
    title = 'Mua theo danh mục',
    subtitle = 'Danh mục lấy trực tiếp từ catalog.',
    sort_order = 45,
    config = '{"limit":8}'
where section_key = 'categories';

-- Hero: keep the main banner in home_hero and pull the side cards from the promo
-- slot so one editor action updates both places.
update homepage_sections
set config = config || '{"sideBannerSlot":"home_promo_grid","sideLimit":3}'::jsonb
where section_key = 'hero';
