# scaffold-commerce-agent

Dựng một shopping/merchant assistant mới trên thư viện TechStore cho hệ thống của bạn.

## Hỏi trước khi dựng

1. Stack của bạn (catalog/cart/order/policy nằm ở đâu)? Mỗi tool là một method backend gọi service server-side — model chỉ đọc kết quả.
2. Bán gì, checkout ở đâu (hosted URL, quote, purchase order)? Checkout luôn handoff: backend trả URL, host render, model không thấy URL.
3. Hệ nào chưa có (no cart? no order tracking)? Hệ thiếu = switch `enable_*` OFF + flow park dưới `skills/_staged/`.

## Dựng (giữ nguyên byte prompt khi stub)

1. Chạy `node scripts/scaffold-commerce-agent.mjs --role shopping|merchant --name "<Tên>"` — sinh `skills/<role>/<flow>/SKILL.md`, registry entry mẫu, manifest và eval placeholders.
2. Implement search + product details trước (shopping pilot tối thiểu), stub phần còn lại trả `unavailable` — không đổi byte prompt.
3. Merchant pilot: implement 8 read methods, writes trả `refuse`; digest + metrics chạy không cần write path.

## Đọc thêm

- `docs/commerce-agents/backends.md` — identity, ordered flows, checkout, products có options.
- `docs/commerce-agents/safety.md` — rule nào enforce ở đâu trước khi mở cho người thật.
