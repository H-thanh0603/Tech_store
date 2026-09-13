# review-commerce-agent

Review một agent có sẵn theo checklist cảng (port từ blueprint):

1. **Backend methods**: mỗi method gọi service server-side bằng credential của host cho session? Model có thấy key/URL nội bộ không?
2. **Provenance gates**: id mờ chỉ dùng được khi tool đã trả về trong cuộc trò chuyện? Checkout/applies có đòi xác nhận + người duyệt?
3. **Grounding**: khẳng định sự thật có bắt buộc từ kết quả tool? Câu hỏi chính sách có force read vòng đầu?
4. **Switches**: hệ thiếu có OFF + flow park `_staged` (không còn tool/prompt/grounding rule)?
5. **Caps & memory**: trần vòng tool, độ dài tin nhắn, validation memory (không PII, cap ký tự)?
6. **Eval & verify**: `node scripts/check-commerce-parity.mjs` xanh? Smoke chat 1 lượt catalog + 1 stage (chưa duyệt) rồi discard?

Kết quả: bảng Đạt/Chưa theo 6 mục + file cần sửa cụ thể.
