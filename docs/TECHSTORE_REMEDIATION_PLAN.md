# TECHSTORE_REMEDIATION_PLAN.md

> Kế hoạch xử lý chi tiết dựa trên báo cáo audit ngày 2026-07-26.
> Tài liệu này là nguồn sự thật cho việc sửa lỗi phát hành, phân quyền, accessibility,
> hiệu năng, kiểm thử và khả năng vận hành của TechStore.
>
> Không được triển khai dàn trải. Mỗi phase phải hoàn thành, kiểm thử và review độc lập
> trước khi chuyển sang phase tiếp theo.

---

# 1. MỤC TIÊU

1. Loại bỏ hai lỗi P0 đang chặn phát hành.
2. Đưa code và database về cùng một version.
3. Ngăn guest giả mạo `user_id` khi checkout.
4. Ngăn public API làm lộ internal user identity.
5. Tạo release gate đáng tin cậy cho migration, build và E2E.
6. Sửa accessibility cho mobile drawer.
7. Đo và tối ưu LCP bằng production build.
8. Thay shared admin secret bằng account và role riêng.
9. Chuẩn bị hệ thống cho public launch ở quy mô cửa hàng nhỏ.

---

# 2. NGUYÊN TẮC TRIỂN KHAI

- Không deploy bản hiện tại trước khi P0 hoàn tất.
- Không thao tác production khi chưa xác nhận đúng project/environment.
- Mọi schema change phải nằm trong migration mới.
- Không sửa migration đã được apply.
- Không dùng service-role key ở client.
- Không tắt RLS để sửa lỗi.
- Không bỏ qua test database thật.
- Không gộp toàn bộ remediation vào một pull request.
- Mỗi pull request chỉ xử lý một nhóm rủi ro rõ ràng.
- Mỗi phase phải có rollback plan.
- Chưa commit/push cho đến khi diff, test và build đã được kiểm tra.

---

# 3. THỨ TỰ ƯU TIÊN

## Phase P0A — Đồng bộ schema và migration release gate

- Sửa lỗi build do thiếu `homepage_collections.filters`.
- Đảm bảo môi trường build/deploy dùng đúng schema version.
- Tạo cơ chế phát hiện migration chưa được apply.

## Phase P0B — Sửa authorization của checkout RPC

- Guest không thể truyền hoặc gán `user_id`.
- Authenticated user chỉ có thể tạo đơn cho chính mình.
- Public review API không làm lộ internal user UUID.

## Phase P1 — Admin identity và role thực tế

- Mỗi admin có account riêng.
- Role xuất phát từ server-side identity.
- Audit log ghi đúng actor.
- Có disable user và revoke session.

## Phase P2A — E2E và database release gate

- Có smoke suite nhanh, ổn định.
- CI kiểm tra migration, RLS, RPC và build trước deploy.

## Phase P2B — Accessibility mobile drawer

- Focus trap đúng.
- Background inert.
- Restore focus.
- Keyboard test đầy đủ.

## Phase P2C — LCP và image performance

- Đo bằng production build.
- Xác định ảnh LCP thực sự.
- Chỉ ưu tiên đúng ảnh above-the-fold.

## Phase P3 — Chuyển `middleware.ts` sang `proxy.ts`

- Loại bỏ deprecation warning.
- Giữ nguyên auth guard và matcher.
- Chuẩn bị cho nâng cấp Next.js.

---

# 4. PHASE P0A — SCHEMA SYNC VÀ MIGRATION RELEASE GATE

## 4.1 Vấn đề

Code luôn query `homepage_collections.filters`, nhưng môi trường build đang dùng schema cũ chưa có cột này.

Tác động:

- Production build fail ở prerender `/`.
- CI unit test có thể xanh nhưng deploy vẫn fail.
- Code và database không còn cùng version.

## 4.2 Công việc chi tiết

### Bước 1 — Xác định environment

Phải ghi rõ:

- Local Supabase project.
- Development/staging project.
- Production project.
- Database URL nào được dùng khi `npm run build`.
- CI dùng secret nào.
- Có build-time query trực tiếp production hay không.

Không được đoán environment từ tên biến.

### Bước 2 — Kiểm tra migration history

- Liệt kê migration local theo thứ tự.
- Kiểm tra migration đã apply ở development.
- Kiểm tra migration đã apply ở production.
- So sánh migration version/checksum nếu công cụ hỗ trợ.
- Xác định migration còn thiếu.
- Không apply migration ngoài thứ tự.

