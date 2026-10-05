# Launch Comms & SLO — TechStore (Q147/Q157/Q161/Q162)

## Kênh status (Q147)
- Chính: fanpage/Zalo OA của shop (ghi URL thật vào đây trước launch).
- Phụ: banner trong site (bật bằng cách deploy text banner, không cần flag).

## Ca trực launch-day (Q157)
- Ca 1 (0–4h sau mở): backend lead + 1 CS. Ca 2: luân phiên 8h trong 72h đầu.
- SLA nội bộ: sự cố thanh toán/checkout ≤ 30 phút phản hồi; câu hỏi thường ≤ 4h.

## Mẫu thông báo sự cố (Q161 — copy-paste)

**1. degraded (checkout chậm / AI chậm):**
> TechStore đang xử lý chậm hơn bình thường (mục [checkout/tra đơn/trợ lý]). Đơn của bạn vẫn được giữ. Chúng tôi cập nhật trong 30 phút.

**2. payment incident:**
> Thanh toán [VNPay/COD] đang gián đoạn từ [giờ]. Vui lòng chọn COD hoặc thử lại sau. Đơn đã trừ tiền sẽ được đối soát và hoàn trong 48h.

**3. resolved:**
> Đã khắc phục lúc [giờ]. Mọi đơn trong thời gian sự cố đã được đối soát. Cảm ơn bạn đã chờ.

## Định nghĩa launch thành công (Q162 — đo 7 ngày đầu)
| Metric | Mục tiêu | Nguồn |
|---|---|---|
| Uptime (GET /api/health) | ≥ 99.5% | monitor.yml |
| 5xx rate | < 0.5% | Sentry |
| Checkout success (place_order OK / attempts) | ≥ 95% | DB |
| p95 API nóng (suggest/track) | < 800ms | Vercel analytics |
| Thanh toán VNPay đối soát lệch | 0 đơn | audit log |
| Không incident PII/secret | 0 | review |

Không đạt → họp go/no-go mở rộng, không scale marketing.
