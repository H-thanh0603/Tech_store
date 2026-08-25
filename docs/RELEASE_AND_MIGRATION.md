# Release và migration

## Thứ tự bắt buộc

1. Chạy `supabase db reset --yes` và `supabase test db` trên database local.
2. Chạy `npm run schema:check`, `npm run lint`, `npm run type-check`, `npm test -- --run`, `npm run build`.
3. Áp dụng toàn bộ migration lên môi trường đích.
4. Chạy lại `npm run schema:check` với URL và anon key của môi trường đích.
5. Chỉ deploy ứng dụng khi bước 4 thành công.
6. Sau deploy, chạy smoke test checkout, tra cứu đơn và trang admin.

## Quy tắc rollback

- Không rollback bằng cách sửa hoặc xóa migration đã phát hành.
- Tạo migration bù để khôi phục contract cũ, sau đó redeploy bản ứng dụng tương thích.
- Nếu schema contract không đạt, dừng deploy ứng dụng; không dùng fallback để che lỗi schema.

## Biến môi trường tối thiểu

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` chỉ ở server/CI, không được đưa vào client bundle.

Supabase Auth phải bật TOTP enrollment và verification; admin dashboard yêu cầu AAL2.

Không ghi giá trị secret vào log, tài liệu, artifact deploy hoặc repository.
