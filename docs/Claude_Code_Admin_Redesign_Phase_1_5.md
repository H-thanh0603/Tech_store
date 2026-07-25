# TECH STORE ADMIN REDESIGN
## Tài liệu triển khai chi tiết Phase 1-5 dành cho Claude Code

> Đây là tài liệu nguồn sự thật cho việc thiết kế lại trang quản trị Tech Store.
> Claude Code phải đọc `CLAUDE.md`, `AGENTS.md` nếu có, `README.md`, tài liệu này, toàn bộ migration Supabase và source code hiện tại trước khi triển khai.

---

# 0. Bối cảnh hiện tại

Trang quản trị hiện có một số chức năng kết nối database thật, gồm dashboard KPI cơ bản, danh sách và form sản phẩm, danh sách và chi tiết đơn hàng. Tuy nhiên hệ thống còn thiếu admin shell chuẩn, biểu đồ, CRUD danh mục và thương hiệu, module tồn kho, coupon admin, tìm kiếm và phân trang phía server, confirmation dialog, toast, audit log và nhiều trạng thái UX quan trọng.

Các bảng hiện có đủ để triển khai trước các phần sau mà chưa cần tạo toàn bộ schema mới:

- `products`
- `product_variants`
- `product_images`
- `product_specs`
- `product_use_cases`
- `categories`
- `brands`
- `inventory`
- `inventory_reservations`
- `orders`
- `order_items`
- `coupons`
- `coupon_redemptions`

Các phần có thể cần migration mới trong Phase 4-5:

- `inventory_adjustments`
- `order_status_events`
- `order_internal_notes` hoặc cột `orders.internal_note`
- `audit_logs`
- các index phục vụ tìm kiếm, lọc và báo cáo

Phần authentication và role phải được hoàn thiện trước hoặc song song theo tài liệu riêng về Admin Authentication và Authorization. Mọi route và mutation admin phải được bảo vệ phía server.

---

# 1. Nguyên tắc bắt buộc áp dụng cho mọi phase

## 1.1 Quy trình làm việc

Mỗi phase phải thực hiện theo quy trình:

1. Đọc tài liệu và khảo sát code liên quan.
2. Chưa sửa code ngay.
3. Lập kế hoạch triển khai.
4. Liệt kê file tạo, sửa hoặc xóa.
5. Nêu database impact.
6. Nêu dependency cần thêm và lý do.
7. Nêu rủi ro, giả định và rollback plan.
8. Tạo branch riêng từ `main`.
9. Triển khai đúng phạm vi phase.
10. Xem toàn bộ `git diff`.
11. Chạy lint.
12. Chạy type-check.
13. Chạy test.
14. Chạy production build.
15. Kiểm tra desktop, tablet và mobile nếu có UI.
16. Báo cáo phần hoàn thành và phần còn thiếu.
17. Chưa commit, push hoặc tạo pull request cho đến khi người dùng yêu cầu.

## 1.2 Git và an toàn

- Không sửa trực tiếp branch `main`.
- Không force push.
- Không commit secret, `.env`, token hoặc service-role key.
- Không thao tác production khi chưa có lệnh rõ ràng.
- Không xóa dữ liệu thật.
- Không sửa migration cũ đã được áp dụng.
- Mọi schema change phải nằm trong migration mới.
- Không tắt RLS để sửa lỗi.
- Không đưa service-role key ra client.
- Không refactor ngoài phạm vi phase.
- Không thay đổi storefront nếu không thực sự cần.
- Không thêm dependency nếu chưa giải thích rõ.

## 1.3 Tiêu chuẩn backend

- Không hard-code dữ liệu giả trong production.
- CRUD phải đọc và ghi database thật.
- Không đánh dấu chức năng hoàn thành nếu chỉ cập nhật state frontend.
- Client validation chỉ hỗ trợ UX; server vẫn phải validation lại.
- Mọi mutation admin phải kiểm tra authentication và authorization phía server.
- Pagination, search, filter và sort phải thực hiện ở database khi dữ liệu có thể lớn.
- Tránh tải toàn bộ dữ liệu rồi filter phía client.
- Tránh N+1 query.
- Thao tác nhiều bước quan trọng phải dùng transaction hoặc PostgreSQL RPC phù hợp.
- Lỗi database phải được map thành thông báo UX dễ hiểu.

## 1.4 Tiêu chuẩn UI/UX

- Admin phải có layout riêng, không lồng storefront header, cart hoặc footer.
- Giao diện hiện đại, sạch, chuyên nghiệp và tập trung vào công việc.
- Không lạm dụng gradient, glassmorphism hoặc animation.
- Typography và hierarchy rõ ràng.
- Khoảng trắng hợp lý.
- Component và trạng thái phải nhất quán giữa các module.
- Mọi thao tác quan trọng phải có phản hồi thành công hoặc thất bại.
- Mọi thao tác nguy hiểm phải có confirmation dialog.
- Phải xử lý loading, empty, error, success, disabled, permission denied và not found.
- Mobile không được chỉ là desktop thu nhỏ.
- Keyboard navigation, focus state, label và accessible name phải đầy đủ.

## 1.5 Currency và locale

