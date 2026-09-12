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

> Cửa hàng công nghệ trực tuyến tại Việt Nam: laptop, điện thoại, PC, màn hình, âm thanh, đồng hồ, phụ kiện và hàng cũ. Lớp dữ liệu công khai dưới đây dành cho AI agent — đọc tự do, hành động chỉ qua intent có người duyệt.

## API

- [Tool manifest](${base}/api/v1/agents/manifest): manifest JSON tự mô tả cho agent (endpoints, tham số, giới hạn).
- [Tìm kiếm sản phẩm](${base}/api/v1/agents/products?q=): GET, tham số \`q\`, \`category\`, \`brand\`, \`useCase\`, \`minPrice\`, \`maxPrice\`, \`inStock=1\`, \`sort\` (relevance | price-asc | price-desc | newest), \`page\`.
- [Chi tiết sản phẩm](${base}/api/v1/agents/products/{slug}): GET — biến thể (SKU, giá VND, tồn kho), thông số, ảnh.
- [So sánh sản phẩm](${base}/api/v1/agents/compare?slugs=a,b): GET — 2–4 slug, trả chi tiết từng món kèm tóm tắt món rẻ nhất + các món còn hàng; slug lạ được báo rõ, không tự bịa.
- [Tra cứu đơn hàng](${base}/api/v1/agents/orders?order_code=&phone=): GET — cần mã đơn + số điện thoại đặt hàng, không bao giờ đoán số điện thoại.
- [Chính sách](${base}/api/v1/agents/policies?q=): GET — đổi trả, hoàn tiền, bảo hành, giao hàng, thanh toán. Tóm tắt: đổi trả trong 7 ngày nếu lỗi nhà sản xuất (xem chi tiết ở endpoint), phí ship tính ở bước thanh toán theo địa chỉ, thanh toán COD / chuyển khoản / VNPay.
- [Chuẩn bị đơn hộ khách](${base}/api/v1/agents/intents): POST, cần \`Authorization: Bearer tsa_…\` (token \`cart:write\` do chủ shop cấp riêng — không xin token trong chat). Body \`{items: [{slug, sku, quantity}]}\`. Trả về \`approvalUrl\` — KHÁCH TỰ MỞ link này để xem, duyệt, rồi thanh toán trên website.

## Danh mục

${categoryList || '- (trống)'}

## Thương hiệu

${brandList || '- (trống)'}

## Chính sách

${policyList || '- (trống)'}

## Quy tắc cho agent

- Đọc tự do, hành động qua intent: endpoint duy nhất được ghi là intents, và nó chỉ tạo bản nháp — đơn thật + tiền chỉ xảy ra khi con người bấm duyệt rồi checkout.
- Tồn kho chưa giữ lúc tạo intent: luôn nói rõ với khách là kiểm tra lại lúc duyệt, và kiểm tra lại bằng endpoint trước khi trả lời.
- Mọi khẳng định về giá, tồn kho, chính sách, đơn hàng phải lấy từ các endpoint trên; không tự bịa thông tin.
- Tôn trọng giới hạn: 60 yêu cầu/15 phút/IP cho catalog, 20/15 phút/IP cho tra cứu đơn, 30 intent/15 phút/token.
- Khi trích dẫn, ghi nguồn TechStore và dẫn link về trang sản phẩm tương ứng.
`

  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
