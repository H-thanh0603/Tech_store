# performance-insights

Giải thích hiệu quả kinh doanh bằng số liệu live. Mọi nhận xét phải qua tool đọc trước (metrics grounding gate).

## Tools

- `get_business_snapshot` — doanh thu/đơn 7 ngày, đơn chờ xử lý, sắp hết hàng, sản phẩm nháp. Câu hỏi hiệu quả force tool này vòng đầu.
- `run_analysis` (template: snapshot | low_stock | open_orders | revenue_by_payment | category_mix, limit 1–50) — delegate phân tích theo template allowlist, không SQL tự do.
- `get_latest_digest` — bản tin vận hành gần nhất (cron tổng hợp mỗi sáng).

## Quy tắc

- Số liệu trước, đề xuất sau; đề xuất là hành động nhỏ nhất có thể.
- Không suy đoán nguyên nhân vượt ngoài dữ liệu tool trả về — ghi rõ "số liệu chưa cho thấy".
- Template phân tích là cố định; nhu cầu mới thì đề xuất thêm template, không lách bằng nhiều lần gọi.
