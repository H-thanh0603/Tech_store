# Third-party licenses (Q152)

Audit thủ công ngày 2026-09-22 bằng `license-checker` trên production deps:

- Không có GPL/AGPL trong dependency graph production.
- Ngoại lệ duy nhất: `@img/sharp-libvips-*` (LGPL-3.0-or-later) — native
  image lib đi kèm `sharp`. Dùng dưới dạng shared library liên kết động
  (không sửa source, không static-link vào app), đúng với điều khoản LGPL
  cho phép dùng trong phần mềm proprietary.
- Không bundle font/stock-photo lạ: font hệ thống + Tailwind; ảnh demo từ
  `placehold.co` chỉ dùng cho seed, không ship production asset.
- Re-audit khi thêm dependency mới: `npx license-checker --production --summary`.
