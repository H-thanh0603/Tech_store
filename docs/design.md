# DESIGN.md — TECH STORE CUSTOMER EXPERIENCE SYSTEM

> Tài liệu thiết kế bắt buộc cho toàn bộ giao diện khách hàng của Tech Store. Claude Code, Codex và mọi AI agent phải đọc tài liệu này trước khi tạo hoặc sửa UI.

## 1. Mục tiêu

Tech Store phải tạo cảm giác cao cấp, hiện đại, đáng tin cậy, có chiều sâu như một tạp chí công nghệ nhưng vẫn dễ mua hàng. Không được giống template dựng sẵn, không sao chép CellphoneS/Thế Giới Di Động/FPT Shop, không lạm dụng gradient, glassmorphism, glow, card bo tròn hoặc animation phô trương.

Mục tiêu trải nghiệm:

- Sản phẩm là nhân vật chính.
- Người không rành công nghệ vẫn dễ chọn.
- Người hiểu công nghệ vẫn tìm được thông tin chi tiết.
- Mỗi section có mục đích rõ ràng.
- Trang chủ đủ dài để khám phá nhưng không kéo dài vô nghĩa.
- Có 2–4 “wow moment” tinh tế, không làm chậm trang.
- Mobile-first, accessibility tốt, hiệu năng cao.

## 2. Nguyên tắc trải nghiệm

### 2.1 Sản phẩm là trung tâm

- Ảnh sản phẩm lớn, rõ, chất lượng cao.
- Không để badge/banner lấn át sản phẩm.
- Card phải cho biết nhanh: tên, giá, đối tượng phù hợp, điểm nổi bật, tình trạng hàng.

### 2.2 Giải thích lợi ích, không chỉ khoe thông số

Không chỉ ghi “RTX 4060, 32 GB RAM”, cần diễn giải như:

- Phù hợp lập trình, chỉnh video và chơi game nặng.
- Mỏng nhẹ để mang đi mỗi ngày.
- Màn hình tốt cho thiết kế và giải trí.
- Cấu hình cân bằng cho học tập và công việc.

### 2.3 Wow đến từ tổng thể

Wow phải đến từ typography, khoảng trắng, art direction, bố cục, hình ảnh và microinteraction. Không dùng animation liên tục, parallax mạnh, cursor tùy biến, video nền nặng hoặc card xoay 3D.

## 3. Tính cách thương hiệu

- Confident — tự tin.
- Helpful — hữu ích.
- Curated — được chọn lọc.
- Modern — hiện đại.
- Premium — cao cấp vừa phải.
- Human — nói ngôn ngữ con người.
- Trustworthy — đáng tin.

Giọng nội dung ngắn, tự nhiên, dễ hiểu. Tránh “siêu phẩm”, “vô đối”, “deal sốc nhất vũ trụ”.

## 4. Art direction

- Editorial technology.
- Product-first.
- Ánh sáng studio sạch.
- Nền trung tính.
- Có ảnh lifestyle cho học tập, sáng tạo, gaming, di chuyển.
- Cận cảnh vật liệu, bàn phím, camera, màn hình, cổng kết nối.

Tỉ lệ ảnh:

- Hero desktop: 16:9 hoặc 21:9.
- Hero mobile: ảnh dọc riêng.
- Product card: 1:1 hoặc 4:3.
- Editorial: 4:3, 3:2 hoặc ảnh dọc.

Tối ưu:

- Dùng `next/image`.
- Khai báo kích thước.
- Lazy-load ảnh dưới fold.
- Preload ảnh hero.
- Dùng WebP/AVIF.
- Có alt text.

## 5. Color system

Dùng một màu thương hiệu chính, nền trung tính, màu trạng thái rõ nghĩa. Tất cả phải dùng design token:

```css
--color-bg-primary
--color-bg-secondary
--color-bg-elevated
--color-surface-soft
--color-text-primary
--color-text-secondary
--color-text-muted
--color-border
--color-border-strong
--color-brand
--color-brand-hover
--color-brand-soft
--color-success
--color-warning
--color-danger
--color-info
--color-price
--color-sale
```

