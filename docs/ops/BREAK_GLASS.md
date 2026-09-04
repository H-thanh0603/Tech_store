# Break-glass: khôi phục quyền admin khi mất MFA

Tình huống: admin duy nhất mất authenticator / mất mã TOTP, không qua được
`/admin/mfa/verify`. Mọi thao tác dưới đây cần **chủ shop phê duyệt** (nhắn xác
nhận + ghi lại), vì chúng bypass lớp MFA.

## Phòng ngừa (làm trước khi sự cố xảy ra)

1. Luôn duy trì **≥ 2 tài khoản admin hoạt động** (1 admin + 1 manager dự phòng).
2. Mỗi người lưu **backup key TOTP** ra giấy, cất riêng khỏi điện thoại.
3. Người giữ `SUPABASE_SERVICE_ROLE_KEY` và quyền Supabase Dashboard phải là chủ
   shop — không chia sẻ qua chat thường.

## Cách A — Reset MFA qua Dashboard (khuyên dùng)

1. Mở Supabase Dashboard → project → **Authentication → Users** → tìm email admin.
2. Xóa hết factors trong **MFA Factors** của user đó.
3. Admin đăng nhập lại tại `/admin/login` → hệ thống chuyển sang
   `/admin/mfa/setup` → quét mã QR mới bằng app Authenticator.
4. Đăng nhập thành công = xong. Ghi nhận vào `admin_audit_logs` (xem mục 5).

## Cách B — Reset MFA bằng SQL (khi Dashboard không vào được)

Chạy trong SQL Editor (dán `user_id` của admin — lấy ở Authentication → Users):

```sql
-- Xem factors hiện tại
select id, friendly_name, status
from auth.mfa_factors
where user_id = '<ADMIN_USER_UUID>';

-- Xóa để user setup lại từ đầu
delete from auth.mfa_factors
where user_id = '<ADMIN_USER_UUID>';
```

Sau đó đăng nhập lại như cách A bước 3. Đồng thời kiểm tra dòng admin còn active:

```sql
select user_id, role, is_active from admin_users
where user_id = '<ADMIN_USER_UUID>';
-- is_active phải là true; nếu false: update admin_users set is_active = true ...
```

## Cách C — Tạo admin dự phòng bằng seed script

Khi tài khoản cũ không cứu được (mất cả email), tạo tài khoản mới từ máy có
`.env.local` chứa service_role key:

```bash
ADMIN_E2E_EMAIL="<email-moi>" ADMIN_E2E_PASSWORD="<mat-khau-manh>" npm run admin:seed
```

Script tạo Auth user + dòng `admin_users` (role admin) + enroll TOTP mới, in secret
ra file `.admin-e2e-mfa-secret` (quyền 0600, đã git-ignore). Quét secret vào app
Authenticator rồi đăng nhập.

## Sau khi khôi phục (bắt buộc)

1. Ghi audit: `insert into admin_audit_logs (action, entity_type, actor_label, payload)`
   với `action = 'admin_mfa_reset'`, nêu lý do + người phê duyệt.
2. Vô hiệu hóa tài khoản/tokens cũ nếu nghi lộ (đổi password qua Dashboard).
3. Khôi phục lại mức dự phòng: đủ 2 admin + backup key giấy.
4. Nếu production: kiểm tra không còn session lạ (Supabase Dashboard → Auth logs).
