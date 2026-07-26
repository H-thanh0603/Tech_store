# Chuyển admin sang Supabase Auth

Production luôn dùng Supabase Auth; `ADMIN_SECRET` chỉ còn là chế độ chuyển tiếp cho local/test.

## Bootstrap admin đầu tiên

1. Tạo hoặc xác nhận user email/password trong Supabase Auth.
2. Lấy UUID của user đó.
3. Chạy bằng quyền database owner/service role:

```sql
insert into public.admin_users (user_id, display_name, role)
values ('<AUTH_USER_UUID>', 'Tên quản trị viên', 'admin');
```

Không đưa UUID, email hay credential thật vào migration/seed chung.

## Vận hành

- Đổi `role` giữa `admin`, `manager`, `staff` có hiệu lực ở request kế tiếp.
- Đặt `is_active = false` để thu hồi quyền ứng dụng ngay cả khi access token còn hạn.
- Đăng xuất hoặc revoke session trong Supabase Auth khi thiết bị/credential bị nghi lộ.
- Admin và manager được điều chỉnh tồn kho; staff chỉ xem tồn kho và xử lý trạng thái đơn.
- Audit dùng `display_name` của tài khoản, không dùng nhãn `admin` dùng chung.

## MFA

MFA AAL2 là điều kiện bắt buộc trước public launch sau khi toàn bộ admin đã enrol TOTP. Không bật
cưỡng chế trước khi có ít nhất hai admin recovery-capable để tránh tự khóa hệ thống.