Không hard-code màu rải rác.

## 6. Typography

- Một font sans-serif hỗ trợ tiếng Việt tốt.
- Không dùng quá nhiều font.
- Heading có cá tính nhưng dễ đọc.
- Body thoáng.
- Giá nổi bật hơn giá cũ.

Scale đề xuất:

```text
Display XL: 56–72px desktop, 38–46px mobile
Display L: 44–56px desktop, 32–40px mobile
H1: 36–48px desktop, 30–36px mobile
H2: 28–36px desktop, 24–30px mobile
H3: 22–28px
H4: 18–22px
Body L: 18px
Body M: 16px
Body S: 14px
Caption: 12–13px
```

## 7. Spacing và grid

Spacing scale:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 120
```

- Desktop dùng 12-column grid.
- Tablet 8-column.
- Mobile 4-column logic.
- Homepage không chỉ dùng grid card lặp lại.
- Kết hợp full-width, split layout, editorial grid và carousel.

## 8. Radius, shadow, surface

- Không bo tròn mọi thứ quá mức.
- Không dùng pill cho mọi nút.
- Shadow nhẹ; ưu tiên border, nền và khoảng trắng.
- Shadow rõ hơn chỉ cho dropdown, modal, sticky element.

## 9. Motion system

Timing:

```text
Micro interaction: 120–180ms
Button/hover/focus: 150–220ms
Dropdown/tooltip: 160–220ms
Drawer/modal: 220–320ms
Section reveal: 350–600ms
Hero transition: tối đa khoảng 800ms
```

Cho phép:

- Product image scale nhẹ.
- Card nâng 2–4px.
- Fade + translate nhỏ.
- Hero layered composition.
- Mask reveal, crossfade.
- Add-to-cart loading/success.
- Filter drawer trượt nhẹ.

Bắt buộc hỗ trợ `prefers-reduced-motion`.

Không dùng bounce mạnh, scroll hijacking, animation từng ký tự, video nền nặng, parallax mạnh.

## 10. Header và navigation

### Desktop

1. Utility bar: bảo hành, giao hàng, tra cứu đơn, hỗ trợ.
2. Main header: logo, search, tài khoản, wishlist, cart.
3. Category nav: laptop, điện thoại, PC, màn hình, phụ kiện, khuyến mãi, tư vấn.

Header sticky nhưng không quá cao. Search phải nổi bật. Mega menu có cấu trúc rõ.

### Mobile

- Logo, search, menu, cart.
- Search có thể mở full-screen.
- Category menu dùng accordion.
- Touch target tối thiểu khoảng 44px.

### Search

- Tìm theo tên, thương hiệu, danh mục.
- Gợi ý khi nhập.
- Recent/popular searches.
- Empty state.
- Keyboard navigation desktop.
- Không hiển thị kết quả giả.

## 11. Trang chủ dài, giàu trải nghiệm

Trang chủ V1 nên có 10–14 section chất lượng.

### 11.1 Hero

Chọn một concept:

- Curated technology: một sản phẩm chủ lực trong bố cục cao cấp.
- Choose by need: hỏi người dùng đang cần thiết bị cho học tập, văn phòng, sáng tạo, gaming, di chuyển.
- Featured story: hero như bìa tạp chí công nghệ.

Yêu cầu:

- Heading mạnh, tối đa 2–3 dòng.
- CTA chính và phụ.
- Ảnh desktop/mobile riêng.
- Không dùng auto-carousel nhiều slide trong V1.
- Không làm LCP xấu.

### 11.2 Quick category explorer

- Laptop, điện thoại, PC, màn hình, phụ kiện, gaming gear.
- Dùng mosaic grid hoặc layout không đồng đều có chủ đích.
- Mobile dùng grid 2 cột hoặc horizontal snap.

### 11.3 Smart need selector

> Chọn nhu cầu, chúng tôi gợi ý thiết bị phù hợp.

Nhóm gợi ý:

- Sinh viên.
- Lập trình viên.
- Designer.
- Content creator.
- Nhân viên văn phòng.
- Gamer.
- Người thường xuyên di chuyển.

V1 có thể dùng rule-based recommendation.

### 11.4 Featured product collections

Ví dụ:

- Laptop đáng mua cho sinh viên.
- Điện thoại chụp ảnh tốt.
- Thiết bị làm việc tại nhà.
- Gaming setup theo ngân sách.
- Sản phẩm cân bằng hiệu năng và giá.

### 11.5 Editorial split section

Ảnh setup lớn + câu chuyện ngắn + CTA. Giúp homepage không biến thành catalog đơn điệu.

### 11.6 Interactive product spotlight

Hotspot giải thích màn hình, bàn phím, camera, cổng kết nối, tản nhiệt. Mobile chuyển thành accordion/list.

### 11.7 Flash sale hoặc limited offers

- Countdown chỉ khi có dữ liệu thật.
- Không tạo khan hiếm giả.
- Giá và điều kiện rõ.

### 11.8 Compare by lifestyle

So sánh bằng ngôn ngữ đời thường:

- Nhẹ nhất để mang đi.
- Mạnh nhất để sáng tạo.
- Cân bằng nhất về giá.

### 11.9 Brand universe

Không chỉ logo grid; có brand story card, category nổi bật và link tới brand page.

### 11.10 Customer trust

- Chính hãng.
- Đổi trả.
- Bảo hành.
- Tư vấn.
- Giao hàng.
- Thanh toán.

### 11.11 Review/social proof

Chỉ dùng review thật. Nếu chưa có, dùng chính sách và cam kết thật.

### 11.12 Tech guide/content hub

- Cách chọn laptop cho sinh viên.
- RAM bao nhiêu là đủ.
- Chọn màn hình.
- Build PC.
- So sánh sản phẩm.

### 11.13 Recently viewed

Chỉ hiển thị khi có lịch sử. Có thể dùng local storage cho guest.

### 11.14 Newsletter/price alert

> Nhận thông báo khi sản phẩm bạn quan tâm giảm giá.

Có validation và privacy note.

### 11.15 Footer

Danh mục, hỗ trợ, chính sách, về cửa hàng, liên hệ, social, newsletter. Mobile dùng accordion.

## 12. Product card

Bắt buộc:

- Ảnh.
- Brand.
- Tên.
- Giá.
- Giá cũ.
- Giảm giá.
- Tình trạng hàng.
- Variant preview.
- Tối đa 2–3 điểm nổi bật.
- Rating khi có dữ liệu thật.

Desktop có hover/focus nhẹ. Mobile không phụ thuộc hover. Tối đa 1–2 badge chính.

## 13. Product listing page

- Breadcrumb.
- Tên danh mục và mô tả.
- Số lượng sản phẩm.
- Filter count, clear all, active chips.
- Filter phản ánh trên URL.
- Mobile filter drawer.
- Sort rõ.
- Skeleton giữ layout.
- Empty state có đề xuất.
- Pagination/load more.
- Giữ state khi quay lại từ PDP.

## 14. Product detail page

Above the fold:

- Breadcrumb.
- Gallery.
- Tên, rating, giá, khuyến mãi.
- Variant selector.
- Tồn kho.
- CTA.
- Giao hàng/bảo hành.

Gallery:

- Thumbnail, zoom, keyboard, swipe mobile, không CLS.

Variant:

- Selected/disabled rõ.
- Giá và tồn kho cập nhật đúng.
- URL phản ánh variant nếu phù hợp.
- Không add-to-cart khi hết hàng.

Purchase panel:

- Desktop có thể sticky.
- Mobile có sticky add-to-cart bar.

Nội dung:

- Điểm nổi bật.
- Phù hợp với ai.
- Hình ảnh thực tế.
- Thông số.
- Mô tả.
- So sánh.
- Review.
- FAQ.
- Sản phẩm liên quan.

## 15. Cart và checkout

Mini cart:

- Sản phẩm, variant, số lượng, giá, tạm tính, CTA.

Cart page:

- Sửa số lượng.
- Xóa.
- Coupon.
- Tạm tính.
- Phí giao hàng dự kiến.
- Tổng tiền.
- Cảnh báo tồn kho.

Checkout:

- Ít bước.
- Guest checkout.
- Không ép đăng ký.
- Validation inline.
- Giữ dữ liệu khi lỗi.
- Tổng đơn sticky desktop.
- Mobile summary dễ mở.

Order success:

- Mã đơn.
- Tóm tắt.
- Bước tiếp theo.
- Theo dõi đơn.
- Hỗ trợ.

## 16. Microinteractions

Nên có:

- Button hover/pressed/loading.
- Input focus.
- Search suggestion.
- Wishlist/compare toggle.
- Add-to-cart success.
- Quantity stepper.
- Accordion/tabs.
- Filter chip removal.
- Toast.
- Copy order code.
- Image gallery navigation.
- Skeleton shimmer nhẹ.

Không dùng âm thanh, confetti, animation kéo dài, toast che CTA.

## 17. Loading, empty, error, success

- Skeleton giống layout thật.
- Không dùng spinner toàn màn hình cho mọi trang.
- Empty state có giải thích và CTA.
- Error có retry, không hiện raw error.
- Success rõ nhưng không phô trương.

## 18. Responsive

- Mobile-first.
- Không coi mobile là desktop thu nhỏ.
- Mỗi component mô tả mobile/tablet/desktop/wide desktop.
- Touch target tối thiểu khoảng 44px.
- Không phụ thuộc hover.
- Sticky element không che nội dung.

## 19. Accessibility

Mục tiêu WCAG 2.1 AA ở luồng chính:

- Semantic HTML.
- Keyboard navigation.
- Focus visible.
- Skip link.
- Input có label.
- Icon button có accessible name.
- Alt text.
- Dialog focus trap.
- Contrast đủ.
- Error gắn với field.
- Không chỉ dùng màu để truyền tải trạng thái.
- Reduced motion.

## 20. Performance

- Ưu tiên Server Components.
- Client Component chỉ khi cần interaction.
- Lazy-load section dưới fold.
- Dynamic import component nặng.
- Không hydrate toàn bộ homepage.
- Không autoplay video lớn.
- Không tải toàn bộ ảnh carousel ngay.
- Hạn chế third-party script.
- Ưu tiên CSS transition.
- Tối ưu LCP và CLS.

## 21. Design system components

```text
Button
IconButton
LinkButton
Input
Textarea
Select
Combobox
Checkbox
Radio
Switch
Tabs
Accordion
Badge
Price
Rating
Tooltip
Popover
DropdownMenu
Modal
Drawer
Toast
Breadcrumb
Pagination
Skeleton
EmptyState
ErrorState
ProductCard
ProductCarousel
CategoryCard
EditorialCard
PromotionCard
SearchOverlay
FilterDrawer
VariantSelector
QuantityStepper
ImageGallery
StickyPurchaseBar
TrustBadge
SectionHeader
NewsletterForm
```

Mỗi component cần variants, sizes, states, responsive, accessibility và usage rules.

## 22. Design tokens

Chuẩn hóa color, typography, spacing, radius, shadow, border, z-index, animation duration/easing, container width và breakpoint.

## 23. Nhịp homepage gợi ý

1. Utility bar.
2. Header.
3. Hero.
4. Category explorer.
5. Smart need selector.
6. Featured products.
7. Editorial story.
8. Flash offers.
9. Interactive spotlight.
10. Lifestyle comparison.
11. Brand universe.
12. Trusted service.
13. Tech guides.
14. Recently viewed.
15. Newsletter/price alert.
16. Footer.

Không đặt ba product carousel liên tiếp. Cứ 2–3 section catalog cần một section editorial/guidance.

## 24. Wow moment

Chỉ chọn 2–4:

- Hero product composition.
- Smart need selector.
- Interactive product anatomy.
- Scroll storytelling nhẹ.
- Dynamic comparison.
- Personalized homepage block.

## 25. Mẫu giao diện phải tránh

- Gradient tím-xanh mặc định.
- Card trắng bo 24px ở mọi nơi.
- Icon trong vòng tròn ở mọi section.
- Heading căn giữa lặp lại.
- Mỗi section đều carousel.
- Bento grid không có lý do.
- Glassmorphism khó đọc.
- Background blob ngẫu nhiên.
- Fake review, fake scarcity, countdown giả, số liệu giả.
- Sao chép nguyên đối thủ.

## 26. Kiểm tra dữ liệu khó

- Tên sản phẩm dài.
- Giá lớn.
- Không giảm giá.
- Hết hàng.
- Nhiều variant.
- Chỉ một ảnh.
- Ảnh khác tỉ lệ.
- Không rating.
- Mô tả dài.
- Thông số nhiều.
- Category trống.
- Search không kết quả.
- Mạng chậm.
- API lỗi.

## 27. SEO

- Heading hierarchy.
- Metadata riêng.
- Product schema.
- Breadcrumb schema.
- Canonical.
- Sitemap.
- Alt text.
- Internal linking.
- Category content có giá trị.
- Filter URL có chiến lược index.

## 28. Analytics events

- Hero CTA click.
- Category click.
- Search performed/no result.
- Filter applied.
- Sort changed.
- Product viewed.
- Variant selected.
- Add/remove cart.
- Begin checkout.
- Checkout error.
- Order completed.
- Wishlist.
- Compare.
- Guide opened.

Không thu thập dữ liệu nhạy cảm không cần thiết.

## 29. Quy trình bắt buộc cho Claude Code

### Trước khi sửa code

1. Đọc `CLAUDE.md`.
2. Đọc `DESIGN.md`.
3. Đọc tài liệu sản phẩm.
4. Khảo sát component, route, data source.
5. Kiểm tra responsive hiện tại.
6. Xác định component tái sử dụng.
7. Viết kế hoạch.
8. Liệt kê file sẽ sửa.
9. Nêu dependency và rủi ro hiệu năng.
10. Nêu acceptance criteria.

### Khi triển khai

- Làm từng page/section.
- Không redesign toàn storefront trong một PR.
- Dùng dữ liệu thật hoặc seed có cấu trúc.
- Không hard-code content rải rác.
- Tái sử dụng design system.
- Không tạo component trùng.
- Không phá backend/business logic.

### Sau khi triển khai

- Lint.
- Type-check.
- Test.
- Build.
- Kiểm tra desktop/tablet/mobile.
- Keyboard.
- Reduced motion.
- Loading/empty/error.
- Dữ liệu dài.
- Console/network.
- Layout shift.
- Git diff.

## 30. Phases triển khai

### D1 — Design foundation

Design audit, tokens, typography, container, button/input, section header, product card, motion tokens, loading/empty/error.

### D2 — Header, search, navigation

Header desktop/mobile, mega menu, search overlay, category nav, sticky behavior.

### D3 — Homepage transformation

Hero, category explorer, need selector, featured products, editorial sections, trust, content hub, footer.

### D4 — Catalog experience

Category page, grid, filter, sort, pagination, search results.

### D5 — Product detail

Gallery, purchase panel, variant, rich content, specs, reviews, related, sticky mobile CTA.

### D6 — Cart và checkout

Mini cart, cart, checkout, order success, error recovery.

### D7 — Quality pass

Responsive, accessibility, performance, SEO, cross-browser, analytics, consistency.

## 31. Acceptance criteria

### Visual

- Không còn cảm giác template.
- Typography/spacing nhất quán.
- Homepage có nhịp điệu.
- Có ít nhất 2 wow moment tinh tế.
- Hình ảnh sản phẩm nổi bật.

### UX

- Search/filter/variant/CTA rõ.
- Checkout ít ma sát.
- Loading/empty/error đầy đủ.
- Mobile có thiết kế riêng.

### Technical

- Không hard-code dữ liệu giả production.
- TypeScript không lỗi.
- Lint/test/build pass.
- LCP/CLS hợp lý.
- Reduced motion hoạt động.

### Accessibility

- Keyboard dùng được.
- Focus rõ.
- Contrast đủ.
- Input có label.
- Dialog đúng.
- Touch target đủ lớn.

### Maintainability

- Dùng token.
- Component tái sử dụng.
- Không copy-paste style lớn.
- Không thêm dependency không cần thiết.

## 32. Prompt khởi động cho Claude Code

```text
Hãy đọc kỹ:

1. CLAUDE.md
2. DESIGN.md hoặc docs/DESIGN.md
3. README.md
4. Tài liệu sản phẩm trong /docs
5. Toàn bộ source code storefront hiện tại
6. Design token và component hiện có
7. Data source và Supabase schema liên quan

Mục tiêu là nâng cấp giao diện khách hàng thành một trải nghiệm thương mại điện tử công nghệ cao cấp, có chiều sâu và đủ ấn tượng, nhưng không hy sinh hiệu năng, accessibility hoặc khả năng sử dụng.

Chưa sửa code.

Trước tiên hãy thực hiện UX/UI audit và trả về:

- Route storefront hiện tại.
- Component hiện tại.
- Vấn đề visual hierarchy, spacing, typography và mobile.
- Vấn đề search/navigation và product discovery.
- Vấn đề product card, product detail, cart/checkout.
- Loading/empty/error còn thiếu.
- Animation hiện tại và rủi ro.
- Vấn đề accessibility và hiệu năng.
- Phần nên giữ và phần cần thiết kế lại.
- Wow moment phù hợp.
- Roadmap D1–D7.
- File dự kiến tạo/sửa cho D1.
- Dependency cần thêm và lý do.
- Acceptance criteria và test plan.

Không thay đổi code, không cài dependency, không commit và không push.
```

## 33. Prompt triển khai homepage

```text
Hãy triển khai Phase D3: Homepage Transformation theo DESIGN.md.