- Locale mặc định: `vi-VN`.
- Tiền tệ hiển thị bằng VND.
- Ví dụ: `25.000.000 ₫`.
- Ngày giờ hiển thị theo locale Việt Nam, nhưng dữ liệu lưu bằng timestamp chuẩn trong database.

---

# 2. Kiến trúc route mục tiêu

```text
/admin/login
/admin
/admin/products
/admin/products/new
/admin/products/[id]
/admin/categories
/admin/brands
/admin/inventory
/admin/orders
/admin/orders/[code]
/admin/customers
/admin/customers/[key]
/admin/coupons
/admin/coupons/new
/admin/coupons/[id]
/admin/reports
/admin/settings
```

Các route `reviews`, `banners`, `content`, `staff` không thuộc phạm vi Phase 1-5 trừ khi đã được phê duyệt riêng.

---

# PHASE 1 - ADMIN FOUNDATION

## 3. Mục tiêu

Xây dựng nền móng UI, layout và component dùng chung cho toàn bộ admin. Phase này chưa triển khai dashboard mới hoặc CRUD nghiệp vụ mới.

Sau khi hoàn thành:

- Admin có layout riêng.
- Route admin không còn lồng storefront header/footer.
- Sidebar, topbar và mobile drawer hoạt động nhất quán.
- Có component dùng chung cho page header, data table, form, dialog, toast và các trạng thái.
- Permission guard hoạt động phía server.
- Các module sau có thể xây dựng mà không cần copy-paste UI foundation.

## 3.1 Phạm vi triển khai

### Admin shell

Xây dựng:

- `AdminShell`
- `AdminSidebar`
- `AdminTopbar`
- `MobileNavDrawer`
- `AdminBreadcrumbs`
- `AdminAccountMenu`
- `EnvironmentBadge` chỉ hiển thị khi phù hợp

Sidebar tối thiểu có:

- Tổng quan
- Sản phẩm
- Danh mục
- Thương hiệu
- Tồn kho
- Đơn hàng
- Khách hàng
- Khuyến mãi
- Báo cáo
- Cài đặt

Yêu cầu sidebar:

- Icon phù hợp.
- Active state rõ ràng.
- Có thể collapse trên desktop.
- Chuyển thành drawer trên mobile.
- Chỉ hiển thị module role hiện tại có quyền truy cập.
- Không hard-code permission rải rác trong component.

### Topbar

Bao gồm:

- Breadcrumb.
- Tên trang hoặc context hiện tại.
- Account menu.
- Đăng xuất.
- Mobile menu trigger.
- Environment badge ở development nếu có ích.

Không cần notification system thật trong phase này. Có thể chỉ tạo vị trí rõ ràng nếu roadmap cần, nhưng không thêm UI giả gây hiểu nhầm.

### Shared UI foundation

Tạo hoặc chuẩn hóa:

- `PageHeader`
- `StatusBadge`
- `ConfirmDialog`
- `ToastProvider` và API toast thống nhất
- `EmptyState`
- `ErrorState`
- `LoadingSkeleton`
- `PermissionDeniedState`
- `FormField`
- `FormSection`
- `CurrencyInput`
- `NumberInput`
- `SearchInput`
- `FilterBar`
- `Pagination`

### Shared DataTable foundation

Component DataTable cần có khả năng mở rộng cho:

- Search.
- Filter.
- Sort.
- Pagination.
- Row actions.
- Row selection.
- Bulk actions.
- Column visibility nếu cần.
- Loading skeleton.
- Empty state.
- Error state.
- URL search params.
- Tổng số kết quả.

Không cần triển khai tất cả bulk action trong phase này, nhưng kiến trúc component phải hỗ trợ.

## 3.2 Cấu trúc component đề xuất

```text
components/admin/
  shell/
    admin-shell.tsx
    admin-sidebar.tsx
    admin-topbar.tsx
    mobile-nav-drawer.tsx
    admin-breadcrumbs.tsx
    admin-account-menu.tsx
  ui/
    page-header.tsx
    data-table.tsx
    filter-bar.tsx
    pagination.tsx
    status-badge.tsx
    confirm-dialog.tsx
    toast-provider.tsx
    empty-state.tsx
    error-state.tsx
    permission-denied-state.tsx
    loading-skeleton.tsx
    form-field.tsx
    form-section.tsx
    currency-input.tsx
    number-input.tsx
```

Có thể điều chỉnh theo convention hiện tại, nhưng không tạo component trùng chức năng với component đã có.

## 3.3 Responsive

- Desktop: sidebar cố định hoặc sticky.
- Tablet: sidebar có thể collapse.
- Mobile: sidebar thành drawer.
- Main content không bị che bởi navigation.
- Table lớn có chiến lược cột responsive; không chỉ thêm horizontal scroll cho mọi trường hợp.
- Primary action luôn dễ tìm.
- Touch target tối thiểu khoảng 44px.

## 3.4 Accessibility

- Sidebar điều hướng bằng keyboard.
- Drawer và dialog quản lý focus đúng.
- Icon button có accessible name.
- Focus visible rõ ràng.
- Không dùng màu làm tín hiệu duy nhất.
- Breadcrumb có semantic đúng.
- Form field có label và error association.

## 3.5 Không nằm trong phạm vi

