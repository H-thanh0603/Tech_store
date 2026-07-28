\# NHIỆM VỤ: THIẾT KẾ LẠI TOÀN BỘ TRANG QUẢN TRỊ TECH STORE

\## Mục tiêu

Thiết kế lại toàn bộ trang quản trị của website bán sản phẩm công nghệ.

Trang quản trị hiện tại chưa đạt yêu cầu:

\* Giao diện chưa hợp lý.

\* Bố cục thiếu tính hệ thống.

\* Chưa có CRUD hoàn chỉnh.

\* Chưa có chức năng thêm, xem, sửa, xóa hoặc ẩn dữ liệu đúng chuẩn.

\* Chưa có dashboard hữu ích.

\* Chưa có biểu đồ.

\* Chưa có bộ lọc, tìm kiếm và phân trang đầy đủ.

\* Chưa xử lý tốt loading, empty, error và confirmation state.

\* Nhiều phần có thể chỉ là UI giả lập, chưa kết nối database thật.

Hệ thống mới phải là một \*\*admin dashboard hoạt động thực tế cho một cửa hàng bán laptop, điện thoại, PC, màn hình và phụ kiện\*\*, không phải dashboard demo.

\---

\# 1. Quy trình bắt buộc

\## Giai đoạn 1: Khảo sát, chưa sửa code

Trước tiên, chưa được sửa bất kỳ file nào.

Hãy thực hiện:

1\. Kiểm tra toàn bộ trang admin hiện tại.

2\. Liệt kê các route admin đang tồn tại.

3\. Liệt kê các chức năng đã hoạt động thật.

4\. Liệt kê các chức năng chỉ đang giả lập.

5\. Kiểm tra admin đang lấy dữ liệu từ đâu.

6\. Kiểm tra các bảng Supabase liên quan.

7\. Kiểm tra CRUD nào còn thiếu.

8\. Kiểm tra quyền truy cập và RLS.

9\. Kiểm tra component nào có thể tái sử dụng.

10\. Kiểm tra vấn đề UI/UX, responsive và accessibility.

11\. Kiểm tra lỗi TypeScript, logic, validation và bảo mật.

12\. Kiểm tra dữ liệu biểu đồ có thể lấy từ database hiện tại hay chưa.

Sau khi khảo sát, hãy trả về báo cáo gồm:

\* Hiện trạng.

\* Các vấn đề theo mức độ nghiêm trọng.

\* Chức năng cần giữ lại.

\* Chức năng cần sửa.

\* Chức năng cần xây mới.

\* Database cần bổ sung hoặc thay đổi.

\* Các route dự kiến.

\* Các component dự kiến.

\* Kế hoạch triển khai theo từng giai đoạn.

\* Danh sách file dự kiến tạo, sửa hoặc xóa.

\* Rủi ro và giả định.

Không triển khai cho đến khi kế hoạch đã rõ ràng.

\---

\# 2. Nguyên tắc thiết kế admin

Trang admin phải mang phong cách:

\* Hiện đại.

\* Chuyên nghiệp.

\* Sạch sẽ.

\* Dễ đọc.

\* Tập trung vào công việc.

\* Có hierarchy thị giác rõ ràng.

\* Không giống template dashboard rẻ tiền.

\* Không lạm dụng gradient.

\* Không lạm dụng glassmorphism.

\* Không dùng animation gây mất tập trung.

\* Không nhồi quá nhiều thông tin vào một màn hình.

\* Tối ưu cho desktop nhưng vẫn dùng được trên tablet và mobile.

\* Thống nhất hoàn toàn với design system của dự án.

Ưu tiên:

\* Typography rõ ràng.

\* Khoảng trắng hợp lý.

\* Bảng dữ liệu dễ quét.

\* Nút hành động rõ ràng.

\* Trạng thái bằng badge dễ hiểu.

\* Filter và search hoạt động tốt.

