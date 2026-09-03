'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { parseCsv, rowsToObjects } from '@/lib/admin/csv'
import { requireAdminSession } from '@/lib/admin/auth'
import { getSupabaseAdminClient } from '@/lib/admin/supabase'

import { writeAudit } from './shared'

const PRODUCT_IMPORT_MAX_ROWS = 500

const csvRowSchema = z.object({
  slug: z.string().trim().min(1, 'slug bắt buộc').max(160),
  name: z.string().trim().min(1, 'name bắt buộc').max(300),
  category_slug: z.string().trim().min(1, 'category_slug bắt buộc'),
  brand_slug: z.string().trim().min(1, 'brand_slug bắt buộc'),
  description: z.string().trim().max(5000).optional().default(''),
  is_published: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  is_featured: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  is_archived: z
    .union([z.literal('true'), z.literal('false'), z.literal('1'), z.literal('0'), z.literal('')])
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  // Optional single-variant block: when any of these columns is present
  // and non-empty, the import also creates/updates one default variant
  // (upsert by SKU) and its inventory row.
  variant_sku: z.string().trim().max(120).optional().default(''),
  variant_attributes: z.string().trim().max(2000).optional().default(''),
  variant_regular_price: z.string().trim().optional().default(''),
  variant_sale_price: z.string().trim().optional().default(''),
  variant_stock: z.string().trim().optional().default(''),
})

export interface ProductImportSummary {
  total: number
  inserted: number
  updated: number
  variantsUpserted: number
  rejected: { row: number; reason: string }[]
  durationMs: number
}

const REQUIRED_COLUMNS = [
  'slug',
  'name',
  'category_slug',
  'brand_slug',
] as const

