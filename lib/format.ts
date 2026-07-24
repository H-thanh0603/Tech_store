// Display formatters for the storefront. Prices are integer VND (the seed
// stores whole-dong numeric values), so we format with no fraction digits and
// the đ suffix used across Vietnamese retail.

const priceFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

export function formatPrice(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.max(amount, 0) : 0
  return priceFormatter.format(safe)
}
