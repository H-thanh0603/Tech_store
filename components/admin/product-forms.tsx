'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { AdminActionState } from '@/lib/admin/types'
import {
  createProduct,
  deleteImage,
  deleteSpec,
  replaceUseCases,
  updateProduct,
  upsertImage,
  upsertSpec,
  upsertVariant,
} from '@/lib/admin/product-actions'
import type {
  AdminImageRow,
  AdminProductDetail,
  AdminSpecRow,
  AdminVariantRow,
  BrandOption,
  CategoryOption,
} from '@/lib/admin/types'

const initial: AdminActionState = { ok: true }

function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.ok) {
    return state.message ? (
      <p className="text-(length:--text-sm) text-success" role="status">
        {state.message}
      </p>
    ) : null
  }
  return (
    <p className="text-(length:--text-sm) text-danger" role="alert">
      {state.message}
    </p>
  )
}

function fieldError(
  state: AdminActionState,
  key: string,
): string | undefined {
  if (state.ok) return undefined
  return state.fieldErrors?.[key]?.[0]
}

function Checkbox({
  id,
  name,
  label,
  defaultChecked,
}: {
  id: string
  name: string
  label: string
  defaultChecked?: boolean
}) {
  return (
    <label htmlFor={id} className="inline-flex items-center gap-2 text-(length:--text-sm) text-fg">
      <input
        id={id}
        name={name}
        type="checkbox"
        value="true"
        defaultChecked={defaultChecked}
        className="size-4 rounded border-border"
      />
      {label}
    </label>
  )
}

export function CreateProductForm({
  categories,
  brands,
}: {
  categories: CategoryOption[]
  brands: BrandOption[]
}) {
  const [state, action, pending] = useActionState(createProduct, initial)

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Input id="name" name="name" label="Tên sản phẩm" required error={fieldError(state, 'name')} />
      <Input id="slug" name="slug" label="Slug" required error={fieldError(state, 'slug')} />
      <div className="md:col-span-2">
        <label htmlFor="description" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Mô tả
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          className="w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 py-2 text-(length:--text-sm)"
        />
      </div>
      <div>
        <label htmlFor="categoryId" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Danh mục
        </label>
        <select
          id="categoryId"
          name="categoryId"
          required
          className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="brandId" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Thương hiệu
        </label>
        <select
          id="brandId"
          name="brandId"
          className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3"
        >
          <option value="">— Không —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <Input id="sku" name="sku" label="SKU biến thể đầu" required error={fieldError(state, 'sku')} />
      <Input
        id="regularPrice"
        name="regularPrice"
        label="Giá (VND)"
        type="number"
        min={0}
        required
        error={fieldError(state, 'regularPrice')}
      />
      <Input id="salePrice" name="salePrice" label="Giá sale (tuỳ chọn)" type="number" min={0} />
      <Input id="quantity" name="quantity" label="Tồn kho" type="number" min={0} required defaultValue={0} />
      <Input
        id="lowStockThreshold"
        name="lowStockThreshold"
        label="Ngưỡng tồn thấp"
        type="number"
        min={0}
        defaultValue={5}
      />
      <Input
        id="attributesJson"
        name="attributesJson"
        label='Thuộc tính JSON (vd {"ram":"16GB"})'
        defaultValue="{}"
      />
      <Input id="imageUrl" name="imageUrl" label="URL ảnh (tuỳ chọn)" />
      <Input id="imageAlt" name="imageAlt" label="Alt ảnh" />
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <Checkbox id="isPublished" name="isPublished" label="Xuất bản ngay" />
        <Checkbox id="isFeatured" name="isFeatured" label="Nổi bật" />
      </div>
      <div className="md:col-span-2 flex flex-col gap-2">
        <ActionMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang tạo…' : 'Tạo sản phẩm'}
        </Button>
      </div>
    </form>
  )
}

