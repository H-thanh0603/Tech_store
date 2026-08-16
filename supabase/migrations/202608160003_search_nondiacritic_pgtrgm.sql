-- Diacritic-insensitive + fuzzy search.
--
-- Adds a normalized (no-diacritic, lowercase) full-text vector alongside the
-- existing search_vector so "dien thoai" matches "Điện thoại", plus pg_trgm
-- on a normalized name column for fuzzy/substring fallback. The original
-- search_vector and its consumers stay untouched.

create extension if not exists pg_trgm;

-- ─── normalize_vietnamese: lowercase + strip diacritics ──────────────────────

create or replace function normalize_vietnamese(p_text text)
returns text
language sql
immutable
parallel safe
as $$
  select translate(
    lower(coalesce(p_text, '')),
    'àáảãạăằắẳẵặâầấẩẫậđèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ',
    'aaaaaaaaaaaaaaaaadeeeeeeeeeeeiiiiioooooooooooooooooouuuuuuuuuuuyyyyy'
  );
$$;

-- ─── products: normalized FTS vector + trgm name column ──────────────────────

alter table products
  add column if not exists search_vector_nd tsvector;

-- Generated column so trgm index and ilike fallback never drift from name.
alter table products
  add column if not exists name_nd text
  generated always as (normalize_vietnamese(name)) stored;

create index if not exists products_search_vector_nd_idx
  on products using gin (search_vector_nd);

create index if not exists products_name_nd_trgm_idx
  on products using gin (name_nd gin_trgm_ops);

-- ─── refresh_product_search_vector: maintain both vectors ────────────────────

create or replace function refresh_product_search_vector(p_product_id uuid)
returns void
language plpgsql
as $$
declare
  v_text text;
begin
  select coalesce(name, '') || ' ' ||
    coalesce(description, '') || ' ' ||
    coalesce((
      select string_agg(sku, ' ')
      from product_variants
      where product_id = p_product_id
    ), '')
  into v_text
  from products
  where id = p_product_id;

  update products
  set search_vector = to_tsvector('simple', v_text),
      search_vector_nd = to_tsvector('simple', normalize_vietnamese(v_text))
  where id = p_product_id;
end;
$$;

-- ─── backfill nd vector for existing rows ────────────────────────────────────

select refresh_product_search_vector(id) from products;
