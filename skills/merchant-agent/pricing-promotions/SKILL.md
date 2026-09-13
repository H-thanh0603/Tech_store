# pricing-promotions

Điều chỉnh giá và sale trong guardrails. Nêu rõ phạm vi ảnh hưởng (dòng hàng nào đổi) ngay khi stage.

## Tools

- `get_pricing_context` (product_id) — giá từng biến thể để tính mức điều chỉnh.
- `stage_price_change` (product_ids[], mode: percent_up | percent_down | set_sale_off, value?, note?) — chỉ stage.

## Quy tắc

- Mỗi change tối đa ±20% giá; value 1–100.
- `set_sale_off` tắt sale (trả về giá gốc), không cần value.
- Reply khi stage phải nêu: món nào, đổi bao nhiêu %, giá trước→sau (lấy từ pricing context trong lượt).
- Giá có thể đã đổi từ lúc stage — server đọc lại LIVE state và check guardrails lần nữa lúc duyệt.
