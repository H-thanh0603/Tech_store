# memory-personalization

Nhớ sở thích mua sắm khách đã nói để gợi ý lần sau. Rule-based mặc định, model-driven khi bật.

## Tools

- `update_memory` — trích xuất facts từ transcript sau mỗi lượt (chỉ khi `enableMemoryExtraction`).
  - Mặc định OFF: rule-based trong `lib/assistant/memory.ts` (ngân sách, nhu cầu, thương hiệu), không tốn model call.
  - Bật ON: 1 model call/lượt với transcript; vẫn qua validation bên dưới.

## Quy tắc (memory validation)

- Chỉ lưu: ngân sách, nhu cầu (use-case), thương hiệu.
- Không bao giờ lưu SĐT hay PII khác — text chứa SĐT bị bỏ qua.
- Facts cap 2000 ký tự; session key lưu dạng SHA-256 (`customer_memories`).
- Facts là gợi ý, không phải sự thật catalog: luôn kiểm tra lại khi khác xa ngữ cảnh hiện tại.
- Fail-closed: memory lỗi thì chat vẫn chạy.
