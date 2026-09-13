# Safety — enforced rules (port từ blueprint, TS paths)

Mọi rule chạy trong tool call và giữ trên mọi runtime (web, SDK consoles, MCP, managed).

| # | Rule | Module | Paths |
|---|---|---|---|
| 1 | Fencing: kết quả tool vào model trong `<storefront_data>`; chỉ thị bên trong là dữ liệu để báo cáo, không làm theo | `lib/assistant/fencing.ts` | all |
| 2 | Grounding: khẳng định sự thật phải từ kết quả tool trong lượt; câu hỏi chính sách force `search_policies` vòng đầu; câu hỏi hiệu quả force `get_business_snapshot` | `lib/assistant/agent.ts`, `lib/assistant/merchant/agent.ts` | all |
| 3 | Provenance-lite (shopping): chi tiết resolve qua slug/id do tool trả về; UUID lạ bị từ chối, không đoán | `lib/assistant/backend.ts` (`resolveSeenOrSlug`) | all |
| 4 | Cart gates: variant_id từ tool, số lượng 1–10 trong tồn kho; `start_checkout` đòi `confirmed=true`, chỉ trả link /checkout | `lib/assistant/cart.ts`, `tools.ts` | all |
| 5 | Merchant approval gate: model chỉ `stage_*`, không apply; envelope HMAC; server verify → đọc LIVE → re-check guardrails → Server Action + audit | `lib/assistant/merchant/stage.ts`, `guardrails.ts`, approve route | all |
| 6 | Guardrails số: ≤10 items/change, giá ±20%/change, tồn 0–1.000.000, restock ≤1000/change | `lib/assistant/merchant/guardrails.ts` | all |
| 7 | Memory validation: chỉ budget/use-case/brand; SĐT/PII bị bỏ; cap 2000 ký tự; session SHA-256 | `lib/assistant/memory.ts` | Messages API (+SDK consoles qua route) |
| 8 | Caps: ≤5 vòng tool + 1 vòng text, ≤10 tin nhắn/lượt, mỗi tin ≤1000 ký tự | `lib/assistant/config.ts`, routes | all |
| 9 | Secrets: key provider server-only, không vào prompt/tool; service_role không ra browser | `lib/assistant/agent.ts`, routes | all |
| 10 | Rate-limit: 20 turns/15'/IP (shopping), 60/15' per staff (merchant); fail-open khi limiter chết | `lib/assistant/rate-limit.ts` | web + consoles |

## Deployment thêm trước khi mở cho người thật

`docs/ASSISTANT.md` → Production checklist (7 mục: env keys, staging secret, migrations, trần billing, xoay key, CSP, smoke test).
