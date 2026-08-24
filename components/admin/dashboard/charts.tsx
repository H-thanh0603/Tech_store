'use client'

import type { ReactNode } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatPrice } from '@/lib/format'
import type {
  FunnelStageRow,
  OrdersByStatusRow,
  RevenueByCategoryRow,
  RevenueDayRow,
  TopProductRow,
} from '@/lib/admin/types'

const FUNNEL_LABELS: Record<FunnelStageRow['stage'], string> = {
  search: 'Tìm kiếm',
  product: 'Xem sản phẩm',
  cart: 'Thêm giỏ',
  checkout: 'Checkout',
  order: 'Đặt hàng',
}

export function SalesFunnel({ data }: { data: FunnelStageRow[] }) {
  return (
    <ol className="grid gap-2 md:grid-cols-5" aria-label="Phễu bán hàng">
      {data.map((row, index) => {
        const previous = data[index - 1]?.count
        const conversion = index === 0 ? null : previous ? Math.round((row.count / previous) * 100) : 0
        return (
          <li key={row.stage} className="rounded-(--radius-md) border border-border bg-bg-secondary/40 p-3">
            <p className="text-(length:--text-xs) font-semibold uppercase tracking-wide text-fg-muted">
              {index + 1}. {FUNNEL_LABELS[row.stage]}
            </p>
            <p className="mt-1 text-(length:--text-2xl) font-semibold tabular-nums text-fg">
              {row.count}
            </p>
            {conversion === null ? (
              <p className="text-(length:--text-xs) text-fg-subtle">phiên bắt đầu</p>
            ) : (
              <p className="text-(length:--text-xs) text-fg-subtle">{conversion}% từ bước trước</p>
            )}
          </li>
        )
      })}
    </ol>
  )
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#c4a35a',
  awaiting_payment: '#c4a35a',
  confirmed: '#2f8fad',
  packing: '#2f8fad',
  shipping: '#2f8fad',
  completed: '#2f9b6a',
  cancelled: '#c44b3c',
  expired: '#c44b3c',
}

const FALLBACK = '#8a93a3'

function ChartShell({
  title,
  summary,
  children,
  height = 260,
}: {
  title: string
  summary: string
  children: ReactNode
  height?: number
}) {
  return (
    <div>
      <p className="sr-only">
        {title}. {summary}
      </p>
      <div style={{ width: '100%', height }} className="min-h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export function RevenueTrendChart({ data }: { data: RevenueDayRow[] }) {
  const total = data.reduce((sum, row) => sum + row.revenue, 0)
  const summary = `Tổng doanh thu ${formatPrice(total)} trên ${data.length} ngày.`

  return (
    <ChartShell title="Doanh thu theo ngày" summary={summary}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => v.slice(5)}
          minTickGap={24}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={56}
          tickFormatter={(v: number) =>
            v >= 1_000_000 ? `${Math.round(v / 1_000_000)}tr` : `${Math.round(v / 1000)}k`
          }
        />
        <Tooltip
          formatter={(value) => formatPrice(Number(value ?? 0))}
          labelFormatter={(label) => `Ngày ${label}`}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Doanh thu"
          stroke="var(--color-accent)"
          strokeWidth={2}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartShell>
  )
}

export function OrdersStatusChart({ data }: { data: OrdersByStatusRow[] }) {
  const total = data.reduce((sum, row) => sum + row.count, 0)
  const summary = data.map((row) => `${row.status}: ${row.count}`).join('. ')

  return (
    <ChartShell title="Đơn theo trạng thái" summary={`Tổng ${total} đơn. ${summary}`}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="status" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
        <Tooltip />
        <Bar dataKey="count" name="Số đơn" radius={[6, 6, 0, 0]} isAnimationActive={false}>
          {data.map((row) => (
            <Cell key={row.status} fill={STATUS_COLORS[row.status] ?? FALLBACK} />
          ))}
        </Bar>
      </BarChart>
    </ChartShell>
  )
}

export function CategoryRevenueChart({ data }: { data: RevenueByCategoryRow[] }) {
  const chartData = [...data].slice(0, 8).reverse()
  const summary = chartData
    .map((row) => `${row.categoryName}: ${formatPrice(row.revenue)}`)
    .join('. ')

  return (
    <ChartShell title="Doanh thu theo danh mục" summary={summary} height={Math.max(220, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) =>
            v >= 1_000_000 ? `${Math.round(v / 1_000_000)}tr` : `${Math.round(v / 1000)}k`
          }
        />
        <YAxis type="category" dataKey="categoryName" width={100} tick={{ fontSize: 11 }} />
        <Tooltip formatter={(value) => formatPrice(Number(value ?? 0))} />
        <Bar dataKey="revenue" name="Doanh thu" fill="var(--color-accent)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartShell>
  )
}

export function TopProductsChart({
  data,
  metric,
}: {
  data: TopProductRow[]
  metric: 'revenue' | 'quantity'
}) {
  const chartData = [...data].reverse()
  const key = metric === 'quantity' ? 'quantity' : 'revenue'
  const summary = chartData
    .map((row) =>
      metric === 'quantity'
        ? `${row.productName}: ${row.quantity}`
        : `${row.productName}: ${formatPrice(row.revenue)}`,
    )
    .join('. ')

  return (
    <ChartShell title="Sản phẩm bán chạy" summary={summary} height={Math.max(220, chartData.length * 36)}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="productName"
          width={120}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 16)}…` : v)}
        />
        <Tooltip
          formatter={(value) =>
            metric === 'quantity' ? Number(value ?? 0) : formatPrice(Number(value ?? 0))
          }
        />
        <Bar dataKey={key} name={metric === 'quantity' ? 'Số lượng' : 'Doanh thu'} fill="var(--color-warm)" radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ChartShell>
  )
}
