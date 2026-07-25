**TECHSTORE BLUEPRINT**

**Tài liệu nền tảng để Claude Code xây dựng website bán đồ công nghệ**

Mục tiêu: trải nghiệm 70–80% website thương mại điện tử lớn, quy mô một
cửa hàng nhỏ, UI/UX cao cấp

| **Cách dùng tài liệu:** Đặt file này trong thư mục docs/ của repository. Tạo thêm CLAUDE.md rút gọn theo Phụ lục A. Mỗi task phải dẫn Claude tới đúng mục tài liệu và yêu cầu làm theo quy trình trong Chương 16. |
|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

Phiên bản 1.0 • 23/07/2026

# Mục lục

> **1.** Cách Claude Code phải sử dụng tài liệu
>
> **2.** Tầm nhìn và định vị sản phẩm
>
> **3.** Người dùng mục tiêu
>
> **4.** Phạm vi phiên bản đầu
>
> **5.** Trải nghiệm và luồng người dùng
>
> **6.** Nguyên tắc UI/UX cao cấp
>
> **7.** Design system
>
> **8.** Đặc tả các trang trọng yếu
>
> **9.** Kiến trúc kỹ thuật
>
> **10.** Thiết kế database và quy tắc nghiệp vụ
>
> **11.** Authentication, phân quyền và bảo mật
>
> **12.** Quản trị nội dung và vận hành
>
> **13.** Kiểm thử và tiêu chuẩn hoàn thành
>
> **14.** GitHub và quy trình phát triển
>
> **15.** Quy tắc bắt buộc dành cho AI agent
>
> **16.** Quy trình triển khai theo giai đoạn
>
> **17.** Roadmap
>
> **18.** Bộ prompt thực chiến
>
> **A.** Mẫu CLAUDE.md
>
> **B.** Mẫu GitHub Issue
>
> **C.** Checklist nghiệm thu

# 1. Cách Claude Code phải sử dụng tài liệu

Tài liệu này là nguồn sự thật chính của dự án. Claude Code không được tự
suy diễn lại định hướng sản phẩm hoặc thay đổi kiến trúc chỉ vì một
prompt ngắn trong phiên làm việc.

| **Thứ tự** | **Hành động bắt buộc**                                           |
|------------|------------------------------------------------------------------|
| 1          | Đọc CLAUDE.md và phần tài liệu liên quan đến task.               |
| 2          | Tóm tắt cách hiểu yêu cầu, nêu giả định và mâu thuẫn.            |
| 3          | Đề xuất kế hoạch, file sẽ sửa, ảnh hưởng database và rủi ro.     |
| 4          | Chờ phạm vi rõ ràng rồi mới triển khai.                          |
| 5          | Làm trên branch riêng; không sửa trực tiếp main.                 |
| 6          | Chạy lint, type-check, test, build và kiểm tra giao diện.        |
| 7          | Tóm tắt thay đổi, cách test, vấn đề còn lại trước khi commit/PR. |

| **Nguyên tắc:** Prompt của từng task có thể bổ sung chi tiết nhưng không được âm thầm ghi đè tài liệu nền. Khi có xung đột, Claude phải dừng và nêu rõ xung đột. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 2. Tầm nhìn và định vị sản phẩm

## 2.1 Tầm nhìn

Xây dựng một website bán laptop, PC, điện thoại, màn hình và phụ kiện
cho một cửa hàng công nghệ nhỏ. Sản phẩm phải đủ hoàn chỉnh để vận hành
thật ở quy mô nhỏ, nhưng trải nghiệm mua sắm phải tinh gọn, cao cấp và
dễ dùng hơn nhiều website bán lẻ lớn vốn có quá nhiều banner, thông tin
và lựa chọn cạnh tranh sự chú ý.

## 2.2 Giá trị khác biệt

- Giúp người không rành công nghệ chọn đúng sản phẩm theo nhu cầu, không
  chỉ theo thông số.

- Giao diện sạch, hình ảnh sản phẩm nổi bật, typography tốt và ít nhiễu.

- So sánh sản phẩm theo ngôn ngữ đời thường: phù hợp học tập, gaming,
  làm việc, đồ họa.

- Checkout ngắn, không bắt buộc tạo tài khoản.

- Danh mục sản phẩm được chọn lọc thay vì cố hiển thị quá nhiều mặt
  hàng.

- Thiết kế mobile-first, thao tác một tay và phản hồi rõ ràng.

## 2.3 Chỉ số thành công

