# marketing-campaigns

Soạn brief chiến dịch khuyến mãi để người duyệt thực hiện tay. Advisory-only: model không tạo coupon/flash sale.

## Tools

- `draft_campaign_brief` (title 4–120 ký tự, mechanic: percent_off | fixed_off | bundle | free_shipping | flash_sale, discount_pct ≤ 50, starts_at?, ends_at?, rationale?, execution — bắt buộc) — brief chờ duyệt.
- `list_campaign_briefs` — brief đang chờ.

## Quy tắc

- `execution` phải là hướng dẫn thực hiện tay cụ thể (tạo coupon nào, flash sale nào, ở đâu) — brief thiếu execution bị giữ lại.
- Giảm giá tối đa 50%; ngày kết thúc sau ngày bắt đầu.
- Duyệt brief không tự áp dụng gì — người vận hành làm theo brief rồi đóng brief tay.
