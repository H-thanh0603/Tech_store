# DESIGN_CELLPHONES_INSPIRED.md

> Đặc tả UX/UI cho storefront Tech Store theo hướng lấy cảm hứng từ mô hình trải nghiệm của CellphoneS: nhiều tầng điều hướng, nhiều danh mục, nhiều cụm sản phẩm, ưu đãi và dịch vụ đầy đủ. Không sao chép nguyên bản giao diện, thương hiệu, màu sắc, hình ảnh hoặc nội dung của CellphoneS.

---

# 1. MỤC TIÊU

Xây dựng giao diện khách hàng có cảm giác đầy đủ như một hệ thống bán lẻ công nghệ lớn, nhưng tinh gọn cho một cửa hàng nhỏ.

Website phải:

- Có nhiều điểm vào sản phẩm.
- Có trang chủ dài, giàu nội dung.
- Có nhiều danh mục và cụm sản phẩm.
- Có khu vực ưu đãi, thành viên, chính sách và dịch vụ.
- Có giao diện hiện đại, nhiều chi tiết nhưng không rối.
- Có hiệu ứng nhỏ tinh tế.
- Hoạt động tốt trên desktop và mobile.
- Không trông như template SaaS hoặc landing page đơn giản.

---

# 2. NGUYÊN TẮC LẤY CẢM HỨNG

Được phép học theo:

- Cấu trúc header nhiều tầng.
- Search nổi bật.
- Mega menu nhiều danh mục.
- Hero kết hợp banner và quick links.
- Các cụm sản phẩm theo ngành hàng.
- Tabs thương hiệu và nhu cầu.
- Khu vực deal, hàng mới, hot trend.
- Khu vực thành viên.
- Dịch vụ, chính sách, hỗ trợ.
- Footer nhiều tầng.
- Mobile bottom navigation.

Không được sao chép:

- Logo.
- Tên thương hiệu.
- Màu đỏ đặc trưng theo tỷ lệ 1:1.
- Nội dung marketing.
- Banner.
- Hình ảnh.
- Icon độc quyền.
- Bố cục pixel-perfect.
- Thành phần nhận diện riêng.

Mục tiêu là cùng cấp độ đầy đủ, không phải bản clone.

---

# 3. KIẾN TRÚC HEADER

## 3.1 Utility bar

Hiển thị các cam kết quan trọng:

- Sản phẩm chính hãng.
- Xuất hóa đơn đầy đủ.
- Giao hàng nhanh.
- Đổi trả.
- Bảo hành.
- Tư vấn mua hàng.

Có thể dùng marquee rất chậm hoặc các item tĩnh. Không dùng text chạy nhanh.

## 3.2 Main header

Bao gồm:

- Logo Tech Store.
- Nút danh mục.
- Search bar lớn.
- Chọn khu vực giao hàng.
- Tra cứu đơn hàng.
- Yêu thích.
- Tài khoản.
- Giỏ hàng.

Yêu cầu:

- Sticky khi scroll.
- Khi sticky có thể giảm chiều cao.
- Search là thành phần trung tâm.
- Không che nội dung khi chuyển trạng thái.
- Có focus và keyboard navigation.

## 3.3 Search overlay

Khi focus:

- Hiển thị từ khóa phổ biến.
- Tìm kiếm gần đây.
- Danh mục gợi ý.
- Sản phẩm gợi ý.
- Kết quả tức thời.
- Trạng thái không có kết quả.

## 3.4 Category mega menu

Danh mục cấp cao:

- Điện thoại và tablet.
- Laptop.
- PC và linh kiện.
- Màn hình.
- Âm thanh.
- Đồng hồ thông minh.
- Camera.
- Phụ kiện.
- Gaming gear.
- Hàng cũ.
- Khuyến mãi.
- Tin công nghệ.

Mega menu mỗi danh mục gồm:

- Nhóm sản phẩm.
- Thương hiệu.
- Nhu cầu sử dụng.
- Mức giá.
- Sản phẩm nổi bật.
- Banner nhỏ.

## 3.5 Mobile navigation

Mobile cần:

- Header gọn.
- Search riêng.
- Drawer danh mục.
- Bottom navigation gồm Trang chủ, Danh mục, Tìm kiếm, Đơn hàng, Tài khoản.

---

# 4. TRANG CHỦ — CẤU TRÚC ĐẦY ĐỦ

Trang chủ mục tiêu từ 14 đến 20 section, tùy dữ liệu thực tế.

## 4.1 Hero commerce zone

Bố cục desktop:

- Cột trái: category menu.
- Trung tâm: hero banner lớn.
- Cột phải: 2–3 banner nhỏ.
- Hàng dưới: campaign quick links.

