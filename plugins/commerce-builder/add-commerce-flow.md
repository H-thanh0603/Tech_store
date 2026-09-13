# add-commerce-flow

Thêm một flow mới (thư mục `SKILL.md`) vào agent có sẵn.

1. Đặt tên flow theo việc của khách/chủ shop (động từ + đối tượng), tạo `skills/<role>/<flow>/SKILL.md` với: Tools (method backend nào), Quy tắc (gates, caps, grounding).
2. Đăng ký vào `lib/commerce-agent/skills.ts` (tools + `isEnabled` theo switch).
3. Backend method mới: gọi service server-side, trả DTO tối thiểu cho UI; flow có thứ tự bước cố định thì enforce thứ tự trong backend.
4. Domain UI mới = `PresentationExtension` trong `lib/commerce-agent/presentation.ts` (host render, model không render).
5. Thêm eval vào `evals/commerce/<flow>.json` + test vitest cho gate mới. Chạy `node scripts/check-commerce-parity.mjs`.