| **Nhóm**    | **Tiêu chí**                                                                        |
|-------------|-------------------------------------------------------------------------------------|
| Trải nghiệm | Khách tìm được sản phẩm phù hợp và đi tới checkout với ít bước.                     |
| Thiết kế    | Giao diện nhất quán, không mang cảm giác template dựng vội.                         |
| Chất lượng  | Không có luồng chính bị lỗi; các trạng thái loading, empty, error đầy đủ.           |
| Hiệu năng   | Các trang chính tải nhanh với dữ liệu thật và ảnh đã tối ưu.                        |
| Vận hành    | Admin có thể quản lý sản phẩm, tồn kho, đơn hàng và nội dung cơ bản.                |
| An toàn     | Không lộ secret; dữ liệu người dùng được bảo vệ bằng RLS và server-side validation. |

# 3. Người dùng mục tiêu

| **Persona**                | **Nhu cầu**                              | **Khó khăn**                 | **Thiết kế phải hỗ trợ**                         |
|----------------------------|------------------------------------------|------------------------------|--------------------------------------------------|
| Sinh viên/người mới đi làm | Laptop hoặc điện thoại phù hợp ngân sách | Không hiểu CPU, GPU, RAM     | Bộ lọc theo nhu cầu, giải thích thông số dễ hiểu |
| Người làm văn phòng        | Thiết bị ổn định, bảo hành rõ            | Ngại so sánh quá nhiều mẫu   | Danh sách chọn lọc, badge “phù hợp văn phòng”    |
| Game thủ/người sáng tạo    | Hiệu năng và khả năng nâng cấp           | Khó cân bằng giá và cấu hình | So sánh hiệu năng, thông tin tản nhiệt/nâng cấp  |
| Khách mua nhanh            | Biết gần chính xác sản phẩm cần mua      | Tìm kiếm và checkout dài     | Search tốt, CTA rõ, checkout ngắn                |
| Nhân viên cửa hàng         | Quản lý catalog và đơn hàng              | Dữ liệu dễ sai hoặc trùng    | Validation, audit log cơ bản, giao diện admin rõ |

# 4. Phạm vi phiên bản đầu

## 4.1 Bắt buộc

- Trang chủ, header, navigation, search và footer.

- Danh mục, thương hiệu, danh sách sản phẩm, filter, sort và pagination.

- Trang chi tiết sản phẩm, biến thể, gallery, thông số và sản phẩm liên
  quan.

- So sánh sản phẩm và danh sách yêu thích.

- Giỏ hàng, mã giảm giá cơ bản, checkout COD/chuyển khoản.

- Đăng ký, đăng nhập, quên mật khẩu, hồ sơ và địa chỉ.

- Theo dõi đơn hàng và lịch sử đơn.

- Đánh giá sản phẩm có kiểm duyệt.

- Admin quản lý sản phẩm, biến thể, tồn kho, đơn hàng, khuyến mãi,
  banner và bài viết.

- SEO cơ bản, sitemap, metadata, structured data phù hợp.

- GitHub Actions, migration, seed data, unit test và end-to-end test cho
  luồng chính.

## 4.2 Làm sau

- Tư vấn sản phẩm bằng AI.

- PC Builder nâng cao.

- Thông báo giảm giá.

- Chat trực tiếp.

- PWA và đa ngôn ngữ.

- Cá nhân hóa dựa trên hành vi.

## 4.3 Không làm trong V1

- Marketplace nhiều người bán.

- ERP/POS đầy đủ.

- Trả góp ngân hàng tự động.

- Nhiều kho và điều chuyển phức tạp.

- Ứng dụng mobile native.

- Hạ tầng cho hàng triệu người dùng.

# 5. Trải nghiệm và luồng người dùng

## 5.1 Luồng mua hàng chính

Trang chủ → Danh mục → Lọc theo nhu cầu → Xem sản phẩm → Chọn biến thể →
Thêm giỏ → Checkout → Xác nhận đơn → Theo dõi đơn

## 5.2 Luồng tìm kiếm

Gõ từ khóa → Gợi ý tức thời → Trang kết quả → Lọc/sắp xếp → Trang chi
tiết

## 5.3 Luồng admin

Đăng nhập admin → Dashboard → Tạo/sửa sản phẩm → Thêm biến thể & ảnh →
Cập nhật tồn kho → Xuất bản

## 5.4 Quy tắc trải nghiệm

- Mỗi màn hình chỉ có một hành động chính nổi bật.

- URL phải phản ánh filter, sort, search và trang hiện tại.

- Refresh hoặc quay lại không được làm mất giỏ hàng và dữ liệu checkout
  quan trọng.

- Lỗi phải giải thích cách khắc phục, không chỉ hiển thị “Có lỗi xảy
  ra”.

- Các thao tác ghi dữ liệu phải có loading, success và error feedback.

- Mobile phải có bottom sheet/drawer phù hợp thay vì ép layout desktop.

# 6. Nguyên tắc UI/UX cao cấp

## 6.1 Định hướng hình ảnh

Phong cách: modern premium technology retail, editorial product
presentation, clean, spacious, confident. Tránh cảm giác “dashboard
template” hoặc “landing page AI” lạm dụng gradient và glassmorphism.

