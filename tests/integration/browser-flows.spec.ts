import {
  test,
  expect,
  type APIRequestContext,
  type Browser,
  type APIResponse,
} from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { authenticatedContext, BASE_URL, login } from './helpers';
const headers = { Origin: BASE_URL };
async function ok(r: Pick<APIResponse, 'ok' | 'status' | 'text' | 'json'>) {
  expect(r.ok(), await r.text()).toBeTruthy();
  return r;
}
async function admin(browser: Browser) {
  const context = await browser.newContext({ baseURL: BASE_URL });
  await login(
    context.request,
    JSON.parse(await readFile(process.env.ADMIN_TEST_CREDENTIALS_FILE!, 'utf8')) as {
      email: string;
      password: string;
    },
  );
  return context;
}
async function product(api: APIRequestContext, customizable = false) {
  const suffix = randomUUID().slice(0, 8);
  const category = (await (
    await ok(
      await api.post('/api/store/management/categories', {
        headers,
        data: { code: `UI-C-${suffix}`, name: `UI ${suffix}` },
      }),
    )
  ).json()) as { id: string };
  const payload = {
    categoryId: category.id,
    code: `UI-P-${suffix}`,
    name: `UI Product ${suffix}`,
    price: 250000,
    description: 'Synthetic integration test',
    isCustomizable: customizable,
    isPreOrder: false,
    shippingWeightGrams: 500,
    packageLengthCm: 30,
    packageWidthCm: 20,
    packageHeightCm: 10,
    packagingSpecsConfirmed: true,
    isActive: true,
  };
  const created = (await (
    await ok(await api.post('/api/store/management/products', { headers, data: payload }))
  ).json()) as { id: string; name: string };
  await ok(
    await api.put(`/api/store/management/inventory/${created.id}?quantity=8`, {
      headers,
      data: {},
    }),
  );
  return { ...created, ...payload };
}