export function EditProductForm({
  product,
  categories,
  brands,
}: {
  product: AdminProductDetail
  categories: CategoryOption[]
  brands: BrandOption[]
}) {
  const bound = updateProduct.bind(null, product.id)
  const [state, action, pending] = useActionState(bound, initial)

  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <Input id="edit-name" name="name" label="Tên" required defaultValue={product.name} />
      <Input id="edit-slug" name="slug" label="Slug" required defaultValue={product.slug} />
      <div className="md:col-span-2">
        <label htmlFor="edit-description" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Mô tả
        </label>
        <textarea
          id="edit-description"
          name="description"
          rows={4}
          defaultValue={product.description ?? ''}
          className="w-full rounded-(--radius-md) border border-border bg-surface-raised px-3 py-2 text-(length:--text-sm)"
        />
      </div>
      <div>
        <label htmlFor="edit-categoryId" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Danh mục
        </label>
        <select
          id="edit-categoryId"
          name="categoryId"
          defaultValue={product.categoryId}
          className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3"
        >
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="edit-brandId" className="mb-1.5 block text-(length:--text-sm) font-medium">
          Thương hiệu
        </label>
        <select
          id="edit-brandId"
          name="brandId"
          defaultValue={product.brandId ?? ''}
          className="min-h-(--size-touch) w-full rounded-(--radius-md) border border-border bg-surface-raised px-3"
        >
          <option value="">— Không —</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap gap-4 md:col-span-2">
        <Checkbox id="edit-published" name="isPublished" label="Xuất bản" defaultChecked={product.isPublished} />
        <Checkbox id="edit-featured" name="isFeatured" label="Nổi bật" defaultChecked={product.isFeatured} />
        <Checkbox id="edit-archived" name="isArchived" label="Lưu trữ" defaultChecked={product.isArchived} />
      </div>
      <div className="md:col-span-2 flex flex-col gap-2">
        <ActionMessage state={state} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Đang lưu…' : 'Lưu sản phẩm'}
        </Button>
      </div>
    </form>
  )
}

export function VariantForm({
  productId,
  variant,
}: {
  productId: string
  variant?: AdminVariantRow
}) {
  const bound = upsertVariant.bind(null, productId)
  const [state, action, pending] = useActionState(bound, initial)

  return (
    <form action={action} className="grid gap-3 rounded-(--radius-lg) border border-border p-4 md:grid-cols-2">
      {variant ? <input type="hidden" name="variantId" value={variant.id} /> : null}
      <Input id={`sku-${variant?.id ?? 'new'}`} name="sku" label="SKU" required defaultValue={variant?.sku} />
      <Input
        id={`price-${variant?.id ?? 'new'}`}
        name="regularPrice"
        label="Giá"
        type="number"
        min={0}
        required
        defaultValue={variant?.regularPrice ?? 0}
      />
      <Input
        id={`sale-${variant?.id ?? 'new'}`}
        name="salePrice"
        label="Sale"
        type="number"
        min={0}
        defaultValue={variant?.salePrice ?? undefined}
      />
      <Input
        id={`qty-${variant?.id ?? 'new'}`}
        name="quantity"
        label="Tồn"
        type="number"
        min={0}
        required
        defaultValue={variant?.quantity ?? 0}
      />
      <Input
        id={`low-${variant?.id ?? 'new'}`}
        name="lowStockThreshold"
        label="Ngưỡng thấp"
        type="number"
        min={0}
        defaultValue={variant?.lowStockThreshold ?? 5}
      />
      <Input
        id={`attrs-${variant?.id ?? 'new'}`}
        name="attributesJson"
        label="Attributes JSON"
        defaultValue={JSON.stringify(variant?.attributes ?? {})}
      />
      <div className="md:col-span-2">
        <Checkbox
          id={`active-${variant?.id ?? 'new'}`}
          name="isActive"
          label="Đang bán"
          defaultChecked={variant?.isActive ?? true}
        />
        {variant ? (
          <p className="mt-1 text-(length:--text-xs) text-fg-muted">
            Reserved: {variant.reservedQuantity} · Available: {variant.available}
          </p>
        ) : null}
      </div>
      <div className="md:col-span-2 flex flex-col gap-2">
        <ActionMessage state={state} />
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? 'Đang lưu…' : variant ? 'Cập nhật biến thể' : 'Thêm biến thể'}
        </Button>
      </div>
    </form>
  )
}

