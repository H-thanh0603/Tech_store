import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật | TechStore',
  description:
    'Chính sách bảo mật TechStore: dữ liệu cá nhân thu thập (tên, SĐT, email, địa chỉ), lưu trữ Supabase, quyền xuất và xóa dữ liệu, cookie và thanh toán VNPay.',
}

export default function PrivacyPage() {
  return (
    <div className="container-store py-10 sm:py-14">
      <article className="max-w-3xl">
        <header>
          <p className="eyebrow">Pháp lý</p>
          <h1 className="mt-2 text-(length:--text-3xl) font-semibold tracking-tight">
            Chính sách bảo mật
          </h1>
          <p className="mt-2 text-(length:--text-sm) text-fg-muted">
            TechStore thu thập ít dữ liệu nhất có thể và chỉ dùng để xử lý đơn hàng. Đây là bản giải
            thích ngắn gọn. Cập nhật lần cuối: tháng 8/2026.
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 text-(length:--text-sm) leading-relaxed text-fg-muted">
          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">1. Dữ liệu shop thu thập</h2>
            <p className="mt-2">Để giao hàng và liên hệ, shop lưu:</p>
            <ul className="mt-2 list-disc pl-5">
              <li>Họ tên người nhận.</li>
              <li>Số điện thoại.</li>
              <li>Email (nếu bạn cung cấp).</li>
              <li>Địa chỉ giao hàng.</li>
            </ul>
            <p className="mt-2">
              Với tài khoản khách hàng, shop thêm lịch sử đơn và thông tin đăng nhập. Shop không
              thu thập dữ liệu nhạy cảm ngoài mức cần thiết để bán hàng.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">2. Dữ liệu lưu ở đâu</h2>
            <p className="mt-2">
              Dữ liệu lưu trên nền tảng Supabase (Postgres), máy chủ đặt tại EU hoặc Singapore tùy
              cấu hình hệ thống. Chỉ nhân sự cần thiết mới truy cập được.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">3. Mục đích sử dụng</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>Xử lý, giao và hỗ trợ đơn hàng.</li>
              <li>Liên hệ khi có vấn đề với đơn (hết hàng, đổi trả, khiếu nại).</li>
              <li>Gửi thông tin đơn hàng và trạng thái giao dịch.</li>
            </ul>
            <p className="mt-2">
              Shop không bán dữ liệu của bạn cho bên thứ ba. Đơn vị vận chuyển chỉ nhận thông tin
              tối thiểu để giao hàng.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">4. Thanh toán qua VNPay</h2>
            <p className="mt-2">
              Khi thanh toán qua VNPay, thông tin thẻ/tài khoản được nhập và xử lý hoàn toàn tại cổng
              của VNPay. TechStore chỉ nhận kết quả giao dịch (thành công/thất bại) — không lưu số
              thẻ, hạn thẻ hay CVV.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">5. Trợ lý AI</h2>
            <p className="mt-2">
              Khung chat trợ lý trên website dùng mô hình AI của bên thứ ba (nhà cung cấp do shop
              cấu hình) để hiểu câu hỏi và tra cứu catalog, chính sách, trạng thái đơn hàng.
            </p>
            <ul className="mt-2 list-disc pl-5">
              <li>
                Nội dung bạn nhập (kể cả mã đơn và số điện thoại khi tra cứu đơn) được gửi cho nhà
                cung cấp AI để tạo câu trả lời — không nhập mật khẩu, mã OTP hay số thẻ vào khung chat.
              </li>
              <li>Shop không dùng nội dung chat để đào tạo mô hình và không lưu lịch sử chat của khách.</li>
              <li>Đặt hàng và thanh toán luôn diễn ra trên website, trợ lý không thu tiền hộ.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">6. Cookie shop dùng</h2>
            <ul className="mt-2 list-disc pl-5">
              <li>
                <code className="rounded bg-bg-secondary px-1 py-0.5 text-fg">techstore_cart</code> —
                lưu giỏ hàng trên thiết bị của bạn.
              </li>
              <li>
                <code className="rounded bg-bg-secondary px-1 py-0.5 text-fg">techstore_order_access</code>{' '}
                — giúp bạn xem đơn hàng đã đặt không cần đăng nhập.
              </li>
              <li>Session đăng nhập — giữ trạng thái đăng nhập của tài khoản.</li>
            </ul>
            <p className="mt-2">
              Cookie không dùng để theo dõi bạn trên website khác. Xóa cookie là mất giỏ hàng và
              quyền truy cập đơn (có thể tạo lại bằng mã đơn + SĐT).
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">7. Xem và xuất dữ liệu</h2>
            <p className="mt-2">
              Bạn có thể tải toàn bộ dữ liệu cá nhân shop đang lưu qua tính năng xuất dữ liệu tại{' '}
              <code className="rounded bg-bg-secondary px-1 py-0.5 text-fg">/api/account/export</code>{' '}
              (đăng nhập trước khi export).
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">8. Yêu cầu xóa dữ liệu</h2>
            <p className="mt-2">
              Bạn có thể yêu cầu shop xóa dữ liệu cá nhân bất cứ lúc nào bằng cách liên hệ hỗ trợ.
              Shop sẽ xóa trong phạm vi pháp luật cho phép — một số dữ liệu giao dịch có thể phải
              giữ lại theo quy định kế toán/thuế.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">9. Bảo mật hệ thống</h2>
            <p className="mt-2">
              Shop truyền dữ liệu qua HTTPS, giới hạn quyền truy cập dữ liệu theo vai trò và kiểm
              tra nhật ký hệ thống định kỳ. Không hệ thống nào an toàn 100%, nhưng shop xử lý sự cố
              minh bạch và thông báo cho bạn nếu dữ liệu bị ảnh hưởng.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">10. Trẻ em</h2>
            <p className="mt-2">
              Website không dành cho người dưới 15 tuổi. Đơn hàng của người chưa thành niên cần
              người lớn thực hiện hoặc xác nhận.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">11. Quyền riêng tư EU (GDPR)</h2>
            <p className="mt-2">
              Vì máy chủ có thể đặt tại EU, shop hỗ trợ quyền GDPR cơ bản: quyền truy cập (xuất dữ
              liệu), quyền xóa, quyền sửa dữ liệu. Gửi yêu cầu qua email hỗ trợ, shop phản hồi trong
              30 ngày.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">12. Thay đổi chính sách</h2>
            <p className="mt-2">
              Nếu shop thay đổi cách xử lý dữ liệu, chính sách này sẽ được cập nhật trên trang này.
              Thay đổi lớn shop sẽ thông báo qua email nếu bạn có tài khoản.
            </p>
          </section>

          <section>
            <h2 className="text-(length:--text-lg) font-semibold text-fg">13. Liên hệ</h2>
            <p className="mt-2">
              Câu hỏi về dữ liệu cá nhân? Liên hệ bộ phận hỗ trợ của shop hoặc xem{' '}
              <Link href="/terms" className="font-medium text-brand hover:underline">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link href="/return-policy" className="font-medium text-brand hover:underline">
                Chính sách đổi trả
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </div>
  )
}