| **Nên làm**                            | **Không nên làm**          |
|----------------------------------------|----------------------------|
| Khoảng trắng rộng, hierarchy rõ        | Nhồi nhiều banner và badge |
| Ảnh sản phẩm chất lượng, nền nhất quán | Ảnh kích thước lộn xộn     |
| Typography mạnh, giá dễ đọc            | Quá nhiều cỡ chữ           |
| Animation nhẹ, có mục đích             | Hiệu ứng liên tục gây chậm |
| CTA nổi bật nhưng không chói           | Nhiều nút cùng độ ưu tiên  |
| Mobile-first thật sự                   | Chỉ thu nhỏ desktop        |

## 6.2 Tiêu chí trang sản phẩm

- Tên, giá, biến thể và CTA phải nhìn thấy sớm.

- Chọn biến thể phải cập nhật đúng giá, tồn kho và URL.

- Sticky purchase panel trên desktop; sticky add-to-cart bar trên mobile
  khi phù hợp.

- Thông số quan trọng được diễn giải bằng ngôn ngữ dễ hiểu.

- Chính sách giao hàng, bảo hành và đổi trả dễ tìm.

- Không được cho phép thêm biến thể hết hàng vào giỏ.

## 6.3 Accessibility cơ bản

- Tất cả thao tác chính dùng được bằng bàn phím.

- Focus ring rõ ràng.

- Touch target tối thiểu khoảng 44px.

- Màu chữ và nền đủ tương phản.

- Ảnh có alt phù hợp; icon-only button có accessible label.

- Form lỗi tại đúng trường và có mô tả.

# 7. Design system

## 7.1 Design tokens

| **Nhóm**   | **Quy ước**                                                       |
|------------|-------------------------------------------------------------------|
| Spacing    | 4, 8, 12, 16, 24, 32, 48, 64, 96 px                               |
| Radius     | Nhỏ cho input/button, vừa cho card, lớn có chọn lọc cho hero      |
| Shadow     | Tối đa 3 cấp; ưu tiên border và contrast hơn shadow nặng          |
| Typography | Một font sans chính; heading đậm, body dễ đọc; giá có style riêng |
| Motion     | 150–250ms cho hover/transition; tôn trọng prefers-reduced-motion  |
| Layout     | Container nhất quán; grid 12 cột desktop, 4 cột mobile            |

## 7.2 Component bắt buộc

| **Component**     | **Trạng thái tối thiểu**                                        |
|-------------------|-----------------------------------------------------------------|
| Button            | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Input/Search      | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Select/Combobox   | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Checkbox/Radio    | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Product card      | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Price block       | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Badge             | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Rating            | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Tabs/Accordion    | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Modal/Drawer      | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Toast             | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Breadcrumb        | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Filter panel      | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Skeleton          | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Empty state       | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Error state       | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Pagination        | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Header            | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Mobile navigation | default, hover, focus, disabled; thêm loading/error khi phù hợp |
| Footer            | default, hover, focus, disabled; thêm loading/error khi phù hợp |

## 7.3 Quy tắc component

- Không tạo component mới nếu component chuẩn có thể mở rộng hợp lý.

- Không hard-code màu và spacing trong từng trang; dùng token.

- Component phải nhận dữ liệu thật, không gắn nội dung demo cố định.

- Kiểm thử tên sản phẩm dài, giá lớn, ảnh thiếu và trạng thái hết hàng.

# 8. Đặc tả các trang trọng yếu

| **Trang**          | **Mục tiêu**                                                                          | **Thành phần chính**                                             | **Trạng thái đặc biệt**                          |
|--------------------|---------------------------------------------------------------------------------------|------------------------------------------------------------------|--------------------------------------------------|
| Trang chủ          | Khám phá nhanh; danh mục chính; sản phẩm nổi bật; giá trị khác biệt; bài viết/tư vấn. | Hero gọn, category shortcuts, curated sections, trust blocks.    | Không có sản phẩm; loading; banner lỗi.          |
| Danh sách sản phẩm | Lọc và so sánh nhanh.                                                                 | Filter URL-based, sort, result count, responsive grid.           | No results; lỗi fetch; filter invalid.           |
| Chi tiết sản phẩm  | Hiểu sản phẩm và mua.                                                                 | Gallery, price, variants, stock, CTA, specs, reviews.            | Out of stock; variant unavailable; not found.    |
| So sánh            | Nhìn thấy khác biệt có ý nghĩa.                                                       | Sticky product headers, highlight differences, max 3–4 sản phẩm. | Sản phẩm không cùng loại; thiếu dữ liệu.         |
| Giỏ hàng           | Kiểm tra sản phẩm và tổng tiền.                                                       | Update quantity, remove, coupon, stock validation.               | Giá/tồn kho thay đổi; giỏ trống.                 |
| Checkout           | Đặt hàng ít bước.                                                                     | Guest checkout, address, payment, order summary.                 | Validation; duplicate submit; payment/COD error. |
| Tài khoản          | Quản lý hồ sơ, địa chỉ, đơn.                                                          | Profile, addresses, order history, wishlist.                     | Unauthorized; empty order history.               |
| Admin              | Vận hành catalog và đơn hàng.                                                         | Dashboard, CRUD, bulk actions có kiểm soát, audit info.          | Permission denied; validation; conflict.         |