Bố cục mobile:

- Hero chính.
- Quick category grid.
- Campaign cards ngang.

Yêu cầu:

- Hero không tự đổi quá nhanh.
- Có navigation rõ.
- Ảnh desktop/mobile riêng.
- Không dùng banner giả.
- Có skeleton đúng tỉ lệ.

## 4.2 Campaign quick links

Các entry có thể gồm:

- Deal sốc.
- Hàng mới.
- Ưu đãi sinh viên.
- Trade-in.
- Hàng cũ.
- Khách hàng doanh nghiệp.
- Trả góp.
- Thành viên.

## 4.3 Member welcome block

Khối đăng nhập thành viên:

- Lợi ích thành viên.
- Điểm thưởng.
- Voucher.
- Theo dõi đơn.
- Bảo hành.
- Giá thành viên.

Nếu chưa đăng nhập:

- CTA đăng nhập.
- CTA đăng ký.

Nếu đã đăng nhập:

- Tên người dùng.
- Điểm.
- Voucher.
- Đơn gần nhất.

## 4.4 Hot deal zone

Tabs:

- Deal sốc.
- Hot trend.
- Hàng mới.
- Bán chạy.

Có:

- Category filter.
- Countdown chỉ khi có thời gian thật.
- Product carousel.
- Xem tất cả.

## 4.5 Category shortcut grid

Danh mục dạng icon/image card:

- Điện thoại.
- Tablet.
- Laptop.
- PC.
- Màn hình.
- Âm thanh.
- Đồng hồ.
- Camera.
- Gia dụng nhỏ nếu dự án có.
- Phụ kiện.

## 4.6 Điện thoại nổi bật

Bao gồm:

- Heading.
- Tabs thương hiệu.
- Tabs mức giá.
- Product grid/carousel.
- Banner nhỏ.
- Xem tất cả.

## 4.7 Laptop nổi bật

Tabs:

- MacBook.
- Gaming.
- Văn phòng.
- Sinh viên.
- Đồ họa.
- Mỏng nhẹ.

## 4.8 PC và màn hình

Nhóm:

- PC gaming.
- PC văn phòng.
- Màn hình gaming.
- Màn hình đồ họa.
- Linh kiện.
- Phụ kiện máy tính.

## 4.9 Âm thanh và wearable

Nhóm:

- Tai nghe.
- Loa.
- Micro.
- Đồng hồ.
- Vòng đeo.

## 4.10 Phụ kiện

Hiển thị nhiều nhóm nhỏ:

- Sạc.
- Cáp.
- Pin dự phòng.
- Bàn phím.
- Chuột.
- Ốp lưng.
- Hub.
- Camera.
- Phụ kiện Apple.

Có thể dùng mosaic grid để tạo nhịp khác với product carousel.

## 4.11 Hàng cũ

- Điện thoại cũ.
- Laptop cũ.
- Tablet cũ.
- Phụ kiện cũ.
- Cam kết tình trạng.
- Chính sách bảo hành.

## 4.12 Trade-in

Khối thu cũ đổi mới:

- Nhập thiết bị đang dùng.
- Ước tính giá.
- Xem quy trình.
- Sản phẩm được trợ giá.

Không cần định giá tự động trong V1 nếu chưa có backend; có thể dẫn tới form đăng ký.

## 4.13 Ưu đãi thanh toán

- Ngân hàng.
- Ví điện tử.
- Trả góp.
- Mua trước trả sau.

Chỉ hiển thị đối tác và ưu đãi thật.

## 4.14 So sánh theo nhu cầu

Ví dụ:

- Laptop cho sinh viên.
- Laptop cho lập trình.
- Điện thoại chụp ảnh.
- Điện thoại pin tốt.
- Màn hình cho designer.
- Gaming setup theo ngân sách.

## 4.15 Brand universe

- Logo thương hiệu.
- Featured brand.
- Collection nổi bật.
- Link tới landing page thương hiệu.

## 4.16 Content hub

- Tin công nghệ.
- Hướng dẫn mua hàng.
- So sánh sản phẩm.
- Kinh nghiệm sử dụng.
- Build PC.

## 4.17 Trust and service

- Chính hãng.
- Bảo hành.
- Đổi trả.
- Giao hàng.
- Xuất hóa đơn.
- Tư vấn.

## 4.18 Recently viewed

Chỉ xuất hiện khi có dữ liệu.

## 4.19 Newsletter / price alert

- Nhận tin giảm giá.
- Theo dõi giá sản phẩm.
- Đăng ký tin công nghệ.

## 4.20 Footer nhiều tầng

Footer gồm:

- Tổng đài hỗ trợ.
- Phương thức thanh toán.
- Chính sách mua hàng.
- Bảo hành.
- Giao hàng.
- Đổi trả.
- Trả góp.
- Tra cứu đơn.
- Liên hệ.
- Giới thiệu.
- Tuyển dụng.
- Blog.
- Social.
- Danh sách keyword SEO có kiểm soát.

---

# 5. PRODUCT CARD PHONG CÁCH BÁN LẺ LỚN

Mỗi card cần:

- Ảnh lớn.
- Tên.
- Giá.
- Giá cũ.
- Mức giảm.
- Khuyến mãi ngắn.
- Badge.
- Rating.
- Tình trạng hàng.
- Wishlist.
- Compare.

Yêu cầu:

- Không quá 2 badge chính.
- Nội dung promotion tối đa 2 dòng.
- Hover scale ảnh nhẹ.
- Card nâng nhẹ.
- Không giấu thông tin quan trọng khi không hover.
- Mobile có layout gọn.

---

# 6. CATEGORY PAGE

Trang danh mục cần đầy đủ:

- Breadcrumb.
- Heading.
- Banner category.
- Quick subcategory.
- Brand filter.
- Price filter.
- Spec filter.
- Need filter.
- Active filter chip.
- Sort.
- Product count.
- Server pagination.
- SEO content cuối trang.
- FAQ.

Mobile:

- Filter drawer.
- Sticky filter/sort bar.
- Không tải toàn bộ sản phẩm lên client.

---

# 7. PRODUCT DETAIL PAGE

Cần đạt mức đầy đủ như một website bán lẻ lớn:

- Gallery.
- Variant selector.
- Giá theo khu vực nếu có.
- Khuyến mãi.
- Voucher.
- Quà tặng.
- Trade-in.
- Trả góp.
- Bảo hành.
- Giao hàng.
- Tình trạng cửa hàng nếu có.
- Add to cart.
- Buy now.
- Call support.
- Specs.
- Mô tả.
- Review.
- Q&A.
- So sánh.
- Sản phẩm liên quan.
- Phụ kiện mua kèm.
- Sản phẩm tương tự.

Không tạo tính năng giả. Module chưa có backend phải có placeholder có kiểm soát hoặc được để ngoài scope.

---

# 8. HIỆU ỨNG

Phong cách chuyển động:

- Nhanh.
- Nhẹ.
- Phục vụ thao tác.
- Không cinematic quá mức.

Cho phép:

- Header thu gọn khi scroll.
- Mega menu fade/slide nhẹ.
- Product image hover zoom 1.02–1.04.
- Card translate 2px.
- Tab indicator animation.
- Drawer và modal mượt.
- Skeleton shimmer nhẹ.
- Add-to-cart feedback.
- Section reveal hạn chế.

Không cho phép:

- Parallax mạnh.
- Scroll hijack.
- Text animation từng ký tự.
- Cursor tùy biến.
- Card xoay 3D.
- Video autoplay nặng.
- Animation trên mọi section.

Bắt buộc hỗ trợ `prefers-reduced-motion`.

---

# 9. MÀU SẮC VÀ BẢN SẮC

Không sao chép nguyên màu đỏ CellphoneS.

Chọn một hướng riêng:

## Option A — Deep navy + electric blue

- Cao cấp.
- Công nghệ.
- Tin cậy.

## Option B — Graphite + lime accent

- Hiện đại.
- Khác biệt.
- Hợp gaming và hardware.

## Option C — Warm white + cobalt

- Sạch.
- Gần gũi.
- Phù hợp bán lẻ phổ thông.

Chỉ một accent chính. Giá và sale có màu riêng nhưng không cạnh tranh thương hiệu.

---

# 10. MOBILE EXPERIENCE

Mobile phải có:

- Bottom navigation.
- Search dễ mở.
- Category drawer.
- Hero đơn giản hóa.
- Horizontal product rail.
- Filter bottom sheet/drawer.
- Sticky add-to-cart.
- Accordion footer.
- Touch target tối thiểu 44px.
- Không phụ thuộc hover.

---

# 11. DATA VÀ CMS

Các section cần có dữ liệu quản trị:

- Hero banners.
- Campaign links.
- Product collections.
- Category highlights.
- Brand highlights.
- Blog articles.
- Trust items.
- Payment promotions.
- Trade-in content.
- Member benefits.

Không hard-code toàn bộ homepage trong component.

Tối thiểu nên có bảng/config cho:

- `banners`
- `homepage_sections`
- `homepage_collections`
- `campaigns`
- `articles`

Nếu chưa có schema, Claude phải đề xuất migration trước.

---

# 12. PERFORMANCE

Trang chủ dài nhưng phải tải theo tầng:

- Header và hero ưu tiên.
- Section dưới fold lazy-load.
- Product query giới hạn số item.
- Ảnh dùng responsive sizes.
- Không tải tất cả carousel ngay lập tức.
- Client component chỉ cho interaction.
- Không tải mega menu data dư thừa.
- Không tải tất cả category products cùng lúc.
- Cache server hợp lý.

---

# 13. ACCESSIBILITY

- Keyboard navigation.
- Focus visible.
- Mega menu accessible.
- Search combobox đúng semantics.
- Dialog focus trap.
- Alt text.
- Contrast AA.
- Reduced motion.
- Không dùng màu làm tín hiệu duy nhất.

---

# 14. PHASE TRIỂN KHAI

## S1 — Header và navigation

- Utility bar.
- Main header.
- Search overlay.
- Mega menu.
- Mobile drawer.
- Bottom navigation.

## S2 — Homepage commerce skeleton

- Hero commerce zone.
- Campaign quick links.
- Member block.
- Category shortcut.
- Deal tabs.

## S3 — Product category sections

- Điện thoại.
- Laptop.
- PC/màn hình.
- Âm thanh/wearable.
- Phụ kiện.
- Hàng cũ.

## S4 — Service and discovery sections

- Trade-in.
- Payment offers.
- Need selector.
- Brand universe.
- Trust section.
- Content hub.

## S5 — Category listing

- Category header.
- Filters.
- Sort.
- Pagination.
- SEO content.

## S6 — Product detail

- Gallery.
- Purchase panel.
- Promotions.
- Variants.
- Rich content.
- Reviews/Q&A.
- Related products.

## S7 — Cart, checkout, account

- Mini cart.
- Cart.
- Checkout.
- Order lookup.
- Account.
- Member benefits.

## S8 — Quality

- Mobile audit.
- Accessibility.
- Performance.
- SEO.
- Cross-browser.
- Analytics.

---

# 15. ACCEPTANCE CRITERIA

Chỉ xem là đạt khi:

- Header và search có độ đầy đủ của một website bán lẻ lớn.
- Trang chủ có tối thiểu 14 section có mục đích rõ ràng.
- Có nhiều cụm sản phẩm theo ngành hàng.
- Có khu vực ưu đãi, thành viên, dịch vụ, chính sách và content.
- Không có 3 carousel giống nhau liên tiếp.
- Có tối thiểu 2 wow moments tinh tế.
- Mobile có bottom navigation và filter drawer.
- Không sao chép nhận diện CellphoneS.
- Không dùng dữ liệu giả ở production.
- Không làm LCP, CLS và interaction suy giảm nghiêm trọng.
- Keyboard và reduced motion hoạt động.
- Lint, type-check, test và build đều pass.

---

# 16. PROMPT CHO CLAUDE CODE

```text
Hãy đọc:

1. CLAUDE.md
2. DESIGN.md
3. DESIGN_CELLPHONES_INSPIRED.md
4. README.md
5. Toàn bộ tài liệu trong /docs
6. Source code storefront hiện tại
7. Supabase schema và data source liên quan

Mục tiêu là thiết kế storefront có mức độ đầy đủ tương đương một website bán lẻ công nghệ lớn như CellphoneS, nhưng không sao chép nhận diện, hình ảnh, nội dung hoặc bố cục 1:1.

Chưa sửa code.

Trước tiên hãy audit và trả về:

- Route hiện tại.
- Header/navigation hiện tại.
- Search hiện tại.
- Cấu trúc homepage hiện tại.
- Các category section hiện có.
- Product card hiện tại.
- Category page hiện tại.
- Product detail hiện tại.
- Cart/checkout/account hiện tại.
- Data source cho banner, campaign, collection và content.
- Những phần đang hard-code.
- Những phần chỉ có UI giả.
- Những phần backend/schema còn thiếu.
- Những component có thể tái sử dụng.
- Khoảng cách so với DESIGN_CELLPHONES_INSPIRED.md.
- Roadmap S1–S8.
- Kế hoạch chi tiết cho S1.
- File dự kiến tạo hoặc sửa.
- Dependency cần thêm và lý do.
- Rủi ro hiệu năng.
- Acceptance criteria.
- Test plan.

Không sửa code, không chạy migration, không cài dependency, không commit và không push.
```

---

# 17. QUY TẮC CUỐI

Mục tiêu không phải tạo bản clone CellphoneS.

Mục tiêu là đạt:

- Độ đầy đủ tương đương.
- Nhiều điểm khám phá tương đương.
- Cấu trúc bán lẻ chuyên nghiệp tương đương.
- Tính năng và nội dung phong phú tương đương ở quy mô nhỏ.
- Thiết kế riêng, hiện đại và dễ bảo trì hơn.