### Bước 3 — Apply migration còn thiếu

Xác nhận migration:

- Có cột `filters`.
- Default là `{}`.
- Có kiểu dữ liệu đúng.
- Có constraint đúng.
- Không làm mất dữ liệu cũ.
- Query cũ vẫn tương thích.

### Bước 4 — Schema assertion

Tạo script, ví dụ:

```text
scripts/check-required-schema.ts
```

Script phải kiểm tra tối thiểu:

- `homepage_collections.filters` tồn tại.
- Các function/RPC quan trọng tồn tại.
- Migration version tối thiểu đã được apply.
- Không in secret hoặc connection string vào log.

Nếu schema không đạt:

- Exit code khác 0.
- Thông báo object nào thiếu.
- Build/deploy dừng ngay.

### Bước 5 — Release gate

```text
install
→ lint
→ type-check
→ unit test
→ start/migrate test database
→ schema assertion
→ SQL integration test
→ production build
→ E2E smoke
→ deploy
```

Không cho deploy chạy nếu bất kỳ bước nào fail.

## 4.3 File dự kiến

```text
scripts/check-required-schema.ts
scripts/check-migration-state.ts
tests/database/schema-contract.test.ts
docs/RELEASE_AND_MIGRATION.md
```

Có thể sửa:

```text
package.json
.github/workflows/ci.yml
lib/content/queries.ts
```

## 4.4 Test bắt buộc

- Database cũ thiếu `filters` → schema check fail.
- Database đúng schema → schema check pass.
- `npm run build` pass với database đã migrate.
- CI không thể deploy khi migration thiếu.
- Migration apply lại không phá dữ liệu.
- Default `{}` hoạt động.
- Query collection hoạt động với `filters = {}`.

## 4.5 Acceptance criteria

- [ ] `homepage_collections.filters` tồn tại.
- [ ] Default `{}` đúng.
- [ ] Constraint đúng.
- [ ] Migration history được xác nhận.
- [ ] Build production pass.
- [ ] Có schema contract test.
- [ ] CI chặn deploy khi migration thiếu.
- [ ] Có tài liệu release/migration.

## 4.6 Rollback

- Backup schema/data trước migration production.
- Nếu migration fail, không tiếp tục deploy.
- Có rollback SQL được review trước.
- Nếu code mới chưa deploy, giữ code cũ.
- Nếu code mới đã deploy nhưng schema lỗi, rollback deployment và restore schema theo kế hoạch.

---

# 5. PHASE P0B — SỬA CHECKOUT RPC AUTHORIZATION

## 5.1 Vấn đề

RPC `place_order` là `SECURITY DEFINER` và cho phép caller truyền `p_user_id`.

Guest có thể:

- Gán đơn cho UUID khác.
- Ghi đè `customer_profiles`.
- Làm sai dữ liệu account và lịch sử đơn.

Ngoài ra public review API có nguy cơ làm lộ internal `user_id`.

## 5.2 Quyết định kiến trúc

- Bỏ hoàn toàn `p_user_id` khỏi public RPC signature.
- Authenticated order luôn lấy owner từ `auth.uid()`.
- Guest order luôn lưu `user_id = NULL`.
- Guest checkout không được upsert profile của authenticated user.
- Public review không được expose internal user UUID.
- Không tin `user_id` từ client payload dưới bất kỳ hình thức nào.

## 5.3 Migration mới

Migration phải:

1. Revoke execute function signature cũ.
2. Drop hoặc rename function signature cũ.
3. Tạo function mới không có `p_user_id`.
4. Grant execute đúng cho `anon` và `authenticated`.
5. Dùng `auth.uid()` làm nguồn identity duy nhất.
6. Chỉ upsert `customer_profiles` khi `auth.uid()` không null.
7. Guest order lưu `NULL` user_id.
8. Giữ transaction và inventory lock hiện có.
9. Giữ rate limit hiện có.
10. Không thay đổi calculation giá/coupon/tồn kho.

## 5.4 Review public reviews

### Phương án ưu tiên — Public view

Tạo view:

```text
public_product_reviews
```

Chỉ chứa:

- review id.
- product id.
- display name an toàn.
- rating.
- title.
- content.
- created_at.
- verified purchase nếu có.
- Không chứa `user_id`.

Không dựa vào frontend `select` để bảo vệ cột nhạy cảm.

