import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | TechStore',
  description:
    'Điều khoản sử dụng website TechStore: đặt hàng, thanh toán COD/chuyển khoản/VNPay, giao hàng, trách nhiệm khách hàng và shop khi mua điện thoại, laptop, phụ kiện chính hãng.',
}

export default function TermsPage() {
  return (
    <div className="container-store py-10 sm:py-14">
      <article className="max-w-3xl">
        <header>
          <p className="eyebrow">Pháp lý</p>
          <h1 className="mt-2 text-(length:--text-3xl) font-semibold tracking-tight">
            Điều khoản sử dụng
          </h1>
          <p className="mt-2 text-(length:--text-sm) text-fg-muted">
            Dùng website TechStore là bạn đồng ý với các điều khoản dưới đây. Chúng tôi cố gắng viết
            ngắn gọn, dễ hiểu nhất có thể. Cập nhật lần cuối: tháng 8/2026.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 text-(length:--text-sm) leading-relaxed text-fg-muted">
          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">1. TechStore là ai</h2>
            <p className="mt-2">
              TechStore là cửa hàng bán lẻ điện thoại, laptop và phụ kiện công nghệ chính hãng tại
              Việt Nam. Website là nơi bạn xem sản phẩm, đặt hàng, theo dõi đơn và liên hệ hỗ trợ.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">2. Tài khoản khách hàng</h2>
            <p className="mt-2">
              Bạn có thể mua không cần tài khoản (guest checkout) hoặc đăng nhập để lưu hồ sơ, xem
              lịch sử đơn. Bạn chịu trách nhiệm giữ bí mật mật khẩu và các hoạt động trên tài khoản
              của mình.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">3. Đặt hàng</h2>
            <p className="mt-2">
              Đơn hàng được xem là hợp lệ khi bạn hoàn tất thông tin giao hàng và được hệ thống xác
              nhận. Trường hợp sản phẩm hết hàng hoặc thông tin không đúng, shop sẽ liên hệ qua SĐT
              hoặc email để xác nhận lại trước khi xử lý.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">4. Giá và thanh toán</h2>
            <p className="mt-2">
              Giá hiển thị bằng VND, đã gồm thuế, có thể thay đổi theo thị trường mà không cần báo
              trước với đơn chưa đặt. Shop hỗ trợ:
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>COD — thanh toán khi nhận hàng.</li>
              <li>Chuyển khoản ngân hàng qua VietQR.</li>
              <li>VNPay — thẻ/tài khoản ngân hàng qua cổng VNPay.</li>
            </ul>
            <p className="mt-2">
              Với VNPay, toàn bộ thông tin thanh toán được xử lý tại cổng của họ — TechStore không
              lưu dữ liệu thẻ của bạn.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">5. Giao hàng và nhận hàng</h2>
            <p className="mt-2">
              Shop giao bằng hình thức vận chuyển thường, hoặc bạn có thể tự đến cửa hàng nhận
              (pickup). Thời gian giao dự kiến hiển thị khi đặt hàng và có thể xem tại trang{' '}
              <Link href="/track-order" className="font-medium text-brand hover:underline">
                theo dõi đơn hàng
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">6. Đổi trả hàng</h2>
            <p className="mt-2">
              Hàng lỗi được đổi miễn phí trong 7 ngày. Yêu cầu trả hàng được tạo trực tiếp từ trang
              đơn hàng. Chi tiết xem{' '}
              <Link href="/return-policy" className="font-medium text-brand hover:underline">
                Chính sách đổi trả
              </Link>
              .
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">7. Bảo hành</h2>
            <p className="mt-2">
              Sản phẩm chính hãng bảo hành theo chính sách nhà sản xuất, tối thiểu 12 tháng từ ngày
              mua. Cần hóa đơn/đơn hàng trên hệ thống để hưởng bảo hành.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">8. Bên bạn cần làm</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>Cung cấp thông tin giao hàng chính xác.</li>
              <li>Kiểm tra hàng khi nhận trong trường hợp COD.</li>
              <li>Không dùng website cho mục đích trái pháp luật Việt Nam.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">9. Trách nhiệm của shop</h2>
            <p className="mt-2">
              Shop cam kết bán hàng chính hãng, mô tả sản phẩm đúng thực tế, hỗ trợ khiếu nại trong
              giờ hành chính, và xử lý yêu cầu đổi trả theo chính sách đã công bố.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">10. Hủy đơn</h2>
            <p className="mt-2">
              Bạn có thể hủy đơn miễn phí trước khi shop giao cho đơn vị vận chuyển. Sau khi giao
              hàng, vui lòng dùng luồng yêu cầu trả hàng từ trang đơn hàng.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">11. Chấm dứt</h2>
            <p className="mt-2">
              Shop có thể từ chối phục vụ trường hợp lạm dụng chính sách, gian lận thanh toán hoặc
              cố tình gây rối. Quyền mua hàng của bạn có thể bị giới hạn nếu vi phạm nhiều lần.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">12. Điều khoản khác</h2>
            <p className="mt-2">
              Cách shop xử lý dữ liệu cá nhân của bạn xem tại{' '}
              <Link href="/privacy" className="font-medium text-brand hover:underline">
                Chính sách bảo mật
              </Link>
              . Mọi tranh chấp ưu tiên thương lượng trước, nếu không thỏa thuận được sẽ giải quyết
              theo pháp luật Việt Nam.
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
