# Agent Layer — Web hai lớp cho TechStore

> "Web đang chuyển từ *information network* sang *action network* — từ nơi
> con người đọc và click sang nơi AI có thể hiểu, lập kế hoạch và hành động."
> (W3C, AC 2026)

TechStore được nâng cấp theo mô hình **hai lớp**, cùng một hệ thống:

```text
                       TECHSTORE
                           │
              ┌────────────┴────────────┐
              │                         │
          HUMAN UI                  AGENT LAYER
              │                         │
      (đã có sẵn)          (mới, tháng 9/2026)
   Trang sản phẩm đẹp          llms.txt
   Cart / checkout             tool manifest (JSON)
   AI assistant trong web      API đọc công khai /api/v1/agents/*
   Storytelling, motion        JSON-LD, sitemap
```

- **Human layer**: giữ nguyên mọi thứ — UI, cart, checkout, assistant widget.
  Con người vẫn là người mua, người thanh toán.
- **Agent layer** (mới): dữ liệu và tools **chỉ đọc** cho AI agent bên ngoài
  (ChatGPT, Gemini, browser agents...). Agent đọc cấu trúc thay vì scrape UI,
  đúng hướng "Build the web for agents" (arXiv:2506.10953) và tinh thần
  WebMCP đang chuẩn hóa ở W3C (vẫn là draft — vì vậy ta expose qua API
  versioned sẵn có, không đặt cược vào một chuẩn chưa xong).

## Endpoints

| Endpoint | Mô tả | Giới hạn (mỗi IP) |
| --- | --- | --- |
| [`/llms.txt`](/llms.txt) | Tổng quan site dạng markdown cho LLM (convention [llmstxt.org](https://llmstxt.org)) | cache 5 phút |
| `GET /api/v1/agents/manifest` | Tool manifest JSON tự mô tả: endpoints, tham số, cả `notCapabilities` | cache 5 phút |
| `GET /api/v1/agents/products` | Tìm kiếm/lọc catalog (q, category, brand, useCase, minPrice, maxPrice, inStock, sort, page) | 60 / 15 phút |
| `GET /api/v1/agents/products/{slug}` | Chi tiết sản phẩm: biến thể, thông số, ảnh | 60 / 15 phút |
| `GET /api/v1/agents/orders` | Tra cứu đơn: `order_code` + `phone` (phone-verified) | 20 / 15 phút |
| `GET /api/v1/agents/policies` | Chính sách đã công bố (đổi trả, bảo hành...) | — |

Canonical implementation nằm ở `app/api/agents/*`; các đường dẫn
`app/api/v1/agents/*` chỉ re-export, theo convention versioning của repo
(external clients pin theo v1; breaking change sẽ ra v2).

## Nguyên tắc thiết kế

1. **Chỉ đọc, không hành động thay con người.** Không có endpoint đặt hàng,
   thêm giỏ, thanh toán. Đây là ranh giới tin cậy cố ý: bài học từ WebMCP —
   cho AI quyền gọi function là mở một security boundary mới (tool spoofing,
   prompt injection, consequential actions — arXiv:2608.24017, 2511.20597).
   Hành động có hậu quả (mua hàng, trả tiền) thuộc về human-in-the-loop trên
   website.
2. **Không bịa, không leak.** API trả về đúng dữ liệu storefront render.
   Số tồn kho chính xác không expose — chỉ `inStock`/`lowStock` (ngưỡng
   "còn ≤ 5" giống UI), chống scraper đánh giá tồn kho hàng loạt. Variant id
   internal bị bỏ; agent tham chiếu sản phẩm bằng slug.
3. **Tra cứu đơn giữ đúng trust boundary cũ**: code + phone phải khớp, mints
   no token (tái dùng `trackOrder` của shopping assistant).
4. **Rate-limit per IP** qua RPC `check_rate_limit` có sẵn (fail-open khi
   limiter chết). Bucket mới `agents_catalog`, `agents_orders` được
   allowlist trong migration `202609120001_agent_rate_limit_buckets.sql`
   (RPC chặn bucket lạ ngay lần đầu — không allowlist là mọi request 429).
5. **Tự mô tả**: agent ngoài chỉ cần đọc `/llms.txt` hoặc manifest là biết
   toàn bộ interface, tham số, giới hạn và cả những gì cửa hàng **không**
   cung cấp (`notCapabilities`) — tránh agent đoán bừa.

## Áp dụng agent layer như thế nào

**AI agent bên ngoài** (ví dụ user hỏi ChatGPT "tìm laptop dưới 20 triệu ở
TechStore"):

```text
Agent đọc /llms.txt hoặc /api/v1/agents/manifest
  → GET /api/v1/agents/products?q=laptop&maxPrice=20000000
  → GET /api/v1/agents/products/{slug} cho món được chọn
  → trả lời kèm link về /products/{slug} cho khách tự đặt hàng
```

**Trợ lý TechStore trong web**: tiếp tục dùng tools server-side nội bộ
(`lib/assistant/*`) — không thay đổi. Lớp agent công khai bổ sung, không
thay thế.

## Cấu trúc code

```text
app/llms.txt/route.ts                  entry markdown cho agent
app/api/agents/
  manifest/route.ts                    tool manifest JSON
  products/route.ts                    search/lọc
  products/[slug]/route.ts             chi tiết
  orders/route.ts                      tra cứu đơn (phone-verified)
  policies/route.ts                    chính sách
app/api/v1/agents/...                  re-export versioned (external pin vào đây)
lib/agents/public-api.ts               rate-limit + IP + DTO mappers dùng chung
supabase/migrations/202609120001_agent_rate_limit_buckets.sql
supabase/tests/agent_rate_limit.sql   pgTAP
tests/api/agent-layer.test.ts          13 unit tests
```

## Khi nào mở rộng

- **WebMCP / A2A lên chuẩn thật**: bọc manifest này thành MCP server là việc
  nhỏ — interface đã sẵn; chỉ đổi lớp transport, không đổi logic đọc.
- **Write-capabilities** (add-to-cart qua agent): chỉ cân nhắc khi có
  human-approval flow tương đương checkpoint thanh toán; đến lúc đó tách
  bucket rate-limit riêng và trình duyệt review security như các nguồn W3C
  đang làm với consequential actions.
- Spatial/3D (WebXR, WebGPU): nhánh năng lực riêng, không thuộc layer này.
