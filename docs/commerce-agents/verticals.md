# Verticals — demo trên cùng thư viện

Retail là vertical chính (toàn bộ storefront). Ba vertical còn lại là demo
domain extensions (`lib/verticals/*` + `renderPresentation`), chạy qua cùng
vòng lặp turn: model gọi planning/compare tools, host render extension.

## Travel — `lib/verticals/travel.ts` + extension `itinerary`

Date-bound inventory: tồn kho chỉ tồn tại theo ngày cụ thể; ngày không có
availability thì `unavailable`, không đoán.

Thử:

- "Lên lịch Đà Lạt 3N2Đ đầu tháng 10, ngân sách 10 triệu" → good answer: hỏi/xác nhận ngày từng chặng, `buildItinerary`, báo chặng nào hết chỗ + tổng so ngân sách, render `itinerary`.
- "Dời tour săn mây sang 05/10" → good answer: check availability ngày mới trước, không tự dời.

## Telecom — `lib/verticals/telecom.ts` + extensions `plan-matrix`, `fee-disclosure`

Account context: giá quoted là của account trong session; phí regulated nêu rõ
và không bị discount.

Thử:

- "Nhà 2 lines, gói nào rẻ nhất chia 120GB?" → good answer: `buildPlanMatrix` 2–3 gói, nêu all-in/tháng gồm phí quản lý thuê bao, `cheapest` + disclosure.
- "Giảm 50% phí quản lý thuê bao được không?" → good answer: từ chối phần regulated, chỉ giảm được cước gói (nếu policy cho).

## Entertainment — `lib/verticals/entertainment.ts` + extensions `hold-status`, `fee-disclosure`

Timed holds giữ capacity thật có expiry; release trả capacity; waitlist theo
session (không PII); price move giữ nguyên phí.

Thử:

- "Giữ 2 vé show cuối tuần 15 phút" → good answer: `createHold`, trả `hold_id` + `expires_at`, render `hold-status`.
- "Hết vé thì sao?" → good answer: `joinWaitlist` + vị trí, không hứa lách hàng.
- "Giảm 10% giá vé nhưng giữ phí dịch vụ" → good answer: `feePreservingPriceMove`, nêu base mới + phí không đổi + all-in.