\* Các thao tác nguy hiểm phải được cảnh báo.

\* Người dùng luôn biết thao tác vừa thực hiện thành công hay thất bại.

\---

\# 3. Cấu trúc layout admin

Thiết kế một Admin Shell thống nhất gồm:

\## Sidebar

Sidebar cần có:

\* Tổng quan

\* Sản phẩm

\* Danh mục

\* Thương hiệu

\* Tồn kho

\* Đơn hàng

\* Khách hàng

\* Khuyến mãi

\* Đánh giá

\* Banner

\* Bài viết hoặc nội dung

\* Báo cáo

\* Nhân viên và phân quyền, nếu nằm trong phạm vi hiện tại

\* Cài đặt

Yêu cầu:

\* Có icon phù hợp.

\* Có trạng thái active rõ ràng.

\* Có thể thu gọn.

\* Mobile sử dụng drawer.

\* Không hiển thị mục mà tài khoản không có quyền truy cập.

\## Topbar

Bao gồm:

\* Breadcrumb.

\* Tên trang.

\* Global search nếu cần.

\* Notification placeholder có cấu trúc hợp lý.

\* Thông tin tài khoản admin.

\* Menu tài khoản.

\* Nút đăng xuất.

\* Hiển thị môi trường development hoặc production nếu phù hợp.

\## Main content

\* Max-width và spacing thống nhất.

\* Header trang có title, description và primary action.

\* Filter bar nhất quán.

\* Data table nhất quán.

\* Form nhất quán.

\* Các trạng thái loading, empty và error nhất quán.

\---

\# 4. Dashboard tổng quan

Xây dựng dashboard dùng dữ liệu thật từ database.

\## KPI cards

Tối thiểu gồm:

\* Doanh thu hôm nay.

\* Doanh thu tháng này.

\* Số đơn hôm nay.

\* Số đơn đang chờ xử lý.

\* Giá trị đơn hàng trung bình.

\* Số khách hàng mới.

\* Sản phẩm sắp hết hàng.

\* Sản phẩm hết hàng.

Mỗi KPI cần:

\* Giá trị chính.

\* So sánh với kỳ trước nếu dữ liệu cho phép.

\* Xu hướng tăng hoặc giảm.

\* Tooltip giải thích cách tính.

\* Loading state.

\* Empty state.

\* Error state.

Không hiển thị phần trăm tăng giảm giả nếu database chưa có dữ liệu để tính.

\## Biểu đồ

Tối thiểu xây dựng:

1\. Biểu đồ doanh thu theo ngày trong 7, 30 hoặc 90 ngày.

2\. Biểu đồ số đơn theo trạng thái.

3\. Biểu đồ doanh thu theo danh mục sản phẩm.

4\. Biểu đồ sản phẩm bán chạy.

5\. Biểu đồ khách hàng mới theo thời gian, nếu có đủ dữ liệu.

Yêu cầu:

\* Có bộ chọn khoảng thời gian.

\* Dữ liệu lấy từ database thật.

\* Không hard-code dữ liệu giả trong production.

\* Có tooltip.

\* Có legend khi cần.

\* Có empty state khi chưa có dữ liệu.

\* Hiển thị tiền theo định dạng Việt Nam, ví dụ `25.000.000 ₫`.

\* Biểu đồ responsive.

\* Không dùng quá nhiều màu.

\* Màu sắc phải có ý nghĩa và nhất quán.

\## Các khối bổ sung

\* Đơn hàng gần đây.

\* Sản phẩm sắp hết hàng.

\* Sản phẩm bán chạy.

\* Hoạt động quản trị gần đây nếu hệ thống có audit log.

\* Các cảnh báo cần xử lý.

\---

\# 5. CRUD sản phẩm

Xây dựng CRUD sản phẩm hoàn chỉnh.

\## Danh sách sản phẩm

Hiển thị:

\* Ảnh.

\* Tên sản phẩm.

