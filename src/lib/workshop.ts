/** Shared display helpers for workshop surfaces (catalog, detail, drawer). */

type WorkshopImageItem = { name: string; category?: string | null };

/** Catalog cover for a workshop. The API carries no workshop images, so the
 * cover is picked from the local set by name/category, like the catalog card. */
export function getWorkshopImage(course: WorkshopImageItem, index: number): string {
  const name = course.name.toLowerCase();
  const cat = (course.category || '').toLowerCase();
  if (name.includes('cơ bản') || cat.includes('cơ bản')) return '/images/ws-club.webp';
  if (name.includes('nâng cao') || cat.includes('chuyên sâu')) return '/images/ws-studio.webp';
  if (index % 2 === 0) return '/images/workshop-hands.webp';
  return '/images/ws-gallery.webp';
}

export function formatDurationMinutes(minutes: number): string {
  if (minutes <= 0) return '120 phút';
  if (minutes >= 60)
    return `${Math.floor(minutes / 60)} giờ${minutes % 60 ? ` ${minutes % 60}p` : ''}`;
  return `${minutes} phút`;
}

/** GoalsJson/IncludesJson are JSON strings of string lists; never throw. */
export function parseStringList(json?: string): string[] {
  if (!json) return [];
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

/** Cancel/refund policy, worded from the BE cancel path (WorkshopService):
 * cancel is allowed any time before the session starts (no 24h cutoff) and a
 * paid booking gets a refund *request* for the shop to process. */
export const WORKSHOP_CANCEL_COPY =
  'Hủy giữ chỗ được chấp nhận trước giờ học bắt đầu. Vé đã thanh toán sẽ được tạo yêu cầu hoàn tiền để tiệm xử lý.';