- KPI mới.
- Biểu đồ.
- Product CRUD redesign.
- Category/Brand CRUD.
- Inventory module.
- Orders redesign.
- Coupon CRUD.

## 3.6 Acceptance criteria

- `/admin` và route con dùng admin layout riêng.
- Storefront header, cart và footer không xuất hiện trong admin.
- Sidebar active state đúng theo route.
- Mobile drawer mở, đóng và quản lý focus đúng.
- Menu module tôn trọng permission.
- Không có lỗi TypeScript.
- Shared component có API rõ ràng và được dùng thử ở ít nhất một trang admin hiện tại.
- Loading, empty và error state có component chuẩn.
- Lint, test và production build thành công.

## 3.7 Test tối thiểu

- Admin shell render với role admin.
- Sidebar ẩn module không có permission.
- Mobile drawer hoạt động.
- Confirm dialog gọi đúng callback.
- DataTable render loading, empty và data state.
- Người không có quyền bị chặn phía server.

## 3.8 Prompt triển khai Phase 1

```text
Hãy triển khai Phase 1 - Admin Foundation theo tài liệu
`docs/Claude_Code_Admin_Redesign_Phase_1_5.md`.

Trước khi sửa code:
1. Đọc CLAUDE.md, AGENTS.md, README.md và tài liệu này.
2. Khảo sát layout và component admin hiện có.
3. Liệt kê file sẽ tạo hoặc sửa.
4. Liệt kê component có thể tái sử dụng.
5. Nêu dependency cần thêm và lý do.
6. Nêu rủi ro và acceptance criteria.

Chỉ triển khai đúng phạm vi Phase 1.
Không làm dashboard chart, CRUD module hoặc migration nghiệp vụ.
Không sửa storefront nếu không cần.
Mọi route admin phải tiếp tục được bảo vệ phía server.

Sau khi triển khai:
- xem toàn bộ git diff;
- chạy lint;
- chạy type-check;
- chạy test;
- chạy production build;
- kiểm tra desktop, tablet và mobile;
- báo phần hoàn thành và phần còn thiếu;
- chưa commit hoặc push.
```

---

# PHASE 2 - DASHBOARD VÀ BIỂU ĐỒ

## 4. Mục tiêu

Thiết kế lại dashboard thành trung tâm điều hành thực tế cho cửa hàng nhỏ, sử dụng dữ liệu thật từ database.

Dashboard phải giúp admin nhanh chóng trả lời:

- Hôm nay bán được bao nhiêu?
- Tháng này doanh thu thế nào?
- Có bao nhiêu đơn cần xử lý?
- Sản phẩm nào sắp hết hàng?
- Danh mục nào tạo nhiều doanh thu?
- Sản phẩm nào bán chạy?

## 4.1 KPI bắt buộc

Tối thiểu:

- Doanh thu hôm nay.
- Doanh thu tháng hiện tại.
- Số đơn hôm nay.
- Số đơn chờ xử lý.
- Giá trị đơn hàng trung bình.
- Sản phẩm sắp hết hàng.
- Sản phẩm hết hàng.

Khách hàng mới chỉ hiển thị nếu dữ liệu hiện tại hỗ trợ định nghĩa đáng tin cậy. Nếu chưa có bảng customer/profile, không được tạo KPI giả. Có thể dùng số khách mua lần đầu suy ra từ orders nếu định nghĩa và query rõ ràng.

Mỗi KPI cần:

- Giá trị chính.
- Tooltip giải thích định nghĩa.
- So sánh kỳ trước nếu có đủ dữ liệu.
- Loading state.
- Empty state.
- Error state.

Không hiển thị phần trăm tăng giảm nếu không tính được chính xác.

## 4.2 Biểu đồ bắt buộc

### Revenue trend

- Doanh thu theo ngày.
- Bộ chọn 7, 30 và 90 ngày.
- Dùng line chart.
- Chỉ tính các trạng thái đơn hợp lệ theo business rule hiện tại.

### Orders by status

- Số đơn theo trạng thái.
- Dùng bar hoặc pie chart tùy số lượng trạng thái và khả năng đọc.
- Status color nhất quán với badge toàn hệ thống.

### Revenue by category

- Doanh thu theo danh mục.
- Dùng horizontal bar chart nếu có nhiều danh mục.
- Query từ order item snapshot/variant/product/category theo schema thực tế.

### Top products

- Top sản phẩm theo số lượng bán hoặc doanh thu.
- Cho phép chọn metric nếu không làm UI quá phức tạp.

## 4.3 Các block vận hành

- Đơn hàng gần đây.
- Sản phẩm sắp hết hàng.
- Sản phẩm hết hàng.
- Cảnh báo cần xử lý.

## 4.4 Data và query

- Không tải full table rồi tính ở client.
- Ưu tiên aggregate ở PostgreSQL hoặc server query.
- Với query phức tạp hoặc dùng lặp lại, cân nhắc SQL view hoặc RPC.
- Nếu tạo view/RPC/index phải dùng migration mới.
- Định nghĩa rõ đơn nào được tính vào doanh thu.
- Không tính cancelled/refunded nếu business rule không cho phép.
- Date range phải rõ timezone.
- Hiển thị theo timezone của cửa hàng.

## 4.5 Chart dependency

Được phép dùng Recharts nếu chưa có chart library phù hợp.

