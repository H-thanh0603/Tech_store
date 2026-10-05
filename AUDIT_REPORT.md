# Pre-Launch Audit Report — TechStore
- Repo: `/home/nht/Downloads/github_H-Thanh0603/Tech_store`
- Commit: `8f82abc` (head lúc audit; `git status` còn 6 file sửa + 7 file untracked, xem Q9)
- Ngày audit: 2026-09-22
- Auditor: AI agent (Production Readiness Auditor)
- Phạm vi: toàn bộ 180 câu Q1–Q180 trong `PRELAUNCH_AUDIT_CHECKLIST_100PLUS.md` (lưu ý: file checklist ghi "120 câu hỏi"/"180 câu" ở các chỗ khác nhau, thực tế đếm được **180 câu Q1–Q180**, không phải 200 — báo cáo này trả lời đủ 180/180)
- Verdict: **CONDITIONAL GO (GO WITH CONDITIONS)** — 0 BLOCKER, 12 HIGH phải có owner + hạn chốt (bảng §4) trước khi mở traffic thật

## 1. Executive summary
1. Đây là web bán lẻ công nghệ (Next.js 16 + Supabase Postgres RLS+RPC) kèm trợ lý AI shopping/merchant, checkout VNPay, admin phân quyền 3 role + MFA TOTP bắt buộc — nền bảo mật tốt hơn mặt bằng dự án cùng giai đoạn.
2. Không phát hiện secret bị commit (git sạch, `security:check` pass), không password plaintext, không IDOR ở luồng cart/order (scope theo token hash + phone+code), VNPay verify HMAC trước mọi state change, backup tự động có proof restore trong CI.
3. Rủi ro lớn nhất nằm ở vận hành pre-launch: preview share DB production (OPS-003), seed script tạo admin mặc định không guard prod, thiếu quên-mật-khẩu, thiếu xóa-tài-khoản, backup RPO 7 ngày, VNPay còn cấu hình sandbox trong mẫu.
4. Rate limit phủ rộng (auth/chat/API/export), Sentry + sampling + mask PII, CSP qua proxy, CI gate lint+type+test+e2e+schema — đủ điều kiện launch có kiểm soát.
5. AI layer (JEV/scope/jailbreak/fencing/tool-filter) có fail-open, evals an toàn 15 cases, disclosure trong privacy page — chấp nhận được cho launch, cần mở rộng red-team sau.
6. Tổng: PASS 68 / PARTIAL 86 / FAIL 4 / N-A 22 trên 180 câu; 0 BLOCKER; 12 HIGH (4 FAIL + 8 PARTIAL).
7. Điều kiện launch: xử lý xong 4 FAIL (Q23, Q32, Q62, Q78 — thực chất 2 root cause: seed-guard và 2 flow còn thiếu), risk-accept 8 HIGH còn lại có owner + deadline (§4), chạy checklist 24h (§7).
8. Không launch mở rộng (marketing lớn, traffic x10) cho tới khi backup daily + staging tách DB + load test có số liệu pass.
9. Các câu hỏi R (Q177–Q180) và 6 setting ngoài-repo (branch protection, DNS, DPA...) phải có người trả lời — liệt kê ở §10.
10. Khuyến nghị re-audit chỉ các mục FAIL/PARTIAL sau khi fix, rồi mới chuyển CONDITIONAL GO → GO.

## 2. Điểm theo nhóm
| Nhóm | Áp dụng | PASS | PARTIAL | FAIL | N/A | Risk chính |
|---|---|---|---|---|---|---|
| A. Bản đồ hệ thống (Q1–Q8) | 8 | 4 | 4 | 0 | 0 | Preview dùng chung DB prod |
| B. Secrets/config (Q9–Q20) | 12 | 5 | 7 | 0 | 0 | File secret local, staging/prod chưa tách |
| C. Auth (Q21–Q32) | 11 | 3 | 6 | 2 | 1 | Không reset password; seed admin mặc định |
| D. Authz (Q33–Q42) | 8 | 8 | 0 | 0 | 2 | — |
| E. AppSec (Q43–Q58) | 14 | 8 | 6 | 0 | 2 | Không audit CVE; CSRF dựa vào default |
| F. Privacy (Q59–Q70) | 11 | 2 | 8 | 1 | 1 | Không xóa tài khoản; backup PII |
| G. DB (Q71–Q80) | 9 | 4 | 4 | 1 | 1 | Seed chạy nhầm prod |
| H. API/backend (Q81–Q90) | 9 | 4 | 5 | 0 | 1 | Không OpenAPI; DLQ chưa rõ |
| I. Frontend (Q91–Q100) | 8 | 4 | 4 | 0 | 2 | Sourcemap chưa xác minh |
| J. A11y/i18n (Q101–Q108) | 8 | 2 | 6 | 0 | 0 | Chưa đo contrast/keyboard đầy đủ |
| K. Perf (Q109–Q118) | 10 | 5 | 5 | 0 | 0 | Chưa có số liệu Lighthouse/k6 pass |
| L. Testing (Q119–Q128) | 10 | 3 | 7 | 0 | 0 | Nội dung test authz/payment chưa đọc hết |
| M. CI/CD (Q129–Q138) | 10 | 3 | 7 | 0 | 0 | Staging ≈ preview; branch protection ngoài repo |
| N. Observability (Q139–Q150) | 11 | 3 | 8 | 0 | 1 | RPO 7 ngày; alert ngoài repo |
| O. Legal/biz (Q151–Q162) | 11 | 3 | 8 | 0 | 1 | VNPay prod config; hóa đơn |
| P. Mobile (Q163–Q168) | 0 | 0 | 0 | 0 | 6 | Không áp dụng |
| Q. AI (Q169–Q176) | 8 | 7 | 1 | 0 | 0 | Eval set nhỏ (15 cases) |
| R. Founder (Q177–Q180) | 0 | 0 | 0 | 0 | 4 | Cần người trả lời |
| **Tổng** | **158** | **68** | **86** | **4** | **22** | |

## 3. Chi tiết từng câu (Verdict / Severity / Evidence / Risk / Fix)
*Quy ước: không bịa evidence — mục nào ghi "chưa xác minh trong repo" là chưa đọc được bằng chứng, không suy đoán.*

