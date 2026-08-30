import { z } from 'zod'

import { parseSectionConfig, safeHref } from '@/lib/content/config-schemas'
import { BANNER_SLOTS, NAV_ITEM_TYPES, SECTION_TYPES } from '@/lib/content/types'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || undefined)
const optionalHttpsUrl = z
  .union([z.literal(''), z.string().url().startsWith('https://')])
  .optional()
  .transform((value) => value || undefined)
const id = z.union([z.literal(''), z.string().uuid()]).optional()
const sortOrder = z.coerce.number().int().min(0).max(10_000)

export const bannerUpsertSchema = z.object({
  id,
  name: z.string().trim().min(1).max(120),
  slot: z.enum(BANNER_SLOTS),
  title: optionalText(160),
  subtitle: optionalText(300),
  imageDesktopUrl: optionalHttpsUrl,
  imageMobileUrl: optionalHttpsUrl,
  href: safeHref,
  sortOrder,
  isActive: z.boolean().default(false),
})

const sectionBaseSchema = z.object({
  id,
  sectionKey: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{1,47}$/),
  sectionType: z.enum(SECTION_TYPES),
  title: optionalText(160),
  subtitle: optionalText(300),
  eyebrow: optionalText(60),
  config: z.string().max(4096),
  sortOrder,
  isActive: z.boolean().default(false),
})

export function parseSectionForm(input: unknown) {
  const base = sectionBaseSchema.safeParse(input)
  if (!base.success) return base

  let raw: unknown
  try {
    raw = JSON.parse(base.data.config || '{}')
  } catch {
    return { success: false as const, error: new z.ZodError([{ code: 'custom', path: ['config'], message: 'Config phải là JSON hợp lệ.' }]) }
  }

  const parsed = parseSectionConfig(base.data.sectionType, raw)
  if (!parsed.config || parsed.error) {
    return { success: false as const, error: new z.ZodError([{ code: 'custom', path: ['config'], message: parsed.error ?? 'Config không hợp lệ.' }]) }
  }
  return { success: true as const, data: { ...base.data, config: parsed.config } }
}

export const navigationUpsertSchema = z
  .object({
    id,
    parentId: id,
    label: z.string().trim().min(1).max(60),
    href: z.union([z.literal(''), safeHref]).optional().default(''),
    itemType: z.enum(NAV_ITEM_TYPES),
    iconKey: z.union([z.literal(''), z.string().regex(/^[a-z0-9][a-z0-9-]{0,31}$/)]).optional(),
    imageUrl: optionalHttpsUrl,
    sortOrder,
    isActive: z.boolean().default(false),
    openInNewTab: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.itemType !== 'group' && !value.href) {
      ctx.addIssue({ code: 'custom', path: ['href'], message: 'Loại này cần đường dẫn.' })
    }
    if (value.openInNewTab && !value.href.startsWith('https://')) {
      ctx.addIssue({ code: 'custom', path: ['href'], message: 'Tab mới chỉ dùng với HTTPS.' })
    }
    if (value.id && value.parentId === value.id) {
      ctx.addIssue({ code: 'custom', path: ['parentId'], message: 'Menu không thể là cha của chính nó.' })
    }
  })

const datetimeLocal = z
  .string()
  .trim()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Không đúng định dạng ngày giờ.')

export const flashOfferUpsertSchema = z
  .object({
    id,
    // Shape-level uuid check only: zod's .uuid() enforces RFC version bits,
    // which the deterministic seed UUIDs (…-0000-…) do not satisfy. The FK on
    // products enforces the real constraint.
    productId: z
      .string()
      .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, { message: 'Chọn một sản phẩm.' }),
    title: z.string().trim().min(1).max(120),
    badge: z.string().trim().min(1).max(60).default('⚡ Flash'),
    startsAt: z.union([z.literal(''), datetimeLocal]).optional().default(''),
    endsAt: datetimeLocal,
    sortOrder,
    isActive: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const startsMs = value.startsAt ? Date.parse(value.startsAt) : null
    const endsMs = Date.parse(value.endsAt)
    if (startsMs !== null && endsMs <= startsMs) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Kết thúc phải sau thời gian bắt đầu.' })
    }
    if (!value.id && endsMs <= Date.now()) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'Kết thúc phải trong tương lai.' })
    }
  })
