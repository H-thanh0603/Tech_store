export default function HomePage() {
  return (
    <section aria-labelledby="home-heading" className="flex flex-col gap-4">
      <h1 id="home-heading" className="text-(length:--text-hero) font-semibold tracking-tight">
        TechStore
      </h1>
      <p className="max-w-prose text-(length:--text-lg) text-fg-muted">
        Cửa hàng công nghệ chọn lọc cho thiết bị cần mua ngay.
      </p>
    </section>
  )
}