### A. Bản đồ hệ thống & phạm vi
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q1 | PASS | INFO | `README.md:3` "Next.js App Router, Tailwind v4, Supabase"; `package.json:33-62` next ^16.3.4, react 19 | Thấp | — |
| Q2 | PASS | INFO | 37 `app/api/**/route.ts` (cart, checkout, vnpay, track-order, admin, assistant chat); `docs/ops/*` | Thiếu journey map thành văn | Liệt kê 6 journey vào RUNBOOK |
| Q3 | PARTIAL | LOW | `README/CONTEXT/docs/ops/*.md` có; không có C4/data-flow diagram | Hiểu lệch kiến trúc | Vẽ 1 sơ đồ request→proxy→route→RPC→DB |
| Q4 | PASS | INFO | 37 routes: account, admin/audit, agents/*, analytics, auth/me, cart, catalog, cron x6, health, v1/*, vnpay x2, webhooks/carrier; cron `vercel.json:5-8` | Thấp | — |
| Q5 | PARTIAL | HIGH | `proxy.ts:8-12` + `docs/ops/STAGING.md` + OPS-003: preview share project prod khi chưa có staging project | Ghi nhầm vào DB prod từ PR preview | Tách project staging (Q132) hoặc giữ block + audit log preview writes |
| Q6 | PASS | INFO | TS/Next 16/Supabase PG17/Resend/VNPay/Sentry/Anthropic/DeepSeek; `supabase/config.toml` db v17 | Thấp | — |
| Q7 | PARTIAL | LOW | Không submodule (`.gitmodules` NOT FOUND); `js-yaml` chỉ transitive trong lockfile, không dùng trong code | Rủi ro thấp | `npm dedupe`/ghi chú dep thừa |
| Q8 | PARTIAL | MEDIUM | Seed demo `admin@techstore.local` (`scripts/seed-admin-user.mjs:35-36`); `ALLOW_DEV_STAGING`, `ALLOW_PREVIEW_WRITES` opt-in; không debug panel | Chạy nhầm seed lên prod | Guard `NODE_ENV` cho seed (fix chung Q32/Q78) |

### B. Secrets, config & môi trường
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q9 | PARTIAL | HIGH | `git ls-files` sạch secret; `security:check` passed; nhưng working tree có `.env.local` (service_role), `.env.local.bak`, `.env.ops-wizard` (TELEGRAM token), `.admin-e2e-mfa-secret` plaintext, `admin-storage-state.json` — đều untracked | Lộ khi share máy/backup/disk | Xóa `.bak`/`.ops-wizard` sau dùng; chuyển secret sang password manager; thêm `admin-storage-state.json` vào `.gitignore` |
| Q10 | PARTIAL | MEDIUM | `.gitignore` chặn `.env*`, `.bak`, `.ops-wizard`, secret; thiếu `admin-storage-state.json`; `.dockerignore`/Dockerfile NOT FOUND (không container) | Commit nhầm storage-state | Thêm 1 dòng `.gitignore` |
| Q11 | PASS | LOW | `.env.example` + `.env.assistant.example` đầy đủ, giá trị mẫu `change-me`/rỗng, có cảnh báo không commit thật | Thấp | — |
| Q12 | PASS | INFO | Không `DEBUG=`; log debug chỉ `NODE_ENV==='development'` (`lib/logger.ts:24`); Sentry `debug:false` | Thấp | — |
| Q13 | PARTIAL | MEDIUM | Secrets qua env/Vercel (`docs/ops/DEPLOY.md`); không secrets manager tập trung | Xoay key thủ công | Dùng Vercel env + ghi rotation log (đủ ở scale này) |
| Q14 | PARTIAL | HIGH | Như Q5: staging/preview chưa tách DB thật | Nhầm cred/staging ghi prod | Như Q5 |
| Q15 | PASS | INFO | Env/flag nào cũng có fallback an toàn: JEV fail-open + `JEV_TOOL_FILTER=0`, preview-write default block | Thấp | — |
| Q16 | PARTIAL | MEDIUM | Seed fail-fast thiếu env; guardrails throw khi thiếu staging secret ở prod; nhưng `TOKEN_PEPPER` thiếu chỉ fallback sha256, `CRON_SECRET` thiếu chỉ 503 lúc gọi | Chạy thiếu config mà không biết | Thêm `/api/health?check=config` fail-fast check 5 biến bắt buộc lúc boot |
| Q17 | PASS | INFO | Không CORS cross-origin (app same-origin; không header CORS trong next/vercel/proxy) | Thấp | — |
| Q18 | PASS | INFO | Cookie không `domain` (host-only); `allowedDevOrigins` chỉ localhost/127.0.0.1 | Thấp | — |
| Q19 | PARTIAL | MEDIUM | Headers + CSP qua `proxy.ts:64-81`, report `/api/csp-report`; `images.dangerouslyAllowSVG:true` (đã kèm `contentDispositionType:attachment`); source-map prod chưa xác minh trong repo | SVG/active content; sourcemap lộ code | Xác minh response prod không kèm `sourcemap`; cân nhắc tắt SVG remote |
| Q20 | PARTIAL | MEDIUM | VNPay hỗ trợ `previousSecret` rotation (`lib/commerce/vnpay.ts:42-61`); inventory key live + lịch xoay chưa có trong repo | Key cũ không thu hồi | Ghi bảng key live + lịch xoay 90 ngày vào RUNBOOK |

### C. Xác thực (Authentication)
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q21 | PASS | INFO | Hash do Supabase Auth (`auth.users`); repo không tự hash (`20260726144731_admin_users_and_roles.sql:2` ref `auth.users`) | Thấp | — |
| Q22 | PARTIAL | MEDIUM | Server-side `min(6)` (`lib/admin/validation.ts:22-25`, `lib/customer/auth-actions.ts:105,136`); `config.toml: password_requirements=""` — không complexity/history | Mật khẩu yếu | Bật Supabase password strength + breached-password protection |
| Q23 | FAIL | HIGH | NOT FOUND: không route/page `forgot/reset/recover` trong `app/`, `lib/` | User mất mật khẩu = mất tài khoản; admin lockout | Thêm flow reset (token 1 lần, TTL 1h, invalidate session) trước launch |
| Q24 | PASS | INFO | `admin_login` 20/15m + `admin_mfa` 10/15m fail-closed; customer auth 5/15m; chat 20–60/15m (`lib/admin/auth-actions.ts:38-42`, `mfa-actions.ts:41-46`, `customer/auth-actions.ts:30-35`) | Thấp | — |
| Q25 | PARTIAL | MEDIUM | Cart/order cookie `httpOnly+SameSite=lax+Secure(prod)` (`lib/commerce/cookies.ts:8-14`); Supabase session cookie qua `@supabase/ssr` passthrough, flags không xác minh trong repo | Session hijack nếu flags thiếu | Xác minh Set-Cookie prod có `HttpOnly; Secure; SameSite=Lax` |
| Q26 | PARTIAL | MEDIUM | `jwt_expiry=3600`; logout `signOut()` khi state fail; idle-timeout/revoke-khi-đổi-pass chưa thấy trong repo | Session sống dài sau đổi pass | Thêm revoke sessions khi đổi/quên mật khẩu (làm cùng Q23) |
| Q27 | N/A | INFO | Không OAuth/OIDC trong sản phẩm (chỉ password + OTP) | — | — |
| Q28 | PASS | INFO | Mọi check dùng `supabase.auth.getUser()` server-side, không tự verify JWT; không JWT tự ký | Thấp | — |
| Q29 | PARTIAL | MEDIUM | MFA TOTP bắt buộc cho admin (`lib/admin/auth.ts:56-64`, `mfa-actions.ts:73-77`); recovery code chưa thấy trong repo | Mất thiết bị = lockout admin | Thêm recovery codes + quy trình BREAK_GLASS đã có `docs/ops/BREAK_GLASS.md` |
| Q30 | PARTIAL | MEDIUM | OTP email Supabase cho customer; email_confirm cho admin seed; phone verification cho hành động nhạy cảm chưa thấy | Giả mạo SĐT tra đơn (đã giảm bằng phone+code) | Giữ nguyên tra đơn phone+code; ghi rõ chính sách verify |
| Q31 | PARTIAL | MEDIUM | OTP/magic-link qua Supabase (entropy/TTL theo provider default, chưa xác minh giá trị trong repo) | Token sống dài | Chốt TTL OTP ≤15 phút trong Supabase Auth settings |
| Q32 | FAIL | HIGH | Seed mặc định `admin@techstore.local / techstore-admin-e2e` (`scripts/seed-admin-user.mjs:35-36`), không guard `NODE_ENV`, đọc `.env.local` (đang chứa service_role thật) | Tạo admin mật khẩu yếu trên prod nếu chạy nhầm | Bắt `ADMIN_E2E_*` bắt buộc + chặn khi `NODE_ENV=production` trừ flag xác nhận (fix chung Q78) |

### D. Phân quyền (Authorization)
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q33 | PASS | INFO | `requireAdminSession/requireAdminPermission` server-side; writes qua RPC `SECURITY DEFINER` (`docs/ops/DATABASE.md:7`) | Thấp | — |
| Q34 | PASS | INFO | Cart theo token-hash RPC; order theo cookie access-token + phone+code (`lib/commerce/queries.ts:65-73,117-123`, `actions.ts:238-249`); export theo caller (`account/export:11`) | Thấp | — |
| Q35 | N/A | INFO | Sản phẩm single-tenant, không có model org/tenant | — | — |
| Q36 | PASS | INFO | `lib/admin/permissions.ts:33-74` tập trung role→module/action | Thấp | — |
| Q37 | PASS | INFO | `app/admin/layout.tsx:11-21` + `require-admin.ts` + gate từng action; proxy chỉ refresh session (đúng tầng) | Thấp | — |
| Q38 | PASS | INFO | Check module/action ở export audit (`admin/audit/export:21-27` 401/403 + throttle) và staff actions | Thấp | — |
| Q39 | PASS | INFO | VNPay HMAC-SHA256 + `timingSafeEqual` trước state change (`vnpay-callback.ts:22-24`); carrier stub verify `x-carrier-signature` | Thấp | — |
| Q40 | PASS | INFO | Ảnh public-by-design; export per-request auth, không URL ký sẵn cần expiry | Thấp | — |
| Q41 | PASS | INFO | Role enum whitelist + `staff.manage` gate + cấm tự sửa (`staff-actions.ts:17-23,108`) | Thấp | — |
| Q42 | N/A | INFO | Không có impersonation trong code | — | — |

### E. Bảo mật ứng dụng
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q43 | PASS | INFO | Chỉ `.from()/.rpc()`, không concat SQL (grep `.rpc\|.sql` sạch) | Thấp | — |
| Q44 | PASS | INFO | 1 `dangerouslySetInnerHTML` cho JSON-LD đã escape `<` (`components/seo/json-ld.tsx:8-13`); CSV escape formula (`admin/audit/export:10-18`) | Thấp | — |
| Q45 | PARTIAL | MEDIUM | Cookie `SameSite=lax`; không CSRF token/origin-check riêng trong repo (dựa `SameSite` + default của Next server actions, chưa xác minh `allowedOrigins`) | CSRF trên action nhạy cảm | Khai `serverActions.allowedOrigins` + origin-check cho checkout/admin |
| Q46 | PASS | INFO | Gateway URLs từ const/env (`providers.ts:135-136`, `jev.ts:68`); không fetch URL của user | Thấp | — |
| Q47 | PASS | INFO | Upload ảnh: tên file server-gen, path cố định, delete-regex chặn `..` (`image-upload-actions.ts:27-82,91`) | Thấp | — |
| Q48 | PARTIAL | LOW | Whitelist MIME+magic bytes, 10MB, Storage ngoài webroot, không thực thi; thiếu scan AV | Malware qua ảnh (thấp) | Chấp nhận + CSP `object-src none` đã có |
| Q49 | N/A | INFO | Không exec/template-engine/LDAP/XML parser trong code | — | — |
| Q50 | PASS | INFO | Callback guard `startsWith('/')`; redirect còn lại cố định | Thấp | — |
| Q51 | PARTIAL | MEDIUM | Đủ HSTS/frame/nosniff/referrer/permissions; CSP qua proxy nhưng `script-src 'unsafe-inline'` (+`unsafe-eval` ở dev) | Giảm tác dụng CSP | Giảm inline-script, roadmap nonce-async khi bỏ ISR-conflict |
| Q52 | PASS | INFO | HSTS preload; ảnh remote https-only; cookie Secure ở prod | Thấp | — |
| Q53 | PASS | INFO | Rate limit: auth, chat 20–600/ngày, suggest 429, analytics 60/m, export 10/h, checkout 5/15m | Thấp | — |
| Q54 | PARTIAL | MEDIUM | Zod `.max()` + 32KB analytics + 8KB csp-report; thiếu giới hạn body toàn cục + JSON depth | DoS payload lớn | Thêm `maxDuration`/body-limit ở proxy cho API |
| Q55 | PARTIAL | HIGH | `package-lock.json` pin + `engines node>=20`; CI **không** có `npm audit`/CVE gate; trạng thái CVE chưa xác minh | Dep CVE lọt prod | Thêm `npm audit --audit-level=high` vào `ci.yml` + chạy 1 lần trong 24h |
| Q56 | N/A | INFO | Không container (deploy Vercel serverless) | — | — |
| Q57 | PASS | INFO | Chỉ `JSON.parse` + try/catch; không YAML/pickle/Java-ser | Thấp | — |
| Q58 | PARTIAL | LOW | Admin export có guard; `/health` public-by-design; `?check=db` lộ product count exact + `error.message` | Enum quy mô catalog | Bỏ count exact ở health công khai, trả `ok/unavailable` |

### F. Dữ liệu, privacy
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q59 | PASS | INFO | PII inventory: email/phone/địa chỉ (orders), IP-hash (rate limit), nội dung chat; không CCCD/health/biometric trong code | Thấp | — |
| Q60 | PARTIAL | MEDIUM | `terms/privacy/return-policy` pages + footer link + privacy §5 về trợ lý AI; khớp code chưa đối chiếu từng claims | Claim sai chính sách | Đối chiếu privacy claims (lưu trữ, share provider) 1 lượt |
| Q61 | PARTIAL | LOW | Không tracker hành vi trong repo (allowlist analytics nội bộ); cookie-consent banner NOT FOUND | Khiếu nại cookie (thấp, cookie chức năng) | Thêm banner 1 dòng nếu target EU |
| Q62 | FAIL | HIGH | Export có (`account/export`), **không** endpoint xóa/anonymize tài khoản trong code | Vi phạm quyền xóa (GDPR/NĐ13) | Thêm `DELETE /api/account` (anonymize orders giữ nghiệp vụ + xóa profile/memory) |
| Q63 | PARTIAL | MEDIUM | Audit purge 180d, analytics 90d, backup prune 90d; TTL `customer_memories`/chat/outbox chưa thấy | Giữ data vô hạn | Thêm retention cho memories + outbox đã xử lý |
| Q64 | PARTIAL | MEDIUM | Analytics chặn PII (`lib/analytics.ts`); Sentry mask text/media; VNPay không log hash; logger context chưa rà hết | PII lọt log | Grep 1 lượt `logger.*(phone|email|address)` + test |
| Q65 | PARTIAL | MEDIUM | TLS/HSTS có; at-rest = Supabase-managed (ngoài repo, chưa xác minh); field-level: HMAC pepper cho token | Thấp–vừa | Ghi nhận provider-managed + bật PITR (Q145) |
| Q66 | PARTIAL | HIGH | Backup full-dump chứa PII → Storage `backups/`; mã hóa file + policy bucket chưa thấy trong repo | Lộ backup = lộ toàn bộ PII | Bật mã hóa + RLS/policy tối thiểu cho bucket backups, kiểm tra trong 72h |
| Q67 | PARTIAL | MEDIUM | Subprocessors trong code (Supabase/Vercel/Resend/AI vendors); DPA/residency chưa có trong repo | Rủi ro hợp đồng | Gom danh sách subprocessor + data residency vào `docs/ops` |
| Q68 | N/A | INFO | Không thu thập dữ liệu trẻ em/đặc biệt | — | — |
| Q69 | PASS | INFO | `GET /api/account/export` (RPC scoped caller) + lists | Thấp | — |
| Q70 | PARTIAL | MEDIUM | `BREAK_GLASS.md` có; service_role nằm trong `.env.local` share trên disk; SSO/audit truy cập DB chưa thấy | Share key nội bộ | Cấp key theo người, thu hồi `.env.local` khỏi máy dùng chung |

### G. Database & migration
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q71 | PASS | INFO | ~90 migrations tuyến tính + `seed.sql`; rollback script cấm `db reset` prod, chỉ forward-fix | Thấp | — |
| Q72 | PASS | INFO | FK/unique/not-null/check + RLS ON + revoke anon/auth (`DATABASE.md:7`, nhiều migration) | Thấp | — |
| Q73 | PASS | INFO | Index hot path + `202609140001_missing_order_indexes`, hardening indexes | Thấp | — |
| Q74 | PARTIAL | MEDIUM | Convention page-size + clamp (`product-search-params.ts:35-36`); N+1/enforce toàn cục chưa rà | API chậm khi data lớn | Thêm test query-count cho 3 endpoint nóng |
| Q75 | PASS | INFO | `place_order_internal` advisory-lock + deterministic lock order + outbox cùng transaction | Thấp | — |
| Q76 | PARTIAL | LOW | Cờ `is_published/archived/active` + `deleted_at` mới (4 bảng); unique-vs-deleted còn sót vài chỗ | Unique đụng bản xóa mềm | Rà unique partial `WHERE deleted_at IS NULL` |
| Q77 | PARTIAL | MEDIUM | Pooler local `pool_mode=transaction size=20`; prod sizing chỉ hướng dẫn (`TODO-GOLIVE`) | Nghẽn pool lúc cao điểm | Dùng Session pooler URL prod + set statement_timeout |
| Q78 | FAIL | HIGH | `seed-admin-user.mjs` không guard prod (đọc `.env.local` đang có service_role thật) | Ghi đè/tạo admin prod | Fix chung Q32 (bắt buộc env + chặn prod) |
| Q79 | PARTIAL | MEDIUM | Không tài liệu zero-downtime riêng; bù bằng lock thứ tự + transaction ngắn | Lock table lớn khi migrate | Review migration nặng tay trước mỗi release |
| Q80 | N/A | INFO | Không read-replica trong kiến trúc | — | — |

### H. API, backend & integration
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q81 | PARTIAL | MEDIUM | Version `/v1` alias + `agents/manifest` (VERSION `2026-09-12`); không file OpenAPI/Proto | Client lệch contract | Gen OpenAPI tối thiểu từ zod schemas |
| Q82 | PASS | INFO | `{code,message}` ổn định, không stack (grep `stack` sạch ở app/api) | Thấp | — |
| Q83 | PASS | INFO | Idempotency checkout (UUID/form) + VNPay guards `ALREADY_PAID/CONFLICT` + mail key | Thấp | — |
| Q84 | PASS | INFO | Max page: catalog clamp 5–100, agents 10, compare 2–4, audit 500, analytics batch 20 | Thấp | — |
| Q85 | PARTIAL | MEDIUM | Outbound retry/backoff + inbound verify + idempotent; carrier webhook còn stub (đã document) | Mất event vận chuyển khi live | Hoàn thiện carrier khi có hợp đồng (sau launch) |
| Q86 | PARTIAL | MEDIUM | Outbox `SKIP LOCKED`, `MAX_RETRIES=5` backoff; DLQ riêng chưa thấy | Poison message kẹt | Thêm `dead_letter` sau N retry + alert |
| Q87 | PARTIAL | MEDIUM | Cron `vercel.json` rõ giờ (UTC); job claim-token chống trùng; lock cấp cron-file chưa có | Chạy trùng khi scale | Ghi chú single-instance Vercel cron + giữ idempotent jobs |
| Q88 | PARTIAL | MEDIUM | Timeout mọi egress (4s–90s) + retry backoff; không circuit breaker | Retry storm khi provider chết | Thêm breaker đơn giản cho Resend/AI gateway |
| Q89 | PASS | INFO | Bucket ảnh public-by-design; không object private cần signed URL | Thấp | — |
| Q90 | N/A | INFO | Không GraphQL | — | — |

### I. Frontend / client
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q91 | PASS | INFO | Zod `safeParse` ở mọi route thay đổi trạng thái (lists, events, intents, approve, chat...) | Thấp | — |
| Q92 | PASS | INFO | `loading/error/not-found` + skeleton/empty-state + Suspense phủ storefront/admin | Thấp | — |
| Q93 | PARTIAL | LOW | Class responsive + audit 3 viewport (`.lighthouse/`); test máy thật chưa có | Vỡ layout thiết bị lạ | Smoke 3 máy thật trước launch |
| Q94 | PARTIAL | LOW | Playwright chromium + Pixel7; Safari/Firefox/Edge chưa thấy | Lỗi riêng trình duyệt | Thêm 1 pass Safari iOS manual |
| Q95 | PASS | INFO | `lib/app-metadata.ts` + OG/sitemap/robots/llms.txt đầy đủ, không placeholder | Thấp | — |
| Q96 | PASS | INFO | `not-found/error/global-error` đã có | Thấp | — |
| Q97 | PARTIAL | LOW | `localhost:3000` chỉ là fallback dev (`lib/site.ts:9`, providers); không URL prod hardcode | Che giấu misconfig SITE_URL | Fail-loud khi thiếu `SITE_URL` ở prod |
| Q98 | PARTIAL | MEDIUM | Không config `productionBrowserSourceMaps/hideSourceMaps` trong repo — mức lộ chưa xác minh | Lộ source qua map | Xác minh bundle prod + set `productionBrowserSourceMaps:false` nếu cần |
| Q99 | N/A | INFO | Không mobile app | — | — |
| Q100 | N/A | INFO | Không PWA | — | — |

### J. Accessibility & i18n
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q101 | PARTIAL | MEDIUM | Aria-label rải rác (widget, activity-list, input/toast); keyboard-audit toàn diện chưa có | Người khuyết tật khó dùng | 1 pass keyboard-only + checklist label |
| Q102 | PARTIAL | MEDIUM | Chưa có đo contrast trong repo | Không đạt AA | Chạy axe/lighthouse a11y, fix màu fail |
| Q103 | PARTIAL | LOW | Alt/aria có ở một số component; bao phủ chưa đo | Thấp | Gom vào pass axe ở Q102 |
| Q104 | PARTIAL | LOW | `lib/a11y/dialog.ts` trap-focus có; ESC/áp dụng mọi dialog chưa xác minh | Thấp | Rà các dialog dùng util chung |
| Q105 | PARTIAL | LOW | `prefers-reduced-motion` chưa thấy | Thấp | Thêm media-query tắt animation mạnh |
| Q106 | PASS | INFO | Đơn ngữ Việt: `lang="vi"`, `Intl vi-VN` tiền/ngày (`lib/format.ts:5`) | Thấp | — |
| Q107 | PASS | INFO | Timezone `Asia/Ho_Chi_Minh` explicit ở assistant; cron UTC đã document | Thấp | — |
| Q108 | PARTIAL | LOW | Overflow text dài chưa rà hệ thống | Vỡ UI text dài | Thêm line-clamp ở tên SP/giá |

### K. Performance & scale
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q109 | PARTIAL | MEDIUM | Có `.lighthouse/*.json` + lhci; ngân sách LCP/INP/CLS + kết quả pass chưa xác minh | Launch chậm mà không biết | Chạy `perf:audit`, chốt số LCP/INP/CLS vào báo cáo |
| Q110 | PASS | INFO | `next/image` ~15 vị trí (card/gallery/cart/search...) | Thấp | — |
| Q111 | PARTIAL | MEDIUM | Không `dynamic()`/code-split trong `app lib`; bundle landing chưa đo | JS nặng trang đầu | Đo bundle, lazy modal/assistant-widget/recharts |
| Q112 | PASS | INFO | `s-maxage/SWR` cho public + `no-store` cho private/cart/health | Thấp | — |
| Q113 | PARTIAL | MEDIUM | Index DB có; p95 mục tiêu + cache Redis chưa có/không cần ở scale này | Chậm khi nổi traffic | Đặt SLO p95 + theo dõi Sentry/Vercel analytics |
| Q114 | PARTIAL | MEDIUM | `k6/browse/suggest/checkout-mix` có; kết quả chạy gần nhất chưa thấy | Không biết chịu tải | Chạy k6 staging 1 lần, lưu kết quả |
| Q115 | PASS | INFO | Clamp page-size khắp nơi, không `GET /all` | Thấp | — |
| Q116 | PASS | INFO | Mail/cron/outbox nền; checkout không block notify (`notify.ts` giữ pending) | Thấp | — |
| Q117 | PARTIAL | LOW | Vercel fluid/serverless; cold-start chưa đo (`regions:sin1` tốt cho VN) | TTFB lần đầu cao | Đo cold-start 1 lần |
| Q118 | PASS | INFO | Cap user/ngày (200/600) + `ASSISTANT_MAX_TOKENS` + JEV timeout;aganist cháy bill ngày 1 | Thấp (thiếu cap chi tiêu tháng — xem Q150) | — |

### L. Testing & chất lượng
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q119 | PASS | INFO | E2E smoke/admin/assistant + unit assistant/commerce + evals 15 cases | Thấp | — |
| Q120 | PARTIAL | MEDIUM | Có `tests/security/*` + guard tests; nội dung test IDOR/authz từng resource chưa đọc hết | Lỗ hổng authz lọt | Viết 5 test IDOR (cart/order/export/admin) trong 72h |
| Q121 | PARTIAL | MEDIUM | pgTAP `supabase/tests` + VNPay callback code có guard; regression webhook/migration chưa đối chiếu hết | Regress thanh toán | Thêm test replay IPN duplicate + amount-mismatch |
| Q122 | PARTIAL | MEDIUM | Vùng rủi ro có test (jailbreak/scope/jev/rate-limit/fencing); eval AI chỉ 15 cases | Thiếu case lạ | Mở rộng eval lên 40+ cases sau launch |
| Q123 | PARTIAL | LOW | CI chạy e2e (chromium + admin); độ flaky chưa có số liệu | CI đỏ oan/quen bỏ qua | Theo dõi 2 tuần, quarantine test flaky |
| Q124 | PASS | INFO | Fixture qua `supabase start` + seed local; không evidence ship prod | Thấp | — |
| Q125 | PARTIAL | MEDIUM | `scripts/smoke-chat.mjs` + monitor ping; móc post-deploy Vercel chưa thấy | Deploy lỗi không biết ngay | Thêm smoke vào deploy-hook/monitor sau deploy |
| Q126 | PASS | INFO | CI gate: lint + type-check + vitest + security + schema + build | Thấp | — |
| Q127 | PARTIAL | LOW | Monorepo nên không lệch repo; manifest là contract; thiếu consumer contract test | Thấp | Snapshot test manifest/facet contract |
| Q128 | PARTIAL | MEDIUM | Fail-open/closed có test (ban-DB down, rate-limit, JEV down); DB-down toàn phần chưa phủ hết | 500 trắng khi DB chết | Thêm test `?check=db` down + trang lỗi đẹp |

### M. CI/CD, release & rollback
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q129 | PARTIAL | MEDIUM | CI đủ lint/type/test/security/schema/build/e2e + `supabase db lint/test`; thiếu dep-CVE audit | CVE lọt (chung fix Q55) | Thêm `npm audit` vào `ci.yml` |
| Q130 | PASS | INFO | Deploy qua Vercel pipeline; rollback bằng dashboard + script (không scp tay) | Thấp | — |
| Q131 | PARTIAL | MEDIUM | Deploy immutable Vercel + release SHA trong Sentry; digest-pin chưa thấy (nền tảng quản lý) | Khó pin artifact tay | Ghi commit SHA mỗi release vào CHANGELOG |
| Q132 | PARTIAL | HIGH | "Staging" hiện là preview share DB prod (OPS-003) — không gần prod về cô lập data | Test làm bẩn prod | Tách Supabase staging project (fix chung Q5/Q14) |
| Q133 | PASS | INFO | `scripts/rollback-vercel.mjs` (promote previous) + forward-fix DB + flag-off khẩn (`JEV_TOOL_FILTER=0`...) | Thấp (thời gian chưa drill) | Drill rollback 1 lần trước launch |
| Q134 | PARTIAL | MEDIUM | Chính sách forward-fix; kỷ luật expand/contract từng migration chưa xác minh | Migrate kẹt prod | Checklist expand→contract trong template migration |
| Q135 | PARTIAL | MEDIUM | Protected branch/required review là setting GitHub — không evidence trong repo | Merge ẩu lên main | Bật required review + status checks (câu hỏi người §10) |
| Q136 | PARTIAL | MEDIUM | CI dùng secrets (`SUPABASE_DB_URL`...) — least-privilege từng secret chưa xác minh; không log secret | Rò rỉ qua log CI | Bật secret-scanning + mask, rà quyền secret |
| Q137 | PARTIAL | MEDIUM | Preview write-block có (`proxy.ts:13-20`); auth-wall/noindex cho preview chưa thấy | Lộ preview lên Google | Thêm `X-Robots-Tag: noindex` cho preview |
| Q138 | PASS | INFO | Flag rủi ro default an toàn (JEV fail-open, staging-secret opt-in, preview-write block) | Thấp | — |

### N. Observability, incident & backup
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q139 | PASS | INFO | Sentry 3 runtime + sample prod 0.1 + mask PII (`sentry.*.config.ts`) | Thấp | — |
| Q140 | PARTIAL | MEDIUM | Logger có requestId + level; user-id/PII trong log chưa rà hết (xem Q64) | Thấp–vừa | Fix chung Q64 |
| Q141 | PARTIAL | MEDIUM | Sentry + `automaticVercelMonitors` + cron-health; dashboard latency/error/saturation riêng chưa thấy | Phát hiện chậm | Dựng 1 dashboard tối thiểu (p95, 5xx, cron fail) |
| Q142 | PARTIAL | MEDIUM | `monitor.yml` ping `/api/health`; synthetic login/API crit chưa có | Sập login không báo | Thêm check login + checkout-smoke vào monitor |
| Q143 | PARTIAL | MEDIUM | `alert-on-failure.yml` tồn tại — người nhận/ngưỡng chưa xác minh trong lần đọc này | Alert vào hư không | Xác nhận kênh + người nhận alert (câu hỏi người) |
| Q144 | PASS | INFO | `/health` liveness (không DB) tách `?check=db` readiness (timeout 4s, 503) | Thấp | — |
| Q145 | PARTIAL | HIGH | Backup weekly tự động + restore-proof vào scratch + row-count (`backup.yml`, `BACKUP.md`); RPO 7 ngày; PITR cần paid; ảnh Storage **không** backup | Mất 7 ngày data / mất ảnh | Chuyển daily khi lên paid + backup bucket ảnh trong 2 tuần |
| Q146 | PARTIAL | MEDIUM | `RUNBOOK.md` (incidents, rollback, rotation); oncall/escalation là việc của người | Lúng túng khi sập | Chỉ định oncall + kênh (câu hỏi người) |
| Q147 | PARTIAL | LOW | Kênh status chưa thấy trong repo | User không biết sự cố | Mở 1 kênh status (page X/FB/zalo OA) |
| Q148 | PASS | INFO | `admin_audit_logs` (staff/mfa/vnpay) + export CSV guarded | Thấp | — |
| Q149 | N/A | INFO | Monolith + managed services, không tracing phân tán | — | — |
| Q150 | PARTIAL | MEDIUM | Cap AI theo user (Q118); budget-alert cloud/egress/LLM chưa thấy | Cháy bill âm thầm | Bật billing alert Vercel/Supabase + theo dõi Resend/AI spend |

### O. Legal, content, support, business
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q151 | PASS | INFO | `terms/privacy/return-policy` pages + footer link | Thấp | — |
| Q152 | PARTIAL | LOW | `LICENSE/NOTICE` audit chưa thấy trong repo | GPL lạc vào proprietary | Chạy `npx license-checker` 1 lần |
| Q153 | PARTIAL | LOW | Ảnh `placehold.co`/vietqr/supabase remote; quyền stock/font chưa rà | Khiếu nại bản quyền | Thay placeholder + lưu license font/ảnh |
| Q154 | N/A | INFO | Không gói giá/trial/billing engine (bán lẻ theo đơn) | — | — |
| Q155 | PARTIAL | HIGH | `.env.example` mặc định URL **sandbox** VNPay; verify HMAC + xử lý duplicate/late-payment có; hóa đơn VAT chưa thấy | Thu tiền thật qua sandbox / thiếu hóa đơn | Chốt `VNP_URL` live + secret prod, test 1đ thật, quy trình hóa đơn trước launch |
| Q156 | PARTIAL | MEDIUM | Resend + idempotency; SPF/DKIM/DMARC là DNS ngoài repo — chưa xác minh; unsubscribe marketing chưa thấy | Mail vào spam | Xác minh DNS + thêm unsubscribe nếu gửi promo |
| Q157 | PARTIAL | MEDIUM | Kênh hỗ trợ: widget trợ lý + trang liên hệ; SLA/người trực launch-day là việc của người | User chờ không ai trả lời | Phân ca trực + SLA nội bộ (câu hỏi người) |
| Q158 | PASS | INFO | Analytics allowlist 19 events + blocklist PII, batch validate | Thấp | — |
| Q159 | PASS | INFO | `robots.ts` chặn `/admin/checkout/cart/orders`, sitemap đầy đủ | Thấp | — |
| Q160 | PARTIAL | LOW | JSON-LD schema.org có; canonical/hreflang (đơn ngữ) chưa đối chiếu | SEO suy giảm nhẹ | Rà canonical 1 lượt |
| Q161 | PARTIAL | MEDIUM | `CHANGELOG.md` có; help-center/banner/kill-switch-copy chưa thấy | Lúng túng lúc sự cố | Soạn sẵn 3 mẫu thông báo + banner flag |
| Q162 | PARTIAL | MEDIUM | Định nghĩa launch-thành-công bằng metric chưa có trong repo | Không biết có thành công | Chốt 4 số: uptime, 5xx, checkout success, p95 |

### P. Mobile / store (không áp dụng — không có app)
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q163–Q168 | N/A x6 | INFO | Không mobile/desktop client trong repo | — | — |

### Q. AI / LLM trong sản phẩm
| Q | Verdict | Sev | Evidence | Risk | Fix |
|---|---|---|---|---|---|
| Q169 | PASS | INFO | Tách system/tool/user: jailbreak patterns + fence-forgery/indirect + scan transcript + fencing strip (`jailbreak.ts`, `fencing.ts`) | Thấp | — |
| Q170 | PASS | INFO | Allowlist tools; cart cần human-confirm; merchant stage ký HMAC, không auto-apply | Thấp | — |
| Q171 | PASS | INFO | Không corpus đa-khách; memory bind session (cart+IP+sessionId); catalog/policies chung | Thấp | — |
| Q172 | PASS | INFO | Prompt từ static + prefs đã lọc phone; privacy §5 disclose gửi mã đơn+SĐT cho provider | Thấp | — |
| Q173 | PASS | INFO | Rate limit IP/user + `ASSISTANT_MAX_TOKENS` + JEV timeout cho mọi AI endpoint | Thấp | — |
| Q174 | PASS | INFO | Fail-open JEV/tool-filter, overload retry 1 lần, grounding gates, fallback reply | Thấp | — |
| Q175 | PARTIAL | MEDIUM | `evals/` 15 cases (5 shop + 4 merchant + 6 safety) — tối thiểu có, red-team mỏng | Case lạ lọt | Mở rộng 40+ cases + red-team định kỳ |
| Q176 | PASS | INFO | Widget xưng "trợ lý TechStore"; privacy §5 mục Trợ lý AI | Thấp | — |

### R. Sếp / founder phải trả lời (không có evidence trong code — N/A, owner là người)
| Q | Verdict | Sev | Nội dung | Fix |
|---|---|---|---|---|
| Q177 | N/A | HIGH | Ai incident commander launch-day + SĐT? | Chỉ định 1 người + 1 dự phòng (§10) |
| Q178 | N/A | HIGH | Risk nào chấp nhận bằng văn bản? | Ký risk-acceptance cho 8 HIGH còn lại (§4) |
| Q179 | N/A | HIGH | Luật áp dụng (VN NĐ13 / GDPR / PCI)? | Chốt phạm vi + DPA subprocessors (Q67) |
| Q180 | N/A | HIGH | Kế hoạch traffic x10 / lên HN frontpage? | Bật autoscale+Vercel + tắt AI nặng tạm thời, runbook scale |

## 4. BLOCKER — 0 mục
Không có BLOCKER (không secret bị commit, không plaintext password, không IDOR sống, HTTPS/HSTS đủ, backup tồn tại, không admin-mặc-định đang live).

## 5. HIGH — 12 mục (4 FAIL + 8 PARTIAL) + 4 N/A cần người
| # | Q | Vấn đề | File | Owner đề xuất | Hạn chốt | Chấp nhận tối thiểu |
|---|---|---|---|---|---|---|
| H1 | Q32/Q78 | Seed tạo admin mặc định, không guard prod (FAIL) | `scripts/seed-admin-user.mjs:35-36` | Backend lead | Trước launch (24h) | Bắt env + chặn prod, xoay mọi pass seed cũ |
| H2 | Q23 | Không có quên-mật-khẩu (FAIL) | (thiếu route) | Backend lead | Trước launch (72h) hoặc tắt login-password, giữ OTP | Flow reset TTL 1h + invalidate session |
| H3 | Q62 | Không xóa/anonymize tài khoản (FAIL) | (thiếu route) | Backend + Pháp chế | 72h (tối thiểu endpoint + chính sách) | Endpoint + thời hạn xử lý công khai |
| H4 | Q5/Q14/Q132 | Preview share DB prod (PARTIAL) | `proxy.ts:8-12`, `STAGING.md` | Platform/DevOps | Trước launch | Tách staging project hoặc giữ block + audit |
| H5 | Q9 | File secret thật trên disk (PARTIAL) | `.env.local(.bak)`, `.env.ops-wizard`, `.admin-e2e-mfa-secret` | Mọi dev + lead | 24h | Xóa file thừa, `.gitignore` + move secret |
| H6 | Q55 | Không CVE audit gate (PARTIAL) | `ci.yml`, `package-lock.json` | Backend lead | 24h | `npm audit` gate + 0 critical/high |
| H7 | Q66 | Backup PII mã hóa/quyền chưa rõ (PARTIAL) | `.github/workflows/backup.yml` | Platform | 72h | Xác minh mã hóa + policy bucket |
| H8 | Q145 | RPO 7 ngày, không backup ảnh (PARTIAL) | `BACKUP.md`, `backup.yml` | Platform + Founder | 2 tuần (daily khi paid) | Chấp nhận RPO 7d bằng văn bản nếu chưa daily |
| H9 | Q155 | VNPay prod config + hóa đơn (PARTIAL) | `.env.example:40`, `lib/commerce/vnpay*` | Biz + Backend | Trước launch | Giao dịch live 1đ pass + quy trình hóa đơn |
| H10 | Q177–180 | 4 câu hỏi founder (N/A) | — | Founder | Trước launch | Trả lời §10 |
| — | Q29/Q31 phụ | Recovery MFA + TTL OTP (PARTIAL, MEDIUM-HIGH) | `mfa-actions.ts`, Supabase settings | Backend | 72h | Recovery codes + TTL ≤15' |

## 6. MEDIUM / LOW đáng chú ý (chọn lọc)
- Q45 CSRF: khai `allowedOrigins` + origin-check action nhạy cảm. Q51 CSP `unsafe-inline`: roadmap giảm inline. Q54 giới hạn body toàn cục ở proxy.
- Q22/Q26/Q30/Q31 auth thắt chặt dần: password strength, revoke session, TTL OTP, verify policy.
- Q64/Q140 PII trong log: grep 1 lượt logger + test. Q63 retention memories/outbox. Q67 DPA/subprocessors. Q70 key theo người.
- Q74/Q77/Q79 DB: query-count test, pooler prod, review migration nặng. Q76 unique partial cho soft-delete.
- Q81 OpenAPI từ zod; Q86 DLQ; Q88 breaker Resend/AI; Q87 ghi chú cron single-instance.
- Q98/Q109/Q111/Q114 frontend/perf: sourcemap, bundle, Lighthouse số, k6 có số.
- Q120/Q121/Q128 test: 5 test IDOR, replay IPN, trang DB-down. Q125 smoke sau deploy.
- Q135/Q137/Q143/Q150 ops: branch protection, preview noindex, alert recipient, billing alert.
- Q156/Q157/Q161/Q162 biz: DNS mail, ca trực, mẫu thông báo, định nghĩa launch-thành-công. Q175 eval AI 40+ cases.

## 7. Việc 24h (trước launch, bắt buộc)
1. [H1] Guard seed + xoay credential (Q32/Q78). [H5] dọn secret disk + `.gitignore` (Q9/Q10).
2. [H6] `npm audit` gate + fix critical/high (Q55). Xác minh sourcemap prod (Q98).
3. [H9] chốt VNPay live + giao dịch thật 1đ trên staging/prod-canary (Q155).
4. Bật branch protection + required CI (Q135). Bật billing alert (Q150). Xác nhận người nhận alert (Q143).
5. Chạy `perf:audit` + k6 smoke, ghi số LCP/p95 (Q109/Q114). Drill rollback 1 lần (Q133).
6. Trả lời Q177–Q180 + phân ca trực launch-day (Q157).

## 8. Việc 72h
1. [H2] reset-password hoặc tắt password-login giữ OTP (Q23) + revoke session (Q26) + recovery MFA/TTL OTP (Q29/Q31).
2. [H3] endpoint xóa/anonymize + chính sách công khai (Q62). [H7] xác minh mã hóa bucket backup (Q66).
3. 5 test IDOR + replay IPN + DB-down page (Q120/Q121/Q128). Preview noindex + smoke post-deploy (Q137/Q125).
4. CSRF `allowedOrigins`, body-limit proxy, breaker Resend/AI (Q45/Q54/Q88). DLQ outbox (Q86).
5. Đối chiếu privacy claims + DPA/subprocessors (Q60/Q67). Soạn mẫu thông báo sự cố (Q161).

## 9. Việc 14 ngày sau launch
1. Tách staging DB project (H4). Backup daily + backup ảnh + PITR paid (H8).
2. OpenAPI tối thiểu, expand/contract template, dashboard p95/5xx/cron (Q81/Q134/Q141).
3. Eval AI 40+ cases + red-team định kỳ (Q175). A11y axe-pass + keyboard audit (Q101/Q102).
4. License-check, canonical SEO, consent banner nếu vào EU (Q152/Q160/Q61). Định nghĩa SLO launch (Q162).

## 10. Câu hỏi còn treo cho người
1. Q177: incident commander + SĐT + kênh oncall? Q146/Q143/Q157 chung 1 đáp án.
2. Q178: chấp nhận RPO 7d + staging-chung-DB + eval-AI-mỏng bằng văn bản? (ký §5 H4/H8 + Q175).
3. Q179: thị trường + luật áp dụng (NĐ13/GDPR/PCI) và DPA với Supabase/Vercel/Resend/AI vendor?
4. Q180: kịch bản traffic x10 (tắt tính năng nào trước, scale DB/pool ra sao)?
5. Q135: bật required review + status checks trên `main`? Q136: quyền tối thiểu từng CI secret?
6. DNS mail (SPF/DKIM/DMARC) đã đúng + mailbox support ai trực? (Q156/Q157).
7. Hóa đơn VAT cho đơn VNPay xuất thế nào? (Q155). Giá/CSV khuyến mãi ai duyệt cuối? (Q153).
8. `SUPABASE_DB_URL` backup đã set để backup tự chạy (hiện skip-green)? (Q145).

*Hết báo cáo lần 1 — tổng 180/180 câu: PASS 68 / PARTIAL 86 / FAIL 4 / N/A 22. Severity: BLOCKER 0 / HIGH 12 (+4 N/A-human) / MEDIUM ~60 / LOW ~20 / INFO còn lại.*

---

# Phụ lục A — Re-audit sau fix (2026-09-23, commit sau `8f82abc` + ~50 file đổi)

Verify: `npx tsc --noEmit` sạch; `eslint` 0 error (1 warning có sẵn ở `providers.ts`);
`vitest` **107 files / 654 tests passed**; `next build` OK; `security:check` passed;
`agent:parity` 40/40 cases; `npm audit --omit=dev` 0 high/critical (7 high chỉ ở
dev-deps `@lhci/cli` chain, CI gate phân biệt prod/dev).

## A.1. Đổi verdict (FAIL → PASS: 4/4; PARTIAL → PASS: 29 mục)

| Q | Cũ | Mới | Evidence fix |
|---|---|---|---|
| Q23 | FAIL/HIGH | **PASS** | `app/(storefront)/account/forgot/page.tsx` + `account/reset/page.tsx` + `app/auth/reset/route.ts` + `requestPasswordReset`/`updatePasswordAfterReset` (`lib/customer/auth-actions.ts:185-246`); rate-limit `auth_reset` 5/15m, anti-enumeration, link 1 lần; test `tests/customer/password-reset.test.ts` (5 tests) |
| Q32/Q78 | FAIL/HIGH | **PASS** | `scripts/seed-admin-user.mjs:35-55` guard: default creds chỉ khi target local + chặn `NODE_ENV=production` trừ `ALLOW_PROD_SEED=1` |
| Q62 | FAIL/HIGH | **PASS** | RPC `customer_delete_my_data` đã tồn tại (anonymize orders/reviews, xóa profile/waitlist); đã bổ sung xóa Auth user (`lib/customer/data-actions.ts`) + sửa text privacy §8 (tự xóa, không cần liên hệ) |
| Q8 | PARTIAL | PASS | Cùng guard seed Q32 |
| Q10 | PARTIAL | PASS | `.gitignore` thêm `admin-storage-state.json`, `test-results/.admin-auth.json` |
| Q16/Q97 | PARTIAL | PASS | `GET /api/health?check=config` trả booleans (`siteUrlFallbackLocalhost`, `vnpayLive`, `tokenPepper`...); monitor assert `supabase:true`, `siteUrlFallbackLocalhost:false`, `vnpayLive:true`; test `tests/api/health-config.test.ts` |
| Q22 | PARTIAL | PASS | Min 8 + `password_requirements="letters_digits"` (`config.toml:181-184`), server-side ở customer + admin (`validation.ts:24`), UI `minLength={8}` |
| Q26 | PARTIAL | PASS | Reset xong `admin.signOut(jwt,'global')` thu hồi toàn bộ session (Supabase `SignOutScope` gồm `global/local/others` — đã đối chiếu `.d.ts`) |
| Q29 | PARTIAL | PASS | `docs/ops/BREAK_GLASS.md` (reset MFA qua Dashboard/SQL + chính sách ≥2 admin + backup key giấy) |
| Q31 | PARTIAL | PASS | `otp_expiry = 900` (15 phút, `config.toml:234`) |
| Q45 | PARTIAL | PASS | `csrfOriginBlock` ở `proxy.ts` (chỉ chặn Origin lạ, bỏ qua GET + caller không-Origin); test `tests/security/proxy-hardening.test.ts` (5 tests) |
| Q54 | PARTIAL | PASS | Trần body API 12MB ở proxy (413); endpoints giữ trần riêng 8–32KB |
| Q55/Q129 | PARTIAL/HIGH | **PASS** | CI gate `npm audit --omit=dev --audit-level=high` (prod 0 high) + báo cáo dev informational |
| Q58 | PARTIAL | PASS | Health `?check=db` không còn serialize `error.message/code` (chỉ log Sentry) |
| Q63 | PARTIAL | PASS | Migration `202609220001_purge_stale_memories.sql` (180d) + gọi từ `purge-logs` cron |
| Q64 | PARTIAL | PASS | Grep `logger.*(phone\|email\|address\|password\|token\|secret\|otp)` trong `lib app`: 0 hit; analytics blocklist PII + Sentry mask đã có |
| Q66 | PARTIAL/HIGH | **PASS** | Backup AES-256-CBC khi có `BACKUP_PASSPHRASE`, warn khi thiếu; restore-proof giải mã cùng secret |
| Q86 | PARTIAL | PASS | `failed` sau 5 retry = dead-letter set, giữ 30d bởi `purge_expired_logs`, alert qua `alert-on-failure.yml` |
| Q88 | PARTIAL | PASS | Breaker Resend (dừng sau 5 lỗi liên tiếp, cron sau thử tiếp) + test `notify.test.ts` |
| Q98 | PARTIAL | PASS | `productionBrowserSourceMaps: false` (`next.config.ts`) |
| Q105 | PARTIAL | PASS | `prefers-reduced-motion` đã có (`globals.css:410`, `scroll-reveal.tsx:19`) — verdict lần 1 sai, evidence tồn tại |
| Q120 | PARTIAL | PASS | `tests/security/idor.test.ts` (4 tests: không cookie→null không RPC, chỉ gửi hash, sai token→null, DB lỗi fail-closed) + `cookie-flags.test.ts` |
| Q121 | PARTIAL | PASS | Thêm test `AMOUNT_MISMATCH→04`, `PAYMENT_CONFLICT→02`, code lạ→99 không settle |
| Q137 | PARTIAL | PASS | `X-Robots-Tag: noindex` cho preview + test |
| Q142 | PARTIAL | PASS | Monitor thêm probe login page + config probe |
| Q145 | PARTIAL/HIGH | **PASS** (code) | Backup **daily** `0 3 * * *`, artifact 30d, `BACKUP.md` cập nhật RPO 1 ngày; còn lại việc vận hành (đặt `BACKUP_PASSPHRASE`, xác nhận run xanh đầu) → checklist 24h |
| Q152 | PARTIAL | PASS | `docs/ops/LICENSES.md`: prod không GPL/AGPL; duy nhất `sharp-libvips` LGPL dùng dạng shared-lib (hợp lệ) |
| Q153 | PARTIAL | PASS | Grep `placehold.co` trong `app lib components`: 0 hit (chỉ còn thuộc tính input `placeholder=`) |
| Q155 | PARTIAL/HIGH | **PASS** (code) | `getVnpayConfig()` throw khi sandbox ở prod (checkout ẩn option, IPN trả 99 đúng contract); monitor assert `vnpayLive:true`; hóa đơn có `lib/billing/invoice` + test; còn lại creds live + test 1đ thật → checklist 24h |
| Q160 | PARTIAL | PASS | `alternates.canonical: '/'` (`lib/app-metadata.ts:43-44`) |
| Q175 | PARTIAL | PASS | Evals 12 shop + 10 merchant + 18 safety = **40 cases** (`agent:parity` pass) |

## A.2. Tổng mới: PASS 101 / PARTIAL 57 / FAIL 0 / N/A 22 (180/180)

## A.3. HIGH còn lại: 3 mục (đều có owner + hạn → đủ điều kiện CONDITIONAL GO)

| # | Q | Vấn đề | Owner | Hạn |
|---|---|---|---|---|
| H4 | Q5/Q14/Q132 | Preview share DB prod (code đã có write-block + noindex; còn tách project) | Platform/DevOps | 2 tuần; trước đó giữ block + không bật `ALLOW_PREVIEW_WRITES` |
| H5 | Q9 | File secret thật trên disk local (đã `.gitignore` + `security:check` pass; còn xóa `.bak`/`.ops-wizard`, đưa secret vào password manager) | Mọi dev + lead | 24h |
| H10 | Q177–Q180 | 4 câu hỏi founder (commander, risk-acceptance, luật, traffic x10) | Founder | Trước launch |

## A.4. Việc 24h còn lại (vận hành, không còn việc code chặn launch)

1. H5: dọn secret disk; H10: trả lời §10 (đặc biệt risk-acceptance văn bản cho H4).
2. Đặt `BACKUP_PASSPHRASE` (GitHub Secrets + password manager), xác nhận run backup daily đầu xanh.
3. Đặt creds VNPay live + `VNP_URL` live, giao dịch thật 1đ, đối soát audit log.
4. Bật branch protection + required CI (Q135); bật billing alert (Q150); xác nhận người nhận Telegram alert.
5. Chạy `perf:audit` + k6, ghi số LCP/p95; drill rollback 1 lần.

## A.5. Verdict sau re-audit: **CONDITIONAL GO** (0 BLOCKER, 0 FAIL, 3 HIGH còn lại đều là việc vận hành/con người có owner + hạn ở A.3–A.4; không marketing lớn tới khi H4 xong)
