# Báo cáo vấn đề, điểm yếu và hạng mục cần xử lý

> **Trạng thái (cập nhật 2026-09): TÀI LIỆU LƯU TRỮ.** Các P0 trong báo cáo này
> đã được xử lý (schema drift + guest authorization qua các migration checkout
> trust boundary; xem `RELEASE_AND_MIGRATION.md`). Đừng dùng kết luận "KHÔNG ĐẠT"
> bên dưới để đánh giá hiện trạng.

**Dự án:** TechStore  
**Ngày audit:** 2026-07-26  
**Trạng thái phát hành:** **KHÔNG ĐẠT** — còn lỗi chặn build và lỗ hổng phân quyền.  
**Phạm vi:** storefront Next.js, Supabase schema/RLS/RPC, admin, kiểm thử và khả năng phát hành.

---

## 1. Tóm tắt ưu tiên

| Mức độ | Số lượng | Ý nghĩa | Trạng thái |
| --- | ---: | --- | --- |
| P0 — Blocking | 2 | Có thể gây lộ/sai dữ liệu hoặc không thể phát hành | Phải xử lý ngay |
| P1 — Major | 1 | Rủi ro bảo mật/vận hành lớn khi dùng thực tế | Xử lý trước khi mở rộng vận hành |
| P2 — Important | 3 | Ảnh hưởng chất lượng, accessibility hoặc độ tin cậy release | Lên kế hoạch sprint kế tiếp |
| P3 — Maintenance | 1 | Nợ kỹ thuật nhỏ, chưa chặn chức năng | Xử lý khi làm sạch codebase |

### Quyết định nên đưa ra ngay

1. Không deploy bản hiện tại trước khi xử lý hai P0.
2. Áp dụng migration còn thiếu cho đúng môi trường database trước khi build/deploy.
3. Sửa RPC checkout để guest không thể truyền hoặc gán `user_id`.
4. Thêm test regression cho hai lỗi P0 để không tái diễn.

---

## 2. Lỗi chặn phát hành (P0)

### P0-01 — Database schema bị lệch với code, production build fail

**Bằng chứng tái hiện**

`npm run build` compile và type-check thành công, nhưng fail khi prerender trang chủ:

```text
[content] failed to load homepage collections
message: column homepage_collections.filters does not exist
Error occurred prerendering page "/"
```

**Vị trí liên quan**

- `lib/content/queries.ts:49-50` luôn query trường `filters` trong `homepage_collections`.
- `supabase/migrations/202607260018_dynamic_collections.sql:29-30` mới thêm cột `filters`.
- Artifact migration hiện có chỉ phản ánh content foundation trước migration này, cho thấy môi trường build đang dùng schema cũ.

**Tác động**

- Không tạo được production build; deploy static/SSR có thể dừng ngay tại trang chủ.
- CI có thể báo xanh ở unit test nhưng vẫn fail ở bước deploy.
- Code và database không còn cùng một version, nên những thay đổi schema sau này có nguy cơ tiếp tục vỡ âm thầm.

**Cách xử lý tối thiểu**

1. Xác định database mà môi trường production/build đang trỏ tới.
2. Kiểm tra lịch sử migration và áp dụng `202607260018_dynamic_collections.sql` cùng mọi migration chưa chạy theo đúng thứ tự.
3. Chạy lại production build sau migration.
4. Thêm release gate: migration phải được áp dụng/xác nhận trước build hoặc deploy.

**Tiêu chí hoàn thành**

- `homepage_collections.filters` tồn tại, có default `{}` và constraint đúng migration.
- `npm run build` hoàn tất thành công.
- Có kiểm tra tự động phát hiện migration chưa được áp dụng.

---

### P0-02 — Guest có thể gán đơn hàng và ghi đè profile của tài khoản khác

**Nguyên nhân gốc**

Hàm `place_order` trong `supabase/migrations/202607250014_customer_auth_reviews.sql:122` là `SECURITY DEFINER` và được cấp quyền thực thi cho `anon`/`authenticated`.

Tại logic quanh dòng 159:

```sql
v_user_id := auth.uid();
if v_user_id is null then
  v_user_id := p_user_id;
end if;
```

Nghĩa là caller guest có thể truyền `p_user_id` tùy ý. Hàm sau đó:

- ghi `user_id` đó vào `orders`;
- upsert dữ liệu checkout vào `customer_profiles` với quyền `SECURITY DEFINER`.

`product_reviews` có policy public read trong cùng migration, trong khi bảng chứa `user_id`. Frontend chỉ chọn các cột an toàn, nhưng Supabase Data API vẫn có thể bị gọi trực tiếp để lấy các cột được phép đọc.

**Chuỗi khai thác**

