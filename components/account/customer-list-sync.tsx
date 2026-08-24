'use client'

import { useEffect } from 'react'

import { mergeAccountLists, type StoredProductRef } from '@/lib/customer/local-lists'

export function CustomerListSync() {
  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/account/lists', { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { wishlist: StoredProductRef[]; compare: StoredProductRef[] } | null) => {
        if (data) mergeAccountLists(data)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [])
  return null
}
