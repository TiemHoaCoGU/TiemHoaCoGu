'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Sparkles, ArrowRight, CheckCircle, Flower2 } from 'lucide-react';
import type { Course } from './workshop-booking-drawer';
import WorkshopBookingDrawer from './workshop-booking-drawer';
import { isOpenFutureSession, remainingSeats } from '@/lib/transaction';
import { getWorkshopImage } from '@/lib/workshop';
import './workshop.css';

interface WorkshopCatalogProps {
  courses: Course[];
}

function formatShortDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' }).format(
      new Date(iso),
    );
  } catch {
    return iso.slice(0, 10);
  }
}

function sessionStartMs(s: { sessionDate: string; startTime: string }) {
  return new Date(`${s.sessionDate.slice(0, 10)}T${s.startTime}`).getTime();
}

function formatPrice(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

export default function WorkshopCatalog({ courses }: WorkshopCatalogProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeDrawerCourse, setActiveDrawerCourse] = useState<Course | null>(null);

  // Extract unique categories
  const categories = Array.from(
    new Set(courses.map((c) => c.category).filter(Boolean)),
  ) as string[];

  const filteredCourses = courses.filter((c) => {
    if (activeCategory === 'all') return true;
    if (activeCategory === 'open') {
      return c.sessions.some((s) => isOpenFutureSession(s));
    }
    return c.category === activeCategory;
  });

  return (
    <section className="ws-catalog-wrap" id="danh-sach-workshop">
      {/* Category Filter Pills */}
      <div className="ws-filter-bar">
        <button
          type="button"
          className={`ws-filter-pill ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Tất cả workshop ({courses.length})
        </button>
        <button
          type="button"
          className={`ws-filter-pill ${activeCategory === 'open' ? 'active' : ''}`}
          onClick={() => setActiveCategory('open')}
        >
          <Sparkles size={14} /> Có ca đang mở
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`ws-filter-pill ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Workshop Grid */}
      {filteredCourses.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
          <Flower2 size={40} style={{ margin: '0 auto 12px', color: '#94a3b8' }} />
          <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '8px' }}>
            Không tìm thấy workshop phù hợp
          </h3>
          <p style={{ fontSize: '14px' }}>
            Hãy thử chọn bộ lọc khác hoặc quay lại danh mục tất cả.
          </p>
        </div>
      ) : (
        <div className="ws-grid">
          {filteredCourses.map((course, index) => {
            const openSessions = course.sessions.filter((s) => isOpenFutureSession(s));
            // P2-2: soonest open session; the card shows its true remaining
            // seats from the sessions already fetched — no new requests.
            const nextOpenSession = [...openSessions].sort(
              (a, b) => sessionStartMs(a) - sessionStartMs(b),
            )[0];
            const imgUrl = getWorkshopImage(course, index);
            const durationText =
              course.duration > 0
                ? course.duration >= 60
                  ? `${Math.floor(course.duration / 60)} giờ${
                      course.duration % 60 ? ` ${course.duration % 60}p` : ''
                    }`
                  : `${course.duration} phút`
                : '120 phút';

            return (
              <article key={course.id} className="ws-card-item">
                {/* Image Cover */}
                <Link
                  href={`/workshop/${course.id}`}
                  className="ws-card-image-link"
                  aria-label={`Xem chi tiết ${course.name}`}
                >
                  <div className="ws-card-image-box">
                    <Image
                      src={imgUrl}
                      alt={course.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 420px"
                    />
                    <div className="ws-card-badges">
                      <span className="ws-badge-cat">{course.category || 'Workshop Sáp'}</span>
                      {openSessions.length > 0 ? (
                        <span className="ws-badge-open">
                          <span className="ws-badge-dot" />
                          {openSessions.length} ca đang mở
                        </span>
                      ) : (
                        <span className="ws-badge-open muted">Sắp mở ca mới</span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Card Content */}
                <div className="ws-card-body">
                  <h3 className="ws-card-title">
                    <Link href={`/workshop/${course.id}`}>{course.name}</Link>
                  </h3>
                  {course.description?.trim() ? (
                    <p className="ws-card-desc">{course.description.trim()}</p>
                  ) : null}

                  <ul className="ws-card-perks">
                    <li>
                      <CheckCircle size={15} />
                      <span>Mang trọn bộ hoa thành phẩm về nhà</span>
                    </li>
                    <li>
                      <CheckCircle size={15} />
                      <span>Đã bao gồm 100% hoa sáp cao cấp & dụng cụ</span>
                    </li>
                    <li>
                      <CheckCircle size={15} />
                      <span>
                        Thời lượng: {durationText} · Tối đa {course.maxCapacity || 12} người/ca
                      </span>
                    </li>
                  </ul>

                  {nextOpenSession ? (
                    <p className="ws-card-seats">
                      Còn {remainingSeats(nextOpenSession)} chỗ · ca{' '}
                      {formatShortDate(nextOpenSession.sessionDate)}
                    </p>
                  ) : (
                    <p className="ws-card-seats muted">Đã đủ chỗ</p>
                  )}

                  {/* Card Footer */}
                  <div className="ws-card-footer">
                    <div className="ws-card-price">
                      <span className="ws-price-val">{formatPrice(course.basePrice)}</span>
                      <span className="ws-price-unit">/ học viên (trọn gói)</span>
                    </div>

                    <button
                      type="button"
                      className="ws-btn-book"
                      onClick={() => setActiveDrawerCourse(course)}
                    >
                      {openSessions.length > 0 ? 'Chọn ca & Giữ chỗ' : 'Xem thông tin lớp'}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Interactive Booking Drawer */}
      <WorkshopBookingDrawer
        workshop={activeDrawerCourse}
        isOpen={Boolean(activeDrawerCourse)}
        onClose={() => setActiveDrawerCourse(null)}
        imageUrl={
          activeDrawerCourse
            ? getWorkshopImage(
                activeDrawerCourse,
                courses.findIndex((c) => c.id === activeDrawerCourse.id),
              )
            : undefined
        }
      />
    </section>
  );
}
