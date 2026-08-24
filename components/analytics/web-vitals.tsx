'use client'

import { useReportWebVitals } from 'next/web-vitals'

import { track } from '@/lib/analytics'

export function WebVitals() {
  useReportWebVitals((metric) => {
    track('web_vital', {
      id: metric.id,
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      navigationType: metric.navigationType,
    })
  })
  return null
}
