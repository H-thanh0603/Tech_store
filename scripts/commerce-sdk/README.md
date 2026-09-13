# Commerce SDK consoles

Host applications around the shared turn loops (`lib/assistant/*`, driven by
`@anthropic-ai/sdk`): same prompt, same skills (`skills/*`), same tool
contracts and gates as the web surfaces.

| Console | Tương đương blueprint | Chạy |
|---|---|---|
| `shopping.mjs` | `shopping-agent/runtime-agent-sdk/main.py --once` | `node scripts/commerce-sdk/shopping.mjs --once "..."` hoặc REPL |
| `merchant.mjs` | `merchant-agent/runtime-agent-sdk/main.py` (duyệt y/N) | `node scripts/commerce-sdk/merchant.mjs --cookie "..."` |

- Shopping console giữ history 10 lượt, jar cart cookie (giỏ chung với web), `sessionId` cho memory.
- Merchant console: mọi staged change dừng ở prompt `y/N` → gọi approve API (`apply`/`discard`); model không có đường apply.
- Cả hai cần dev server (`npm run dev`) hoặc `--base` trỏ production. Không cần API key ở máy chạy console — key nằm server-only.
