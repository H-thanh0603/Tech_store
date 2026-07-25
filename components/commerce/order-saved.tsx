'use client'

import { useEffect } from 'react'

import { useOptionalToast } from '@/components/ui/toast'
import { pushSavedOrder } from '@/lib/customer/profile'

export function OrderSavedEffect({
  orderCode,
  total,
}: {
  orderCode: string
  total?: number
}) {
  const { toast } = useOptionalToast()

  useEffect(() => {
    pushSavedOrder(orderCode, total)
    toast({
      title: 'Đặt hàng thành công',
      description: `Mã đơn ${orderCode} đã được lưu trên thiết bị.`,
      tone: 'success',
      durationMs: 5000,
    })
    // once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderCode])

  return null
}
