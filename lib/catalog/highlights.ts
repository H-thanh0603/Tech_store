/**
 * Benefit-oriented highlights for product cards/homepage.
 * Rule-based from category/use-case — no fake specs.
 */

const BY_CATEGORY: Record<string, string[]> = {
  laptop: ['Phù hợp học tập & làm việc', 'Pin tốt mang đi cả ngày', 'Màn hình rõ cho đa nhiệm'],
  'dien-thoai': ['Chụp ảnh & xem phim tốt', 'Mượt cho app hàng ngày', 'Gọn trong túi'],
  'phu-kien': ['Dễ kết nối', 'Nâng trải nghiệm thiết bị', 'Giá hợp lý'],
  'man-hinh': ['Làm việc lâu ít mỏi mắt', 'Hình ảnh sắc nét', 'Phù hợp văn phòng'],
  pc: ['Hiệu năng ổn định', 'Nâng cấp linh hoạt', 'Làm việc & giải trí'],
}

const BY_NEED: Record<string, { label: string; blurb: string; href: string; chips: string[] }> = {
  student: {
    label: 'Sinh viên',
    blurb: 'Nhẹ, pin tốt, đủ mạnh cho học và làm bài.',
    href: '/products?useCase=hoc-tap',
    chips: ['Laptop học tập', 'Tai nghe', 'Bàn phím'],
  },
  developer: {
    label: 'Lập trình viên',
    blurb: 'Đa nhiệm mượt, bàn phím êm, màn hình rõ code.',
    href: '/products?useCase=lap-trinh',
    chips: ['Laptop mạnh', 'Màn hình', 'Phím cơ'],
  },
  designer: {
    label: 'Designer',
    blurb: 'Màu hiển thị tốt, GPU đủ cho thiết kế.',
    href: '/products?useCase=thiet-ke',
    chips: ['Màn hình', 'Laptop sáng tạo'],
  },
  creator: {
    label: 'Content creator',
    blurb: 'Xử lý video/ảnh, pin và cổng kết nối tiện.',
    href: '/products?useCase=sang-tao',
    chips: ['Laptop sáng tạo', 'Điện thoại'],
  },
  office: {
    label: 'Văn phòng',
    blurb: 'Êm, gọn, chạy Office & họp online ổn.',
    href: '/products?useCase=van-phong',
    chips: ['Laptop văn phòng', 'Phụ kiện'],
  },
  gamer: {
    label: 'Gamer',
    blurb: 'Hiệu năng cao, tản nhiệt và màn hình mượt.',
    href: '/products?useCase=gaming',
    chips: ['Laptop gaming', 'PC', 'Tai nghe'],
  },
  mobile: {
    label: 'Di chuyển nhiều',
    blurb: 'Nhẹ, pin lâu, sạc nhanh khi đang đi.',
    href: '/products?useCase=di-chuyen',
    chips: ['Ultrabook', 'Điện thoại'],
  },
}

export function highlightsForProduct(categorySlug: string, max = 2): string[] {
  const list = BY_CATEGORY[categorySlug] ?? [
    'Thiết bị chọn lọc',
    'Giá minh bạch',
    'Hỗ trợ mua nhanh',
  ]
  return list.slice(0, max)
}

export function needSelectorItems() {
  return Object.entries(BY_NEED).map(([id, value]) => ({ id, ...value }))
}

export const CATEGORY_EXPLORER = [
  {
    href: '/products?category=laptop',
    label: 'Laptop',
    blurb: 'Học · làm việc · sáng tạo',
    span: 'lg:col-span-2 lg:row-span-2',
  },
  {
    href: '/products?category=dien-thoai',
    label: 'Điện thoại',
    blurb: 'Flagship chọn lọc',
    span: '',
  },
  {
    href: '/products?category=phu-kien',
    label: 'Phụ kiện',
    blurb: 'Tai nghe & hơn nữa',
    span: '',
  },
  {
    href: '/products?useCase=gaming',
    label: 'Gaming gear',
    blurb: 'Chơi game mượt hơn',
    span: 'lg:col-span-2',
  },
  {
    href: '/products',
    label: 'Tất cả thiết bị',
    blurb: 'Xem catalog đầy đủ',
    span: '',
  },
] as const

export const TRUST_ITEMS = [
  {
    title: 'Chính hãng / nguồn rõ',
    body: 'Thông số và biến thể hiển thị đúng dữ liệu kho demo.',
  },
  {
    title: 'Giá minh bạch',
    body: 'Giá VND rõ ràng, không phí ẩn trong luồng checkout.',
  },
  {
    title: 'Giữ hàng thông minh',
    body: 'COD giữ stock; chuyển khoản giữ có thời hạn.',
  },
  {
    title: 'Theo dõi đơn dễ',
    body: 'Tra cứu bằng mã đơn + số điện thoại, không cần tài khoản.',
  },
  {
    title: 'Guest checkout',
    body: 'Mua nhanh, không ép đăng ký.',
  },
  {
    title: 'Hỗ trợ chọn máy',
    body: 'Gợi ý theo nhu cầu: học, code, sáng tạo, gaming.',
  },
] as const

export const GUIDE_LINKS = [
  {
    href: '/products?useCase=hoc-tap',
    title: 'Chọn laptop cho sinh viên',
    body: 'Nhẹ, pin tốt, đủ mạnh cho học online và làm bài.',
  },
  {
    href: '/products?category=laptop',
    title: 'RAM bao nhiêu là đủ?',
    body: 'Học tập, văn phòng và sáng tạo cần mức RAM khác nhau.',
  },
  {
    href: '/products?category=dien-thoai',
    title: 'Điện thoại chụp ảnh tốt',
    body: 'Ưu tiên camera và xử lý ảnh nếu bạn hay chia sẻ nội dung.',
  },
] as const
