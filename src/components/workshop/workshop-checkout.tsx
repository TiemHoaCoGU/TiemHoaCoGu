'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  CalendarDays,
  Clock,
  MapPin,
  CheckCircle2,
  Copy,
  Check,
  ShieldCheck,
  ArrowRight,
  QrCode,
  AlertCircle,
  Users,
} from 'lucide-react';
import { storeRequest } from '@/lib/browser-api';
import type { Booking, Session, Workshop } from '@/lib/api/client';
import { DEFAULT_WORKSHOP_LOCATION } from '@/lib/transaction';
import './workshop-checkout.css';

interface WorkshopCheckoutProps {
  bookingId: string;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat('vi-VN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

function formatPrice(amount: number) {
  return `${new Intl.NumberFormat('vi-VN').format(amount)} ₫`;
}

function remainingSeconds(holdExpiresAt?: string) {
  if (!holdExpiresAt) return 0;
  const ms = new Date(holdExpiresAt).getTime() - Date.now();
  return Math.max(0, Math.floor(ms / 1000));
}

export default function WorkshopCheckout({ bookingId }: WorkshopCheckoutProps) {
  const searchParams = useSearchParams();
  const vnpResponseCode = searchParams.get('vnp_ResponseCode');
  const payParam = searchParams.get('pay');
  const [booking, setBooking] = useState<Booking | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sessionError, setSessionError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [copiedField, setCopiedField] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [vnpayBusy, setVnpayBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const vnpReturnDone = useRef(false);
  const expiredRefetchDone = useRef(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSessionError('');
    expiredRefetchDone.current = false;

    storeRequest<Booking>(`bookings/${bookingId}`)
      .then(async (b) => {
        if (!active) return;
        setBooking(b);
        setCountdown(remainingSeconds(b.holdExpiresAt));
        if ((b.pendingVerificationAmount ?? 0) > 0) setReported(true);

        // VNPay return: the provider redirects back here with vnp_* params.
        // Sync once through the BE (it verifies the signature); the booking
        // below is then refetched so the page shows the server truth.
        if (vnpResponseCode && !vnpReturnDone.current) {
          vnpReturnDone.current = true;
          try {
            await storeRequest(
              `bookings/${bookingId}/vnpay/return`,
              { query: searchParams.toString() },
              'POST',
            );
            const synced = await storeRequest<Booking>(`bookings/${bookingId}`).catch(() => null);
            if (active && synced) {
              setBooking(synced);
              setCountdown(remainingSeconds(synced.holdExpiresAt));
              if ((synced.pendingVerificationAmount ?? 0) > 0) setReported(true);
            }
          } catch (err) {
            if (active)
              setError(
                err instanceof Error
                  ? err.message
                  : 'Không thể đối chiếu kết quả thanh toán VNPay.',
              );
          }
        }

        // M6: a session lookup failure is shown, not swallowed — the payment
        // box stays hidden until the session loads.
        let matched = false;
        try {
          const wsList = await storeRequest<{ id: string }[]>('workshops');
          for (const w of wsList) {
            try {
              const wsSessions = await storeRequest<Session[]>(`workshops/${w.id}/sessions`);
              const found = wsSessions.find((s) => s.id === b.sessionId);
              if (found) {
                matched = true;
                if (active) {
                  setSession(found);
                  const wsDetail = await storeRequest<Workshop>(`workshops/${w.id}`).catch(
                    () => null,
                  );
                  if (active && wsDetail) setWorkshop(wsDetail);
                }
                break;
              }
            } catch {
              // try the next workshop
            }
          }
        } catch {
          // workshops list itself failed
        }
        if (active && !matched) setSessionError('Không tải được thông tin ca học.');
      })
      .catch((err) => {
        if (active)
          setError(err instanceof Error ? err.message : 'Không tìm thấy thông tin vé giữ chỗ.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [bookingId, loadAttempt, vnpResponseCode, searchParams]);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // M2: when the hold runs out, refetch once so the expired state shows the
  // server status (expired/cancelled) instead of a stale local copy.
  useEffect(() => {
    if (countdown !== 0 || !booking || expiredRefetchDone.current) return;
    expiredRefetchDone.current = true;
    storeRequest<Booking>(`bookings/${booking.id}`)
      .then((fresh) => {
        setBooking(fresh);
        setCountdown(remainingSeconds(fresh.holdExpiresAt));
      })
      .catch(() => {});
  }, [countdown, booking]);

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(''), 2000);
    } catch {
      setError('Không thể sao chép tự động. Vui lòng chép tay mã này.');
    }
  };

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // P2-3: deposit-first choice from the drawer (?pay=deposit). The amount is
  // the server's DepositAmount — never computed on the client. It only
  // applies to the first payment of a still-unpaid booking; any later payment
  // (the phase-1 M3 remainder path) charges the full remaining amount.
  // Note the ?? (not ||): a fully-paid booking has remainingAmount 0, which
  // must stay 0 so the paid-success state below is reached.
  const totalAmount = booking?.totalAmount ?? 0;
  const remainingAmount = booking?.remainingAmount ?? totalAmount;
  const depositAmount = booking?.depositAmount ?? 0;
  const isDepositFirst =
    payParam === 'deposit' &&
    totalAmount > 0 &&
    depositAmount > 0 &&
    remainingAmount === totalAmount;
  const reportAmount = isDepositFirst ? depositAmount : remainingAmount || totalAmount;
  // VNPay always charges the full remaining amount — the deposit choice
  // collapses to "Trả đủ" when the customer picks VNPay.
  const vnpayAmount = remainingAmount || totalAmount;

  async function handleReportTransfer() {
    if (!booking || isProcessing) return;
    setIsProcessing(true);
    setError('');
    const amount = reportAmount;
    try {
      await storeRequest(
        `payments/booking/${booking.id}`,
        {
          transactionCode: `CK-${booking.bookingCode}`,
          paymentMethod: 'BankTransfer',
          amount,
        },
        'POST',
      );
      const fresh = await storeRequest<Booking>(`bookings/${booking.id}`).catch(() => null);
      if (fresh) {
        setBooking(fresh);
        setCountdown(remainingSeconds(fresh.holdExpiresAt));
      }
      setReported(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể ghi nhận báo chuyển khoản.');
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleVnpayPay() {
    if (!booking || isProcessing || vnpayBusy) return;
    setVnpayBusy(true);
    setError('');
    try {
      const checkout = await storeRequest<{ paymentUrl?: string }>(
        `bookings/${booking.id}/vnpay`,
        {},
        'POST',
      );
      const redirect = checkout.paymentUrl ? new URL(checkout.paymentUrl) : null;
      if (
        !redirect ||
        redirect.protocol !== 'https:' ||
        redirect.hostname !== 'sandbox.vnpayment.vn'
      )
        throw new Error(
          'Cổng thanh toán sandbox chưa trả về đường dẫn kiểm thử hợp lệ. Kiểm tra lại trạng thái vé trước khi thử lại.',
        );
      window.location.assign(redirect.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể chuyển sang cổng thanh toán VNPay.');
      setVnpayBusy(false);
    }
  }

  async function handleCancelHold() {
    if (!booking || isProcessing || vnpayBusy) return;
    if (!window.confirm('Huỷ giữ chỗ này? Bạn sẽ cần chọn ca khác để đặt lại.')) return;
    setIsProcessing(true);
    setError('');
    try {
      await storeRequest(
        `bookings/${booking.id}/cancel`,
        'Khách huỷ giữ chỗ từ trang thanh toán',
        'POST',
      );
      const fresh = await storeRequest<Booking>(`bookings/${booking.id}`).catch(() => null);
      if (fresh) {
        setBooking(fresh);
        setCountdown(remainingSeconds(fresh.holdExpiresAt));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể huỷ giữ chỗ.');
    } finally {
      setIsProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="ws-checkout-container" style={{ textAlign: 'center', padding: '100px 20px' }}>
        <p style={{ fontSize: '15px', color: '#64748b' }}>Đang tải thông tin giữ chỗ...</p>
      </div>
    );
  }

  if (error && !booking) {
    return (
      <div className="ws-checkout-container" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <AlertCircle size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
        <h2 style={{ fontSize: '20px', color: '#1c2326', marginBottom: '8px' }}>
          Không thể tải vé giữ chỗ
        </h2>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>{error}</p>
        <Link
          href="/workshop"
          className="ws-btn-confirm"
          style={{ display: 'inline-flex', width: 'auto', padding: '10px 24px' }}
        >
          Quay lại danh sách Workshop
        </Link>
      </div>
    );
  }

  const bookingCode = booking?.bookingCode || 'WS-CHUA-CAP';
  const pendingVerificationAmount = booking?.pendingVerificationAmount ?? 0;
  // What was actually reported (while it is still awaiting verification).
  const reportedAmount = pendingVerificationAmount > 0 ? pendingVerificationAmount : reportAmount;
  const workshopName = workshop?.name || 'Workshop Cắm Hoa Sáp';
  const sessionDate = session ? formatDate(session.sessionDate) : '—';
  const sessionTime = session
    ? `${session.startTime.slice(0, 5)} - ${session.endTime.slice(0, 5)}`
    : '—';
  const sessionVenue = session?.location || DEFAULT_WORKSHOP_LOCATION;
  const statusLower = (booking?.bookingStatus || '').toLowerCase();
  const isConfirmed = statusLower === 'confirmed' && remainingAmount === 0;
  const isFree = totalAmount === 0;
  // M2: hold gone (server status or local countdown) — the payment box is
  // replaced by the expired state, so the report button can't be used.
  const isExpiredHold =
    !isConfirmed &&
    !isFree &&
    !reported &&
    (statusLower === 'expired' || statusLower === 'cancelled' || countdown === 0);

  const vietQrUrl = `https://img.vietqr.io/image/MB-0971201001-compact2.png?amount=${reportAmount}&addInfo=${encodeURIComponent(
    bookingCode,
  )}&accountName=TIEM%20HOA%20CO%20GU`;

  return (
    <div className="ws-checkout-container">
      <div className="ws-checkout-steps" aria-label="Các bước giữ chỗ">
        <div className="ws-step-item done">
          <span className="ws-step-num">
            <Check size={14} />
          </span>
          <span>1. Chọn ca học</span>
        </div>
        <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} aria-hidden="true" />
        <div className="ws-step-item done">
          <span className="ws-step-num">
            <Check size={14} />
          </span>
          <span>2. Giữ chỗ</span>
        </div>
        <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} aria-hidden="true" />
        <div className={`ws-step-item ${reported || isConfirmed || isFree ? 'done' : 'active'}`}>
          <span className="ws-step-num">
            {reported || isConfirmed || isFree ? <Check size={14} /> : '3'}
          </span>
          <span>3. Chuyển khoản</span>
        </div>
        <div style={{ width: '32px', height: '1px', background: '#cbd5e1' }} aria-hidden="true" />
        <div className={`ws-step-item ${isConfirmed || isFree ? 'active' : ''}`}>
          <span className="ws-step-num">4</span>
          <span>4. Nhận vé QR</span>
        </div>
      </div>

      {isConfirmed || isFree ? (
        <div className="ws-paid-success-wrap">
          <div className="ws-paid-icon">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="ws-paid-title">
            {isFree ? 'Giữ chỗ miễn phí đã được xác nhận' : 'Đặt chỗ đã được xác nhận'}
          </h2>
          <p className="ws-paid-msg">
            Vé QR của bạn có thể xem trong mục tra cứu. Đưa mã QR cho tiệm khi check-in tại xưởng.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '440px',
              margin: '0 auto 28px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Mã đặt chỗ:</span>
              <strong style={{ color: '#243db5', fontFamily: 'monospace', fontSize: '16px' }}>
                {bookingCode}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Workshop:</span>
              <strong style={{ color: '#1c2326', fontSize: '13.5px' }}>{workshopName}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Thời gian:</span>
              <span style={{ color: '#1c2326', fontSize: '13px', fontWeight: 600 }}>
                {sessionDate} ({sessionTime})
              </span>
            </div>
          </div>
          <div className="ws-paid-btn-group">
            <Link
              href={`/tra-cuu?ve=${encodeURIComponent(bookingId)}`}
              className="ws-btn-pay-action"
              style={{ width: 'auto', padding: '12px 28px', textDecoration: 'none' }}
            >
              Xem vé QR <ArrowRight size={16} />
            </Link>
            <Link
              href="/workshop"
              className="ws-btn-dismiss"
              style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
            >
              Xem thêm Workshop
            </Link>
          </div>
        </div>
      ) : reported ? (
        <div className="ws-paid-success-wrap">
          <div className="ws-paid-icon">
            <CheckCircle2 size={36} />
          </div>
          <h2 className="ws-paid-title">Đã ghi nhận báo chuyển khoản</h2>
          <p className="ws-paid-msg">
            Đã ghi nhận bạn báo chuyển khoản. Tiệm sẽ xác nhận khi nhận tiền; vé QR được gửi qua
            email và hiện trong mục tra cứu.
          </p>
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '20px',
              maxWidth: '440px',
              margin: '0 auto 28px',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Mã đặt chỗ / nội dung CK:</span>
              <strong style={{ color: '#243db5', fontFamily: 'monospace', fontSize: '16px' }}>
                {bookingCode}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#64748b', fontSize: '13px' }}>Số tiền báo chuyển:</span>
              <strong style={{ color: '#1c2326', fontSize: '13.5px' }}>
                {formatPrice(reportedAmount)}
              </strong>
            </div>
            {countdown > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b', fontSize: '13px' }}>Giữ chỗ còn:</span>
                <span style={{ color: '#1c2326', fontSize: '13px', fontWeight: 600 }}>
                  {timeFormatted}
                </span>
              </div>
            )}
          </div>
          <div className="ws-paid-btn-group">
            <Link
              href={`/tra-cuu?ve=${encodeURIComponent(bookingId)}`}
              className="ws-btn-pay-action"
              style={{ width: 'auto', padding: '12px 28px', textDecoration: 'none' }}
            >
              Xem trạng thái vé <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      ) : sessionError ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <AlertCircle size={40} style={{ color: '#ef4444', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: '#1c2326', marginBottom: '8px' }}>
            Không tải được thông tin ca học
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            {sessionError} Vui lòng thử tải lại để xem ca học trước khi thanh toán.
          </p>
          <button
            type="button"
            className="ws-btn-pay-action"
            style={{ display: 'inline-flex', width: 'auto', padding: '10px 24px' }}
            onClick={() => setLoadAttempt((n) => n + 1)}
          >
            Tải lại thông tin ca học
          </button>
        </div>
      ) : isExpiredHold ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <AlertCircle size={40} style={{ color: '#f59e0b', margin: '0 auto 16px' }} />
          <h2 style={{ fontSize: '20px', color: '#1c2326', marginBottom: '8px' }}>
            Giữ chỗ đã hết hạn
          </h2>
          <p style={{ color: '#64748b', marginBottom: '24px' }}>
            Thời gian giữ chỗ 10 phút đã hết
            {statusLower === 'cancelled' ? ' hoặc giữ chỗ đã bị huỷ' : ''}. Vui lòng chọn ca khác để
            đặt lại.
          </p>
          <Link
            href="/workshop"
            className="ws-btn-pay-action"
            style={{
              display: 'inline-flex',
              width: 'auto',
              padding: '12px 28px',
              textDecoration: 'none',
            }}
          >
            Chọn ca khác <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="ws-checkout-layout">
          <div className="ws-checkout-card">
            <h2>
              <span>Chuyển khoản giữ chỗ</span>
              {countdown > 0 && (
                <span className="ws-timer-badge">
                  <Clock size={13} aria-hidden="true" /> Giữ chỗ còn: {timeFormatted}
                </span>
              )}
            </h2>

            <div className="ws-pay-methods" aria-label="Hướng dẫn chuyển khoản">
              <div className="ws-pay-method-opt selected">
                <div className="ws-pay-radio" aria-hidden="true">
                  <div className="ws-pay-radio-inner" />
                </div>
                <QrCode size={24} style={{ color: '#243db5' }} aria-hidden="true" />
                <div className="ws-pay-opt-text">
                  <span className="ws-pay-opt-title">Chuyển khoản ngân hàng (VietQR)</span>
                  <span className="ws-pay-opt-sub">
                    Nội dung chuyển khoản là mã đặt chỗ để tiệm đối soát.
                  </span>
                </div>
              </div>
            </div>

            <div className="ws-vietqr-box">
              <div className="ws-qr-image-wrap">
                <Image
                  src={vietQrUrl}
                  alt={`Mã VietQR chuyển khoản ${formatPrice(reportAmount)} với nội dung ${bookingCode}`}
                  width={220}
                  height={220}
                  style={{ borderRadius: '8px' }}
                  unoptimized
                />
              </div>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                Quét mã QR để chuyển khoản đúng số tiền và nội dung. Sau khi chuyển, bấm &quot;Tôi
                đã chuyển khoản&quot; để tiệm xác nhận.
              </p>

              <table className="ws-bank-details">
                <tbody>
                  <tr>
                    <td>Ngân hàng:</td>
                    <td>
                      <strong>MB Bank (Ngân hàng Quân Đội)</strong>
                    </td>
                  </tr>
                  <tr>
                    <td>Số tài khoản:</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontSize: '14px' }}>0971201001</span>
                      <button
                        type="button"
                        className="ws-copy-btn"
                        onClick={() => void copyToClipboard('0971201001', 'stk')}
                        aria-label="Sao chép số tài khoản"
                      >
                        {copiedField === 'stk' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === 'stk' ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <td>Chủ tài khoản:</td>
                    <td>TIEM HOA CO GU</td>
                  </tr>
                  <tr>
                    <td>Số tiền:</td>
                    <td style={{ color: '#243db5' }}>{formatPrice(reportAmount)}</td>
                  </tr>
                  <tr>
                    <td>Nội dung CK:</td>
                    <td>
                      <span style={{ fontFamily: 'monospace', color: '#243db5', fontWeight: 800 }}>
                        {bookingCode}
                      </span>
                      <button
                        type="button"
                        className="ws-copy-btn"
                        onClick={() => void copyToClipboard(bookingCode, 'nd')}
                        aria-label="Sao chép nội dung chuyển khoản"
                      >
                        {copiedField === 'nd' ? <Check size={12} /> : <Copy size={12} />}
                        {copiedField === 'nd' ? 'Đã chép' : 'Sao chép'}
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {error && (
              <div className="ws-error-alert" style={{ marginBottom: '18px' }} role="alert">
                <AlertCircle size={18} aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="button"
              className="ws-btn-pay-action"
              onClick={() => void handleReportTransfer()}
              disabled={isProcessing}
            >
              {isProcessing
                ? 'Đang ghi nhận báo chuyển khoản…'
                : `Tôi đã chuyển khoản · ${formatPrice(reportAmount)}`}
            </button>
            <p
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textAlign: 'center',
                margin: '12px 0 0',
              }}
            >
              {isDepositFirst
                ? `Bạn chọn cọc trước 30% (${formatPrice(depositAmount)}). Còn thiếu ${formatPrice(totalAmount - depositAmount)} — trả nốt trước giờ học để nhận vé. Vé QR chỉ phát hành sau khi thanh toán đủ.`
                : 'Tiệm sẽ xác nhận khi nhận được tiền. Vé QR chỉ phát hành sau khi đặt chỗ được xác nhận.'}
            </p>

            <button
              type="button"
              className="ws-btn-pay-action"
              style={{ marginTop: '10px', background: '#243db5' }}
              onClick={() => void handleVnpayPay()}
              disabled={isProcessing || vnpayBusy}
            >
              {vnpayBusy
                ? 'Đang chuyển sang cổng VNPay…'
                : `Thanh toán VNPay · ${formatPrice(vnpayAmount)}`}
            </button>
            <p
              style={{
                fontSize: '12px',
                color: '#94a3b8',
                textAlign: 'center',
                margin: '8px 0 0',
              }}
            >
              Thanh toán qua cổng VNPay (sandbox). Bạn sẽ được chuyển về trang này để đối chiếu kết
              quả.
              {isDepositFirst ? ' VNPay thu đủ phần còn lại, không áp dụng cọc trước.' : ''}
            </p>

            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => void handleCancelHold()}
                disabled={isProcessing || vnpayBusy}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#dc2626',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Huỷ giữ chỗ
              </button>
            </div>
          </div>

          <div className="ws-summary-sidebar">
            <div className="ws-order-ticket-preview">
              <div className="ws-ticket-header">
                <span>GIỮ CHỖ WORKSHOP</span>
                <h3>{workshopName}</h3>
              </div>

              <div className="ws-ticket-info-body">
                <div className="ws-ticket-row">
                  <CalendarDays size={16} aria-hidden="true" />
                  <span>
                    <strong>Ngày học:</strong> {sessionDate}
                  </span>
                </div>
                <div className="ws-ticket-row">
                  <Clock size={16} aria-hidden="true" />
                  <span>
                    <strong>Khung giờ:</strong> {sessionTime}
                  </span>
                </div>
                <div className="ws-ticket-row">
                  <MapPin size={16} aria-hidden="true" />
                  <span>
                    <strong>Địa điểm:</strong> {sessionVenue}
                  </span>
                </div>
                <div className="ws-ticket-row">
                  <Users size={16} aria-hidden="true" />
                  <span>
                    <strong>Học viên:</strong> {booking?.customerName || 'Khách hàng'}
                  </span>
                </div>
              </div>

              <div className="ws-ticket-pricing">
                <div className="ws-price-row">
                  <span>Số lượng:</span>
                  <span>{booking?.ticketCount || 1} người</span>
                </div>
                <div className="ws-price-row">
                  <span>Số tiền cần chuyển:</span>
                  <span>{formatPrice(reportAmount)}</span>
                </div>
                <div className="ws-price-row total">
                  <span>Tổng đặt chỗ:</span>
                  <span>{formatPrice(totalAmount)}</span>
                </div>
              </div>
            </div>

            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e8ebe4',
                borderRadius: '16px',
                padding: '18px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                fontSize: '12.5px',
                color: '#475569',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} style={{ color: '#10b981' }} aria-hidden="true" />
                <span>
                  Nội dung chuyển khoản: <strong>{bookingCode}</strong>
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={16} style={{ color: '#10b981' }} aria-hidden="true" />
                <span>Tiệm xác nhận thanh toán trước khi phát hành vé QR.</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
