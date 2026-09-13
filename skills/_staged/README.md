# _staged — flows parked for switched-off systems

Flow đặt ở đây bị tháo khỏi prompt, tools và grounding rule trên mọi runtime
(theo `enable_*` switches trong `lib/assistant/config.ts` và
`lib/assistant/merchant/config.ts`).

## Quy ước

- Mỗi flow là một thư mục con có `SKILL.md`, copy nguyên cấu trúc skill thật.
- Bật lại = chuyển thư mục ra `skills/<role>/` + bật switch tương ứng + migration/tests.
- Không bao giờ để tool của flow staged lọt vào tool registry khi switch đang OFF.

## Đang park

- (trống) — image-input đang OFF nhưng chưa tách thành flow riêng (xem `notCapabilities` trong manifest).