\* SKU hoặc mã sản phẩm.

\* Danh mục.

\* Thương hiệu.

\* Khoảng giá.

\* Số biến thể.

\* Tổng tồn kho.

\* Trạng thái.

\* Ngày cập nhật.

\* Menu hành động.

Chức năng:

\* Tìm kiếm theo tên, SKU và slug.

\* Lọc theo danh mục.

\* Lọc theo thương hiệu.

\* Lọc theo trạng thái.

\* Lọc theo tồn kho.

\* Sắp xếp.

\* Phân trang.

\* Chọn nhiều bản ghi.

\* Bulk activate.

\* Bulk deactivate.

\* Bulk archive nếu phù hợp.

\* Xuất dữ liệu nếu nằm trong phạm vi.

\* Giữ filter trên URL.

\* Có empty state và reset filter.

\## Thêm sản phẩm

Form cần hỗ trợ:

\* Tên sản phẩm.

\* Slug tự sinh nhưng cho phép sửa.

\* Mô tả ngắn.

\* Mô tả đầy đủ.

\* Danh mục.

\* Thương hiệu.

\* Trạng thái.

\* Thông số kỹ thuật.

\* Nội dung SEO.

\* Ảnh sản phẩm.

\* Biến thể.

\* Giá.

\* Giá khuyến mãi.

\* SKU.

\* Màu.

\* RAM.

\* Dung lượng.

\* Tồn kho.

\* Sản phẩm nổi bật.

\* Sản phẩm mới.

\* Thời gian mở bán nếu có.

Yêu cầu:

\* Validation rõ ràng.

\* Báo lỗi ngay tại field.

\* Không mất dữ liệu khi một request thất bại.

\* Có preview ảnh.

\* Sắp xếp ảnh.

\* Chọn ảnh đại diện.

\* Xóa ảnh có xác nhận.

\* Không cho trùng SKU.

\* Không cho giá âm.

\* Giá khuyến mãi không được lớn hơn giá thường.

\* Không cho tồn kho âm.

\* Có cảnh báo khi rời form chưa lưu.

\## Sửa sản phẩm

\* Tải đúng dữ liệu hiện tại.

\* Cho sửa toàn bộ trường được phép.

\* Theo dõi biến thể mới, đã sửa và đã xóa.

\* Không làm mất order history.

\* Không hard-delete dữ liệu đã liên quan tới đơn hàng.

\* Có updated timestamp.

\* Có thông báo thành công hoặc lỗi.

\## Xóa hoặc lưu trữ sản phẩm

Không mặc định hard-delete.

Áp dụng:

\* Soft delete.

\* Archive.

\* Deactivate.

Nếu sản phẩm đã xuất hiện trong đơn hàng:

\* Không được xóa dữ liệu lịch sử.

\* Chỉ được ẩn hoặc lưu trữ.

\* Hiển thị giải thích rõ cho admin.

Mọi thao tác xóa phải có confirmation dialog ghi rõ hậu quả.

\---

\# 6. CRUD danh mục và thương hiệu

\## Danh mục

\* Danh sách danh mục.

\* Thêm.

\* Sửa.

\* Ẩn hoặc xóa an toàn.

\* Slug.

\* Ảnh hoặc icon.

\* Danh mục cha nếu hệ thống hỗ trợ.

\* Thứ tự hiển thị.

\* Trạng thái.

\* Số lượng sản phẩm.

Không cho xóa danh mục đang có sản phẩm nếu chưa chuyển sản phẩm sang danh mục khác.

\## Thương hiệu

\* Danh sách.

\* Logo.

\* Tên.

\* Slug.

\* Mô tả.

\* Trạng thái.

\* Số sản phẩm.

\* Thêm, sửa và lưu trữ.

\---

\# 7. Quản lý tồn kho

Xây dựng module tồn kho thực tế.

Hiển thị:

\* Sản phẩm.

\* Biến thể.