1. Attacker lấy một UUID user từ review công khai/Data API.
2. Attacker tạo cart của chính mình qua RPC public.
3. Attacker gọi trực tiếp RPC `place_order` với `p_user_id` là UUID nạn nhân.
4. Đơn xuất hiện trong account nạn nhân; profile nạn nhân có thể bị ghi đè bởi tên, điện thoại và địa chỉ của attacker.

**Tác động**

- Sai lệch dữ liệu khách hàng và lịch sử đơn hàng.
- Rò rỉ hoặc thay đổi thông tin profile trái phép.
- Làm hỏng quy trình chăm sóc khách hàng, giao hàng và đối soát.

**Cách xử lý tối thiểu**

1. Bỏ tham số `p_user_id` khỏi RPC `place_order`.
2. Chỉ lấy `user_id` bằng `auth.uid()`; nếu không có session, luôn lưu `NULL` cho guest order.
3. Xóa/đổi quyền function signature cũ trước khi cấp lại quyền execute.
4. Không cho Data API public trả về `product_reviews.user_id`; dùng view chỉ chứa các cột public hoặc tách identity nội bộ khỏi bảng review public.
5. Thêm SQL regression test: anon gọi `place_order` với UUID khác phải không tạo/không gán đơn và không thay đổi profile.

**Tiêu chí hoàn thành**

- Guest order không thể có `user_id`.
- Authenticated order luôn dùng chính `auth.uid()`.
- API public không trả UUID tài khoản từ review.
- Regression test chứng minh không thể giả mạo owner.

---

## 3. Rủi ro vận hành và phân quyền (P1)

### P1-01 — Admin dùng shared secret, chưa có tài khoản/role thực tế

**Vị trí liên quan**

- `lib/admin/auth.ts`: cookie HMAC được tạo từ duy nhất `ADMIN_SECRET`, TTL 12 giờ.
- `lib/admin/permissions.ts`: tất cả session hiện được gán `DEFAULT_ADMIN_ROLE = 'admin'`.

**Điểm yếu**

- Không có tài khoản admin riêng cho từng người.
- Không thể biết chính xác ai đã thực hiện một thao tác.
- Không thể thu hồi riêng session bị lộ; đổi secret sẽ đăng xuất toàn bộ người dùng admin.
- Các role `manager` và `staff` mới chỉ là cấu trúc UI/quyền lý thuyết, không xuất phát từ identity thực.

**Khi nào trở thành bắt buộc**

Phải xử lý trước khi có nhiều hơn một người dùng admin, khi mở admin qua Internet, hoặc khi admin được phép sửa giá/tồn kho/đơn hàng thật.

**Hướng xử lý**

- Dùng identity riêng cho từng nhân viên (Supabase Auth hoặc provider tương đương).
- Lưu role server-side/app metadata an toàn; không dựa vào `user_metadata`.
- Ghi actor thực vào audit log; hỗ trợ disable user và revoke session.
- Có thể giữ shared secret chỉ cho môi trường demo nội bộ một người.

---

## 4. Accessibility và trải nghiệm mobile (P2)

### P2-01 — Drawer mobile khai báo modal nhưng không giữ focus bên trong

**Vị trí**

- `components/layout/mobile-nav-drawer.tsx`
- `components/admin/shell/mobile-nav-drawer.tsx`

**Hiện trạng**

Drawer có `role="dialog"`, `aria-modal="true"`, đưa focus vào panel và đóng bằng Escape. Tuy nhiên không có focus trap cho Tab/Shift+Tab và không làm phần nền `inert`.

**Tác động**

Người dùng bàn phím có thể Tab sang các control phía sau drawer trong khi screen reader được thông báo đây là modal. Focus order trở nên khó hiểu, đặc biệt trên mobile/admin.

**Hướng xử lý**

- Thêm trap Tab/Shift+Tab nhỏ gọn trong drawer hiện tại, hoặc dùng `inert` cho content phía sau khi drawer mở.
- Giữ Escape, restore focus và body-scroll lock như hiện có.
- Thêm test keyboard: mở drawer → Tab vòng trong drawer → Escape → focus quay lại trigger.

---

## 5. Hiệu năng, kiểm thử và độ tin cậy release (P2)

### P2-02 — LCP image cần được đo và tối ưu theo ảnh thực tế

Dev server log phát hiện ảnh `placehold.co/800x800?...iPhone+15` là Largest Contentful Paint và khuyến nghị eager-load.

**Rủi ro**

- Ảnh hero/ảnh đầu trang có thể không được ưu tiên đúng trên dữ liệu thật.
- Placeholder remote làm số đo local không phản ánh hoàn toàn production, nhưng vẫn là tín hiệu cần kiểm chứng.

**Hướng xử lý**

- Đo LCP bằng Lighthouse hoặc Web Vitals trên build production.
- Xác định đúng ảnh above-the-fold theo từng breakpoint.
- Chỉ đặt `priority` cho ảnh LCP thực sự; khai báo `sizes` chính xác; lazy-load phần dưới fold.