## 5.5 Regression tests

### Guest

- Guest tạo order bình thường → `user_id IS NULL`.
- Guest không thể truyền `user_id`.
- Function signature cũ không còn execute được.
- Guest không thể thay đổi `customer_profiles`.
- Guest không thể làm order xuất hiện trong account khác.

### Authenticated

- Authenticated user tạo order → `user_id = auth.uid()`.
- Không thể tạo order cho user khác.
- Profile chỉ update cho chính user đó.
- Session không hợp lệ → không được gán owner.

### Review

- Public API không trả `user_id`.
- Authenticated client không có quyền đọc UUID internal nếu không cần.
- Admin query vẫn truy vết review owner khi có permission phù hợp.

## 5.6 File dự kiến

```text
supabase/migrations/<timestamp>_secure_place_order_identity.sql
supabase/migrations/<timestamp>_public_reviews_view.sql
tests/database/place-order-authorization.sql
tests/database/public-reviews-privacy.sql
tests/integration/checkout-auth-boundary.test.ts
```

## 5.7 Acceptance criteria

- [ ] RPC mới không nhận `p_user_id`.
- [ ] Signature cũ bị revoke/drop.
- [ ] Guest order luôn có `user_id = NULL`.
- [ ] Auth order luôn dùng `auth.uid()`.
- [ ] Guest không update profile.
- [ ] Public review API không lộ UUID nội bộ.
- [ ] Regression tests pass.
- [ ] Build pass.
- [ ] Checkout E2E pass.

## 5.8 Rollback

- Giữ SQL backup function cũ nhưng không để execute public.
- Nếu RPC mới lỗi commerce, rollback app code nhưng không khôi phục lỗ hổng.
- Có thể tạo hotfix function tương thích nhưng vẫn không nhận `p_user_id`.
- Không rollback về signature insecure.

---

# 6. PHASE P1 — ADMIN ACCOUNT VÀ ROLE THỰC TẾ

## 6.1 Vấn đề

Trước phase này, Admin dùng một shared `ADMIN_SECRET`.

Rủi ro:

- Không biết ai thao tác.
- Không revoke riêng một người.
- Không có role thật.
- Audit log không có actor đáng tin.
- Một secret lộ ảnh hưởng toàn bộ admin.

## 6.2 Kiến trúc mục tiêu

- Supabase Auth.
- Bảng `admin_users` hoặc `staff_profiles`.
- Role server-side.
- Permission matrix.
- Session riêng từng người.
- Audit actor.
- Disable account.
- Session revocation.
- MFA cho admin khi public launch.

## 6.3 Schema đề xuất

```text
admin_users
- user_id uuid primary key references auth.users
- display_name text
- role admin_role
- is_active boolean
- created_at
- updated_at
- disabled_at
```

Role:

```text
admin
manager
staff
```

Không dùng `user_metadata` làm nguồn role tin cậy.

## 6.4 Permission matrix

### admin

- Toàn quyền.

### manager

- Products.
- Categories.
- Brands.
- Inventory.
- Orders.
- Coupons.
- Reports.

### staff

- Xem đơn.
- Cập nhật trạng thái hợp lệ.
- Xem tồn kho.
- Điều chỉnh hạn chế khi được cấp.

## 6.5 Chuyển đổi

1. Thêm auth mới song song.
2. Bootstrap admin đầu tiên.
3. Test login mới.
4. Test guard route.
5. Test role.
6. Test audit actor.
7. Test disable account.
8. Sau khi ổn định mới xóa shared secret trong PR riêng.

## 6.6 Acceptance criteria

- [x] Mỗi admin có identity riêng.
- [x] Role lấy server-side.
- [x] Shared secret bị loại khỏi production.
- [x] Disable user hoạt động.
- [x] Revoke session hoạt động.
- [x] Audit actor chính xác.
- [x] MFA bắt buộc AAL2 cho mọi Staff Account active.
- [x] Permission tests pass.

---

# 7. PHASE P2A — E2E VÀ DATABASE RELEASE GATE

## 7.1 Smoke suite tối thiểu

1. Homepage trả 200 và render content.
2. Catalog mở được.
3. PDP mở được.
4. Add to cart.
5. Guest checkout.
6. Track order.
7. Customer account guard.
8. Admin guard.
9. Schema contract.
10. Checkout authorization boundary.

## 7.2 Test database