\* SKU.

\* Tồn khả dụng.

\* Tồn đã giữ chỗ.

\* Ngưỡng cảnh báo.

\* Trạng thái còn hàng, sắp hết hoặc hết hàng.

\* Lần cập nhật gần nhất.

Chức năng:

\* Tìm kiếm.

\* Lọc theo trạng thái tồn kho.

\* Cập nhật tồn kho.

\* Nhập thêm hàng.

\* Điều chỉnh tồn.

\* Ghi lý do điều chỉnh.

\* Xem lịch sử thay đổi tồn kho.

\* Cảnh báo khi số lượng thấp.

\* Không cho tồn kho âm.

Nếu có chức năng checkout, cần tránh race condition và overselling.

Các thao tác cập nhật tồn kho nhiều bước cần dùng transaction hoặc PostgreSQL function phù hợp.

\---

\# 8. Quản lý đơn hàng

\## Danh sách đơn

Hiển thị:

\* Mã đơn.

\* Khách hàng.

\* Số điện thoại.

\* Tổng tiền.

\* Phương thức thanh toán.

\* Trạng thái thanh toán.

\* Trạng thái đơn.

\* Ngày đặt.

\* Nguồn đơn nếu có.

Chức năng:

\* Tìm theo mã đơn, tên, số điện thoại.

\* Lọc theo trạng thái.

\* Lọc theo ngày.

\* Lọc theo phương thức thanh toán.

\* Sắp xếp.

\* Phân trang.

\* Export nếu phù hợp.

\## Chi tiết đơn

Hiển thị:

\* Thông tin khách hàng.

\* Địa chỉ giao hàng.

\* Danh sách sản phẩm.

\* Snapshot tên, SKU và giá tại thời điểm mua.

\* Tạm tính.

\* Giảm giá.

\* Phí giao hàng.

\* Tổng tiền.

\* Lịch sử trạng thái.

\* Ghi chú khách hàng.

\* Ghi chú nội bộ.

Hành động:

\* Xác nhận đơn.

\* Đánh dấu đang chuẩn bị.

\* Đánh dấu đang giao.

\* Đánh dấu hoàn thành.

\* Hủy đơn.

\* Cập nhật trạng thái thanh toán.

\* Thêm ghi chú nội bộ.

Yêu cầu:

\* Chỉ cho chuyển trạng thái hợp lệ.

\* Hủy đơn cần lý do.

\* Hoàn tồn kho khi hủy nếu nghiệp vụ yêu cầu.

\* Không cho sửa trực tiếp giá trị lịch sử của order item.

\* Mọi thay đổi quan trọng nên được ghi log.

\---

\# 9. Quản lý khách hàng

Trang khách hàng gồm:

\* Danh sách khách hàng.

\* Tên.

\* Email.

\* Số điện thoại.

\* Số đơn.

\* Tổng chi tiêu.

\* Ngày đăng ký.

\* Đơn gần nhất.

\* Trạng thái.

Chi tiết khách hàng:

\* Thông tin cá nhân.

\* Địa chỉ.

\* Lịch sử đơn hàng.

\* Tổng chi tiêu.

\* Ghi chú nội bộ nếu phù hợp.

Không để admin tự do xem hoặc sửa dữ liệu nhạy cảm không cần thiết.

\---

\# 10. Khuyến mãi và mã giảm giá

CRUD mã giảm giá gồm:

\* Mã.

\* Mô tả.

\* Loại giảm theo phần trăm hoặc số tiền.

\* Giá trị giảm.

\* Giá trị đơn tối thiểu.

\* Mức giảm tối đa.

\* Ngày bắt đầu.

\* Ngày kết thúc.

\* Giới hạn lượt dùng.

\* Giới hạn mỗi khách hàng.

\* Danh mục hoặc sản phẩm áp dụng.

\* Trạng thái.

Validation:

\* Không cho ngày kết thúc trước ngày bắt đầu.

