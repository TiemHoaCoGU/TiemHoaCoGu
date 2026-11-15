export type PaymentMethod = 'Cash' | 'BankTransfer' | 'MoMo';

export type PaymentRecordInput = {
  amount: number;
  method: PaymentMethod;
  transactionCode: string;
};

export type PaymentRequest = (path: string, body?: unknown, method?: string) => Promise<unknown>;

/**
 * Lỗi nhập liệu của form ghi nhận thanh toán, null khi hợp lệ.
 * Thông điệp giữ nguyên như trong giao diện quản trị.
 */
export function validatePaymentRecord(amount: number, transactionCode: string): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'Số tiền thanh toán phải lớn hơn 0.';
  if (!transactionCode.trim()) return 'Nhập mã giao dịch để tránh ghi trùng.';
  return null;
}

const inFlightPayments = new Set<string>();

/**
 * Ghi nhận thanh toán qua BFF. Trả true khi đã gửi request, false khi một lần
 * ghi giống hệt (cùng đơn, phương thức, mã, số tiền) đang chạy — chống
 * double-submit khi người dùng bấm nhanh hai lần trước khi nút kịp khóa.
 * Lỗi backend được ném ra để giao diện hiện lỗi, không hiện thông báo thành công.
 */
export async function recordOrderPayment(
  request: PaymentRequest,
  orderId: string,
  input: PaymentRecordInput,
): Promise<boolean> {
  const key = `${orderId}|${input.method}|${input.transactionCode.trim()}|${input.amount}`;
  if (inFlightPayments.has(key)) return false;
  inFlightPayments.add(key);
  try {
    await request(
      `payments/order/${orderId}`,
      {
        paymentMethod: input.method,
        transactionCode: input.transactionCode.trim(),
        amount: input.amount,
      },
      'POST',
    );
    return true;
  } finally {
    inFlightPayments.delete(key);
  }
}