- Mỗi CI run dùng database riêng hoặc reset sạch.
- Apply toàn bộ migration theo thứ tự.
- Seed dữ liệu tối thiểu.
- Không chạy test phá dữ liệu production.
- Test RLS bằng role `anon`, `authenticated`, `service_role` phù hợp.
- Log migration failure rõ ràng.

## 7.3 Timeout và artifact

- Mỗi test có timeout rõ.
- Khi timeout lưu trace/screenshot/log.
- Không dùng timeout lớn để che test treo.

## 7.4 Acceptance criteria

- [ ] Smoke suite hoàn tất ổn định.
- [ ] Có pass/fail rõ.
- [ ] Trace được lưu khi fail.
- [ ] CI dùng schema đã migrate.
- [ ] P0 regression nằm trong gate.
- [ ] Deploy phụ thuộc smoke suite.

---

# 8. PHASE P2B — MOBILE DRAWER ACCESSIBILITY

## 8.1 Phạm vi

- Storefront mobile drawer.
- Admin mobile drawer.

## 8.2 Yêu cầu

Khi mở drawer:

- Focus chuyển vào drawer.
- Tab/Shift+Tab chỉ vòng trong drawer.
- Background được `inert` hoặc tương đương.
- Body scroll bị khóa.
- Escape đóng.
- Focus quay về trigger.
- `aria-modal="true"`.
- Có accessible label.
- Screen reader không tương tác với nền.

## 8.3 Test

- Tab vòng đúng.
- Shift+Tab vòng đúng.
- Escape đóng.
- Focus restore.
- Background không focus được.
- Touch close hoạt động.
- Screen reader semantics đúng.

## 8.4 Acceptance criteria

- [ ] Không focus ra nền.
- [ ] Background inert.
- [ ] Restore focus.
- [ ] Storefront và admin dùng pattern nhất quán.
- [ ] A11y test pass.

---

# 9. PHASE P2C — LCP VÀ IMAGE PERFORMANCE

## 9.1 Công việc

1. Build production.
2. Chạy Lighthouse/Web Vitals ở 375px, 768px, 1440px.
3. Xác định element LCP thật.
4. Kiểm tra ảnh hero/product tile đầu tiên.
5. Chỉ đặt `priority` cho ảnh LCP.
6. Khai báo `sizes` đúng.
7. Có width/height hoặc aspect ratio.
8. Lazy-load ảnh dưới fold.
9. Không dùng placeholder remote làm dữ liệu production.
10. Kiểm tra cache headers/CDN.

## 9.2 Performance budget

- LCP < 2.5s.
- CLS < 0.1.
- INP < 200ms.
- Không preload quá nhiều ảnh.
- Không đặt `priority` cho toàn bộ product card.

## 9.3 Acceptance criteria

- [ ] Đã xác định LCP theo breakpoint.
- [ ] Chỉ ảnh cần thiết dùng priority.
- [ ] `sizes` đúng.
- [ ] Ảnh dưới fold lazy.
- [ ] Lighthouse đạt ngưỡng hoặc có tài liệu giải thích.
- [ ] Không layout shift rõ từ ảnh.

---

# 10. PHASE P3 — CHUYỂN MIDDLEWARE SANG PROXY

## 10.1 Công việc

- Đọc Next.js version hiện tại.
- Chuyển logic từ `middleware.ts` sang `proxy.ts` đúng convention.
- Giữ matcher.
- Giữ redirect logic.
- Giữ admin/customer guard.
- Không thay đổi cookie semantics.
- Thêm test route protection.

## 10.2 Test

- Guest vào admin → redirect login.
- Guest vào account → redirect login.
- Authenticated user vào account → pass.
- Admin hợp lệ vào admin → pass.
- Static asset không bị chặn.
- API không bị redirect sai.
- Không redirect loop.

## 10.3 Acceptance criteria

- [ ] Không còn warning middleware deprecate.
- [ ] Matcher đúng.
- [ ] Auth guard không đổi hành vi.
- [ ] Tests pass.
- [ ] Build pass.

---

# 11. OBSERVABILITY VÀ VẬN HÀNH

Theo dõi tối thiểu:

- Build failure.
- Migration failure.
- Checkout failure.
- RPC authorization failure.
- E2E failure.
- LCP/CLS/INP.
- Rate limit hits.
- Order creation error.

Không log:

- Password.
- Token.
- Cookie.
- Secret.
- Dữ liệu cá nhân dư thừa.

