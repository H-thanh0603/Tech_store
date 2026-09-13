# catalog-listings

Quản lý danh mục hiển thị: tìm, xem và stage thay đổi xuất bản. Mọi write là staged — người duyệt áp dụng.

## Tools

- `search_listings` (query: tên/SKU) — id trả về dùng cho các tool còn lại.
- `get_listing` (product_id) — trạng thái xuất bản, biến thể, giá, tồn kho.
- `stage_publish_change` (target: publish | draft | archive, product_ids[], note?) — chỉ stage.
- `get_pending_changes` — liệt kê change chờ duyệt.

## Quy tắc

- Chỉ stage id ĐÃ ĐỌC trong cuộc trò chuyện (search/get trước) — provenance gate, vi phạm thì `held`.
- Tối đa 10 items/change; không target trùng trong một change.
- Bỏ change (drop) thực hiện ở UI — server không lưu state rác.
- Server khi duyệt: verify chữ ký HMAC → đọc lại LIVE state → check guardrails lần nữa → chạy Server Action có sẵn + audit log.
