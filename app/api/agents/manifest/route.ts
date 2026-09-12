import { NextResponse } from 'next/server'

import { getCatalogFacets } from '@/lib/catalog/queries'
import { searchPolicies } from '@/lib/assistant/policies'
import { getSiteUrl } from '@/lib/site'

/**
 * Self-describing tool manifest for the public agent layer
 * (docs/AGENT_LAYER.md): an external AI agent reads this once and learns what
 * the store exposes and how to call it, instead of scraping the human UI.
 * Read-only by design — checkout and payment stay human-controlled on the
 * website.
 */

const VERSION = '2026-09-12'

export async function GET() {
  const base = getSiteUrl()

  // Facets power the enum hints below; empty lists are fine (missing grants,
  // local dev) — the manifest still describes the interface.
  let categories: Array<{ name: string; slug: string }> = []
  let brands: Array<{ name: string; slug: string }> = []
  try {
    const facets = await getCatalogFacets()
    categories = facets.categories
    brands = facets.brands
  } catch {
    // cached fetcher already fail-opens to empty lists
  }

  const policyTopics = [...new Set(searchPolicies('', 99).map((p) => p.title))].sort()

  return NextResponse.json(
    {
      name: 'TechStore',
      version: VERSION,
      description:
        'Cửa hàng công nghệ trực tuyến tại Việt Nam. Lớp API công khai, chỉ đọc, cho AI agent: tìm kiếm sản phẩm, chi tiết sản phẩm, tra cứu đơn hàng, chính sách cửa hàng.',
      website: base,
      humanUrls: {
        products: `${base}/products`,
        product: `${base}/products/{slug}`,
        trackOrder: `${base}/track-order`,
        returnPolicy: `${base}/return-policy`,
        terms: `${base}/terms`,
        privacy: `${base}/privacy`,
      },
      capabilities: {
        searchProducts: {
          description:
            'Tìm sản phẩm theo từ khóa (tiếng Việt), lọc theo danh mục, thương hiệu, mục đích sử dụng, khoảng giá, tồn kho; sắp xếp theo giá/mới nhất.',
          endpoint: `${base}/api/v1/agents/products`,
          method: 'GET',
          parameters: {
            q: 'từ khóa tìm kiếm, ví dụ "laptop học tập dưới 20 triệu"',
            category: `slug danh mục${categories.length ? `: ${categories.map((c) => c.slug).join(', ')}` : ''}`,
            brand: `slug thương hiệu${brands.length ? `: ${brands.map((b) => b.slug).join(', ')}` : ''}`,
            useCase: 'slug mục đích sử dụng (nếu có)',
            minPrice: 'giá sàn VND',
            maxPrice: 'giá trần VND',
            inStock: '1 = chỉ hàng còn',
            sort: 'relevance | price-asc | price-desc | newest',
            page: 'số trang, tối đa 10',
          },
        },
        getProduct: {
          description: 'Xem chi tiết một sản phẩm: biến thể (SKU, giá, tồn kho), thông số, ảnh.',
          endpoint: `${base}/api/v1/agents/products/{slug}`,
          method: 'GET',
          parameters: { slug: 'slug sản phẩm do searchProducts trả về' },
        },
        compareProducts: {
          description:
            'So sánh 2–4 sản phẩm cạnh nhau: chi tiết từng món (giá theo biến thể, tồn kho, thông số) kèm tóm tắt món rẻ nhất và các món còn hàng.',
          endpoint: `${base}/api/v1/agents/compare`,
          method: 'GET',
          parameters: { slugs: 'danh sách 2–4 slug, cách nhau bằng dấu phẩy' },
        },
        trackOrder: {
          description:
            'Tra cứu trạng thái đơn hàng. Cần mã đơn + số điện thoại đặt hàng — không bao giờ đoán số điện thoại.',
          endpoint: `${base}/api/v1/agents/orders`,
          method: 'GET',
          parameters: { order_code: 'mã đơn, ví dụ TS-ABC123', phone: 'số điện thoại dùng khi đặt hàng' },
        },
        getPolicy: {
          description:
            'Truy vấn chính sách cửa hàng đã công bố (đổi trả, hoàn tiền, bảo hành, giao hàng, thanh toán).',
          endpoint: `${base}/api/v1/agents/policies`,
          method: 'GET',
          parameters: { q: 'câu hỏi về chính sách' },
          topics: policyTopics,
        },
        stageOrderIntent: {
          description:
            'Chuẩn bị đơn hộ khách (scope cart:write): gửi slug + SKU + số lượng, nhận approvalUrl để KHÁCH TỰ MỞ và duyệt. Agent không bao giờ tạo đơn thật hay trừ tiền — đơn và thanh toán chỉ xảy ra khi con người bấm duyệt rồi checkout trên website. Tồn kho kiểm tra lại lúc duyệt.',
          endpoint: `${base}/api/v1/agents/intents`,
          method: 'POST',
          auth: 'Authorization: Bearer tsa_… (token do chủ shop cấp, xem /llms.txt)',
          parameters: { items: 'mảng 1–10 món {slug, sku, quantity 1–99}' },
        },
      },
      notCapabilities: [
        'Tạo đơn thật, thêm vào giỏ của khách hay thanh toán qua API — agent chỉ stage intent, khách tự duyệt và trả tiền trên website.',
        'Tra cứu phí vận chuyển theo thời gian thực — hiển thị ở bước thanh toán.',
      ],
      rateLimits: {
        catalog: '60 yêu cầu / 15 phút / IP',
        orders: '20 yêu cầu / 15 phút / IP',
      },
      attribution: {
        note:
          'Dữ liệu trả về là catalog công khai của TechStore. Khi trích dẫn, ghi nguồn và dẫn link về trang sản phẩm.',
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=300' } },
  )
}
