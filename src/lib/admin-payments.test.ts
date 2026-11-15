import { describe, expect, it, vi } from 'vitest';
import { recordOrderPayment, validatePaymentRecord } from '@/lib/admin-payments';

const input = { amount: 100000, method: 'Cash' as const, transactionCode: 'COD-DH-0001' };

describe('validatePaymentRecord', () => {
  it('chặn số tiền <= 0 hoặc không phải số', () => {
    expect(validatePaymentRecord(0, 'COD-1')).toBe('Số tiền thanh toán phải lớn hơn 0.');
    expect(validatePaymentRecord(-5000, 'COD-1')).toBe('Số tiền thanh toán phải lớn hơn 0.');
    expect(validatePaymentRecord(Number.NaN, 'COD-1')).toBe(
      'Số tiền thanh toán phải lớn hơn 0.',
    );
  });
  it('chặn mã giao dịch trống', () => {
    expect(validatePaymentRecord(100000, '')).toBe('Nhập mã giao dịch để tránh ghi trùng.');
    expect(validatePaymentRecord(100000, '   ')).toBe('Nhập mã giao dịch để tránh ghi trùng.');
  });
  it('hợp lệ khi đủ số tiền và mã', () => {
    expect(validatePaymentRecord(100000, 'COD-1')).toBeNull();
  });
});

describe('recordOrderPayment', () => {
  it('gửi đúng path/body qua BFF, backend trả recorded', async () => {
    const request = vi.fn(async () => ({ recorded: true }));
    await expect(recordOrderPayment(request, 'order-1', input)).resolves.toBe(true);
    expect(request).toHaveBeenCalledWith(
      'payments/order/order-1',
      { paymentMethod: 'Cash', transactionCode: 'COD-DH-0001', amount: 100000 },
      'POST',
    );
  });
  it('lỗi backend được ném ra, không báo thành công', async () => {
    const request = vi.fn(async () => {
      throw new Error('Đơn đã thanh toán đủ.');
    });
    await expect(recordOrderPayment(request, 'order-1', input)).rejects.toThrow(
      'Đơn đã thanh toán đủ.',
    );
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('chặn double-submit: hai lần gọi đồng thời chỉ gửi một request', async () => {
    let resolveRequest!: (value: { recorded: boolean }) => void;
    const request = vi.fn(
      () =>
        new Promise<{ recorded: boolean }>((resolve) => {
          resolveRequest = resolve;
        }),
    );
    const first = recordOrderPayment(request, 'order-1', input);
    const second = recordOrderPayment(request, 'order-1', input);
    resolveRequest({ recorded: true });
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('ghi lại được sau khi lần trước lỗi', async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Mạng lỗi.'))
      .mockResolvedValueOnce({ recorded: true });
    await expect(recordOrderPayment(request, 'order-1', input)).rejects.toThrow('Mạng lỗi.');
    await expect(recordOrderPayment(request, 'order-1', input)).resolves.toBe(true);
    expect(request).toHaveBeenCalledTimes(2);
  });
});