Yêu cầu:

- Chỉ import trong dashboard client islands cần thiết.
- Không đưa chart library vào toàn bộ admin layout.
- Responsive.
- Tooltip và legend khi cần.
- Có dữ liệu thay thế hoặc summary text hỗ trợ accessibility.
- Không quá nhiều màu.
- Không dùng 3D chart.
- Không animation quá mức.

## 4.6 Hiệu năng

- Dashboard phần KPI tải trước.
- Chart có thể tải độc lập.
- Query chạy song song khi an toàn.
- Không block toàn bộ dashboard nếu một chart lỗi.
- Có error boundary theo block nếu kiến trúc phù hợp.

## 4.7 Không nằm trong phạm vi

- Trang reports chuyên sâu.
- Forecast doanh thu.
- AI insight.
- Export báo cáo phức tạp.
- Multi-store analytics.

## 4.8 Acceptance criteria

- Tất cả KPI lấy từ database thật.
- Có bộ chọn date range cho chart liên quan.
- Currency format đúng `vi-VN`.
- Không hard-code số liệu production.
- Dashboard có loading, empty và error state riêng theo block.
- Không query full inventory rồi filter client.
- Không tạo N+1 query.
- Chart responsive và dùng được trên mobile.
- Lint, type-check, test và build thành công.

## 4.9 Test tối thiểu

- Revenue query loại đơn không hợp lệ đúng business rule.
- AOV tính đúng và tránh chia cho 0.
- Date range đúng timezone.
- Dashboard render khi không có dữ liệu.
- Một chart lỗi không làm toàn trang crash nếu đã thiết kế block isolation.
- Format VND đúng.

## 4.10 Prompt triển khai Phase 2

```text
Hãy triển khai Phase 2 - Dashboard và Biểu đồ theo tài liệu
`docs/Claude_Code_Admin_Redesign_Phase_1_5.md`.

Trước khi code:
1. Kiểm tra schema và business rule trạng thái đơn.
2. Định nghĩa chính xác từng KPI.
3. Viết kế hoạch query và nêu query nào cần view/RPC/index.
4. Liệt kê component và file sẽ thay đổi.
5. Nêu dependency chart; chỉ dùng Recharts nếu chưa có lựa chọn phù hợp.
6. Nêu timezone và cách tính date range.

Không hard-code dữ liệu giả.
Không tính KPI ở client từ full table.
Không làm reports module ngoài phạm vi.

Sau khi triển khai:
- kiểm tra số liệu bằng query đối chiếu;
- chạy lint, type-check, test và build;
- kiểm tra 7/30/90 ngày;
- kiểm tra empty/error/loading state;
- kiểm tra responsive;
- xem git diff;
- chưa commit hoặc push.
```

---

# PHASE 3 - PRODUCT MANAGEMENT HOÀN CHỈNH

## 5. Mục tiêu

Nâng cấp module sản phẩm thành CRUD thực tế, dễ vận hành, hỗ trợ nhiều biến thể, ảnh, tồn kho, tìm kiếm, lọc, sắp xếp và phân trang phía server.

## 5.1 Danh sách sản phẩm

Hiển thị:

- Ảnh đại diện.
- Tên sản phẩm.
- SKU hoặc mã chính phù hợp.
- Danh mục.
- Thương hiệu.
- Khoảng giá.
- Số biến thể.
- Tổng tồn khả dụng.
- Trạng thái.
- Ngày cập nhật.
- Menu hành động.

Chức năng:

- Tìm theo tên, slug và SKU.
- Lọc danh mục.
- Lọc thương hiệu.
- Lọc trạng thái.
- Lọc tồn kho.
- Sort theo tên, giá, tồn kho và ngày cập nhật khi phù hợp.
- Server-side pagination.
- Giữ filter/sort/page trong URL.
- Reset filter.
- Row action: xem/sửa, archive, activate/deactivate.
- Row selection foundation cho bulk actions.

Bulk action tối thiểu:

- Publish nếu hợp lệ.
- Chuyển draft.
- Archive.

Mọi bulk action phải có confirmation và server authorization.

## 5.2 Tạo sản phẩm

Form chia section rõ ràng:

### Thông tin cơ bản

- Tên.
- Slug tự sinh nhưng có thể sửa.
- Mô tả ngắn.
- Mô tả đầy đủ.
- Danh mục.
- Thương hiệu.
- Trạng thái.

### Biến thể

Mỗi variant:

- SKU.
- Màu.
- RAM.
- Dung lượng.
- Thuộc tính khác nếu schema hỗ trợ.
- Giá thường.
- Giá khuyến mãi.
- Tồn kho ban đầu.
- Trạng thái.

### Ảnh

- Upload Supabase Storage.
- Preview.
- Chọn ảnh đại diện.
- Sắp xếp ảnh.
- Xóa ảnh có xác nhận.
- Kiểm tra mime type và kích thước.

### Nội dung bổ sung

- Specs.
- Use cases.
- SEO title.
- SEO description.
- Sản phẩm nổi bật.
- Sản phẩm mới nếu schema có.

## 5.3 Validation