Trước khi sửa code:

1. Đọc lại DESIGN.md.
2. Khảo sát homepage và component hiện tại.
3. Liệt kê dữ liệu thật hiện có.
4. Liệt kê section sẽ giữ, sửa, xóa và tạo mới.
5. Đề xuất thứ tự section.
6. Chọn tối đa 3 wow moment.
7. Nêu chiến lược mobile.
8. Nêu chiến lược animation/reduced motion.
9. Nêu chiến lược tối ưu LCP.
10. Liệt kê file dự kiến sửa và dependency.
11. Chưa sửa code cho đến khi kế hoạch rõ.

Homepage mục tiêu có khoảng 10–14 section chất lượng, tùy dữ liệu thực tế.

Yêu cầu:

- Không tạo ba product carousel liên tiếp.
- Không lạm dụng gradient, glassmorphism hoặc shadow.
- Không dùng số liệu, review, countdown hoặc khan hiếm giả.
- Animation tinh tế, hỗ trợ reduced motion.
- Mobile có thiết kế riêng.
- Không hard-code sản phẩm giả production.
- Không làm hỏng backend.
- Ưu tiên Server Components.
- Client Component chỉ khi cần interaction.
- Hero không làm LCP xấu nghiêm trọng.
- Mọi section có loading/empty/fallback phù hợp.

Sau khi triển khai:

- Chạy lint, type-check, test và production build.
- Kiểm tra desktop, tablet, mobile.
- Kiểm tra reduced motion, keyboard, layout shift, ảnh và network.
- Xem toàn bộ git diff.
- Báo phần hoàn thành, chưa hoàn thành và rủi ro.
- Chưa commit hoặc push cho đến khi tôi yêu cầu.
```

## 34. Quy tắc cuối

Không đánh dấu hoàn thành nếu:

- Chỉ đẹp với dữ liệu mẫu lý tưởng.
- Chưa hoạt động mobile.
- Chưa có keyboard focus.
- Chưa xử lý loading/empty/error.
- Dùng dữ liệu giả production.
- Làm website chậm rõ rệt.
- Không hỗ trợ reduced motion.
- Chỉ cập nhật state client nhưng chưa tích hợp backend khi cần.
- Chưa có test hoặc chưa chạy build.

> Tech Store được đánh giá bằng trải nghiệm trọn vẹn: nhìn đẹp, hiểu nhanh, thao tác dễ, phản hồi tốt, tải nhanh và đáng tin cậy.
