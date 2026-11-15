import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const { values } = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (key: string) => (values.has(key) ? { value: values.get(key) } : undefined),
  }),
}));
import { GET } from '@/app/api/reference-images/[owner]/[name]/route';

const owner = 'a'.repeat(32);
const name = `${'b'.repeat(32)}.png`;
const context = (o = owner, n = name) => ({ params: Promise.resolve({ owner: o, name: n }) });
const image = (headers: Record<string, string> = { 'Content-Type': 'image/png' }) =>
  new Response(new Uint8Array([1, 2, 3]), { headers });

beforeEach(() => {
  values.clear();
  values.set('store_access', 'test-token');
  vi.stubEnv('API_BASE_URL', 'http://localhost:5085');
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => image()),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('GET /api/reference-images/[owner]/[name]', () => {
  it('trả ảnh kèm security headers khi backend trả ảnh hợp lệ', async () => {
    const response = await GET(
      new Request('https://shop.test/api/reference-images/x/y'),
      context(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fetch).toHaveBeenCalledWith(
      `http://localhost:5085/api/custom-orders/reference-images/${owner}/${name}`,
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-token' },
        cache: 'no-store',
        redirect: 'error',
      }),
    );
  });
  it('404 khi owner/name sai định dạng hoặc chưa cấu hình API', async () => {
    expect((await GET(new Request('https://shop.test/x'), context('not-hex', name))).status).toBe(
      404,
    );
    expect((await GET(new Request('https://shop.test/x'), context(owner, 'evil.exe'))).status).toBe(
      404,
    );
    expect(
      (await GET(new Request('https://shop.test/x'), context(owner, 'short.png'))).status,
    ).toBe(404);
    vi.stubEnv('API_BASE_URL', '');
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('401 khi chưa đăng nhập, không gọi backend', async () => {
    values.delete('store_access');
    const response = await GET(new Request('https://shop.test/x'), context());
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('backend 404 thì 404, lỗi khác thì 502', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(404);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 500 }));
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(502);
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 403 }));
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(502);
  });
  it('502 khi backend trả sai content-type hoặc quá giới hạn 900 KiB', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'application/json' } }),
    );
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(502);
    vi.mocked(fetch).mockResolvedValueOnce(
      image({ 'Content-Type': 'image/png', 'Content-Length': String(900 * 1024 + 1) }),
    );
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(502);
    const big = new Uint8Array(512 * 1024).fill(7);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(big);
        controller.enqueue(big);
        controller.close();
      },
    });
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(stream, { headers: { 'Content-Type': 'image/png' } }),
    );
    expect((await GET(new Request('https://shop.test/x'), context())).status).toBe(502);
  });
  it('503 khi backend không tới được, không lộ lỗi nội bộ', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('internal host unreachable'));
    const response = await GET(new Request('https://shop.test/x'), context());
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('internal host');
  });
});
