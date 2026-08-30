'use client'

import { useActionState, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import {
  deleteContentItem,
  upsertBanner,
  upsertFlashOffer,
  upsertHomepageSection,
  upsertNavigationItem,
} from '@/lib/admin/content-actions'
import type {
  AdminBanner,
  AdminFlashOffer,
  AdminHomepageSection,
  AdminNavigationItem,
  AdminProductOption,
} from '@/lib/admin/content-queries'
import type { AdminActionState } from '@/lib/admin/types'
import { BANNER_SLOTS, NAV_ITEM_TYPES, SECTION_TYPES } from '@/lib/content/types'

const initial: AdminActionState = { ok: true }
const field = 'min-h-11 w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 text-(length:--text-sm)'

function Message({ state }: { state: AdminActionState }) {
  if (!state.message) return null
  return <p role="status" className={`text-(length:--text-sm) ${state.ok ? 'text-success' : 'text-danger'}`}>{state.message}</p>
}

function Actions({ onCancel, pending }: { onCancel?: () => void; pending: boolean }) {
  return <div className="flex gap-2"><button disabled={pending} className="min-h-11 rounded-(--radius-md) bg-accent px-4 text-sm font-semibold text-accent-fg">{pending ? 'Đang lưu…' : 'Lưu'}</button>{onCancel ? <button type="button" onClick={onCancel} className="min-h-11 rounded-(--radius-md) border border-border px-4 text-sm">Hủy</button> : null}</div>
}

function DeleteButton({ kind, id }: { kind: 'banner' | 'section' | 'navigation' | 'flash'; id: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} className="min-h-10 px-2 text-danger" onClick={() => {
    if (!window.confirm('Xóa mục này?')) return
    startTransition(async () => { await deleteContentItem(kind, id); router.refresh() })
  }}>{pending ? 'Đang xóa…' : 'Xóa'}</button>
}

function Panel({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return <details open className="rounded-(--radius-lg) border border-border bg-surface-raised p-4 shadow-(--shadow-sm)"><summary className="cursor-pointer text-lg font-semibold">{title} <span className="text-sm font-normal text-fg-muted">({count})</span></summary><div className="mt-4">{children}</div></details>
}

export function ContentManager(props: { banners: AdminBanner[]; sections: AdminHomepageSection[]; navigation: AdminNavigationItem[]; flashOffers: AdminFlashOffer[]; productOptions: AdminProductOption[] }) {
  return <div className="space-y-5"><BannerPanel rows={props.banners} /><SectionPanel rows={props.sections} /><NavigationPanel rows={props.navigation} /><FlashSalePanel rows={props.flashOffers} productOptions={props.productOptions} /></div>
}

function toInputDateTime(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function FlashSalePanel({ rows, productOptions }: { rows: AdminFlashOffer[]; productOptions: AdminProductOption[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<AdminFlashOffer | null>(null)
  const [state, action, pending] = useActionState(async (prev: AdminActionState, data: FormData) => { const result = await upsertFlashOffer(prev, data); if (result.ok) { setEditing(null); router.refresh() } return result }, initial)
  return <Panel title="Flash sale" count={rows.length}><div className="grid gap-5 xl:grid-cols-[1fr_24rem]"><ItemTable rows={rows.map((x) => ({ id: x.id, primary: x.title, secondary: `${x.productName} · hết ${toInputDateTime(x.endsAt).replace('T', ' ')}`, active: x.isActive }))} onEdit={(id) => setEditing(rows.find((x) => x.id === id) ?? null)} kind="flash" /><form action={action} key={editing?.id ?? 'new'} className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{editing ? 'Sửa flash offer' : 'Tạo flash offer'}</h3>{editing ? <input type="hidden" name="id" value={editing.id} /> : null}<p className="text-xs text-fg-muted">Giá hiển thị là giá sale của sản phẩm — hãy chọn sản phẩm đã đặt giá khuyến mãi ở trang Sản phẩm.</p><select name="productId" required defaultValue={editing?.productId ?? ''} className={field}><option value="" disabled>Chọn sản phẩm</option>{productOptions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select><input name="title" required maxLength={120} defaultValue={editing?.title ?? ''} placeholder="Tiêu đề ưu đãi" className={field} /><input name="badge" maxLength={60} defaultValue={editing?.badge ?? '⚡ Flash'} placeholder="Badge" className={field} /><label className="block text-xs text-fg-muted">Bắt đầu (để trống = chạy ngay)<input name="startsAt" type="datetime-local" defaultValue={toInputDateTime(editing?.startsAt ?? null)} className={field} /></label><label className="block text-xs text-fg-muted">Kết thúc<input name="endsAt" type="datetime-local" required defaultValue={toInputDateTime(editing?.endsAt ?? null)} className={field} /></label><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} className={field} /><Check name="isActive" label="Đang hiển thị" checked={editing?.isActive ?? true} /><Message state={state} /><Actions pending={pending} onCancel={editing ? () => setEditing(null) : undefined} /></form></div></Panel>
}

function BannerPanel({ rows }: { rows: AdminBanner[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<AdminBanner | null>(null)
  const [state, action, pending] = useActionState(async (prev: AdminActionState, data: FormData) => { const result = await upsertBanner(prev, data); if (result.ok) { setEditing(null); router.refresh() } return result }, initial)
  return <Panel title="Banner" count={rows.length}><div className="grid gap-5 xl:grid-cols-[1fr_24rem]"><ItemTable rows={rows.map((x) => ({ id: x.id, primary: x.name, secondary: `${x.slot} · ${x.href}`, active: x.isActive }))} onEdit={(id) => setEditing(rows.find((x) => x.id === id) ?? null)} kind="banner" /><form action={action} key={editing?.id ?? 'new'} className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{editing ? 'Sửa banner' : 'Tạo banner'}</h3>{editing ? <input type="hidden" name="id" value={editing.id} /> : null}<input name="name" required maxLength={120} defaultValue={editing?.name ?? ''} placeholder="Tên nội bộ" className={field} /><select name="slot" defaultValue={editing?.slot ?? 'home_hero'} className={field}>{BANNER_SLOTS.map((x) => <option key={x}>{x}</option>)}</select><input name="title" defaultValue={editing?.title ?? ''} placeholder="Tiêu đề" className={field} /><input name="subtitle" defaultValue={editing?.subtitle ?? ''} placeholder="Mô tả ngắn" className={field} /><input name="href" required defaultValue={editing?.href ?? '/products'} placeholder="/products" className={field} /><input name="imageDesktopUrl" type="url" defaultValue={editing?.imageDesktopUrl ?? ''} placeholder="Ảnh desktop HTTPS" className={field} /><input name="imageMobileUrl" type="url" defaultValue={editing?.imageMobileUrl ?? ''} placeholder="Ảnh mobile HTTPS" className={field} /><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} className={field} /><Check name="isActive" label="Đang hiển thị" checked={editing?.isActive ?? true} /><Message state={state} /><Actions pending={pending} onCancel={editing ? () => setEditing(null) : undefined} /></form></div></Panel>
}

function SectionPanel({ rows }: { rows: AdminHomepageSection[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<AdminHomepageSection | null>(null)
  const [state, action, pending] = useActionState(async (prev: AdminActionState, data: FormData) => { const result = await upsertHomepageSection(prev, data); if (result.ok) { setEditing(null); router.refresh() } return result }, initial)
  return <Panel title="Section trang chủ" count={rows.length}><div className="grid gap-5 xl:grid-cols-[1fr_24rem]"><ItemTable rows={rows.map((x) => ({ id: x.id, primary: x.sectionKey, secondary: x.sectionType, active: x.isActive }))} onEdit={(id) => setEditing(rows.find((x) => x.id === id) ?? null)} kind="section" /><form action={action} key={editing?.id ?? 'new'} className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{editing ? 'Sửa section' : 'Tạo section'}</h3>{editing ? <input type="hidden" name="id" value={editing.id} /> : null}<input name="sectionKey" required defaultValue={editing?.sectionKey ?? ''} placeholder="section-key" className={field} /><select name="sectionType" defaultValue={editing?.sectionType ?? 'editorial'} className={field}>{SECTION_TYPES.map((x) => <option key={x}>{x}</option>)}</select><input name="eyebrow" defaultValue={editing?.eyebrow ?? ''} placeholder="Eyebrow" className={field} /><input name="title" defaultValue={editing?.title ?? ''} placeholder="Tiêu đề" className={field} /><input name="subtitle" defaultValue={editing?.subtitle ?? ''} placeholder="Mô tả" className={field} /><textarea name="config" required rows={5} defaultValue={JSON.stringify(editing?.config ?? {}, null, 2)} className={`${field} py-2 font-mono`} /><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} className={field} /><Check name="isActive" label="Đang hiển thị" checked={editing?.isActive ?? true} /><Message state={state} /><Actions pending={pending} onCancel={editing ? () => setEditing(null) : undefined} /></form></div></Panel>
}

function NavigationPanel({ rows }: { rows: AdminNavigationItem[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<AdminNavigationItem | null>(null)
  const [state, action, pending] = useActionState(async (prev: AdminActionState, data: FormData) => { const result = await upsertNavigationItem(prev, data); if (result.ok) { setEditing(null); router.refresh() } return result }, initial)
  return <Panel title="Menu" count={rows.length}><div className="grid gap-5 xl:grid-cols-[1fr_24rem]"><ItemTable rows={rows.map((x) => ({ id: x.id, primary: x.label, secondary: `${x.itemType} · ${x.href ?? 'nhóm'}`, active: x.isActive }))} onEdit={(id) => setEditing(rows.find((x) => x.id === id) ?? null)} kind="navigation" /><form action={action} key={editing?.id ?? 'new'} className="space-y-3 rounded-lg border border-border p-4"><h3 className="font-semibold">{editing ? 'Sửa menu' : 'Tạo menu'}</h3>{editing ? <input type="hidden" name="id" value={editing.id} /> : null}<input name="label" required defaultValue={editing?.label ?? ''} placeholder="Nhãn" className={field} /><select name="itemType" defaultValue={editing?.itemType ?? 'link'} className={field}>{NAV_ITEM_TYPES.map((x) => <option key={x}>{x}</option>)}</select><input name="href" defaultValue={editing?.href ?? ''} placeholder="/products hoặc HTTPS" className={field} /><select name="parentId" defaultValue={editing?.parentId ?? ''} className={field}><option value="">Không có menu cha</option>{rows.filter((x) => x.id !== editing?.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select><input name="iconKey" defaultValue={editing?.iconKey ?? ''} placeholder="icon-key" className={field} /><input name="imageUrl" type="url" defaultValue={editing?.imageUrl ?? ''} placeholder="Ảnh HTTPS" className={field} /><input name="sortOrder" type="number" min="0" defaultValue={editing?.sortOrder ?? 0} className={field} /><Check name="isActive" label="Đang hiển thị" checked={editing?.isActive ?? true} /><Check name="openInNewTab" label="Mở tab mới (chỉ HTTPS)" checked={editing?.openInNewTab ?? false} /><Message state={state} /><Actions pending={pending} onCancel={editing ? () => setEditing(null) : undefined} /></form></div></Panel>
}

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return <label className="flex min-h-10 items-center gap-2 text-sm"><input type="checkbox" name={name} value="true" defaultChecked={checked} className="size-4" />{label}</label>
}

function ItemTable({ rows, onEdit, kind }: { rows: Array<{ id: string; primary: string; secondary: string; active: boolean }>; onEdit: (id: string) => void; kind: 'banner' | 'section' | 'navigation' | 'flash' }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border text-fg-muted"><th className="p-3">Tên</th><th className="p-3">Chi tiết</th><th className="p-3">Trạng thái</th><th className="p-3"><span className="sr-only">Hành động</span></th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-b border-border"><td className="p-3 font-medium">{row.primary}</td><td className="p-3 text-fg-muted">{row.secondary}</td><td className="p-3">{row.active ? 'Active' : 'Inactive'}</td><td className="p-3 whitespace-nowrap"><button type="button" className="min-h-10 px-2 text-accent" onClick={() => onEdit(row.id)}>Sửa</button><DeleteButton kind={kind} id={row.id} /></td></tr>)}{rows.length === 0 ? <tr><td colSpan={4} className="p-8 text-center text-fg-muted">Chưa có dữ liệu.</td></tr> : null}</tbody></table></div>
}
