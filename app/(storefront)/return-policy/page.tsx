import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Chính sách đổi trả | TechStore',
  description:
    'Chính sách đổi trả TechStore: hàng lỗi đổi miễn phí trong 7 ngày, yêu cầu trả hàng từ trang đơn hàng, shop liên hệ trong 24 giờ, hoàn tiền theo phương thức thanh toán gốc.',
}

export default function ReturnPolicyPage() {
  return (
    <div className="container-store py-10 sm:py-14">
      <article className="max-w-3xl">
        <header>
          <p className="eyebrow">Pháp lý</p>
          <h1 className="mt-2 text-(length:--text-3xl) font-semibold tracking-tight">
            Chính sách đổi trả
          </h1>
          <p className="mt-2 text-(length:--text-sm) text-fg-muted">
            Đổi trả tại TechStore làm ngay trên website — không cần gọi điện, không cần ra cửa hàng.
            Cập nhật lần cuối: tháng 8/2026.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 text-(length:--text-sm) leading-relaxed text-fg-muted">
          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">1. Tóm tắt nhanh</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>Hàng lỗi/hỏng: đổi miễn phí trong 7 ngày.</li>
              <li>Nhận sai sản phẩm, không đúng mô tả: shop chịu toàn bộ chi phí.</li>
              <li>Đổi ý: được trả, có thể mất phí.</li>
              <li>Yêu cầu trả hàng tạo trực tiếp từ trang đơn hàng.</li>
              <li>Shop phản hồi trong 24 giờ.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">2. Cách gửi yêu cầu</h2>
            <p className="mt-2">
              Mở trang đơn hàng, chọn sản phẩm cần trả và gửi yêu cầu kèm lý do. Lý do chọn được:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>Lỗi/hỏng.</li>
              <li>Nhận sai sản phẩm.</li>
              <li>Không đúng mô tả.</li>
              <li>Đổi ý.</li>
              <li>Lý do khác.</li>
            </ul>
            <p className="mt-2">
              Không có tài khoản? Vào{' '}
              <Link href="/track-order" className="font-medium text-brand hover:underline">
                theo dõi đơn hàng
              </Link>{' '}
              bằng mã đơn + SĐT.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">3. Xử lý trong 24 giờ</h2>
            <p className="mt-2">
              Sau khi bạn gửi yêu cầu, shop liên hệ trong 24 giờ (trừ ngày lễ) để xác nhận tình
              trạng hàng và hướng dẫn tiếp. Không phản hồi từ shop trong 24 giờ? Yêu cầu được xem
              như tạm duyệt, chờ xác nhận cuối.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">4. Hàng lỗi/hỏng — đổi miễn phí 7 ngày</h2>
            <p className="mt-2">
              Sản phẩm bị lỗi từ nhà sản xuất hoặc hỏng trong 7 ngày đầu (tính từ ngày nhận) được
              đổi mới miễn phí. Shop chịu phí vận chuyển hai chiều. Hết 7 ngày sẽ chuyển sang chế độ
              bảo hành chính hãng.
            </p>
            <p className="mt-2 text-fg-subtle">
              Ghi chú: mức 7 ngày theo thông lệ bán lẻ tại Việt Nam, shop có thể điều chỉnh theo
              từng dòng sản phẩm — mức hiển thị tại trang yêu cầu trả hàng luôn là chuẩn.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">5. Nhận sai hoặc không đúng mô tả</h2>
            <p className="mt-2">
              Shop giao sai model, sai phụ kiện, hoặc sản phẩm khác mô tả trên website: đổi đúng hàng
              hoặc trả hoàn toàn tiền, shop chịu mọi chi phí. Bạn không mất một đồng nào.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">6. Đổi ý — được trả, có thể mất phí</h2>
            <p className="mt-2">
              Không thích màu, muốn lên đời, mua nhầm — vẫn trả được. Yêu cầu gửi trong 7 ngày, hàng
              nguyên vẹn, đủ hộp phụ kiện. Trường hợp này có thể mất phí (vận chuyển, kiểm định lại
              hàng), mức phí shop báo trước khi bạn xác nhận — không có phí ẩn.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">7. Điều kiện hàng trả</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>Đủ hộp, cáp, sạc, phụ kiện đi kèm.</li>
              <li>Không trầy xước, còn nguyên tem, dán và phụ kiện.</li>
              <li>Hóa đơn/đơn hàng trên hệ thống còn hiệu lực.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">8. Hoàn tiền</h2>
            <p className="mt-2">
              Yêu cầu được duyệt, shop hoàn tiền theo đúng phương thức thanh toán gốc:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>COD — chuyển khoản lại cho bạn qua số tài khoản cung cấp.</li>
              <li>Chuyển khoản/VietQR — hoàn về tài khoản đã thanh toán.</li>
              <li>VNPay — hoàn qua cổng VNPay, thời gian phụ thuộc ngân hàng.</li>
            </ul>
            <p className="mt-2">
              Thời gian hoàn tiền thường 1–5 ngày làm việc kể từ khi duyệt.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">9. Hoàn tồn kho</h2>
            <p className="mt-2">
              Hàng trả về được kiểm tra, cập nhật trạng thái và nhập lại tồn kho. Sản phẩm lỗi gửi
              trả nhà phân phối/nhà sản xuất, không bán lại cho khách khác.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">10. Hàng không nhận được trả</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>Đã kích hoạt bảo hành chính hãng hoặc mã region lock.</li>
              <li>Hỏng do sử dụng sai, vào nước, rơi vỡ do khách.</li>
              <li>Phụ kiện tiêu hao (ốp lưng, dán màn hình) đã qua sử dụng.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">11. Nhận tại cửa hàng</h2>
            <p className="mt-2">
              Đơn pickup tại shop đổi/trả trực tiếp quầy — nhân viên kiểm tra và xử lý ngay trong
              giờ, không cần chờ luồng online.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">12. Khiếu nại</h2>
            <p className="mt-2">
              Không hài lòng với kết quả đổi trả? Liên hệ shop lần nữa kèm mã đơn, shop nâng cấp cho
              quản lý xử lý. Quy định chung khi mua hàng xem{' '}
              <Link href="/terms" className="font-medium text-brand hover:underline">
                Điều khoản sử dụng
              </Link>
              , cách shop dùng dữ liệu của bạn xem{' '}
              <Link href="/privacy" className="font-medium text-brand hover:underline">
                Chính sách bảo mật
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