- Tên bắt buộc.
- Slug hợp lệ và duy nhất.
- Ít nhất một variant để publish.
- SKU duy nhất.
- Giá không âm.
- Sale price không lớn hơn regular price.
- Tồn kho không âm.
- Danh mục và thương hiệu phải tồn tại.
- Image URL/path phải thuộc nguồn được phép.
- Server validation bắt buộc.

## 5.4 Transaction tạo sản phẩm

Tạo sản phẩm có thể gồm:

- Product.
- Variant.
- Inventory.
- Image metadata.
- Specs.
- Use cases.

Không để partial data nếu một bước thất bại.

Ưu tiên transaction hoặc PostgreSQL RPC. Nếu code hiện tại có rollback thủ công, phải đánh giá độ an toàn và nâng cấp nếu cần.

## 5.5 Sửa sản phẩm

- Load dữ liệu hiện tại phía server.
- Phân biệt variant mới, sửa và archive/xóa.
- Không hard-delete variant đã xuất hiện trong order history.
- Không làm mất order item snapshot.
- Có unsaved changes warning.
- Có optimistic UI chỉ khi an toàn.
- Sau lưu phải đọc lại hoặc invalidate cache đúng cách.

## 5.6 Archive và delete policy

Mặc định không hard-delete sản phẩm.

- Draft chưa liên quan dữ liệu khác có thể cân nhắc hard-delete theo rule rõ ràng.
- Sản phẩm đã có order item chỉ được archive/deactivate.
- Confirmation dialog phải ghi rõ hậu quả.
- Product list mặc định không hiển thị archived trừ khi filter.

## 5.7 Image Storage

- Dùng Supabase Storage bucket phù hợp.
- Upload qua server hoặc signed workflow an toàn theo kiến trúc.
- Không dùng service role ở client.
- Tên file tránh collision.
- Có cleanup khi upload thành công nhưng save DB thất bại, nếu khả thi.
- Không xóa file đang được entity khác sử dụng.

## 5.8 Search và index

Đánh giá index cho:

- `products.name`
- `products.slug`
- `product_variants.sku`
- category/brand/status columns

Nếu dùng fuzzy search hoặc `ilike`, giải thích ảnh hưởng và chỉ thêm extension/index qua migration khi cần.

## 5.9 Không nằm trong phạm vi

- Import hàng nghìn sản phẩm bằng CSV.
- Product translation đa ngôn ngữ.
- AI generation nội dung.
- Supplier management.
- Multi-warehouse.

## 5.10 Acceptance criteria

- Product list dùng server pagination.
- Search, filter, sort phản ánh trong URL.
- Create ghi đủ product, variant, inventory và image metadata.
- Failure không để partial product không hợp lệ.
- Edit không phá order history.
- Archive hoạt động đúng.
- Upload ảnh thật vào Supabase Storage.
- Không dùng service role ở client.
- Validation client và server đầy đủ.
- Toast, confirmation, loading và error state hoạt động.
- Lint, test và build thành công.

## 5.11 Test tối thiểu

- Tạo sản phẩm hợp lệ.
- SKU trùng bị chặn.
- Slug trùng bị chặn.
- Sale price lớn hơn price bị chặn.
- Publish không có variant bị chặn.
- Transaction rollback khi inventory insert thất bại.
- Edit variant không làm mất order history.
- Archive product.
- Search, filter và pagination.
- User thiếu permission không mutation được.

## 5.12 Prompt triển khai Phase 3

```text
Hãy triển khai Phase 3 - Product Management theo tài liệu
`docs/Claude_Code_Admin_Redesign_Phase_1_5.md`.

Trước khi code:
1. Khảo sát product schema, trigger và RPC hiện có.
2. Kiểm tra product create/edit hiện tại và xác định phần có thể giữ.
3. Đề xuất transaction strategy cho create/update nhiều bảng.
4. Đề xuất search, filter, sort, pagination và index.
5. Đề xuất Supabase Storage workflow.
6. Liệt kê file, migration, component và test.

Không hard-delete sản phẩm đã liên quan đơn hàng.
Không dùng service role ở client.
Không load toàn bộ catalog để filter client.
Không đánh dấu hoàn thành nếu UI chưa lưu và đọc lại database thật.

Sau khi triển khai:
- test create/edit/archive/upload;
- test rollback;
- test permission;
- chạy lint, type-check, test và build;
- kiểm tra responsive;
- xem git diff;
- chưa commit hoặc push.
```

---

# PHASE 4 - CATEGORY, BRAND VÀ INVENTORY

## 6. Mục tiêu

Xây dựng CRUD danh mục, thương hiệu và module tồn kho riêng, thay vì chỉnh tồn kho rải rác trong product form.

## 6.1 Category CRUD

Danh sách:

- Tên.
- Slug.
- Ảnh/icon nếu schema hỗ trợ.
- Danh mục cha nếu có.
- Số sản phẩm.
- Trạng thái.
- Thứ tự hiển thị.
- Ngày cập nhật.

Chức năng:

- Search.
- Filter trạng thái.
- Sort.
- Pagination nếu số lượng lớn.
- Tạo.
- Sửa.
- Activate/deactivate.
- Archive hoặc delete an toàn.

Business rules:

- Slug duy nhất.
- Không xóa danh mục đang có sản phẩm nếu chưa chuyển sản phẩm.
- Nếu có hierarchy, không tạo cycle.
- Không cho category tự làm parent của chính nó.
- Không làm vỡ URL storefront khi đổi slug mà chưa có redirect strategy.