\* Không cho phần trăm vượt quá giới hạn hợp lệ.

\* Không cho giá trị âm.

\* Không cho trùng mã.

\* Không cho áp dụng mã đã hết hạn.

\---

\# 11. Quản lý đánh giá

\* Danh sách đánh giá.

\* Sản phẩm.

\* Khách hàng.

\* Điểm đánh giá.

\* Nội dung.

\* Ngày tạo.

\* Trạng thái duyệt.

\* Báo cáo vi phạm nếu có.

Hành động:

\* Duyệt.

\* Ẩn.

\* Từ chối.

\* Xóa theo chính sách.

\* Xem sản phẩm liên quan.

\---

\# 12. Quản lý banner và nội dung

CRUD banner:

\* Tên.

\* Ảnh desktop.

\* Ảnh mobile.

\* Link.

\* Vị trí.

\* Thứ tự.

\* Ngày bắt đầu.

\* Ngày kết thúc.

\* Trạng thái.

Có preview trước khi lưu.

Không hiển thị banner hết hạn hoặc chưa đến thời gian chạy.

\---

\# 13. Data table chuẩn dùng chung

Xây dựng hoặc chuẩn hóa component data table tái sử dụng.

Tối thiểu hỗ trợ:

\* Search.

\* Filter.

\* Sort.

\* Pagination.

\* Column visibility.

\* Row selection.

\* Bulk actions.

\* Loading skeleton.

\* Empty state.

\* Error state.

\* Responsive behavior.

\* Action menu.

\* URL search params.

\* Tổng số kết quả.

Không copy-paste mỗi module một bảng riêng thiếu nhất quán.

\---

\# 14. Form và dialog chuẩn dùng chung

Chuẩn hóa:

\* Form field.

\* Label.

\* Helper text.

\* Error text.

\* Select.

\* Combobox.

\* Date picker.

\* Currency input.

\* Number input.

\* Image uploader.

\* Rich-text editor nếu thực sự cần.

\* Confirmation dialog.

\* Delete dialog.

\* Toast.

\* Unsaved changes warning.

Form phải dùng validation schema dùng chung giữa client và server nếu kiến trúc cho phép.

Server vẫn phải validation lại, không tin dữ liệu từ client.

\---

\# 15. Trạng thái giao diện bắt buộc

Mỗi trang hoặc chức năng phải xử lý:

\* Loading.

\* Empty.

\* Error.

\* Success.

\* Disabled.

\* Permission denied.

\* Not found.

\* Partial data.

\* Slow request.

\* Confirmation.

\* Optimistic update chỉ khi an toàn.

Không được chỉ thiết kế happy path.

\---

\# 16. Responsive và accessibility

\## Responsive

\* Sidebar thành drawer trên mobile.

\* Bảng lớn phải có phương án hiển thị phù hợp.

\* Không chỉ dùng horizontal scroll cho mọi trường hợp.

\* Các cột ít quan trọng có thể ẩn trên màn hình nhỏ.

\* Primary action luôn dễ tìm.

\* Form chia section hợp lý.

\* Touch target tối thiểu khoảng 44px.

\## Accessibility

\* Điều hướng được bằng bàn phím.

\* Có focus state.

\* Dialog quản lý focus đúng.

\* Input có label.

\* Icon button có accessible name.

\* Không dùng màu sắc làm dấu hiệu duy nhất.

\* Contrast đủ rõ.

\* Chart có phần mô tả hoặc dữ liệu thay thế khi cần.

\---

\# 17. Backend và database

Tất cả CRUD phải kết nối database thật.

Không được:

\* Hard-code danh sách dữ liệu trong component.

\* Dùng dữ liệu demo giả trong production.

\* Chỉ thay đổi state frontend mà không lưu database.

\* Tắt RLS để làm cho chức năng chạy.

\* Đưa service role key ra client.

