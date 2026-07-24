export function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-border bg-surface-muted">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-6 text-(length:--text-sm) text-fg-muted">
        <p className="font-medium text-fg">TechStore</p>
        <p>Cửa hàng công nghệ chọn lọc.</p>
        <p>© {year} TechStore. Dữ liệu demo cho môi trường phát triển.</p>
      </div>
    </footer>
  )
}
