import { getCatalogFacets } from '@/lib/catalog/queries'
import { searchPolicies } from '@/lib/assistant/policies'
import { getSiteUrl } from '@/lib/site'

/**
 * `/llms.txt` — the agent-layer entry point (https://llmstxt.org convention).
 * Machine-readable site overview in markdown so AI agents learn what
 * TechStore offers and which structured endpoints to call, instead of
 * scraping the human UI. See docs/AGENT_LAYER.md.
 */
export async function GET() {
  const base = getSiteUrl()

  let categories: Array<{ name: string; slug: string }> = []
  let brands: Array<{ name: string; slug: string }> = []
  try {
    const facets = await getCatalogFacets()
    categories = facets.categories
    brands = facets.brands
  } catch {
    // fail-open: the file still lists the endpoints
  }
  const policyTopics = [...new Set(searchPolicies('', 99).map((p) => p.title))].sort()
  const categoryList = categories.map((c) => `- ${c.name} (\`category=${c.slug}\`)`).join('\n')
  const brandList = brands.map((b) => `- ${b.name} (\`brand=${b.slug}\`)`).join('\n')
  const policyList = policyTopics.map((t) => `- ${t}`).join('\n')

  const body = `# TechStore

> Cửa hàng công nghệ trực tuyến tại Việt Nam: laptop, điện thoại, PC, màn hình, âm thanh, đồng hồ, phụ kiện và hàng cũ. Lớp dữ liệu công khai dưới đây dành cho AI agent — chỉ đọc, không đặt hàng hộ.

## API

- [Tool manifest](${base}/api/v1/agents/manifest): manifest JSON tự mô tả cho agent (endpoints, tham số, giới hạn).
- [Tìm kiếm sản phẩm](${base}/api/v1/agents/products?q=): GET, tham số \`q\`, \`category\`, \`brand\`, \`useCase\`, \`minPrice\`, \`maxPrice\`, \`inStock=1\`, \`sort\`, \`page\`.
- [Chi tiết sản phẩm](${base}/api/v1/agents/products/{slug}): GET — biến thể (SKU, giá VND, tồn kho), thông số, ảnh.
- [Tra cứu đơn hàng](${base}/api/v1/agents/orders?order_code=&phone=): GET — cần mã đơn + số điện thoại đặt hàng, không bao giờ đoán số điện thoại.
- [Chính sách](${base}/api/v1/agents/policies?q=): GET — đổi trả, hoàn tiền, bảo hành, giao hàng, thanh toán.

## Danh mục

${categoryList || '- (trống)'}

## Thương hiệu

${brandList || '- (trống)'}

## Chính sách

${policyList || '- (trống)'}

## Quy tắc cho agent

- Chỉ đọc: không có endpoint đặt hàng, thêm giỏ hay thanh toán — hướng khách hoàn tất trên website.
- Mọi khẳng định về giá, tồn kho, chính sách, đơn hàng phải lấy từ các endpoint trên; không tự bịa thông tin.
- Tôn trọng giới hạn: 60 yêu cầu/15 phút/IP cho catalog, 20/15 phút/IP cho tra cứu đơn.
- Khi trích dẫn, ghi nguồn TechStore và dẫn link về trang sản phẩm tương ứng.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