## 6.2 Brand CRUD

Danh sách:

- Logo.
- Tên.
- Slug.
- Mô tả ngắn.
- Số sản phẩm.
- Trạng thái.
- Ngày cập nhật.

Chức năng:

- Search.
- Filter.
- Tạo.
- Sửa.
- Upload logo.
- Activate/deactivate.
- Archive/delete an toàn.

Business rules:

- Slug duy nhất.
- Không hard-delete brand đang có sản phẩm.
- Logo upload theo quy tắc Storage an toàn.

## 6.3 Inventory module

Danh sách tồn kho hiển thị:

- Ảnh sản phẩm.
- Tên sản phẩm.
- Variant.
- SKU.
- Tồn thực tế hoặc on-hand theo schema.
- Tồn reserved.
- Tồn khả dụng.
- Ngưỡng cảnh báo.
- Trạng thái: còn hàng, sắp hết, hết hàng.
- Lần cập nhật cuối.

Chức năng:

- Search theo tên và SKU.
- Filter theo trạng thái tồn kho.
- Filter theo category/brand.
- Sort.
- Server pagination.
- Điều chỉnh tồn kho.
- Nhập thêm hàng.
- Giảm hàng do kiểm kê.
- Ghi lý do.
- Xem lịch sử điều chỉnh.

## 6.4 Inventory adjustment migration

Đề xuất bảng `inventory_adjustments` gồm tối thiểu:

- `id`
- `inventory_id` hoặc `variant_id`
- `previous_quantity`
- `delta`
- `new_quantity`
- `reason_code`
- `note`
- `actor_user_id`
- `created_at`

Có thể điều chỉnh theo schema thực tế.

Reason code gợi ý:

- restock
- correction
- damaged
- returned
- manual_adjustment

Không cho chỉnh tồn mà không có reason.

## 6.5 Transaction và race condition

- Không cho tồn khả dụng âm.
- Tôn trọng inventory reservation.
- Cập nhật quantity và ghi adjustment log trong cùng transaction.
- Không cho hai request đồng thời ghi đè sai số lượng.
- Ưu tiên RPC với row locking khi cần.
- Không cập nhật tồn theo kiểu đọc client rồi gửi absolute value mà không kiểm tra version/current value.

## 6.6 Low-stock rule

- Ngưỡng cảnh báo có thể là global hoặc per item tùy schema.
- Nếu chưa có cột threshold, đề xuất migration rõ ràng.
- Định nghĩa:
  - Out of stock: available = 0.
  - Low stock: available > 0 và <= threshold.
  - In stock: available > threshold.

Không tự giả định công thức nếu schema reservation hiện tại khác; phải khảo sát trước.

## 6.7 Không nằm trong phạm vi

- Multi-warehouse.
- Purchase orders.
- Supplier management.
- Barcode scanner.
- Warehouse transfer.
- Full accounting inventory valuation.

## 6.8 Acceptance criteria

- Category CRUD hoạt động với database thật.
- Brand CRUD hoạt động với database thật.
- Không xóa category/brand đang được dùng sai policy.
- Inventory có search/filter/pagination phía server.
- Mọi adjustment có reason và actor.
- Quantity và adjustment log ghi atomically.
- Không cho available stock âm.
- Low-stock status tính nhất quán.
- Dashboard low-stock dùng cùng business rule.
- Lint, test và build thành công.

## 6.9 Test tối thiểu

- Tạo/sửa/archive category.
- Chặn slug trùng.
- Chặn delete category có product.
- Tạo/sửa/archive brand.
- Chặn delete brand có product.
- Restock inventory.
- Correction inventory.
- Chặn adjustment làm quantity invalid.
- Concurrent adjustment không mất dữ liệu.
- Adjustment log có actor và reason.
- Permission cho staff/manager/admin.

## 6.10 Prompt triển khai Phase 4

```text
Hãy triển khai Phase 4 - Category, Brand và Inventory theo tài liệu
`docs/Claude_Code_Admin_Redesign_Phase_1_5.md`.

Trước khi code:
1. Khảo sát schema category, brand, inventory và reservations.
2. Định nghĩa chính xác on-hand, reserved và available.
3. Đề xuất migration inventory_adjustments và threshold nếu cần.
4. Đề xuất transaction/RPC tránh race condition.
5. Liệt kê file, migration, permission và test.

Không làm multi-warehouse hoặc supplier module.
Không chỉnh tồn kho chỉ bằng client state.
Không cho quantity âm hoặc thấp hơn reserved theo business rule.
Mọi adjustment phải có reason, actor và audit trail.

Sau khi triển khai:
- test CRUD category/brand;
- test inventory adjustment và concurrency;
- test permission;
- chạy lint, type-check, test và build;
- kiểm tra responsive;
- xem git diff;
- chưa commit hoặc push.
```

---

# PHASE 5 - ORDER MANAGEMENT VÀ COUPON ADMIN

## 7. Mục tiêu

Nâng cấp quản lý đơn hàng thành workflow vận hành đầy đủ và xây dựng CRUD coupon thực tế.

## 7.1 Order list redesign

