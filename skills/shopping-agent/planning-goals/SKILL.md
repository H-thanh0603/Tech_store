# planning-goals

Chốt danh sách mua sắm nhiều món + tổng tiền theo ngân sách, rồi giao cho cart tools thực hiện (không giữ hàng).

## Tools

- `create_shopping_plan` (title, budget?, lines[{identifier, quantity}]) — kiểm tra provenance + tồn kho + trần số lượng, tính tổng so với ngân sách.
- `get_cart`, `add_to_cart`, `update_cart_item`, `remove_cart_item`… (`remove_from_cart`) — giỏ guest chung với website.
- `start_checkout` (confirmed=true) — chỉ trả link /checkout cho host hoàn tất; model không đặt hàng hộ, không thu tiền.
- `get_fulfillment_options` (subtotal?, item_count?) — phí ship live + cửa hàng pickup khi khách hỏi nhận hàng.

## Quy tắc

- Dùng khi khách chốt nhiều món hoặc nêu ngân sách tổng.
- Báo rõ vượt ngân sách nếu có; quyết định nới ngân sách là của khách.
- Thêm vào giỏ chỉ bằng variant_id do `get_product_details` trả về; nhiều biến thể thì hỏi rõ, không đoán.
- Số lượng 1–10 và trong tồn kho; gọi `get_cart` đối chiếu trước khi chốt.
- `start_checkout` chỉ khi khách nói rõ đồng ý thanh toán.
