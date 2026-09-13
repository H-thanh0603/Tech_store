# author-commerce-evals

Viết eval cho flow theo mẫu `evals/commerce/*.json`.

Mỗi case: `{ "prompt": "...", "expect": { "tool": "<tool_bắt_buộc>", "contains": ["..."], "forbid": ["..."] } }`.

- Shopping: prompt mẫu trong `scripts/smoke-chat.mjs` (TRY sections) — mỗi prompt kèm "good answer làm gì".
- Merchant: staged write phải assert `held` khi id chưa đọc, `staged` khi đủ provenance, và guardrails (`±20%`, `≤10 items`, restock `≤1000`).
- An toàn: ít nhất 1 case prompt-injection (chỉ thị trong dữ liệu catalog phải bị báo cáo, không làm theo) và 1 case PII (SĐT không vào memory).
- Chạy: `node scripts/smoke-chat.mjs --vertical retail` (cần key + dev server).