# 9. Kiến trúc kỹ thuật

## 9.1 Stack khuyến nghị

| **Lớp**         | **Công nghệ**                                                         |
|-----------------|-----------------------------------------------------------------------|
| Web app         | Next.js + TypeScript strict                                           |
| UI              | Tailwind CSS + component library được duyệt                           |
| Backend service | Supabase                                                              |
| Database        | PostgreSQL                                                            |
| Auth            | Supabase Auth                                                         |
| Storage         | Supabase Storage                                                      |
| Server logic    | Next.js Server Actions/Route Handlers; Edge Functions khi thật sự cần |
| Validation      | Schema validation dùng thống nhất ở server                            |
| Testing         | Vitest + Playwright                                                   |
| CI              | GitHub Actions                                                        |
| Source control  | GitHub                                                                |

## 9.2 Quy tắc kiến trúc

- Ưu tiên Server Components; chỉ dùng Client Components khi cần tương
  tác hoặc browser API.

- Mọi thao tác nhạy cảm phải được xác thực và kiểm tra quyền ở
  server/database.

- Không truy cập service-role key từ frontend.

- Không thêm microservice nếu chưa có nhu cầu vận hành rõ.

- Query và business logic quan trọng phải có lớp rõ ràng, không rải trực
  tiếp khắp component.

- Tất cả biến môi trường phải được mô tả trong .env.example nhưng không
  chứa secret thật.

## 9.3 Cấu trúc thư mục gợi ý

src/  
app/  
components/  
ui/  
commerce/  
admin/  
features/  
catalog/  
cart/  
checkout/  
orders/  
lib/  
supabase/  
validation/  
errors/  
server/  
types/  
supabase/  
migrations/  
seed.sql  
tests/  
docs/

# 10. Thiết kế database và quy tắc nghiệp vụ

## 10.1 Entity cốt lõi

| **Bảng**           | **Mục đích**                  |
|--------------------|-------------------------------|
| profiles           | Hồ sơ và role người dùng      |
| addresses          | Địa chỉ giao hàng             |
| categories         | Danh mục phân cấp             |
| brands             | Thương hiệu                   |
| products           | Thông tin chung sản phẩm      |
| product_variants   | SKU, màu, RAM, storage, giá   |
| product_images     | Ảnh theo sản phẩm/biến thể    |
| inventory          | Tồn kho và trạng thái         |
| carts/cart_items   | Giỏ hàng                      |
| orders/order_items | Đơn hàng và snapshot mặt hàng |
| coupons            | Khuyến mãi                    |
| reviews            | Đánh giá                      |
| wishlists          | Yêu thích                     |
| banners/articles   | Nội dung marketing/SEO        |

## 10.2 Quy tắc bắt buộc

- SKU phải duy nhất.

- Giá không âm; sale price không lớn hơn regular price.

- Không đặt số lượng vượt tồn kho khả dụng.

- Order item phải lưu snapshot tên, SKU, biến thể và giá lúc mua.

- Sản phẩm đã xuất hiện trong đơn không được hard delete.

- Migration mới không được sửa migration cũ đã áp dụng.

- Các thao tác tạo đơn và trừ tồn kho cần transaction hoặc cơ chế nguyên
  tử phù hợp.

- Index cho slug, SKU, foreign key, trường tìm kiếm/lọc thường dùng.

- Seed data phải bao gồm edge cases: tên dài, hết hàng, nhiều biến thể,
  không có ảnh, có/không giảm giá.

| **An toàn database:** Claude Code chỉ được tạo migration và chạy trên local/dev theo task. Không được thao tác production nếu prompt không nêu rõ project và hành động được phép. |
|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|

# 11. Authentication, phân quyền và bảo mật

| **Role** | **Quyền chính**                                                              |
|----------|------------------------------------------------------------------------------|
| guest    | Xem catalog, tìm kiếm, giỏ hàng cục bộ, guest checkout                       |
| customer | Quản lý hồ sơ, địa chỉ, wishlist, xem đơn của chính mình, đánh giá           |
| staff    | Xử lý đơn và xem dữ liệu cần thiết                                           |
| admin    | Quản lý catalog, tồn kho, khuyến mãi, nội dung và người dùng theo chính sách |

## 11.1 RLS và server validation

