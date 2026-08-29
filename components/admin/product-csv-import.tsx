'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { importProductsCsv } from '@/lib/admin/product-actions'
import type { ProductImportSummary } from '@/lib/admin/product-actions'

const SAMPLE = `slug,name,category_slug,brand_slug,description,is_published,is_featured,is_archived,variant_sku,variant_attributes,variant_regular_price,variant_sale_price,variant_stock
iphone-15-pro-256gb,iPhone 15 Pro 256GB,phone,apple,Pro 2024 flagship,true,true,false,IP15P-256,"{""ram"": ""8GB"", ""storage"": ""256GB""}",28990000,25990000,15
pixel-9-pro-256gb,Pixel 9 Pro 256GB,phone,google,Google flagship 2024,true,false,false,PX9P-256,"{""ram"": ""12GB"", ""storage"": ""256GB""}",21900000,,8
galaxy-s24-ultra-512gb,Galaxy S24 Ultra 512GB,phone,samsung,Top-tier Android,true,true,false,S24U-512,"{""ram"": ""12GB"", ""storage"": ""512GB""}",31990000,29990000,0
`

interface Props {
  defaultValue?: string
}

export function ProductCsvImportForm({ defaultValue = '' }: Props) {
  const [csv, setCsv] = useState(defaultValue)
  const [summary, setSummary] = useState<ProductImportSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function submit() {
    setError(null)
    setSummary(null)
    if (!csv.trim()) {
      setError('Dán nội dung CSV vào ô bên dưới trước khi nhập.')
      return
    }
    startTransition(async () => {
      try {
        const result = await importProductsCsv(csv)
        setSummary(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Không rõ lỗi.')
      }
    })
  }

  return (
    <div className="space-y-4">
      <details className="rounded-(--radius-md) border border-border bg-surface-muted/40 px-3 py-2 text-(length:--text-sm) text-fg-muted">
        <summary className="cursor-pointer font-medium text-fg">Định dạng cột bắt buộc</summary>
        <div className="mt-2 space-y-2">
          <p>
            Cột bắt buộc: <code>slug</code>, <code>name</code>, <code>category_slug</code>,{' '}
            <code>brand_slug</code>. Tùy chọn: <code>description</code>, <code>is_published</code>,{' '}
            <code>is_featured</code>, <code>is_archived</code> (true/false).
          </p>
          <p>
            <strong>Biến thể mặc định (tùy chọn):</strong> điền thêm{' '}
            <code>variant_sku</code> (bắt buộc nếu muốn tạo variant),{' '}
            <code>variant_attributes</code> (JSON), <code>variant_regular_price</code>,{' '}
            <code>variant_sale_price</code>, <code>variant_stock</code>. Một dòng = một sản phẩm
            với một biến thể mặc định; sản phẩm nhiều biến thể vẫn cần thêm thủ công sau import.
          </p>
          <p>
            Tối đa 500 dòng / lần import. Nếu file lớn hơn, hãy chia nhỏ. Upsert theo{' '}
            <code>slug</code> (sản phẩm) và <code>variant_sku</code> (biến thể): chạy lại file sẽ
            cập nhật, không tạo trùng.
          </p>
        </div>
      </details>

      <label className="block text-(length:--text-sm) font-medium text-fg" htmlFor="csv">
        Dán CSV (có dòng tiêu đề)
      </label>
      <textarea
        id="csv"
        name="csv"
        rows={12}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        placeholder={SAMPLE}
        className="w-full rounded-(--radius-md) border border-border bg-bg-primary px-3 py-2 font-mono text-(length:--text-xs) text-fg"
        spellCheck={false}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending ? 'Đang nhập…' : 'Import'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            setCsv(SAMPLE)
            setError(null)
            setSummary(null)
          }}
        >
          Điền mẫu
        </Button>
      </div>

      {error ? (
        <p className="rounded-(--radius-md) border border-danger/40 bg-danger/10 px-3 py-2 text-(length:--text-sm) text-danger">
          {error}
        </p>
      ) : null}

      {summary ? <ImportSummaryView summary={summary} /> : null}
    </div>
  )
}

function ImportSummaryView({ summary }: { summary: ProductImportSummary }) {
  const ok = summary.rejected.length === 0
  return (
    <div
      className={`space-y-3 rounded-(--radius-md) border px-4 py-3 text-(length:--text-sm) ${
        ok ? 'border-success/40 bg-success/10 text-success' : 'border-warning/40 bg-warning/10 text-warning'
      }`}
    >
      <p>
        Tổng {summary.total} dòng · tạo mới {summary.inserted} · cập nhật {summary.updated} · biến thể{' '}
        {summary.variantsUpserted} · bị từ chối {summary.rejected.length} · {summary.durationMs} ms
      </p>
      {summary.rejected.length > 0 ? (
        <details>
          <summary className="cursor-pointer font-medium">Xem lý do từ chối</summary>
          <ul className="ml-5 mt-2 list-disc space-y-0.5 text-(length:--text-xs) text-fg">
            {summary.rejected.slice(0, 50).map((r) => (
              <li key={`${r.row}-${r.reason}`}>
                Dòng {r.row}: {r.reason}
              </li>
            ))}
            {summary.rejected.length > 50 ? (
              <li>… và {summary.rejected.length - 50} lỗi khác</li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </div>
  )
}