Hiển thị:

- Mã đơn.
- Khách hàng.
- Số điện thoại.
- Tổng tiền.
- Phương thức thanh toán.
- Trạng thái thanh toán.
- Trạng thái đơn.
- Ngày đặt.
- Ngày cập nhật.

Chức năng:

- Search theo mã đơn, tên và số điện thoại.
- Filter trạng thái đơn.
- Filter trạng thái thanh toán.
- Filter phương thức thanh toán.
- Filter khoảng ngày.
- Sort.
- Server pagination.
- URL search params.
- Export CSV chỉ khi nằm trong phạm vi và không làm lộ dữ liệu quá mức.

Không load limit 100 cố định rồi filter client.

## 7.2 Order detail

Hiển thị:

- Thông tin khách hàng.
- Địa chỉ giao hàng.
- Sản phẩm trong đơn.
- Snapshot tên, SKU và giá tại thời điểm mua.
- Tạm tính.
- Giảm giá.
- Phí giao hàng.
- Tổng tiền.
- Payment method.
- Payment status.
- Order status.
- Timeline trạng thái.
- Ghi chú khách hàng.
- Ghi chú nội bộ.

Không dùng giá sản phẩm hiện tại thay cho order item snapshot.

## 7.3 Status workflow

Giữ và chuẩn hóa transition matrix hiện tại.

Ví dụ trạng thái có thể gồm:

- pending
- confirmed
- processing
- shipping
- completed
- cancelled

Phải dựa trên enum/rule hiện tại, không tự đổi tên trạng thái nếu chưa có migration plan.

Yêu cầu:

- Chỉ cho transition hợp lệ.
- UI chỉ hiển thị action hợp lệ.
- Server/RPC vẫn phải kiểm tra transition.
- Cancel bắt buộc lý do.
- Status change ghi event history.
- Actor được lưu.
- Mark paid phải kiểm tra permission.
- Không cho sửa trực tiếp lịch sử order item.

## 7.4 Cancel và inventory

- Xác định inventory bị reserve/trừ ở bước nào trong flow hiện tại.
- Cancel phải release hoặc restore stock đúng một lần.
- Request lặp lại không được cộng trả tồn nhiều lần.
- Dùng transaction/RPC hiện có hoặc nâng cấp.
- Thao tác phải idempotent khi phù hợp.

## 7.5 Order status history migration

Đề xuất bảng `order_status_events`:

- `id`
- `order_id`
- `from_status`
- `to_status`
- `reason`
- `actor_user_id`
- `created_at`

Có thể thêm metadata cần thiết nhưng không lưu secret.

## 7.6 Internal notes

Có thể dùng:

- cột `orders.internal_note`, hoặc
- bảng `order_internal_notes` nếu cần nhiều note và lịch sử.

Ưu tiên bảng riêng nếu muốn:

- nhiều note;
- actor;
- timestamp;
- không ghi đè lịch sử.

Không hiển thị internal note cho customer.

## 7.7 Customer view nhẹ

Trong Phase 5 có thể tạo `/admin/customers` dạng aggregate từ orders nếu chưa có bảng customer/profile:

- Tên gần nhất.
- Số điện thoại.
- Email nếu có.
- Số đơn.
- Tổng chi tiêu.
- Đơn gần nhất.

Phải ghi rõ đây là customer aggregate từ order data, không phải hồ sơ tài khoản hoàn chỉnh.

Không bắt buộc xây customer authentication trong phase này.

## 7.8 Coupon CRUD

Danh sách:

- Code.
- Mô tả.
- Loại giảm.
- Giá trị.
- Ngày bắt đầu.
- Ngày kết thúc.
- Lượt dùng.
- Giới hạn.
- Trạng thái.

Form:

- Code.
- Percentage hoặc fixed amount.
- Discount value.
- Minimum order value.
- Maximum discount.
- Start time.
- End time.
- Total usage limit.
- Per-customer limit nếu schema hỗ trợ.
- Product/category scope nếu schema hỗ trợ.
- Active state.

Validation:

- Code duy nhất và normalize rõ ràng.
- Không âm.
- Percentage trong giới hạn hợp lệ.
- End time sau start time.
- Usage limit hợp lệ.
- Không cho coupon hết hạn được áp dụng.
- Server checkout là nguồn sự thật khi tính coupon.

## 7.9 Audit

Tối thiểu log:

- Order status change.
- Cancel order.
- Mark paid/unpaid nếu có.
- Internal note creation.
- Coupon create/update/deactivate.

## 7.10 Không nằm trong phạm vi

- Tích hợp hãng vận chuyển thật.
- Refund payment gateway tự động.
- Trả góp.
- Hóa đơn điện tử.
- Full CRM.
- Marketing automation.

## 7.11 Acceptance criteria

- Order list có search/filter/date range/pagination phía server.
- Order detail dùng snapshot data.
- Status workflow được kiểm tra ở server.
- Cancel có reason và stock handling đúng.
- Status history có actor và timestamp.
- Internal notes không lộ ra storefront/customer.
- Coupon CRUD dùng database thật.
- Coupon validation nhất quán với checkout.
- Không hard-code status transitions chỉ ở UI.
- Lint, type-check, test và build thành công.

## 7.12 Test tối thiểu

