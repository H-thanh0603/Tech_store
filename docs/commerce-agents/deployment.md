# Deployment (port từ blueprint, Vercel-first)

## Chính (M6): Vercel + Supabase

App chạy Next.js thuần trên Vercel Hobby, DB Supabase Cloud (xem
`docs/ops/PLATFORM.md`, `DEPLOY.md`, `RUNBOOK.md`). Mọi runtime (web, SDK
consoles, MCP servers, managed manifests) trỏ về cùng một base URL.

Env production (Vercel → Settings → Environment Variables):

- `ASSISTANT_PROVIDER` + `ANTHROPIC_API_KEY` / `DEEPSEEK_API_KEY`
- `ASSISTANT_STAGING_SECRET` (random ≥ 32 ký tự; thiếu thì staging từ chối)
- `ASSISTANT_MODEL` (tùy chọn), `ASSISTANT_MEMORY=model` (tùy chọn, tốn 1 call/lượt)
- Supabase URL/keys như `docs/ops/DEPLOY.md`

Cron digest merchant: `/api/cron/merchant-digest` (xem manifest
`managed-agents/merchant-agent.json` → `scheduledDigest`).

## Nền tảng khác

Runtimes nhận mọi `anthropic` client qua `client=` (xem `lib/assistant/providers.ts`):
GCP Vertex AI, AWS Bedrock, Microsoft Foundry và gateways đều đi qua cùng seam
`MessagesClient` — chỉ đổi factory trong `createProviderClient()`, không đổi
vòng lặp turn, tools hay gates. DeepSeek đã chạy qua translator OpenAI-compatible
(trừ model reasoning — bị chặn cứng, xem `REASONER_GUARD_REPLY`).

## Checklist trước deploy

`node scripts/check-commerce-parity.mjs` xanh + `docs/ASSISTANT.md` Production checklist (7 mục).