---

# 12. BRANCH VÀ PULL REQUEST

```text
fix/p0-schema-sync
fix/p0-checkout-authorization
feat/admin-auth-roles
test/e2e-release-gate
fix/mobile-drawer-a11y
perf/lcp-images
chore/next-proxy-migration
```

Mỗi PR phải có:

- Vấn đề.
- Nguyên nhân gốc.
- Phạm vi.
- Migration.
- Test.
- Security impact.
- Rollback.
- Screenshots/trace nếu liên quan UI.
- Checklist.

---

# 13. DEFINITION OF DONE

Một phase chỉ hoàn thành khi:

- Code đúng phạm vi.
- Migration mới, không sửa migration cũ.
- RLS không bị tắt.
- Unit test pass.
- SQL/integration test pass nếu liên quan database.
- E2E pass nếu liên quan user flow.
- Lint pass.
- Type-check pass.
- Production build pass.
- Diff đã review.
- Không có secret trong repository.
- Có rollback plan.
- Có tài liệu cập nhật.
- Không còn issue CRITICAL/HIGH trong phạm vi phase.

---

# 14. CHECKLIST PUBLIC LAUNCH

- [ ] Production database đúng migration version.
- [ ] Production build pass.
- [ ] Guest không thể gán đơn cho user khác.
- [ ] Guest không thể sửa profile user khác.
- [ ] Public review API không lộ internal UUID.
- [ ] E2E checkout pass.
- [ ] Track-order pass.
- [ ] Admin guard pass.
- [ ] Customer guard pass.
- [ ] Mobile drawer accessible.
- [ ] LCP/CLS/INP được đo.
- [ ] Error/migration monitoring hoạt động.
- [ ] Shared admin secret không dùng khi có nhiều admin.
- [ ] Backup/rollback được kiểm chứng.

---

# 15. PROMPT BẮT ĐẦU P0A

```text
Hãy đọc:

1. CLAUDE.md
2. TECHSTORE_REMEDIATION_PLAN.md
3. BAO_CAO_VAN_DE_CAN_XU_LY.md
4. Toàn bộ Supabase migrations
5. lib/content/queries.ts
6. package.json
7. CI workflow hiện tại
8. Cấu hình environment liên quan build

Hiện tại chỉ xử lý Phase P0A: Schema sync và migration release gate.

Chưa sửa code ngay.

Trước tiên hãy trả về:

- Database/environment nào đang được dùng khi build.
- Migration nào đã apply và migration nào còn thiếu.
- Schema hiện tại của homepage_collections.
- Tác động của migration dynamic_collections.
- Kế hoạch apply migration an toàn.
- Schema assertion cần tạo.
- Release gate cần sửa.
- File dự kiến thay đổi.
- Test plan.
- Rollback plan.

Không thao tác production, không chạy migration production, không commit và không push
cho đến khi tôi xác nhận.
```

---

# 16. PROMPT BẮT ĐẦU P0B

```text
Hãy đọc:

1. CLAUDE.md
2. TECHSTORE_REMEDIATION_PLAN.md
3. BAO_CAO_VAN_DE_CAN_XU_LY.md
4. Migration chứa place_order
5. Checkout server actions/RPC callers
6. product_reviews schema, RLS và query
7. Các SQL test hiện có

Hiện tại chỉ xử lý Phase P0B: Checkout RPC authorization và review privacy.

Chưa sửa code ngay.

Trước tiên hãy trả về:

- Function signature hiện tại.
- Execute grants hiện tại.
- Identity flow cho guest và authenticated user.
- Profile upsert flow.
- Public review exposure.
- Migration mới đề xuất.
- Cách revoke/drop signature cũ.
- Regression SQL tests.
- App code cần sửa.
- Rollback plan.

Yêu cầu bắt buộc:

- RPC mới không nhận p_user_id.
- Guest order luôn user_id NULL.
- Auth order dùng auth.uid().
- Guest không update customer_profiles.
- Public review API không trả internal user_id.
- Không được rollback về function insecure.

Không chạy migration production, không commit và không push trước khi tôi xác nhận.
```

---

# 17. TÀI LIỆU NGUỒN

Kế hoạch này được tạo từ:

```text
BAO_CAO_VAN_DE_CAN_XU_LY.md
```

Giữ file báo cáo gốc trong repository để truy vết bằng chứng và quyết định.