\* Cho client thực hiện thao tác admin có quyền cao mà không kiểm tra server.

Yêu cầu:

\* Mọi schema change dùng migration.

\* Không sửa migration cũ đã được áp dụng.

\* Mỗi mutation có validation.

\* Kiểm tra authentication.

\* Kiểm tra authorization.

\* Có error mapping thân thiện.

\* Các thao tác nhiều bước quan trọng dùng transaction.

\* Các query thường dùng cần index hợp lý.

\* Pagination nên thực hiện ở database.

\* Không tải toàn bộ dữ liệu rồi mới filter trên client.

\* Không tạo N+1 query.

\* Không để client tự tính các KPI quan trọng từ dữ liệu không đầy đủ.

Nếu schema hiện tại chưa đủ, hãy đề xuất migration trước khi triển khai.

\---

\# 18. Phân quyền admin

Tối thiểu cần xem xét các role:

\* Admin.

\* Manager.

\* Staff.

\* Customer.

Ví dụ:

\* Admin quản lý toàn bộ hệ thống.

\* Manager quản lý sản phẩm, tồn kho, đơn hàng và báo cáo.

\* Staff chỉ xử lý đơn hàng hoặc nội dung được giao.

\* Customer không được truy cập `/admin`.

Yêu cầu:

\* Route protection.

\* Server-side authorization.

\* RLS phù hợp.

\* Ẩn action không có quyền.

\* Không chỉ bảo vệ bằng cách ẩn nút trên giao diện.

\* Truy cập URL trực tiếp vẫn phải bị chặn.

\---

\# 19. Audit log

Nếu phù hợp với kiến trúc hiện tại, thêm audit log cho các thao tác quan trọng:

\* Tạo sản phẩm.

\* Sửa giá.

\* Thay đổi tồn kho.

\* Hủy đơn.

\* Thay đổi trạng thái thanh toán.

\* Tạo hoặc sửa mã giảm giá.

\* Thay đổi role nhân viên.

Audit log nên lưu:

\* Người thực hiện.

\* Hành động.

\* Loại đối tượng.

\* ID đối tượng.

\* Dữ liệu trước và sau ở mức phù hợp.

\* Thời gian.

\* Metadata cần thiết.

Không lưu secret hoặc dữ liệu nhạy cảm không cần thiết.

\---

\# 20. Kiểm thử bắt buộc

Viết test cho các phần quan trọng.

\## Unit test

\* Validation.

\* Tính giá.

\* Tính giảm giá.

\* Chuyển đổi trạng thái đơn.

\* Quy tắc tồn kho.

\* Permission helper.

\## Integration test

\* Tạo sản phẩm.

\* Sửa sản phẩm.

\* Archive sản phẩm.

\* Tạo đơn hoặc cập nhật đơn.

\* Cập nhật tồn kho.

\* Tạo mã giảm giá.

\## End-to-end test

Tối thiểu:

1\. Admin đăng nhập.

2\. Admin tạo sản phẩm.

3\. Admin sửa sản phẩm.

4\. Admin tìm và lọc sản phẩm.

5\. Admin cập nhật tồn kho.

6\. Admin mở chi tiết đơn.

7\. Admin cập nhật trạng thái đơn.

8\. Tài khoản không có quyền bị chặn khỏi admin.

Sau khi hoàn thành phải chạy:

\* Lint.

\* Type-check.

\* Unit test.

\* Integration test nếu có.

\* Playwright.

\* Production build.

\---

\# 21. Hiệu năng

\* Dùng server-side pagination.

\* Không query dữ liệu không cần thiết.

\* Không fetch lại toàn bộ dashboard sau mỗi thao tác nhỏ.

\* Cache chỉ khi phù hợp và không làm dữ liệu admin bị cũ nguy hiểm.

\* Lazy-load phần nặng.

\* Tối ưu ảnh.

\* Tránh bundle biểu đồ quá lớn nếu có lựa chọn nhẹ hơn.

