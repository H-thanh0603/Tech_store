import { CouponManager } from '@/components/admin/coupon-manager'
import { ErrorState } from '@/components/admin/ui/error-state'
import { PageHeader } from '@/components/admin/ui/page-header'
import { PermissionDeniedState } from '@/components/admin/ui/permission-denied-state'
import { listAdminCoupons } from '@/lib/admin/queries'
import { isForbidden, requireAdminModule } from '@/lib/admin/require-admin'

export default async function AdminCouponsPage() {
  const access = await requireAdminModule('coupons')
  if (isForbidden(access)) return <PermissionDeniedState />

  let coupons
  let error: string | null = null
  try {
    coupons = await listAdminCoupons()
  } catch {
    error = 'Không tải được coupon.'
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Khuyến mãi"
        description="CRUD coupon. Checkout server vẫn là nguồn sự thật khi áp dụng mã."
      />
      {error ? <ErrorState message={error} /> : null}
      {!error && coupons ? <CouponManager coupons={coupons} /> : null}
    </section>
  )
}