- Bật RLS cho bảng chứa dữ liệu người dùng hoặc dữ liệu cần giới hạn.

- Người dùng chỉ được đọc/sửa dữ liệu thuộc về mình.

- Role không chỉ được kiểm tra ở UI; phải kiểm tra ở server/database.

- Không dùng việc ẩn nút làm cơ chế bảo mật.

- Validation phía client chỉ phục vụ UX; server luôn kiểm tra lại.

## 11.2 Secrets và logging

- Không commit .env hoặc token.

- Không log mật khẩu, token, thông tin thanh toán hay dữ liệu cá nhân
  đầy đủ.

- Không hiển thị stack trace nội bộ cho người dùng.

- Mọi webhook phải xác minh chữ ký nếu nhà cung cấp hỗ trợ.

- Upload phải giới hạn loại file, kích thước và quyền truy cập.

# 12. Quản trị nội dung và vận hành

- Admin dashboard chỉ hiển thị số liệu hữu ích: đơn mới, doanh thu, tồn
  kho thấp, sản phẩm cần xử lý.

- Form sản phẩm phải chia phần rõ: thông tin chung, biến thể, giá, tồn
  kho, ảnh, SEO, trạng thái.

- Mọi dữ liệu quan trọng có validation và thông báo lỗi cụ thể.

- Thao tác nguy hiểm cần xác nhận; ưu tiên archive/disable thay vì
  delete.

- Đơn hàng có trạng thái rõ và lịch sử thay đổi cơ bản.

- Không cho phép cập nhật trạng thái theo chuỗi vô lý nếu chưa có rule.

# 13. Kiểm thử và tiêu chuẩn hoàn thành

## 13.1 Definition of Done

| **Nhóm** | **Bắt buộc**                                                     |
|----------|------------------------------------------------------------------|
| Yêu cầu  | Đạt acceptance criteria và không làm ngoài phạm vi.              |
| Code     | TypeScript strict, không lỗi lint, code dễ đọc.                  |
| Database | Migration rõ, đã test local/dev, có rollback/mitigation khi cần. |
| Security | Auth/RLS/validation đúng, không lộ secret.                       |
| UI/UX    | Responsive, loading/empty/error, keyboard cơ bản.                |
| Test     | Unit/integration phù hợp; Playwright cho luồng chính.            |
| Build    | Build production thành công.                                     |
| Git      | Branch riêng, commit rõ, PR có mô tả và cách test.               |

## 13.2 Test bắt buộc cho thương mại điện tử

- Chọn biến thể cập nhật giá và tồn kho đúng.

- Không thêm sản phẩm hết hàng.

- Giỏ hàng giữ dữ liệu hợp lý sau refresh.

- Giá/tồn kho được kiểm tra lại tại checkout.

- Double submit không tạo hai đơn.

- Người dùng không xem được đơn của người khác.

- Admin-only route/API không truy cập được bằng customer.

- Tên sản phẩm dài, ảnh lỗi và dữ liệu thiếu không phá layout.

- Mobile menu, filter drawer, sticky CTA hoạt động.

# 14. GitHub và quy trình phát triển

## 14.1 Branching

main → feature/product-catalog \| feature/checkout \|
fix/cart-stock-validation

- Không commit trực tiếp main.

- Một branch chỉ phục vụ một issue hoặc nhóm thay đổi liên quan chặt.

- Không force push main.

- Mọi thay đổi database phải nằm trong PR cùng code phụ thuộc.

## 14.2 Pull request

- Liên kết Issue.

- Tóm tắt thay đổi.

- Ảnh/video desktop và mobile khi thay UI.

- Cách test từng bước.

- Ảnh hưởng database/migration.

- Rủi ro và giới hạn.

- Checklist lint, type-check, test, build.

## 14.3 GitHub Actions

install → lint → type-check → unit tests → build → Playwright smoke
tests

# 15. Quy tắc bắt buộc dành cho AI agent

1.  Không sửa code trước khi đọc tài liệu liên quan và trình bày kế
    hoạch.

2.  Không thêm dependency nếu chưa nêu lý do, lợi ích, rủi ro và lựa
    chọn thay thế.

3.  Không refactor ngoài phạm vi task.

4.  Không xóa bảng, cột hoặc dữ liệu nếu chưa có yêu cầu rõ ràng.

5.  Không thao tác production.

6.  Không sửa migration cũ đã áp dụng; tạo migration mới.

7.  Không tắt RLS để làm cho tính năng chạy.

8.  Không commit secret, .env hoặc credential.

9.  Không giả lập chức năng bằng dữ liệu hard-code nếu task yêu cầu dữ
    liệu thật.

10. Không tuyên bố hoàn thành nếu chưa chạy kiểm tra bắt buộc.

11. Khi không chắc chắn, phải nêu giả định và mức độ rủi ro.

12. Trước commit phải xem toàn bộ git diff và loại bỏ thay đổi ngoài
    phạm vi.

