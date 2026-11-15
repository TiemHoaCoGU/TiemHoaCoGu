import type { StorefrontMode } from '@/lib/storefront';

export type AreaLoadState = { loaded: boolean; failed: boolean };

/**
 * Kiểm tra khu vực giao ở bước liên hệ của form đặt riêng.
 * Trả về thông báo lỗi khi chưa thể tiếp tục, chuỗi rỗng khi hợp lệ.
 * Ở chế độ xem trước không có danh mục GHN nên không chặn.
 * Tỉnh/phường bắt buộc khi đã nối backend: form gửi provinceId/wardId
 * thiếu sẽ chỉ lỗi muộn ở checkout, nên chặn ngay từ bước 3.
 */
export function validateDeliveryArea(
  mode: StorefrontMode,
  area: AreaLoadState,
  provinceId: string,
  wardId: string,
): string {
  if (mode !== 'connected') return '';
  if (area.failed)
    return 'Không tải được danh mục tỉnh/phường. Hãy bấm “Thử lại” rồi chọn khu vực giao hoa.';
  if (!area.loaded) return 'Đang tải danh mục tỉnh/phường, hãy chờ một chút rồi thử lại.';
  if (!provinceId || !wardId) return 'Chọn tỉnh và phường nhận hoa để tiệm báo đúng phí giao.';
  return '';
}
