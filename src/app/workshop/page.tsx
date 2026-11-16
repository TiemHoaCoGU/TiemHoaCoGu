import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, HeartHandshake, ShieldCheck, Clock3, ArrowDown } from 'lucide-react';
import { PageIntro } from '@/components/site';
import WorkshopCatalog from '@/components/workshop/workshop-catalog';
import { getStorefront } from '@/lib/storefront';
import type { Course } from '@/components/workshop/workshop-booking-drawer';
import { isOpenFutureSession } from '@/lib/transaction';

export const metadata: Metadata = {
  title: 'Workshop Hoa Sáp — Trải Nghiệm Làm Hoa Thủ Công | Tiệm Hoa Có Gu',
  description:
    'Tham gia các buổi workshop cắm hoa sáp thủ công tại Tiệm Hoa Có Gu. Tự tay chọn màu, uốn cánh và mang về trọn vẹn tác phẩm hoa nghệ thuật của riêng bạn.',
};

// Next.js tải danh sách lớp và ca trên server trước khi gửi trang cho trình duyệt.
export default async function WorkshopPage() {
  const storefront = await getStorefront();
  const connected = storefront.mode === 'connected' && storefront.workshops !== undefined;
  // m1: the per-course detail fetch was unused (Course.detail is never read).
  const courses: Course[] = connected && storefront.workshops ? storefront.workshops : [];

  const totalOpenSessions = courses.reduce(
    (count, course) =>
      count + course.sessions.filter((session) => isOpenFutureSession(session)).length,
    0,
  );

  return (
    <div className="workshop-page">
      {/* Intro Header */}
      <PageIntro
        eyebrow="WORKSHOP / SÁPA STUDIO"
        title={
          <>
            Chạm sáp, nở một
            <br className="workshop-title-break" /> bó hoa của riêng bạn.
          </>
        }
        description="Một khoảng chậm giữa phố xá để tự tay uốn cánh, thắt nơ và gói ghém một món quà ý nghĩa. Không cần khéo tay, chỉ cần bạn yêu hoa."
      />

      {/* Hero Visual Section */}
      <section className="workshop-hero" aria-label="Không gian làm hoa tại xưởng">
        <div className="workshop-hero-image">
          <Image
            src="/images/ws-hero.webp"
            alt="Đôi tay đang làm hoa trong một buổi workshop tại xưởng"
            fill
            priority
            sizes="(max-width: 760px) 100vw, 56vw"
          />
          <span className="workshop-image-caption">SÁPA STUDIO · LÀM HOA BẰNG TAY</span>
        </div>
        <div className="workshop-hero-copy">
          <p className="workshop-kicker">
            <span /> TRẢI NGHIỆM THẬT · KHÔNG VỘI VÃ
          </p>
          <h2>
            Không cần khéo tay.
            <br />
            Chỉ cần có mặt.
          </h2>
          <p>
            Tại xưởng, tụi mình chuẩn bị sẵn toàn bộ hoa sáp cao cấp, giấy bọc, phụ liệu và nước
            uống. Người hướng dẫn sẽ đồng hành cùng bạn từng thao tác nhỏ nhất cho tới khi bạn tự
            hào cầm trên tay tác phẩm hoàn chỉnh mang về.
          </p>
          <div className="workshop-hero-facts">
            <span>
              <Clock3 size={17} aria-hidden="true" /> Ca học 90 – 120 phút
            </span>
            <span>
              <Sparkles size={17} aria-hidden="true" /> {totalOpenSessions} ca đang mở chỗ
            </span>
          </div>
          <a className="button" href="#danh-sach-workshop">
            Chọn lớp & ca học <ArrowDown size={18} aria-hidden="true" />
          </a>
        </div>
      </section>

      {/* Workshop Experience Highlights */}
      <section
        style={{
          maxWidth: '1360px',
          margin: '0 auto 60px',
          padding: '0 20px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '24px',
            padding: '36px 32px',
            background: '#ffffff',
            borderRadius: '20px',
            border: '1px solid #e8ebe4',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#edf1fc',
                color: '#243db5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Sparkles size={22} />
            </div>
            <div>
              <h4
                style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1c2326' }}
              >
                Vật liệu trọn gói cao cấp
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Toàn bộ hoa sáp hương dịu, giấy bọc phong cách Hàn Quốc, kéo, ruy băng và túi đựng
                mang về.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <HeartHandshake size={22} />
            </div>
            <div>
              <h4
                style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1c2326' }}
              >
                Hướng dẫn tận tình 1:1
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Xưởng giới hạn sĩ số từ 8 – 12 người mỗi ca để đảm bảo bạn luôn được hỗ trợ chu đáo
                nhất.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h4
                style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 700, color: '#1c2326' }}
              >
                Quản lý vé & hủy giữ chỗ linh hoạt
              </h4>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.6, color: '#64748b' }}>
                Vé lưu trực tiếp trong tài khoản cá nhân. Hủy giữ chỗ được chấp nhận trước giờ học
                bắt đầu. Vé đã thanh toán sẽ được tạo yêu cầu hoàn tiền để tiệm xử lý.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Workshop Catalog & In-Place Booking Drawer */}
      {storefront.mode === 'unavailable' ? (
        <section
          style={{ maxWidth: '1360px', margin: '0 auto 60px', padding: '0 20px' }}
          aria-label="Không tải được danh sách workshop"
        >
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e8ebe4',
              borderRadius: '20px',
              padding: '48px 24px',
              textAlign: 'center',
            }}
          >
            <h3 style={{ fontSize: '18px', color: '#1c2326', marginBottom: '8px' }}>
              Không tải được danh sách workshop
            </h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
              {storefront.error || 'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.'}
            </p>
            <Link className="button" href="/workshop">
              Thử tải lại danh sách
            </Link>
          </div>
        </section>
      ) : (
        <WorkshopCatalog courses={courses} />
      )}
    </div>
  );
}