test('UI tài khoản: đăng nhập, CRUD địa chỉ, khôi phục giỏ máy chủ, mobile', async ({
  browser,
}) => {
  const manager = await admin(browser);
  const p = await product(manager.request);
  const customer = await authenticatedContext(browser);
  await ok(await customer.api.post('/api/store/auth/logout', { headers, data: {} }));
  const page = await customer.context.newPage();
  await page.goto('/tai-khoan');
  await page.getByLabel('Email', { exact: true }).fill(customer.user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(customer.user.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `Xin chào, ${customer.user.fullName}.` }),
  ).toBeVisible();
  for (const [label, value] of Object.entries({
    'Người nhận': customer.user.fullName,
    'Điện thoại': customer.user.phoneNumber,
    'Địa chỉ chi tiết': '12 UI Integration Street',
    'Phường/xã': 'Ben Nghe',
    'Quận/huyện': 'District 1',
    'Tỉnh/thành phố': 'Ho Chi Minh City',
  }))
    await page.getByLabel(label, { exact: true }).fill(value);
  await page.getByRole('button', { name: 'Thêm địa chỉ', exact: true }).click();
  const row = page.locator('main li').filter({ hasText: '12 UI Integration Street' });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Sửa', exact: true }).click();
  await page.getByLabel('Địa chỉ chi tiết', { exact: true }).fill('14 UI Integration Street');
  await page.getByRole('button', { name: 'Cập nhật địa chỉ', exact: true }).click();
  const updated = page.locator('main li').filter({ hasText: '14 UI Integration Street' });
  await expect(updated).toBeVisible();
  expect(await (await customer.api.get('/api/store/addresses')).json()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ detailAddress: '14 UI Integration Street' }),
    ]),
  );
  await updated.getByRole('button', { name: 'Xoá', exact: true }).click();
  await expect(updated).toHaveCount(0);
  await ok(
    await customer.api.post('/api/store/cart', { headers, data: { productId: p.id, quantity: 1 } }),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Túi hoa trong tài khoản' })).toBeVisible();
  await page.getByRole('button', { name: 'Khôi phục túi tài khoản về máy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Mở túi hoa, 1 sản phẩm' })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('cogu-cart-v1') || '[]')),
  ).toEqual([{ id: p.id, quantity: 1 }]);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole('heading', { name: `Xin chào, ${customer.user.fullName}.` }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mở túi hoa, 1 sản phẩm' })).toBeVisible();
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI catalog → túi → checkout: thiếu shipping provider trả lỗi thật, không tạo đơn', async ({
  browser,
}) => {
  const manager = await admin(browser);
  const p = await product(manager.request);
  const customer = await authenticatedContext(browser);
  const page = await customer.context.newPage();
  await page.route('**/api/store/shipping/locations/provinces', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1000001, name: 'Hồ Chí Minh', parentId: 1 }]),
    }),
  );
  await page.route('**/api/store/shipping/locations/wards**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ id: 1003580, name: 'Phường Thủ Đức', parentId: 1000001 }]),
    }),
  );
  await page.goto(`/cua-tiem/${p.id}`);
  await expect(page.getByRole('heading', { name: p.name, exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /Thêm vào túi hoa/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Mở túi hoa, 1 sản phẩm' })).toBeVisible();
  await page.goto('/thanh-toan');
  await page.locator('[name="name"]').fill(customer.user.fullName);
  await page.locator('[name="phone"]').fill(customer.user.phoneNumber);
  await page.locator('[name="email"]').fill(customer.user.email);
  await page.locator('[name="streetAddress"]').fill('12 UI Integration Street');
  await page.locator('[name="provinceId"]').selectOption('1000001');
  await page.locator('[name="wardId"]').selectOption('1003580');
  let quoteRequests = 0;
  page.on('request', (request) => {
    if (request.url().endsWith('/api/store/shipping/quote')) quoteRequests += 1;
  });
  const quoteButton = page.getByRole('button', { name: /Báo phí giao hàng/ });
  await expect(quoteButton).toBeDisabled();
  await expect(page.locator('.form-notice')).toContainText('mapping phí GHN chính thức');
  expect(quoteRequests).toBe(0);
  const serverQuote = await customer.api.post('/api/store/shipping/quote', {
    headers,
    data: {
      streetAddress: '12 UI Integration Street',
      provinceId: 1000001,
      wardId: 1003580,
      items: [{ productId: p.id, quantity: 1 }],
    },
  });
  expect(serverQuote.status()).toBe(503);
  await expect(page.locator('.form-status[role="alert"]')).toHaveCount(0);
  expect(await (await customer.api.get('/api/store/orders')).json()).toEqual([]);
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI đặt riêng: tạo yêu cầu, xem và duyệt giá thật, checkout thành đơn Unpaid', async ({
  browser,
}) => {
  const manager = await admin(browser);
  const p = await product(manager.request, true);
  const customer = await authenticatedContext(browser);
  const page = await customer.context.newPage();
  await page.goto('/dat-rieng');
  await page.locator('[name="productId"]').selectOption(p.id);
  await page.locator('[name="name"]').fill(customer.user.fullName);
  await page.locator('[name="phone"]').fill(customer.user.phoneNumber);
  await page.locator('[name="occasion"]').selectOption({ index: 1 });
  await page.locator('[name="budget"]').selectOption({ index: 1 });
  await page.locator('[name="message"]').fill('Synthetic UI custom request');
  const createdResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/store/custom-orders') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Gửi yêu cầu báo giá', exact: true }).click();
  const created = (await (await ok(await createdResponse)).json()) as { id: string };
  await expect(page.locator('.form-status[role="status"]').first()).toContainText(/BÁO GIÁ/);
  await ok(
    await manager.request.post(`/api/store/custom-orders/${created.id}/quote`, {
      headers,
      data: {
        unitPrice: 250000,
        depositPercent: 50,
        completionDate: new Date(Date.now() + 14 * 86400000).toISOString(),
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        adminNote: 'Synthetic UI quote',
      },
    }),
  );
  await page.getByRole('button', { name: 'Tải lại báo giá', exact: true }).click();
  await expect(page.getByText(/Tiền cọc theo báo giá:/)).toContainText('125.000');
  await page.getByRole('button', { name: 'Duyệt báo giá này', exact: true }).click();
  await expect(page.getByLabel('Địa chỉ giao hàng *', { exact: true })).toBeVisible();
  await page.getByLabel('Địa chỉ giao hàng *', { exact: true }).fill('12 UI Custom Street');
  const checkoutResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/store/custom-orders/${created.id}/checkout`) &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo đơn đặt riêng', exact: true }).click();
  const result = (await (await ok(await checkoutResponse)).json()) as {
    orderId: string;
    orderCode: string;
  };
  const order = (await (
    await ok(await customer.api.get(`/api/store/orders/${result.orderId}`))
  ).json()) as { paymentStatus: string; totalAmount: number };
  expect(order).toMatchObject({ paymentStatus: 'Unpaid', totalAmount: 250000 });
  await expect(page.locator('.form-status[role="status"]').last()).toContainText(
    /Chưa xác nhận thu tiền/,
  );
  await page.goto('/tra-cuu');
  await expect(
    page.getByRole('heading', { name: 'Món quà của bạn, đang ở đâu?', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xem lịch sử tài khoản', exact: true }).click();
  await expect(page.getByText(result.orderCode, { exact: true })).toBeVisible();
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI workshop: chọn ca trong drawer, giữ chỗ thật rồi sang trang thanh toán', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const manager = await admin(browser);
  const suffix = randomUUID().slice(0, 8);
  const workshop = (await (
    await ok(
      await manager.request.post('/api/store/workshops', {
        headers,
        data: {
          code: `UI-WS-${suffix}`,
          name: `UI Workshop ${suffix}`,
          basePrice: 300000,
          duration: 120,
          maxCapacity: 8,
          description: 'Synthetic UI workshop',
          isActive: true,
        },
      }),
    )
  ).json()) as { id: string };
  const session = (await (
    await ok(
      await manager.request.post(`/api/store/workshops/${workshop.id}/sessions`, {
        headers,
        data: {
          sessionDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
          startTime: '10:00:00',
          endTime: '12:00:00',
          capacity: 8,
          location: 'Synthetic UI studio',
        },
      }),
    )
  ).json()) as { id: string };
  const customer = await authenticatedContext(browser);
  const page = await customer.context.newPage();
  await page.goto('/workshop');
  await page.waitForLoadState('networkidle');
  const card = page.locator('article', { hasText: `UI Workshop ${suffix}` });
  await expect(card.getByRole('button', { name: 'Chọn ca & Giữ chỗ' })).toBeVisible();
  await card.getByRole('button', { name: 'Chọn ca & Giữ chỗ' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  // Pick the session explicitly (the drawer also auto-picks the first free one).
  await drawer.locator('.ws-session-option', { hasText: '10:00' }).first().click();
  // The submit button only appears once the drawer has loaded the logged-in
  // user; waiting for it also proves hydration (a pre-hydration click would
  // fire a native form submit instead of the React handler).
  const submit = drawer.getByRole('button', { name: /Tiếp tục thanh toán/ });
  await expect(submit).toBeVisible();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/store/bookings/sessions/${session.id}`) &&
      r.request().method() === 'POST',
  );
  await submit.click();
  const booking = (await (await ok(await response)).json()) as {
    id: string;
    bookingCode: string;
    bookingStatus: string;
    ticketCount: number;
    holdExpiresAt: string;
  };
  expect(booking).toMatchObject({ bookingStatus: 'pending', ticketCount: 1 });
  expect(new Date(booking.holdExpiresAt).getTime()).toBeGreaterThan(Date.now());
  await page.waitForURL(new RegExp(`/thanh-toan\\?bookingId=${booking.id}`));
  // The checkout page loaded the hold: bank-transfer box + VNPay button.
  await expect(page.getByRole('button', { name: /Tôi đã chuyển khoản/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Thanh toán VNPay/ })).toBeVisible();
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI workshop: trang chi tiết hiển thị đầy đủ và mở drawer từ ca đã chọn', async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const manager = await admin(browser);
  const suffix = randomUUID().slice(0, 8);
  const workshop = (await (
    await ok(
      await manager.request.post('/api/store/workshops', {
        headers,
        data: {
          code: `UI-WS-D-${suffix}`,
          name: `UI Workshop Detail ${suffix}`,
          basePrice: 300000,
          duration: 120,
          maxCapacity: 8,
          description: 'Synthetic detail workshop',
          leadContent: 'Lead content for detail',
          goalsJson: JSON.stringify(['Học uốn cánh sáp', 'Học gói bó hoa']),
          includesJson: JSON.stringify(['Hoa sáp mang về', 'Dụng cụ đầy đủ']),
          forWho: 'Người mới bắt đầu',
          isActive: true,
        },
      }),
    )
  ).json()) as { id: string };
  await ok(
    await manager.request.post(`/api/store/workshops/${workshop.id}/sessions`, {
      headers,
      data: {
        sessionDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        startTime: '10:00:00',
        endTime: '12:00:00',
        capacity: 8,
        location: 'Synthetic UI studio',
      },
    }),
  );
  const customer = await authenticatedContext(browser);
  const page = await customer.context.newPage();
  await page.goto(`/workshop/${workshop.id}`);
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('heading', { name: `UI Workshop Detail ${suffix}` })).toBeVisible();
  await expect(page.getByText('Lead content for detail')).toBeVisible();
  await expect(page.getByText('Học uốn cánh sáp')).toBeVisible();
  await expect(page.getByText('Hoa sáp mang về')).toBeVisible();
  await expect(page.getByText('Người mới bắt đầu')).toBeVisible();
  await expect(page.getByText('0 người đã đăng ký')).toBeVisible();
  const row = page.locator('.ws-detail-session', { hasText: '10:00' });
  await expect(row.getByText('Còn 8 chỗ')).toBeVisible();
  await row.getByRole('button', { name: 'Chọn ca này' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible();
  // The drawer opened preselected on the picked session.
  await expect(drawer.locator('.ws-session-option.selected', { hasText: '10:00' })).toBeVisible();
  // P2-3: the deposit choice renders once a session is picked.
  await expect(drawer.getByText('Trả đủ 300.000 ₫')).toBeVisible();
  await expect(drawer.getByText('Cọc trước 30%')).toBeVisible();
  await drawer.getByText('Cọc trước 30%').click();
  await expect(drawer.getByRole('button', { name: /Cọc trước 30%/ })).toBeVisible();
  await expect(drawer.getByRole('button', { name: /Tiếp tục thanh toán/ })).toBeVisible();
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI CMS: customer bị chặn, Admin sửa false flags và đọc gallery thật', async ({ browser }) => {
  const manager = await admin(browser);
  const p = await product(manager.request);
  const customer = await authenticatedContext(browser);
  const customerPage = await customer.context.newPage();
  await customerPage.goto('/quan-tri');
  await expect(
    customerPage.getByRole('heading', { name: 'Không có quyền truy cập', exact: true }),
  ).toBeVisible();
  const page = await manager.newPage();
  await page.goto('/quan-tri');
  await page.locator('.admin-tab').filter({ hasText: 'Danh mục & sản phẩm' }).click();
  const row = page.getByRole('row').filter({ hasText: p.code });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Sửa', exact: true }).click();
  await expect(page.locator('[name="isCustomizable"]')).not.toBeChecked();
  await expect(page.locator('[name="isPreOrder"]')).not.toBeChecked();
  const updateResponse = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/store/management/products/${p.id}`) && r.request().method() === 'PUT',
  );
  await page.getByRole('button', { name: 'Cập nhật sản phẩm', exact: true }).click();
  await ok(await updateResponse);
  const updated = await (
    await ok(await manager.request.get(`/api/store/management/products/${p.id}`))
  ).json();
  expect(updated).toMatchObject({ isCustomizable: false, isPreOrder: false });
  await expect(page.getByRole('heading', { name: 'Ảnh sản phẩm', exact: true })).toBeVisible();
  await Promise.all([customer.context.close(), manager.close()]);
});

test('UI auth: response kiểm tra phiên cũ về muộn không đăng xuất phiên vừa tạo', async ({
  browser,
}) => {
  const customer = await authenticatedContext(browser);
  await ok(await customer.api.post('/api/store/auth/logout', { headers, data: {} }));
  const page = await customer.context.newPage();
  let first = true;
  let staleFinished: () => void = () => {};
  const staleResponse = new Promise<void>((resolve) => {
    staleFinished = resolve;
  });
  await page.route('**/api/store/auth/me', async (route) => {
    if (!first) {
      await route.continue();
      return;
    }
    first = false;
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Yêu cầu đăng nhập.' }),
    });
    staleFinished();
  });
  await page.goto('/tai-khoan');
  await expect(page.getByText('API: sẵn sàng.', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(customer.user.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(customer.user.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const greeting = page.getByRole('heading', { name: `Xin chào, ${customer.user.fullName}.` });
  await expect(greeting).toBeVisible();
  await staleResponse;
  await expect(greeting).toBeVisible();
  expect((await customer.api.get('/api/store/auth/me')).status()).toBe(200);
  await customer.context.close();
});