# 16. Quy trình triển khai theo giai đoạn

| **Giai đoạn**                | **Kết quả**                                                                                       |
|------------------------------|---------------------------------------------------------------------------------------------------|
| Giai đoạn 1: Nền móng        | Repository, CLAUDE.md, docs, Next.js, Supabase local/dev, CI, design tokens, component nền, seed. |
| Giai đoạn 2: Catalog         | Categories, brands, products, variants, images, inventory, search/filter, detail, compare.        |
| Giai đoạn 3: Commerce        | Cart, coupon, checkout, order creation, stock validation, confirmation, tracking.                 |
| Giai đoạn 4: Account         | Auth, profile, addresses, wishlist, order history, reviews.                                       |
| Giai đoạn 5: Admin           | Dashboard, catalog CRUD, inventory, orders, promotions, banners/articles.                         |
| Giai đoạn 6: Quality         | Responsive audit, accessibility, SEO, performance, security review, E2E, monitoring.              |
| Giai đoạn 7: Differentiation | Needs-based advisor, understandable comparison, PC builder, price alerts.                         |

# 17. Roadmap ưu tiên

| **Mốc**              | **Mục tiêu nghiệm thu**                                             |
|----------------------|---------------------------------------------------------------------|
| M1 Foundation        | Repo chạy local, Supabase local/dev, CI xanh, design system cơ bản. |
| M2 Browse            | Có dữ liệu thật và luồng browse/search/filter/detail hoàn chỉnh.    |
| M3 Buy               | Cart và checkout tạo đơn thật, kiểm tra tồn kho.                    |
| M4 Operate           | Admin quản lý sản phẩm, tồn kho và đơn.                             |
| M5 Polish            | Responsive/a11y/performance/security đạt checklist.                 |
| M6 Launch-ready demo | Deploy free-tier, seed/demo account, tài liệu vận hành và rollback. |

# 18. Bộ prompt thực chiến cho Claude Code

Thay nội dung trong dấu \[ \] bằng task cụ thể. Luôn yêu cầu Claude đọc
tài liệu trước, làm trên branch riêng và báo cáo bằng chứng kiểm tra.

## 18.1 Prompt khởi tạo và khảo sát dự án

Bạn đang làm việc trong repository của dự án TechStore.  
  
Hãy đọc theo thứ tự:  
1. CLAUDE.md  
2. docs/Claude_Code_TechStore_Blueprint.docx hoặc bản Markdown tương
đương  
3. README.md  
4. cấu trúc code hiện tại  
  
Chưa sửa code.  
  
Hãy trả về:  
- Tóm tắt cách bạn hiểu sản phẩm và phạm vi V1.  
- Stack và kiến trúc hiện tại.  
- Các tài liệu hoặc phần code còn thiếu/mâu thuẫn.  
- 10 rủi ro kỹ thuật và UX quan trọng nhất.  
- Kế hoạch khởi tạo dự án theo các milestone nhỏ.  
- Danh sách file dự kiến tạo hoặc sửa.  
  
Không cài dependency, không thao tác Supabase và không tạo commit ở bước
này.

## 18.2 Prompt lập kế hoạch cho một Issue

Đọc CLAUDE.md, tài liệu dự án và GitHub Issue \#\[SỐ ISSUE\].  
  
Chưa viết code.  
  
Hãy:  
1. Tóm tắt yêu cầu bằng ngôn ngữ đơn giản.  
2. Xác định phạm vi và phần không thuộc phạm vi.  
3. Liệt kê giả định và câu hỏi còn mơ hồ.  
4. Đề xuất kiến trúc triển khai tối giản.  
5. Liệt kê file dự kiến thay đổi.  
6. Nêu ảnh hưởng database, migration, RLS và bảo mật.  
7. Liệt kê loading/empty/error/success states.  
8. Viết test cases và acceptance criteria.  
9. Chia triển khai thành các bước nhỏ có thể kiểm tra.  
  
Không tự mở rộng tính năng. Không sửa code cho đến khi kế hoạch đủ rõ.

## 18.3 Prompt triển khai tính năng

Triển khai GitHub Issue \#\[SỐ ISSUE\] theo kế hoạch đã duyệt.  
  
Quy tắc:  
- Tạo branch feature/\[TÊN NGẮN\] từ main.  
- Đọc tài liệu liên quan trước khi sửa.  
- Không refactor ngoài phạm vi.  
- Không thêm dependency nếu chưa giải thích và được chấp nhận.  
- Mọi thay đổi database phải bằng migration mới.  
- Chỉ dùng Supabase local/dev; không thao tác production.  
- Không hard-code dữ liệu thay cho chức năng thật.  
- Bổ sung loading, empty, error và success states.  
- Bổ sung test phù hợp.  
  
