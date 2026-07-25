/**
 * Category navigation tree for mega menu / mobile accordion.
 * Extensible: add children as catalog grows.
 */

export type CategoryNavItem = {
  slug: string
  label: string
  href: string
  description?: string
  children?: CategoryNavItem[]
  featured?: boolean
}

export const CATEGORY_NAV: CategoryNavItem[] = [
  {
    slug: 'laptop',
    label: 'Laptop',
    href: '/products?category=laptop',
    description: 'Học tập, văn phòng, sáng tạo, gaming',
    featured: true,
    children: [
      { slug: 'laptop-all', label: 'Tất cả laptop', href: '/products?category=laptop' },
      { slug: 'laptop-student', label: 'Sinh viên', href: '/products?category=laptop&useCase=hoc-tap' },
      { slug: 'laptop-office', label: 'Văn phòng', href: '/products?category=laptop&useCase=van-phong' },
      { slug: 'laptop-dev', label: 'Lập trình', href: '/products?category=laptop&useCase=lap-trinh' },
      { slug: 'laptop-create', label: 'Sáng tạo', href: '/products?category=laptop&useCase=sang-tao' },
      { slug: 'laptop-game', label: 'Gaming', href: '/products?category=laptop&useCase=gaming' },
    ],
  },
  {
    slug: 'dien-thoai',
    label: 'Điện thoại',
    href: '/products?category=dien-thoai',
    description: 'Flagship chọn lọc, chụp ảnh & hàng ngày',
    children: [
      { slug: 'phone-all', label: 'Tất cả điện thoại', href: '/products?category=dien-thoai' },
      { slug: 'phone-photo', label: 'Chụp ảnh tốt', href: '/products?category=dien-thoai&useCase=sang-tao' },
      { slug: 'phone-daily', label: 'Dùng hàng ngày', href: '/products?category=dien-thoai' },
    ],
  },
  {
    slug: 'pc',
    label: 'PC & màn hình',
    href: '/products?category=pc',
    description: 'Máy bàn, màn hình làm việc',
    children: [
      { slug: 'pc-all', label: 'PC', href: '/products?category=pc' },
      { slug: 'monitor', label: 'Màn hình', href: '/products?category=man-hinh' },
    ],
  },
  {
    slug: 'phu-kien',
    label: 'Phụ kiện',
    href: '/products?category=phu-kien',
    description: 'Tai nghe, bàn phím, sạc…',
    children: [
      { slug: 'acc-all', label: 'Tất cả phụ kiện', href: '/products?category=phu-kien' },
      { slug: 'acc-audio', label: 'Âm thanh', href: '/products?category=phu-kien' },
    ],
  },
  {
    slug: 'gaming',
    label: 'Gaming',
    href: '/products?useCase=gaming',
    description: 'Laptop & gear chơi game',
    children: [
      { slug: 'game-laptop', label: 'Laptop gaming', href: '/products?category=laptop&useCase=gaming' },
      { slug: 'game-gear', label: 'Phụ kiện gaming', href: '/products?useCase=gaming' },
    ],
  },
  {
    slug: 'deals',
    label: 'Khuyến mãi',
    href: '/products',
    description: 'Sản phẩm đang giảm giá (khi có)',
  },
  {
    slug: 'tu-van',
    label: 'Tư vấn',
    href: '/#need-selector',
    description: 'Chọn máy theo nhu cầu',
  },
]

export const QUICK_LINKS = [
  { href: '/products', label: 'Toàn bộ catalog' },
  { href: '/wishlist', label: 'Wishlist' },
  { href: '/compare', label: 'So sánh' },
  { href: '/track-order', label: 'Tra cứu đơn' },
  { href: '/account', label: 'Tài khoản' },
]
