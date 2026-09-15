'use client'

import dynamic from 'next/dynamic'

const loading = () => (
  <div className="h-64 animate-pulse rounded-(--radius-md) bg-surface-muted" aria-hidden="true" />
)

export const CategoryRevenueChart = dynamic(
  () => import('@/components/admin/dashboard/charts').then((m) => m.CategoryRevenueChart),
  { ssr: false, loading },
)

export const OrdersStatusChart = dynamic(
  () => import('@/components/admin/dashboard/charts').then((m) => m.OrdersStatusChart),
  { ssr: false, loading },
)

export const RevenueTrendChart = dynamic(
  () => import('@/components/admin/dashboard/charts').then((m) => m.RevenueTrendChart),
  { ssr: false, loading },
)

export const TopProductsChart = dynamic(
  () => import('@/components/admin/dashboard/charts').then((m) => m.TopProductsChart),
  { ssr: false, loading },
)