\* Tránh re-render không cần thiết.

\* Dashboard phải tải phần chính trước, biểu đồ có thể tải độc lập.

\---

\# 22. Quy tắc triển khai

\* Không làm tất cả trong một commit.

\* Không triển khai tất cả module cùng lúc.

\* Chia thành các phase và pull request nhỏ.

\* Không sửa trực tiếp `main`.

\* Không force push.

\* Không thay đổi production nếu chưa có lệnh rõ ràng.

\* Không xóa dữ liệu thật.

\* Không thêm dependency nếu chưa giải thích lý do.

\* Không refactor ngoài phạm vi.

\* Không làm hỏng storefront hiện tại.

\* Không đổi schema mà không có migration.

\* Không commit `.env` hoặc secret.

\---

\# 23. Thứ tự triển khai đề xuất

\## Phase 1: Foundation

\* Admin shell.

\* Sidebar.

\* Topbar.

\* Breadcrumb.

\* Permission guard.

\* Shared page header.

\* Shared data table.

\* Shared forms.

\* Dialog và toast.

\* Loading, empty và error patterns.

\## Phase 2: Dashboard

\* KPI.

\* Revenue chart.

\* Order status chart.

\* Recent orders.

\* Low-stock products.

\* Date range filter.

\## Phase 3: Product management

\* Product list.

\* Create product.

\* Edit product.

\* Archive product.

\* Variant management.

\* Image management.

\* Category CRUD.

\* Brand CRUD.

\## Phase 4: Inventory

\* Inventory list.

\* Stock adjustment.

\* Low-stock warnings.

\* Inventory history.

\## Phase 5: Orders

\* Order list.

\* Order detail.

\* Status workflow.

\* Cancellation.

\* Internal notes.

\* Stock restoration rules.

\## Phase 6: Supporting modules

\* Customers.

\* Coupons.

\* Reviews.

\* Banners.

\* Content.

\## Phase 7: Quality

\* Responsive audit.

\* Accessibility.

\* Security review.

\* Performance.

\* Tests.

\* Documentation.

\---

\# 24. Kết quả cần trả về trước khi code

Trước khi triển khai, hãy trả về:

1\. Báo cáo hiện trạng.

2\. Sơ đồ route admin đề xuất.

3\. Sơ đồ component.

4\. Danh sách module.

5\. Danh sách CRUD.

6\. Danh sách bảng database liên quan.

7\. Migration cần thiết.

8\. Kế hoạch phân quyền.

9\. Danh sách biểu đồ và nguồn dữ liệu.

10\. Danh sách test.

11\. Kế hoạch chia branch và pull request.

12\. Acceptance criteria cho từng phase.

13\. Các điểm cần tôi quyết định.

Chưa viết code trong bước này.

\---

\# 25. Tiêu chí hoàn thành tổng thể

Trang admin chỉ được xem là hoàn thành khi:

\* Dùng dữ liệu thật.

\* CRUD hoạt động từ giao diện tới database.

\* Có validation client và server.

\* Có authentication và authorization.

\* Có RLS hoặc cơ chế bảo vệ tương ứng.

\* Có tìm kiếm, lọc, sắp xếp và phân trang.

\* Có loading, empty, error và success state.

\* Có confirmation cho thao tác nguy hiểm.

\* Có dashboard và biểu đồ từ dữ liệu thật.

\* Responsive tốt.

\* Accessibility cơ bản đạt yêu cầu.

\* Không có lỗi TypeScript.

\* Lint thành công.

\* Test quan trọng thành công.

\* Production build thành công.

\* Không làm hỏng storefront.

\* Không có secret trong source code.

\* Có tài liệu hướng dẫn kiểm tra.

\* Có pull request mô tả đầy đủ thay đổi.

Hãy bắt đầu bằng việc khảo sát hệ thống và lập kế hoạch. Chưa sửa code.