- Search order theo code/phone.
- Date filter.
- Transition hợp lệ.
- Transition không hợp lệ bị chặn.
- Cancel bắt buộc reason.
- Cancel release/restore stock đúng một lần.
- Mark paid permission.
- Status event được tạo.
- Internal note không xuất hiện ở customer API/UI.
- Tạo coupon hợp lệ.
- Chặn code trùng.
- Chặn date range sai.
- Chặn coupon hết hạn.
- Discount calculation khớp checkout.

## 7.13 Prompt triển khai Phase 5

```text
Hãy triển khai Phase 5 - Order Management và Coupon Admin theo tài liệu
`docs/Claude_Code_Admin_Redesign_Phase_1_5.md`.

Trước khi code:
1. Khảo sát order status RPC, reservation và stock flow hiện tại.
2. Vẽ transition matrix hiện tại.
3. Xác định cancel/complete đang tác động inventory lúc nào.
4. Đề xuất migration order_status_events và internal notes.
5. Kiểm tra coupon schema và checkout calculation hiện tại.
6. Liệt kê file, migration, RPC, permission và test.

Không thay đổi status enum tùy ý.
Không sửa order item snapshot.
Không để cancel trả tồn hai lần.
Không tính coupon khác logic checkout.
Không load 100 orders rồi filter client.

Sau khi triển khai:
- test transition và idempotency;
- test stock release/restore;
- test coupon validation;
- test permission và audit;
- chạy lint, type-check, test và build;
- kiểm tra responsive;
- xem git diff;
- chưa commit hoặc push.
```

---

# 8. Kế hoạch branch và pull request

Khuyến nghị:

```text
feature/admin-foundation
feature/admin-dashboard
feature/admin-product-management
feature/admin-catalog-inventory
feature/admin-orders-coupons
```

Mỗi phase nên là một pull request riêng. Nếu Phase 3-5 quá lớn, chia tiếp:

```text
feature/admin-products-list
feature/admin-product-form
feature/admin-product-images
feature/admin-categories-brands
feature/admin-inventory
feature/admin-orders
feature/admin-coupons
```

Mỗi PR phải ghi:

- Mục tiêu.
- Phạm vi.
- Không nằm trong phạm vi.
- UI screenshots desktop/mobile.
- Database migration.
- Cách test.
- Security impact.
- Rủi ro.
- Rollback plan.
- Issue liên quan.

---

# 9. Definition of Done chung

Một phase chỉ được xem là hoàn thành khi:

- Tính năng hoạt động từ UI tới database thật.
- Authentication và authorization phía server đầy đủ.
- Không có secret trong client hoặc repository.
- Migration rõ ràng và có rollback strategy.
- Loading, empty, error và success state đầy đủ.
- Validation client và server đầy đủ.
- Responsive đạt yêu cầu.
- Accessibility cơ bản đạt yêu cầu.
- Không có lỗi TypeScript.
- Lint thành công.
- Test quan trọng thành công.
- Production build thành công.
- Không làm hỏng storefront hoặc flow checkout hiện tại.
- Documentation được cập nhật.
- Git diff đã được review.
- Không còn mock data production.

---

# 10. Prompt điều phối toàn bộ Phase 1-5

Dùng prompt này khi bắt đầu một phiên Claude Code mới:

```text
Hãy đọc toàn bộ:

1. CLAUDE.md
2. AGENTS.md nếu có
3. README.md
4. docs/Claude_Code_Admin_Redesign_Phase_1_5.md
5. migrations trong /supabase
6. source code admin hiện tại

Tài liệu Phase 1-5 là nguồn sự thật cho việc redesign admin.

Không triển khai nhiều phase cùng lúc.
Chỉ làm phase tôi chỉ định.

Trước mọi phase:
- tóm tắt cách hiểu yêu cầu;
- khảo sát hiện trạng;
- chỉ ra điểm mâu thuẫn;
- nêu giả định;
- lập kế hoạch;
- liệt kê file;
- nêu database impact;
- nêu security impact;
- nêu test plan;
- chưa sửa code cho đến khi kế hoạch rõ ràng.

Trong lúc triển khai:
- không mở rộng phạm vi;
- không hard-code production data;
- không tắt RLS;
- không dùng service role ở client;
- không sửa migration cũ;
- không refactor ngoài task;
- không thao tác production;
- không commit hoặc push nếu chưa được yêu cầu.

Sau khi triển khai:
- xem toàn bộ git diff;
- chạy lint;
- chạy type-check;
- chạy unit/integration/E2E test liên quan;
- chạy production build;
- kiểm tra desktop/tablet/mobile;
- báo phần hoàn thành, phần thiếu, rủi ro còn lại và cách rollback.
```

---

# 11. Thứ tự thực hiện bắt buộc

1. Hoàn thành authentication/authorization foundation theo tài liệu riêng.
2. Phase 1 - Admin Foundation.
3. Phase 2 - Dashboard và Biểu đồ.
4. Phase 3 - Product Management.
5. Phase 4 - Category, Brand và Inventory.
6. Phase 5 - Order Management và Coupon Admin.

Không bắt đầu phase sau khi phase trước còn lỗi build, lỗi auth nghiêm trọng, migration chưa ổn định hoặc chưa được review.
