import { ProductGridSkeleton } from '@/components/ui/loading-skeleton'

export default function Loading() {
  return (
    <section aria-label="Đang tải sản phẩm" className="container-store py-8 sm:py-10">
      <ProductGridSkeleton count={12} />
    </section>
  )
}
