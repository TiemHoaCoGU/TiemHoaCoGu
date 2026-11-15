export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ApiError, workshopsApi, type Session, type Workshop } from '@/lib/api/client';
import WorkshopDetail from '@/components/workshop/workshop-detail';

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // BE GET /api/workshops/{id:guid} accepts the workshop Id only, not Code.
  if (!GUID_RE.test(id)) return { title: 'Workshop — Tiệm Hoa Có Gu' };
  try {
    const w = await workshopsApi().workshop(id);
    return {
      title: `${w.name} — Workshop | Tiệm Hoa Có Gu`,
      description: w.description || w.leadContent || undefined,
    };
  } catch {
    return { title: 'Workshop — Tiệm Hoa Có Gu' };
  }
}

export default async function WorkshopDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!GUID_RE.test(id)) notFound();

  let workshop: Workshop;
  let sessions: Session[];
  try {
    [workshop, sessions] = await Promise.all([
      workshopsApi().workshop(id),
      workshopsApi().sessions(id),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    return (
      <div className="ws-detail" style={{ textAlign: 'center', padding: '80px 20px' }}>
        <h1 style={{ fontSize: '20px', color: '#1c2326', marginBottom: '8px' }}>
          Không tải được workshop
        </h1>
        <p style={{ color: '#64748b', marginBottom: '24px' }}>
          Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.
        </p>
        <a className="button" href={`/workshop/${id}`}>
          Thử tải lại
        </a>
      </div>
    );
  }

  return <WorkshopDetail workshop={workshop} sessions={sessions} />;
}