### P2-03 — E2E hiện chưa là release gate đáng tin cậy

`npm run test:e2e` không hoàn tất trong 182 giây của lượt audit. Dev server trả HTTP 200, nhưng toàn suite không kết thúc để cung cấp một kết quả pass/fail đáng tin cậy.

**Rủi ro**

- Lỗi luồng thật chỉ xuất hiện khi browser + database + migration cùng chạy có thể lọt qua unit test.
- Hiện unit test xanh không phát hiện P0 schema drift hoặc P0 RPC authorization.

**Hướng xử lý**

- Tách E2E smoke tối thiểu chạy nhanh: homepage, cart, checkout guest, tracking, admin guard.
- Dùng database/schema đã được migration cho E2E.
- Đặt timeout rõ ràng theo test, log nguyên nhân fail và dùng suite đó trong CI trước deploy.
- Bổ sung test integration SQL cho RLS, RPC execute grants và authorization boundary.

---

## 6. Nợ kỹ thuật (P3)

### P3-01 — `middleware.ts` đã bị Next.js deprecate

Build cảnh báo convention `middleware` sẽ được thay bằng `proxy`.

**Tác động hiện tại:** chưa làm hỏng app, nhưng có thể thành breaking change ở lần nâng Next.js sau.

**Hướng xử lý:** chuyển middleware hiện có sang convention `proxy.ts`, giữ nguyên matcher và test guard admin/customer session.

---

## 7. Các điểm tốt cần giữ

- RLS được bật cho các bảng commerce; browser không có direct-write policy.
- Checkout tính lại giá, coupon và tồn kho trong database; inventory được lock theo thứ tự xác định để giảm oversell.
- Order tracking trả lỗi đồng nhất cho mã/số điện thoại sai và có rate limit theo bucket.
- Input ở server action được kiểm tra bằng Zod.
- `prefers-reduced-motion`, focus-visible và nhiều touch target tối thiểu đã có mặt.
- `npm run lint` pass.
- `npm run type-check` pass.
- `npm test -- --run` pass: 39 test files, 251 tests.

Các điểm trên là nền tảng tốt, nhưng không thay thế kiểm thử database thật và production build.

---

## 8. Những hạng mục chưa có hoặc chưa đủ cho vận hành thật

| Hạng mục | Trạng thái hiện tại | Khi nào cần bổ sung |
| --- | --- | --- |
| Quản trị nhiều nhân viên | Shared secret một admin | Trước khi giao admin cho người thứ hai |
| Thu hồi phiên/MFA/audit actor | Chưa có identity admin riêng | Trước khi mở admin Internet hoặc xử lý đơn thật |
| Migration release gate | Chưa có, schema drift đã xảy ra | Ngay bây giờ |
| Integration test Supabase/RLS | Có SQL test source nhưng chưa là gate chứng minh môi trường deploy | Ngay bây giờ |
| E2E release gate | Suite chưa hoàn tất ổn định trong audit | Trước public launch |
| Payment webhook | Admin xác nhận chuyển khoản thủ công | Chỉ cần khi số đơn/chuyển khoản tăng; MVP có thể giữ manual |
| Observability | Chưa xác minh error tracking, alert build hoặc cảnh báo migration | Trước khi có traffic thật |

---

## 9. Kế hoạch xử lý ngắn gọn

### Giai đoạn 1 — Chặn rủi ro ngay

1. Apply migration bị thiếu, kiểm tra production build.
2. Sửa `place_order` để guest không thể truyền `user_id`.
3. Ẩn `product_reviews.user_id` khỏi public Data API.
4. Thêm regression test cho schema drift và authorization của checkout.

### Giai đoạn 2 — Đủ điều kiện release

1. Làm E2E smoke ổn định và chạy trong CI.
2. Sửa focus trap cho hai mobile drawer.
3. Đo LCP bằng production build và tối ưu ảnh above-the-fold.

### Giai đoạn 3 — Sẵn sàng vận hành mở rộng

1. Thay shared admin secret bằng account + role per user.
2. Bổ sung audit actor, session revocation và MFA phù hợp.
3. Chuyển `middleware.ts` sang `proxy.ts`.

---

## 10. Checklist trước khi public launch

- [ ] Production build pass với database production thật.
- [ ] Mọi migration cần thiết đã được apply và kiểm tra version.
- [ ] Guest không thể gán/ghi đè dữ liệu của user khác qua RPC.
- [ ] Public Data API không lộ internal `user_id`.
- [ ] E2E checkout, tracking và admin guard pass trong CI.
- [ ] Mobile drawer hoạt động đúng bằng keyboard/screen reader.
- [ ] LCP, lỗi runtime và migration failure có monitoring cơ bản.

