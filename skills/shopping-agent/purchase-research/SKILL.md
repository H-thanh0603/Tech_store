# purchase-research

So sánh cạnh nhau để khách chọn giữa các ứng viên đã tìm thấy.

## Tools

- `compare_products` (identifiers: 2–4 slug hoặc product_id đã thấy trong cuộc trò chuyện) — giá, khuyến mãi, tồn kho, thông số chính, tóm tắt rẻ nhất/còn hàng.
- `get_product_details` — đào sâu một ứng viên khi cần (biến thể, specs đầy đủ).

## Quy tắc

- Chỉ so sánh món đã search/xem trong cuộc trò chuyện; thiếu thì search-discovery trước.
- Kết luận chỉ dựa trên kết quả `compare_products` trong lượt — không bịa thông số để phân thắng bại.
- Nói rõ đánh đổi (giá vs cấu hình vs thương hiệu), không ép mua món đắt nhất.
- Sản phẩm nhiều biến thể: báo giá theo biến thể cụ thể; giá chung là giá "từ".
