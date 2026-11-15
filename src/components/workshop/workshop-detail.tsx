'use client';

import React, { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Users,
} from 'lucide-react';
import type { Session, Workshop } from '@/lib/api/client';
import type { Course } from './workshop-booking-drawer';
import WorkshopBookingDrawer from './workshop-booking-drawer';
import {
  DEFAULT_WORKSHOP_LOCATION,
  isOpenFutureSession,
  remainingSeats,
} from '@/lib/transaction';
import {
  WORKSHOP_CANCEL_COPY,
  formatDurationMinutes,
  getWorkshopImage,
  parseStringList,
} from '@/lib/workshop';
import './workshop.css';

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'short',
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function formatPrice(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function sessionStartMs(s: Session) {
  return new Date(`${s.sessionDate.slice(0, 10)}T${s.startTime}`).getTime();
}

/** Future sessions with status open (including full ones), soonest first. */
function upcomingOpenSessions(sessions: Session[]) {
  return sessions
    .filter((s) => s.sessionStatus.toLowerCase() === 'open' && sessionStartMs(s) > Date.now())
    .sort((a, b) => sessionStartMs(a) - sessionStartMs(b));
}

export default function WorkshopDetail({
  workshop,
  sessions,
}: {
  workshop: Workshop;
  sessions: Session[];
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preselectedSessionId, setPreselectedSessionId] = useState<string | undefined>(undefined);

  const course: Course = useMemo(
    () => ({ ...workshop, sessions }),
    [workshop, sessions],
  );
  const upcoming = useMemo(() => upcomingOpenSessions(sessions), [sessions]);
  const openSessions = useMemo(
    () => upcoming.filter((s) => isOpenFutureSession(s)),
    [upcoming],
  );
  const registeredCount = useMemo(
    () => sessions.reduce((count, s) => count + (s.bookedSlots || 0), 0),
    [sessions],
  );
  const goals = parseStringList(workshop.goalsJson);
  const includes = parseStringList(workshop.includesJson);
  const imageUrl = getWorkshopImage(workshop, 0);

  const openDrawer = (sessionId?: string) => {
    setPreselectedSessionId(sessionId);
    setDrawerOpen(true);
  };

  return (
    <div className="ws-detail">
      <nav className="ws-detail-crumb" aria-label="Đường dẫn">
        <Link href="/workshop">Workshop</Link>
        <span aria-hidden="true"> / </span>
        <span>{workshop.name}</span>
      </nav>

      <div className="ws-detail-grid">
        <div className="ws-detail-cover">
          <Image
            src={imageUrl}
            alt={workshop.name}
            fill
            priority
            sizes="(max-width: 860px) 100vw, 56vw"
          />
          <span className="ws-detail-cat">{workshop.category || 'Workshop Sáp'}</span>
        </div>

        <div className="ws-detail-panel">
          <h1>{workshop.name}</h1>
          {workshop.leadContent?.trim() ? (
            <p className="ws-detail-lead">{workshop.leadContent.trim()}</p>
          ) : workshop.description?.trim() ? (
            <p className="ws-detail-lead">{workshop.description.trim()}</p>
          ) : null}

          <div className="ws-detail-facts">
            <span>
              <Clock3 size={15} /> {formatDurationMinutes(workshop.duration)}
            </span>
            <span>
              <Users size={15} /> {registeredCount} người đã đăng ký
            </span>
            <span>
              <MapPin size={15} /> {DEFAULT_WORKSHOP_LOCATION}
            </span>
          </div>

          <div className="ws-detail-price-row">
            <span className="ws-price-val">{formatPrice(workshop.basePrice)}</span>
            <span className="ws-price-unit">/ học viên (trọn gói)</span>
          </div>

          {!workshop.isActive ? (
            <div className="ws-detail-empty" role="status">
              <AlertCircle size={18} />
              <span>Workshop này hiện không mở.</span>
            </div>
          ) : openSessions.length === 0 ? (
            <div className="ws-detail-empty" role="status">
              <AlertCircle size={18} />
              <span>Hiện chưa có ca mở cho workshop này. Tiệm sẽ mở thêm ca sớm!</span>
              <Link href="/workshop">Quay lại danh sách Workshop</Link>
            </div>
          ) : (
            <button type="button" className="ws-btn-book ws-detail-cta" onClick={() => openDrawer()}>
              Chọn ca & Giữ chỗ <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {workshop.description?.trim() ? (
        <section className="ws-detail-section" aria-label="Về workshop">
          <h2>Về workshop</h2>
          <p>{workshop.description.trim()}</p>
        </section>
      ) : null}

      {goals.length > 0 ? (
        <section className="ws-detail-section" aria-label="Bạn sẽ học được gì">
          <h2>Bạn sẽ học được gì</h2>
          <ul className="ws-detail-list">
            {goals.map((goal) => (
              <li key={goal}>
                <CheckCircle2 size={16} />
                <span>{goal}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {includes.length > 0 ? (
        <section className="ws-detail-section" aria-label="Đã bao gồm">
          <h2>Đã bao gồm</h2>
          <ul className="ws-detail-list">
            {includes.map((item) => (
              <li key={item}>
                <CheckCircle2 size={16} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {workshop.forWho?.trim() ? (
        <section className="ws-detail-section" aria-label="Dành cho ai">
          <h2>Dành cho ai</h2>
          <p>{workshop.forWho.trim()}</p>
        </section>
      ) : null}

      <section className="ws-detail-section" aria-label="Các ca học">
        <h2>Các ca học</h2>
        {upcoming.length === 0 ? (
          <p className="ws-detail-muted">
            Hiện chưa có ca mở cho workshop này. Tiệm sẽ mở thêm ca sớm!
          </p>
        ) : (
          <div className="ws-detail-sessions">
            {upcoming.map((s) => {
              const seats = remainingSeats(s);
              const pickable = workshop.isActive && seats > 0;
              return (
                <div key={s.id} className="ws-detail-session">
                  <div className="ws-detail-session-info">
                    <div className="ws-session-datetime-txt">
                      <CalendarDays size={15} />
                      <span>
                        {formatDate(s.sessionDate)} · {s.startTime.slice(0, 5)} -{' '}
                        {s.endTime.slice(0, 5)}
                      </span>
                    </div>
                    <div className="ws-session-venue">
                      <MapPin size={14} />
                      <span>{s.location || DEFAULT_WORKSHOP_LOCATION}</span>
                    </div>
                  </div>
                  <span className="ws-detail-session-price">
                    {formatPrice(workshop.basePrice)}
                  </span>
                  {seats > 0 ? (
                    <span className="ws-session-seats-badge">Còn {seats} chỗ</span>
                  ) : (
                    <span className="ws-detail-full-badge">Đã đủ chỗ</span>
                  )}
                  <button
                    type="button"
                    className="ws-btn-book"
                    disabled={!pickable}
                    onClick={() => openDrawer(s.id)}
                  >
                    {pickable ? 'Chọn ca này' : 'Đã đủ chỗ'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="ws-detail-section" aria-label="Lưu ý">
        <h2>Lưu ý</h2>
        <p className="ws-detail-muted">
          Thời lượng {formatDurationMinutes(workshop.duration)} · Địa điểm{' '}
          {DEFAULT_WORKSHOP_LOCATION} · {WORKSHOP_CANCEL_COPY}
        </p>
      </section>

      <WorkshopBookingDrawer
        workshop={drawerOpen ? course : null}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        imageUrl={imageUrl}
        preselectedSessionId={preselectedSessionId}
      />
    </div>
  );
}