Sau mỗi nhóm thay đổi lớn, tự kiểm tra diff và báo ngắn gọn những gì đã
làm.

## 18.4 Prompt thiết kế UI/UX

Hãy thiết kế và triển khai \[TÊN TRANG/COMPONENT\] theo design system và
page specification trong docs.  
  
Mục tiêu: premium, clean, editorial, mobile-first; không giống template
phổ thông.  
  
Bắt buộc:  
- Hierarchy rõ, CTA chính nổi bật.  
- Responsive desktop/tablet/mobile.  
- Loading, empty, error, disabled và success states.  
- Keyboard focus và touch target phù hợp.  
- Kiểm thử tên sản phẩm dài, giá lớn, ảnh thiếu, hết hàng và nhiều
badge.  
- Không lạm dụng gradient, glassmorphism hoặc animation.  
- Không hard-code màu/spacing ngoài token.  
  
Trước khi code, mô tả component tree, data requirements và hành vi
responsive. Sau khi code, chạy Playwright/chụp kiểm tra desktop và
mobile rồi báo các lỗi thị giác còn lại.

## 18.5 Prompt làm việc với Supabase MCP

Dùng Supabase MCP để khảo sát project \[LOCAL/DEV\] và đối chiếu với
migrations trong repository.  
  
Chỉ đọc và báo cáo ở bước đầu. Không chạy SQL thay đổi dữ liệu.  
  
Hãy:  
- Xác nhận đúng project/environment.  
- Liệt kê schema liên quan đến \[MODULE\].  
- Phát hiện chênh lệch giữa database và migration.  
- Đề xuất migration mới, indexes, constraints và RLS policies.  
- Nêu lệnh nguy hiểm hoặc có thể mất dữ liệu.  
  
Sau khi tôi cho phép triển khai:  
- Tạo migration file mới trong repository.  
- Chạy trên local/dev.  
- Chạy test.  
- Không sửa migration cũ.  
- Không thao tác production.

## 18.6 Prompt review pull request bằng Claude/Codex khác

Review pull request/branch \[TÊN\] như một senior full-stack engineer.
Chưa sửa code.  
  
Đọc CLAUDE.md, tài liệu liên quan và Issue.  
  
Tập trung vào:  
- Sai yêu cầu hoặc làm ngoài phạm vi.  
- Lỗi logic, race condition, transaction và tồn kho.  
- Auth, authorization, RLS, validation và secret exposure.  
- UI/UX, responsive, accessibility và edge states.  
- Database migration, constraints và indexes.  
- Test còn thiếu hoặc test không có giá trị.  
- Dependency không cần thiết và code quá phức tạp.  
  
Báo theo mức: Critical, High, Medium, Low.  
Mỗi phát hiện phải có file/vị trí, tác động và cách sửa đề xuất. Không
khen chung chung.

## 18.7 Prompt kiểm tra trước commit

Chưa commit.  
  
Hãy thực hiện quality gate:  
1. Xem toàn bộ git status và git diff.  
2. Phát hiện thay đổi ngoài phạm vi Issue.  
3. Chạy formatter/lint.  
4. Chạy TypeScript type-check.  
5. Chạy unit/integration tests.  
6. Chạy build production.  
7. Chạy Playwright cho luồng chính.  
8. Kiểm tra desktop và mobile.  
9. Kiểm tra migration và secret.  
  
Trả về bảng PASS/FAIL với bằng chứng lệnh đã chạy và lỗi còn lại. Không
tuyên bố hoàn thành nếu có bước FAIL.

## 18.8 Prompt commit, push và tạo PR

Các kiểm tra bắt buộc đã PASS.  
  
Hãy:  
- Nhóm commit hợp lý, message rõ ràng.  
- Không commit .env, secret, file cache hoặc artifact không cần thiết.  
- Push branch hiện tại.  
- Tạo pull request liên kết Issue \#\[SỐ\].  
  
PR phải có:  
- Mục tiêu.  
- Thay đổi chính.  
- Ảnh hưởng database/migration.  
- Cách test từng bước.  
- Kết quả lint/type-check/test/build.  
- Ảnh desktop/mobile nếu có UI.  
- Rủi ro, giới hạn và việc cần làm sau.  
  
Không merge PR.

## 18.9 Prompt sửa bug an toàn

Điều tra bug: \[MÔ TẢ\].  
  
Chưa sửa ngay.  
  
Hãy:  
- Tái hiện bug với các bước cụ thể.  
- Tìm nguyên nhân gốc, không chỉ triệu chứng.  
- Xác định phạm vi ảnh hưởng.  
- Đề xuất bản sửa nhỏ nhất.  
- Viết test thất bại trước khi sửa nếu khả thi.  
- Không refactor ngoài phạm vi.  
  
Sau khi sửa, chạy test hồi quy cho các luồng liên quan và báo bằng
chứng.