export function ImageForm({
  productId,
  image,
}: {
  productId: string
  image?: AdminImageRow
}) {
  const bound = upsertImage.bind(null, productId)
  const [state, action, pending] = useActionState(bound, initial)
  const delBound = deleteImage.bind(null, productId)
  const [delState, delAction, delPending] = useActionState(delBound, initial)

  return (
    <div className="rounded-(--radius-lg) border border-border p-4">
      <form action={action} className="grid gap-3 md:grid-cols-2">
        {image ? <input type="hidden" name="imageId" value={image.id} /> : null}
        <Input id={`url-${image?.id ?? 'new'}`} name="url" label="URL" required defaultValue={image?.url} />
        <Input
          id={`alt-${image?.id ?? 'new'}`}
          name="altText"
          label="Alt"
          defaultValue={image?.altText ?? ''}
        />
        <Input
          id={`sort-${image?.id ?? 'new'}`}
          name="sortOrder"
          label="Sort"
          type="number"
          defaultValue={image?.sortOrder ?? 0}
        />
        <div className="md:col-span-2 flex flex-col gap-2">
          <ActionMessage state={state} />
          <Button type="submit" variant="secondary" disabled={pending}>
            {pending ? '…' : image ? 'Cập nhật ảnh' : 'Thêm ảnh'}
          </Button>
        </div>
      </form>
      {image ? (
        <form action={delAction} className="mt-2">
          <input type="hidden" name="imageId" value={image.id} />
          <ActionMessage state={delState} />
          <Button type="submit" variant="ghost" disabled={delPending}>
            Xóa ảnh
          </Button>
        </form>
      ) : null}
    </div>
  )
}

export function SpecForm({
  productId,
  spec,
}: {
  productId: string
  spec?: AdminSpecRow
}) {
  const bound = upsertSpec.bind(null, productId)
  const [state, action, pending] = useActionState(bound, initial)
  const delBound = deleteSpec.bind(null, productId)
  const [delState, delAction, delPending] = useActionState(delBound, initial)

  return (
    <div className="rounded-(--radius-lg) border border-border p-4">
      <form action={action} className="grid gap-3 md:grid-cols-2">
        {spec ? <input type="hidden" name="specId" value={spec.id} /> : null}
        <Input
          id={`group-${spec?.id ?? 'new'}`}
          name="groupName"
          label="Nhóm"
          required
          defaultValue={spec?.groupName}
        />
        <Input
          id={`label-${spec?.id ?? 'new'}`}
          name="label"
          label="Nhãn"
          required
          defaultValue={spec?.label}
        />
        <Input
          id={`value-${spec?.id ?? 'new'}`}
          name="value"
          label="Giá trị"
          required
          defaultValue={spec?.value}
        />
        <Input
          id={`ssort-${spec?.id ?? 'new'}`}
          name="sortOrder"
          label="Sort"
          type="number"
          defaultValue={spec?.sortOrder ?? 0}
        />
        <div className="md:col-span-2">
          <ActionMessage state={state} />
          <Button type="submit" variant="secondary" disabled={pending}>
            {spec ? 'Cập nhật spec' : 'Thêm spec'}
          </Button>
        </div>
      </form>
      {spec ? (
        <form action={delAction} className="mt-2">
          <input type="hidden" name="specId" value={spec.id} />
          <ActionMessage state={delState} />
          <Button type="submit" variant="ghost" disabled={delPending}>
            Xóa spec
          </Button>
        </form>
      ) : null}
    </div>
  )
}

export function UseCasesForm({
  productId,
  useCases,
}: {
  productId: string
  useCases: string[]
}) {
  const bound = replaceUseCases.bind(null, productId)
  const [state, action, pending] = useActionState(bound, initial)

  return (
    <form action={action} className="flex flex-col gap-3">
      <Input
        id="useCases"
        name="useCases"
        label="Use cases (phân tách bằng dấu phẩy)"
        defaultValue={useCases.join(', ')}
      />
      <ActionMessage state={state} />
      <Button type="submit" variant="secondary" disabled={pending}>
        Lưu use cases
      </Button>
    </form>
  )
}
