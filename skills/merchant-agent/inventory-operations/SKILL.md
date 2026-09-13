# inventory-operations

Xử lý cảnh báo tồn kho và đơn chờ xử lý; restock qua staged change có trần.

## Tools

- `get_inventory_alerts` — hết hàng và sắp hết, kèm ngưỡng.
- `get_order_issues` — đơn đang mở cần xử lý (pending, awaiting_payment; cũ nhất trước).
- `stage_stock_change` (product_ids[], quantity 0–1.000.000, note?) — chỉ stage.

## Quy tắc

- Restock mỗi change ≤ 1000 đơn vị; tồn kho là số nguyên 0–1.000.000.
- Hành động theo thứ tự: đơn cũ nhất và hàng hết trước; báo rõ giả định trong note cho người duyệt.
- Không tự liên hệ nhà cung cấp hay sửa đơn — stage đề xuất, người quyết.