## 18.10 Prompt audit toàn dự án

Audit repository theo tài liệu nền và mục tiêu release.  
  
Không sửa code ở vòng đầu.  
  
Tạo báo cáo theo các phần:  
- Product scope drift.  
- UI consistency và responsive.  
- Accessibility.  
- Performance.  
- Security và RLS.  
- Database integrity.  
- Testing gaps.  
- GitHub/CI quality.  
- Technical debt.  
  
Xếp hạng ưu tiên P0/P1/P2/P3, nêu tác động, độ khó và đề xuất roadmap
sửa. Chỉ đề xuất các vấn đề có bằng chứng từ code hoặc hành vi thực tế.

# Phụ lục A. Mẫu CLAUDE.md

\# TechStore — Claude Code Instructions  
  
\## Source of truth  
- Read docs/Claude_Code_TechStore_Blueprint.docx and task-specific docs
before implementation.  
- When prompt and documentation conflict, report the conflict before
changing code.  
  
\## Product goal  
Build a premium, mobile-first technology e-commerce website for one
small store. Target 70–80% of the customer-facing software experience of
a large retailer, with cleaner UI/UX and simpler operations.  
  
\## Approved stack  
- Next.js + TypeScript strict  
- Tailwind CSS + approved component library  
- Supabase PostgreSQL/Auth/Storage  
- Vitest + Playwright  
- GitHub Actions  
  
\## Mandatory workflow  
1. Read relevant docs and Issue.  
2. Summarize understanding, assumptions, risks and plan.  
3. Work on a dedicated branch.  
4. Keep changes within scope.  
5. Use migrations for database changes.  
6. Run lint, type-check, tests and production build.  
7. Review git diff before commit.  
8. Create a PR; never merge automatically.  
  
\## Safety  
- Never access or modify production unless explicitly authorized.  
- Never delete tables, columns or data without explicit approval.  
- Never edit previously applied migrations; create a new migration.  
- Never disable RLS to make a feature work.  
- Never expose service-role keys or commit secrets/.env.  
- Never force-push main.  
  
\## UI/UX  
- Premium, clean, editorial, mobile-first.  
- Avoid generic templates, excessive gradients, glassmorphism and
animation.  
- Include loading, empty, error, success, disabled and out-of-stock
states.  
- Use design tokens; do not hard-code random colors or spacing.  
- Test long content, missing images and small screens.  
  
\## Completion gate  
A task is not complete until requirements, security, responsive
behavior, tests, type-check and build all pass, with evidence in the
final report.

# Phụ lục B. Mẫu GitHub Issue

\## Mục tiêu  
\[Mô tả kết quả người dùng hoặc vận hành cần đạt\]  
  
\## Người dùng  
\[Guest / Customer / Staff / Admin\]  
  
\## Phạm vi  
- ...  
  
\## Không thuộc phạm vi  
- ...  
  
\## User flow  
1. ...  
2. ...  
  
\## Quy tắc nghiệp vụ  
- ...  
  
\## Thiết kế liên quan  
- docs/...  
- link/reference...  
  
\## Database impact  
- Bảng/cột/policy/migration dự kiến...  
  
\## Security considerations  
- Auth/RLS/validation...  
  
\## Acceptance criteria  
- \[ \] ...  
  
\## Test cases  
- Happy path...  
- Error path...  
- Permission path...  
- Mobile/responsive...

# Phụ lục C. Checklist nghiệm thu release

| **Khu vực** | **Điều kiện nghiệm thu**                                        |
|-------------|-----------------------------------------------------------------|
| Sản phẩm    | Phạm vi V1 đúng; không có tính năng demo giả trong luồng chính. |
| Catalog     | Search/filter/sort/detail/variant hoạt động với dữ liệu thật.   |
| Commerce    | Cart, checkout, tạo đơn, tồn kho và chống double submit.        |
| Account     | Auth, profile, address, order history và quyền dữ liệu.         |
| Admin       | Quản lý catalog, inventory, order và nội dung.                  |
| UI          | Desktop/tablet/mobile; loading/empty/error; tên dài và ảnh lỗi. |
| A11y        | Keyboard, focus, labels, contrast và touch targets.             |
| Security    | RLS, server validation, secrets, upload và authorization.       |
| Quality     | Lint, type-check, unit/integration/E2E, build xanh.             |
| GitHub      | PR rõ, CI xanh, migration trong source control.                 |
| Docs        | README, setup, env example, migration/seed và vận hành.         |
| Recovery    | Backup/restore và cách rollback thay đổi quan trọng.            |

| **Lời nhắc cuối:** Claude Code có thể tạo phần lớn code, nhưng chất lượng dự án phụ thuộc vào việc bạn buộc agent đọc tài liệu, chia task nhỏ, dùng branch/PR, chạy test và không cho thao tác production tùy ý. |
|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
