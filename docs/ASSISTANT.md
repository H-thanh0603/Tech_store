# Shopping Assistant

TypeScript-native port of the shopping agent from
[anthropics/commerce-agents](https://github.com/anthropics/commerce-agents)
(Messages-API path, full flow scope). No Python sidecar: the turn loop runs in
`lib/assistant/*` on Vercel/Next, backed by the store's own Supabase systems.

## Scope

| ON                                                                                                                                                                          | OFF                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `search_products` — catalog search (từ khóa, category, brand, trần giá)                                                                                                     | Streaming token-level (SSE text deltas đã có), input ảnh (`enableImageInput`, mặc định OFF)         |
| `get_product_details` — biến thể, thông số, ảnh                                                                                                                             | Order history theo account (guest chỉ tra cứu theo SĐT của chính mình)                              |
| `compare_products` — so sánh 2–4 món cạnh nhau                                                                                                                              | Xem thêm: skills (`skills/*`), plugin (`plugins/commerce-builder/`), docs (`docs/commerce-agents/`) |
| `create_shopping_plan` — chốt danh sách + tổng tiền theo ngân sách                                                                                                          |                                                                                                     |
| Cart (`get_cart`, `add/update/remove`, `start_checkout`) — chung giỏ guest với website, gates provenance + số lượng 1–10, checkout chỉ trả link /checkout cho host hoàn tất |                                                                                                     |
| `get_fulfillment_options` — phí ship live + cửa hàng pickup                                                                                                                 | Streaming token-level, input ảnh (`enableImageInput`, mặc định OFF)                                 |
| `track_order` — mã đơn + SĐT, read-only, không mint token                                                                                                                   |                                                                                                     |
| `get_order_history` — 5 đơn gần nhất theo SĐT (không chi tiết thanh toán)                                                                                                   |                                                                                                     |
| `search_policies` — passages tĩnh từ trang pháp lý                                                                                                                          |                                                                                                     |
| Memory — sở thích (ngân sách, nhu cầu, thương hiệu) theo session; rule-based mặc định, model-driven (`update_memory` sau lượt) khi `ASSISTANT_MEMORY=model`; không lưu SĐT  |                                                                                                     |
| `present_suggestions` — chips kết thúc lượt                                                                                                                                 |                                                                                                     |
| Runtimes — Messages API (web), SDK consoles (`scripts/commerce-sdk/`), MCP servers (`scripts/mcp/`) + manifests (`managed-agents/`, deploy qua `npm run agent:deploy`)      |                                                                                                     |

## Setup

 1. Chọn provider: `ASSISTANT_PROVIDER=anthropic` (mặc định), `deepseek`, `openrouter`, hoặc `tokenrouter`.
  - `tokenrouter` là slot gateway OpenAI-compatible chung: trỏ `TOKENROUTER_BASE_URL` về gateway bất kỳ (9router local, LiteLLM, Ollama…).
  - Tốc độ: model reasoning free (nex-n2.5-pro…) đốt ~30s chain-of-thought trước chunk đầu — đo thật first-chunk 30s → 1.6s khi tắt. `ASSISTANT_REASONING=0` tắt reasoning ẩn (tool-call giữ nguyên); `ASSISTANT_MAX_TOKENS` giữ 1024, tăng trần không làm nhanh hơn.
2. Chọn provider rồi copy template credentials riêng sang `.env.assistant` (file này
   được git-ignore, không bao giờ commit key thật):
   `cp .env.assistant.example .env.assistant`, rồi điền key + model. `.env.local`
   chỉ giữ hạ tầng (Supabase, VNPay, Resend…); `.env.assistant` quyết
   định mọi thứ LLM + Jev.
   - Anthropic: `ANTHROPIC_API_KEY=...` (https://console.anthropic.com → API Keys)
   - DeepSeek: `DEEPSEEK_API_KEY=...` (https://platform.deepseek.com → API Keys)
   - OpenRouter: `OPENROUTER_API_KEY=...` (https://openrouter.ai → Keys) + `ASSISTANT_MODEL=...` (ví dụ `anthropic/claude-haiku-4-5`; model reasoning/R1 bị chặn vì tool-calling không ổn định)
   - TokenRouter: `TOKENROUTER_API_KEY=...` (https://www.tokenrouter.io → Keys) + `ASSISTANT_MODEL=...` (ví dụ `z-ai/glm-5.3-free`; GLM đôi khi trả tool-call dạng pseudo-XML trong text — translator tự bóc tách, không leak markup ra UI)
    - Jev decision layer (typed scope triage + product re-rank, **fail-open**): `lib/assistant/jev.ts`.
      - Key: `JEV_API_KEY` (Vercel AI Gateway → API Keys), hoặc tái dùng `OPENROUTER_API_KEY` / `TOKENROUTER_API_KEY`.
      - 2 transport, cùng contract `{choice, confidence}`:
        - Vercel AI Gateway: `JEV_BASE_URL=https://ai-gateway.vercel.sh/v1` + `JEV_MODEL=typesafe-ai/jev` — model Jev thật qua native Evaluation API (`/v1/evaluate`: choice/score, không scrape JSON).
        - Chat gateway bất kỳ (`JEV_API=chat` hoặc model không phải `typesafe-ai/`): OpenRouter cloud (`typesafe/jev-latest`) hoặc gateway local (9router + model tool-capable, prompt ép JSON-only).
      - Tự chọn theo `JEV_MODEL`/`JEV_BASE_URL`; `JEV_API=chat|evaluate` ép tay.
      - Không key / gateway chết / JSON hỏng → rớt về scope keyword + thứ tự DB, chat không gãy. Tinh chỉnh: `JEV_THRESHOLD` (0.7), `JEV_TIMEOUT_MS` (3500), `JEV_MAX_TOKENS` (512 — chỉ áp dụng chat path), `JEV_ENABLED=0` để tắt.
      - Verify live: `JEV_LIVE_PROBE=1 JEV_API_KEY=... JEV_BASE_URL=... npx vitest run tests/assistant/jev-live.test.ts`
    - Tool-filter layer (shopping + merchant, **fail-open**): `lib/assistant/tool-filter.ts`.
      - Mỗi turn chỉ nạp bucket tool cần thiết (shopping: catalog/cart/order/policy/fulfillment; merchant: metrics/inventory/listing/campaign) thay vì full schema.
      - Thứ tự: keyword rõ → subset cứng (miễn phí) → follow-up gray kế thừa bucket turn trước (miễn phí) → Jev chọn bucket → full toolset khi thiếu tự tin / lỗi.
      - Jev chỉ chọn *nhóm tool*, giá/đơn/chính sách vẫn từ tool (grounding giữ nguyên). Rollback: `JEV_TOOL_FILTER=0`.
      - Đo lường: mỗi `TurnResult` có `toolFilter` (`source`, `buckets`, `sent`, `full`); route trả về field `tool_filter`.
3. Restart dev server. Trong log khởi động sẽ thấy dòng
   `- Assistant env: .env.assistant (N keys)` — nghĩa là loader (`next.config.ts`
   → `lib/env/assistant-env.ts`) đã nạp file và **thắng** `.env.local`. Chưa có key
   → widget vẫn hiện nhưng trả lời \"chưa được cấu hình\" (xem `DISABLED_REPLY`).
4. Optional: `ASSISTANT_MODEL=`, `ASSISTANT_MAX_TOKENS=`.

### File credentials riêng (`.env.assistant`) — loader + precedence

Nguồn dữ liệu credential của LLM + Jev nằm trong `.env.assistant` (template
`.env.assistant.example`, đã nằm trong `.gitignore`). Loader nhẹ
`lib/env/assistant-env.ts` (`loadAssistantEnv()`) **parse dotenv thủ công**
(không phụ thuộc `dotenv`, không ép throw) và được gọi ở 3 chỗ:

- `next.config.ts` — trước khi build config, nên cả dev/server runtime thừa nhận
  process.env (và Turbopack child `next-server` thừa nhận env từ parent).
- `lib/assistant/config.ts` — bất kỳ server entry point nào khác (scripts tương
  lai).
- `tests/setup.ts` — để vitest (không tự động load dotenv nào) thấy file.

**Thứ tự ưu tiên mặc định: file thắng.** Một key trong `.env.assistant` thay thế
giá trị từ `.env` / `.env.local` / shell — sửa một file là đủ. Để chuyển sang
nuyền "process thắng" trên CI/Vercel (nơi file thường vắng): dùng biến
`ASSISTANT_ENV_PRECEDENCE=process`. Chuyển provider: comment block hiện tại trong
`.env.assistant`, mở block provider mới. Trống `JEV_API_KEY` → Jev tự rút
`OPENROUTER_API_KEY` rồi `TOKENROUTER_API_KEY`.

**Fail-open:** thiếu file / đọc lỗi / giá trị rỗng → loader bỏ qua, app dùng mặc
định và widget vẫn trả lời \"chưa được cấu hình\" thay vì crash.

**Test:** `npx vitest run tests/lib/assistant-env.test.ts` (loader + parser);
`JEV_LIVE_PROBE=1 npx vitest run tests/assistant/jev-live.test.ts` gọi thật gateway
được cấu hình (2 test xanh khi gateway chạy).

DeepSeek, OpenRouter và TokenRouter chạy qua endpoint OpenAI-compatible (`/chat/completions`), được dịch
hai chiều trong `lib/assistant/providers.ts` nên vòng lặp turn không đổi —
tool contracts, fencing và grounding giữ nguyên. Guard reasoner áp dụng cho cả
hai provider dịch (model reasoning/R1 bị từ chối với thông báo rõ ràng).

## Safety (port từ `docs/safety.md` của blueprint)

- **Abuse layer** (trước mọi model call, không tốn budget): IP bị ban → 403 (`abuse_bans`); phát hiện jailbreak (`lib/assistant/jailbreak.ts`: override EN/VI, moi system prompt/API key, giả mạo thẻ `<storefront_data>`) → chặn + ghi `security_events`, tái phạm ≥3/24h ban 1h, ≥6 ban 24h; câu ngoài lề (`lib/assistant/scope.ts`) → từ chối cứng kèm chip gợi ý. Câu mơ hồ/gray vẫn chạy mềm như cũ.
- **Fencing** (`lib/assistant/fencing.ts`): mọi kết quả tool vào model trong thẻ
  `<storefront_data>`; chỉ thị bên trong là dữ liệu để báo cáo, không làm theo.
- **Grounding**: khẳng định về sản phẩm/giá/tồn kho/chính sách/đơn hàng phải từ
  kết quả tool trong cuộc trò chuyện; câu hỏi chính sách force `search_policies`
  ngay vòng đầu (`wantsPolicyGrounding`).
- **Provenance-lite**: chi tiết sản phẩm resolve qua slug hoặc id do search trả về.
- **Writes có gate**: cart tools chỉ dùng variant_id do tool trả về trong cuộc
  trò chuyện (provenance), số lượng 1–10 trong tồn kho; `start_checkout` đòi
  `confirmed=true` và chỉ trả link /checkout — model không đặt hàng hộ.
- **Memory validation**: chỉ lưu ngân sách/nhu cầu/thương hiệu; text chứa SĐT bị
  bỏ qua, facts cap 2000 ký tự, session lưu dạng SHA-256.
- **Secrets**: key Anthropic chỉ ở server (`lib/assistant/agent.ts`); model không
  bao giờ thấy key, service_role, hay token.
- **Caps**: tối đa 5 vòng tool/lượt + 1 vòng text, 10 tin nhắn/lượt, mỗi tin ≤ 1000 ký tự.
- **Trung thực catalog**: cấm bịa review, số đã bán, khan hiếm giả — cùng triết lý
  với spec TechStore (§ homepage sections).

---

# Merchant Assistant

Port of the merchant agent (reads + staged writes + campaigns + analysis +
digest). Staff-only, MFA-verified, trong `/admin/assistant` (module
`assistant`: role admin/manager).

## Scope

| ON                                                                                                                    | OFF                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `get_business_snapshot` — doanh thu/đơn 7 ngày, chờ xử lý, sắp hết, nháp                                              | SQL tự do — chỉ template allowlist (`snapshot`, `low_stock`, `open_orders`, `revenue_by_payment`, `category_mix`) |
| `get_inventory_alerts`, `get_order_issues`                                                                            | Áp dụng campaign tự động — brief duyệt xong người thực hiện tay                                                   |
| `search_listings`, `get_listing`, `get_pricing_context`                                                               | Memory extraction merchant (shopping đã có `update_memory`; merchant stateless theo ca trực)                      |
| `stage_*` — publish/draft/archive, giá %/tắt sale, đặt tồn                                                            | apply/discard cho model (không có tool)                                                                           |
| `draft_campaign_brief` / `list_campaign_briefs` — brief khuyến mãi chờ duyệt ở `/api/v1/assistant/merchant/campaigns` |                                                                                                                   |
| `run_analysis` — delegate phân tích theo template                                                                     |                                                                                                                   |
| `get_latest_digest` — bản tin sáng (cron `/api/cron/merchant-digest`, gộp trong health route)                         |                                                                                                                   |

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

## Streaming

Cả 2 chat endpoint nhận `"stream": true` → SSE (`text` deltas + `result` cuối).
Vòng lặp chung `lib/assistant/stream.ts` (Anthropic native stream, DeepSeek SSE

- ráp tool_calls); khi provider không có stream sẽ fallback 1 `create()` mỗi vòng.
  Widgets đọc bằng `readChatStream` (`lib/assistant/sse.ts`).

## Agent Activity UI + AI Activity Log (điểm 5-6)

- **Real-time Agent Activity UI**: mỗi tool call của agent được chuẩn hóa thành
  `AgentCall` (`lib/assistant/activity.ts` — nhãn tiếng Việt đọc được, chi tiết
  1 dòng đã redact SĐT/email, cap 140 ký tự), đẩy ra SSE qua event
  `{type:'activity', call}` trong `stream.ts`. Widget vẽ checklist từng bước
  (`components/assistant/agent-activity-list.tsx`) — khách thấy agent đang
  "Tìm sản phẩm trong catalog: laptop gaming" thay vì "Đang xử lý...".
- **AI Activity Log**: cùng gói AgentCall được ghi append-only vào bảng
  `agent_activity_log` (`lib/assistant/activity-log.ts`, migration
  `202609140007_agent_activity_log.sql`) — agent, session, tool, kind, detail
  (đã redact), identity hash. Fail-open như abuse layer: log lỗi không phá chat.
  Dùng cho debug, security review, CS kháng nghị và phát hiện agent hành xử
  bất thường (query theo `session_key` hoặc `agent` — đã có index theo cả hai).
- Wire format `activity` hỗ trợ cả `call` lẫn key cũ `activity` trên client
  (`readChatStream`) để tương thích ngược.

---

# Production checklist (trước khi mở assistant cho người thật)

| #   | Việc                                                                                                                                                                                                                                  | Ở đâu                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | `ASSISTANT_PROVIDER` + key tương ứng (`ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` / `TOKENROUTER_API_KEY`) vào Vercel env (Production), **không** commit                                                          | Vercel → Settings → Environment Variables |
| 2   | `ASSISTANT_STAGING_SECRET` random ≥ 32 ký tự vào Vercel env; thiếu → staging từ chối ở production                                                                                                                                     | Vercel env                                |
| 3   | Áp migrations lên DB production (`supabase db push`) + chạy pgTAP: `assistant_staged_changes.sql`, `assistant_full_scope.sql` (memory, briefs, digests), `agent_activity_log.sql` (AI Activity Log), `rate_limit.sql` (daily buckets) | Supabase                                  |
| 4   | Đặt trần chi tiêu + cảnh báo trên dashboard nhà cung cấp model (Anthropic Console / DeepSeek Platform / OpenRouter / TokenRouter) — endpoint công khai đã rate-limit 20 turns/15'/IP + daily quota nhưng trần billing là chốt cuối    | Provider dashboard                        |
| 5   | Xoay key ngay nếu từng paste vào chat/log; key cũ revoke trên dashboard                                                                                                                                                               | Provider dashboard                        |
| 6   | Kiểm tra CSP: chat chỉ gọi `same-origin` (`/api/v1/assistant/*`) — đã nằm trong `connect-src 'self'`, không cần sửa                                                                                                                   | `proxy.ts`                                |
| 7   | Smoke test production: chat thử 1 câu catalog + merchant stage 1 change lên staging (chưa Duyệt), rồi discard                                                                                                                         | Browser                                   |

## Mở rộng

- Thêm passage chính sách: sửa `lib/assistant/policies.ts` + giữ trang nguồn đồng bộ.
- Memory shopping: rule-based mặc định; bật `ASSISTANT_MEMORY=model` để trích
  xuất bằng model sau mỗi lượt (`updateMemoryWithModel` — 1 call, transcript
  lọc SĐT, JSON qua validation không PII + cap 2000 ký tự).
- Merchant agent: campaigns briefs đã có (advisory); muốn tự tạo coupon thì thêm
  tool apply ký HMAC theo mẫu staged changes.

## Ngưỡng tốt nghiệp translator

`lib/assistant/providers.ts` là translator mỏng cố ý (dispatcher tool đọc +
ghi có gate, không ảnh, không billing). Khi chạm một trong các ngưỡng sau,
migrate sang **Vercel AI SDK** (`ai` package — TS-native, có người maintain:
multi-provider, retry, usage) thay vì phình translator:

- tool calls song song hoặc multi-step phụ thuộc lẫn nhau qua nhiều vòng,
- input ảnh/file, streaming token-level, billing theo usage,
- model reasoning (`deepseek-reasoner` và họ hàng — hiện bị chặn cứng vì
  `reasoning_content` + tool-calling không ổn định).

Không dùng LiteLLM proxy: nó là Python sidecar, mâu thuẫn với kiến trúc
Next.js thuần của dự án và Vercel Hobby không host được.
