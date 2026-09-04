# Shopping Assistant (pilot)

TypeScript-native port of the shopping agent from
[anthropics/commerce-agents](https://github.com/anthropics/commerce-agents)
(Messages-API path, pilot subset). No Python sidecar: the turn loop runs in
`lib/assistant/*` on Vercel/Next, backed by the store's own Supabase systems.

## Scope (pilot)

| ON | OFF (stubbed by config) |
|---|---|
| `search_products` — catalog search (từ khóa, category, brand, trần giá) | Cart writes — widget hướng dẫn dùng nút Thêm vào giỏ / trang web |
| `get_product_details` — biến thể, thông số, ảnh | Order history — guest không có tài khoản |
| `track_order` — mã đơn + SĐT, read-only, không mint token | Fulfillment realtime — phí ship xem ở bước thanh toán |
| `search_policies` — passages tĩnh từ trang pháp lý | Memory extraction — server stateless |
| `present_suggestions` — chips kết thúc lượt | Streaming — JSON một lượt (có thể thêm SSE sau) |

## Setup

1. Chọn provider: `ASSISTANT_PROVIDER=anthropic` (mặc định) hoặc `deepseek`.
2. Thêm key tương ứng vào `.env.local` (server-only, không bao giờ `NEXT_PUBLIC_*`):
   - Anthropic: `ANTHROPIC_API_KEY=...` (https://console.anthropic.com → API Keys)
   - DeepSeek: `DEEPSEEK_API_KEY=...` (https://platform.deepseek.com → API Keys)
3. Restart dev server. Chưa có key → widget vẫn hiện nhưng trả lời "chưa được cấu hình" (xem `DISABLED_REPLY`).
4. Optional: `ASSISTANT_MODEL=` (mặc định `claude-haiku-4-5` / `deepseek-chat`).

DeepSeek chạy qua endpoint OpenAI-compatible (`/chat/completions`), được dịch
hai chiều trong `lib/assistant/providers.ts` nên vòng lặp turn không đổi —
tool contracts, fencing và grounding giữ nguyên.

## Safety (port từ `docs/safety.md` của blueprint)

- **Fencing** (`lib/assistant/fencing.ts`): mọi kết quả tool vào model trong thẻ
  `<storefront_data>`; chỉ thị bên trong là dữ liệu để báo cáo, không làm theo.
- **Grounding**: khẳng định về sản phẩm/giá/tồn kho/chính sách/đơn hàng phải từ
  kết quả tool trong cuộc trò chuyện; câu hỏi chính sách force `search_policies`
  ngay vòng đầu (`wantsPolicyGrounding`).
- **Provenance-lite**: chi tiết sản phẩm resolve qua slug hoặc id do search trả về.
- **No writes**: pilot không có tool ghi nào; `track_order` chỉ đọc có xác thực
  SĐT (không tạo access token như RPC `order_track`).
- **Secrets**: key Anthropic chỉ ở server (`lib/assistant/agent.ts`); model không
  bao giờ thấy key, service_role, hay token.
- **Caps**: tối đa 5 vòng tool/lượt + 1 vòng text, 10 tin nhắn/lượt, mỗi tin ≤ 1000 ký tự.
- **Trung thực catalog**: cấm bịa review, số đã bán, khan hiếm giả — cùng triết lý
  với spec TechStore (§ homepage sections).

---

# Merchant Assistant (pilot)

Port of the merchant agent (propose → preview → approve → apply). Staff-only,
MFA-verified, trong `/admin/assistant` (module `assistant`: role admin/manager).

## Scope (pilot)

| ON | OFF |
|---|---|
| `get_business_snapshot` — doanh thu/đơn 7 ngày, chờ xử lý, sắp hết, nháp | Campaigns — tư vấn lời, không stage |
| `get_inventory_alerts`, `get_order_issues` | SQL analysis delegate |
| `search_listings`, `get_listing`, `get_pricing_context` | Memory extraction, streaming |
| `stage_*` — publish/draft/archive, giá %/tắt sale, đặt tồn | apply/discard cho model (không có tool) |

## Staged-write contract

1. Model chỉ được gọi `stage_*` với id đã đọc trong cuộc trò chuyện; kết quả là
   **signed envelope** (HMAC-SHA256, `ASSISTANT_STAGING_SECRET`) trả về UI.
2. Người vận hành bấm **Duyệt & áp dụng** trên thẻ preview
   (`POST /api/v1/assistant/merchant/approve`, yêu cầu module `products`).
3. Server verify chữ ký → đọc lại LIVE state → check guardrails lần nữa
   (giá có thể đã đổi từ lúc stage) → chạy Server Action có sẵn
   (`bulkUpdateProducts`/`bulkAdjustPrice`/`bulkSetStock`, kèm audit log).
4. Guardrails (`lib/assistant/merchant/guardrails.ts`): tối đa 10 items/change,
   giá ±20%/change, tồn 0–1.000.000 và restock ≤ 1000/change, không target trùng,
   bỏ change (drop) là xóa ở UI — server không lưu state.

## Setup thêm

- `ASSISTANT_STAGING_SECRET=` vào `.env.local` (production bắt buộc; dev fallback
  kèm cảnh báo — approve vẫn yêu cầu staff session + re-validate nên fallback chỉ
  chống sửa lén envelope, không phải biên an toàn chính).

## Mở rộng

- Thêm passage chính sách: sửa `lib/assistant/policies.ts` + giữ trang nguồn đồng bộ.
- Bật giỏ hàng: `enableCart: true` trong `lib/assistant/config.ts`, thêm cart tools
  + provenance/quantity gates (tham khảo `gates.py` của blueprint), UI xác nhận.
- Streaming: đổi route sang SSE, giữ nguyên `runAssistantTurn` (tách event loop).
- Merchant agent: để phase sau — cần approval surface cho staged writes.

## Ngưỡng tốt nghiệp translator

`lib/assistant/providers.ts` là translator mỏng cố ý cho pilot (4 tool đọc,
dispatch tuần tự, không ảnh, không billing). Khi chạm một trong các ngưỡng sau,
migrate sang **Vercel AI SDK** (`ai` package — TS-native, có người maintain:
multi-provider, retry, usage) thay vì phình translator:

- tool calls song song hoặc multi-step phụ thuộc lẫn nhau qua nhiều vòng,
- input ảnh/file, streaming token-level, billing theo usage,
- model reasoning (`deepseek-reasoner` và họ hàng — hiện bị chặn cứng vì
  `reasoning_content` + tool-calling không ổn định).

Không dùng LiteLLM proxy: nó là Python sidecar, mâu thuẫn với kiến trúc
Next.js thuần của dự án và Vercel Hobby không host được.
