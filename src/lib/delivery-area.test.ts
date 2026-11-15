import { describe, expect, it } from 'vitest';
import { validateDeliveryArea } from '@/lib/delivery-area';

describe('validateDeliveryArea', () => {
  it('không chặn ở chế độ xem trước', () => {
    expect(validateDeliveryArea('preview', { loaded: false, failed: false }, '', '')).toBe('');
  });
  it('chặn khi danh mục tải lỗi và hướng dẫn thử lại', () => {
    expect(validateDeliveryArea('connected', { loaded: true, failed: true }, '', '')).toContain(
      'Thử lại',
    );
  });
  it('chặn khi danh mục chưa tải xong', () => {
    expect(validateDeliveryArea('connected', { loaded: false, failed: false }, '', '')).toContain(
      'Đang tải',
    );
  });
  it('chặn khi chưa chọn tỉnh hoặc phường', () => {
    const loaded = { loaded: true, failed: false };
    expect(validateDeliveryArea('connected', loaded, '', '')).toContain('Chọn tỉnh và phường');
    expect(validateDeliveryArea('connected', loaded, '1000001', '')).toContain(
      'Chọn tỉnh và phường',
    );
    expect(validateDeliveryArea('connected', loaded, '', '1003580')).toContain(
      'Chọn tỉnh và phường',
    );
  });
  it('cho qua khi đã chọn đủ tỉnh và phường', () => {
    expect(
      validateDeliveryArea('connected', { loaded: true, failed: false }, '1000001', '1003580'),
    ).toBe('');
  });
});
