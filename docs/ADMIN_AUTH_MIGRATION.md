# Chuyển admin sang Supabase Auth

Production và local đều dùng Supabase Auth với TOTP MFA bắt buộc.

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
- Audit lưu cả nhãn hiển thị và UUID bất biến của actor.

## MFA

Mọi Staff Account active phải đạt AAL2. Phiên chỉ có password được chuyển tới setup/verify và không
thể gọi admin mutation. Duy trì ít nhất hai Admin để recovery; trường hợp admin duy nhất phải xóa
factor qua Supabase Dashboard, ghi incident thủ công và đăng ký TOTP mới ngay.