export async function importProductsCsv(input: string): Promise<ProductImportSummary> {
  const start = Date.now()
  const admin = await requireAdminSession('products')
  const db = getSupabaseAdminClient()

  const { rows, errors } = parseCsv(input)
  if (errors.length > 0) {
    return {
      total: 0,
      inserted: 0,
      updated: 0,
      variantsUpserted: 0,
      rejected: errors.map((e) => ({ row: 0, reason: e })),
      durationMs: Date.now() - start,
    }
  }
  if (rows.length === 0) {
    return { total: 0, inserted: 0, updated: 0, variantsUpserted: 0, rejected: [], durationMs: Date.now() - start }
  }

  const header = rows[0].map((c) => c.trim().toLowerCase())
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length > 0) {
    return {
      total: 0,
      inserted: 0,
      updated: 0,
      variantsUpserted: 0,
      rejected: [
        { row: 1, reason: `Thiếu cột bắt buộc: ${missing.join(', ')}.` },
      ],
      durationMs: Date.now() - start,
    }
  }

  const dataRows = rowsToObjects<Record<string, string>>(rows)
  if (dataRows.length > PRODUCT_IMPORT_MAX_ROWS) {
    return {
      total: dataRows.length,
      inserted: 0,
      updated: 0,
      variantsUpserted: 0,
      rejected: [
        {
          row: 0,
          reason: `Tối đa ${PRODUCT_IMPORT_MAX_ROWS} dòng / lần import. Hãy chia nhỏ file.`,
        },
      ],
      durationMs: Date.now() - start,
    }
  }

  // Validate each row first so we can collect every error, not just the first.
  const validated: z.infer<typeof csvRowSchema>[] = []
  const rejected: { row: number; reason: string }[] = []
  dataRows.forEach((raw, idx) => {
    const parsed = csvRowSchema.safeParse(raw)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      rejected.push({
        row: idx + 2,
        reason: `${firstIssue.path.join('.') || 'row'}: ${firstIssue.message}`,
      })
      return
    }
    validated.push(parsed.data)
  })

  if (validated.length === 0) {
    return { total: dataRows.length, inserted: 0, updated: 0, variantsUpserted: 0, rejected, durationMs: Date.now() - start }
  }

  // Resolve category / brand slugs in one round-trip each.
  const categorySlugs = Array.from(new Set(validated.map((r) => r.category_slug)))
  const brandSlugs = Array.from(new Set(validated.map((r) => r.brand_slug)))

  const [{ data: categories }, { data: brands }] = await Promise.all([
    db.from('categories').select('id, slug').in('slug', categorySlugs),
    db.from('brands').select('id, slug').in('slug', brandSlugs),
  ])

  const categoryBySlug = new Map((categories ?? []).map((c) => [String(c.slug), String(c.id)]))
  const brandBySlug = new Map((brands ?? []).map((b) => [String(b.slug), String(b.id)]))

  for (let i = validated.length - 1; i >= 0; i -= 1) {
    const r = validated[i]
    if (!categoryBySlug.has(r.category_slug)) {
      rejected.push({ row: i + 2, reason: `category_slug không tồn tại: ${r.category_slug}` })
      validated.splice(i, 1)
      continue
    }
    if (!brandBySlug.has(r.brand_slug)) {
      rejected.push({ row: i + 2, reason: `brand_slug không tồn tại: ${r.brand_slug}` })
      validated.splice(i, 1)
      continue
    }
  }

  if (validated.length === 0) {
    return { total: dataRows.length, inserted: 0, updated: 0, variantsUpserted: 0, rejected, durationMs: Date.now() - start }
  }

  // Upsert in chunks of 50. Vercel Hobby function timeout is 10 s; this
  // stays well under that for the 500-row cap.
  const CHUNK = 50
  const slugs = validated.map((r) => r.slug)
  const { data: existing } = await db
    .from('products')
    .select('id, slug')
    .in('slug', slugs)
  const existingSlugs = new Set((existing ?? []).map((p) => String(p.slug)))

  let inserted = 0
  let updated = 0
  for (let i = 0; i < validated.length; i += CHUNK) {
    const batch = validated.slice(i, i + CHUNK).map((r) => ({
      slug: r.slug,
      name: r.name,
      description: r.description,
      category_id: categoryBySlug.get(r.category_slug)!,
      brand_id: brandBySlug.get(r.brand_slug)!,
      is_published: r.is_published,
      is_featured: r.is_featured,
      is_archived: r.is_archived,
    }))

    const { error } = await db
      .from('products')
      .upsert(batch, { onConflict: 'slug', count: 'exact' })
    if (error) {
      rejected.push({
        row: i + 2,
        reason: `Lỗi DB ở batch ${Math.floor(i / CHUNK) + 1}: ${error.message}`,
      })
      continue
    }
    for (const r of batch) {
      if (existingSlugs.has(r.slug)) updated += 1
      else inserted += 1
    }
  }

  // Optional single-variant block: rows that also carry variant_* columns
  // create or update one default variant (upsert by SKU) plus its inventory
  // row, so imported products are publishable immediately.
  const variantRows = validated.filter(
    (r) => r.variant_sku && r.variant_regular_price !== '',
  )
  let variantsUpserted = 0
  if (variantRows.length > 0) {
    const { data: idMap } = await db
      .from('products')
      .select('id, slug')
      .in(
        'slug',
        variantRows.map((r) => r.slug),
      )
    const idBySlug = new Map((idMap ?? []).map((p) => [String(p.slug), String(p.id)]))

    for (const r of variantRows) {
      const productId = idBySlug.get(r.slug)
      if (!productId) continue

      const regular = Number(r.variant_regular_price)
      const saleRaw = r.variant_sale_price === '' ? null : Number(r.variant_sale_price)
      const stockRaw = r.variant_stock === '' ? 0 : Number(r.variant_stock)
      if (!Number.isFinite(regular) || regular < 0) {
        rejected.push({ row: 0, reason: `variant_regular_price không hợp lệ cho ${r.slug}` })
        continue
      }
      if (saleRaw != null && (!Number.isFinite(saleRaw) || saleRaw < 0 || saleRaw > regular)) {
        rejected.push({
          row: 0,
          reason: `variant_sale_price phải >= 0 và <= giá thường cho ${r.slug}`,
        })
        continue
      }

      let attributes: Record<string, string> = {}
      if (r.variant_attributes) {
        try {
          const parsedAttr = JSON.parse(r.variant_attributes)
          if (parsedAttr && typeof parsedAttr === 'object' && !Array.isArray(parsedAttr)) {
            attributes = Object.fromEntries(
              Object.entries(parsedAttr).map(([k, v]) => [k, String(v)]),
            )
          }
        } catch {
          rejected.push({
            row: 0,
            reason: `variant_attributes phải là JSON hợp lệ cho ${r.slug}`,
          })
          continue
        }
      }

      const { data: upserted, error: varError } = await db
        .from('product_variants')
        .upsert(
          {
            product_id: productId,
            sku: r.variant_sku,
            attributes,
            regular_price: regular,
            sale_price: saleRaw,
            is_active: true,
          },
          { onConflict: 'sku' }
        )
        .select('id')
        .single()
      if (varError || !upserted) {
        rejected.push({ row: 0, reason: `Lỗi variant upsert cho ${r.slug}: ${varError?.message}` })
        continue
      }
      variantsUpserted += 1

      // Ensure an inventory row exists; set quantity only when the CSV
      // provides the column (leave existing stock alone otherwise).
      if (r.variant_stock !== '') {
        if (!Number.isInteger(stockRaw) || stockRaw < 0) {
          rejected.push({ row: 0, reason: `variant_stock phải là số nguyên >= 0 cho ${r.slug}` })
          continue
        }
        const { error: invError } = await db.from('inventory').upsert(
          {
            variant_id: upserted.id,
            quantity: stockRaw,
          },
          { onConflict: 'variant_id' }
        )
        if (invError) {
          rejected.push({
            row: 0,
            reason: `Lỗi inventory upsert cho ${r.slug}: ${invError.message}`,
          })
        }
      }
    }
  }

  await writeAudit(
    'product_csv_import',
    null,
    {
      inserted,
      updated,
      variantsUpserted,
      rejected: rejected.length,
      total: dataRows.length,
    },
    admin,
  )

  revalidatePath('/admin/products')
  revalidatePath('/products')
  revalidatePath('/', 'layout')

  return {
    total: dataRows.length,
    inserted,
    updated,
    variantsUpserted,
    rejected,
    durationMs: Date.now() - start,
  }
}

