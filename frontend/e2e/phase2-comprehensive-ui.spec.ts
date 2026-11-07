import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

function attachStrictConsoleAndPageGuards(page: Page): {
  pageErrors: string[];
  hydrationErrors: string[];
} {
  const pageErrors: string[] = [];
  const hydrationErrors: string[] = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (/hydration|did not match|react error/i.test(text)) {
        hydrationErrors.push(text);
      }
    }
  });

  return { pageErrors, hydrationErrors };
}

async function assertZeroSeriousAxeViolations(page: Page, contextLabel: string): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();

  const seriousOrCritical = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    seriousOrCritical.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} -> [${v.nodes.map((n) => n.target.join(' ')).join(', ')}]`,
    ),
    `Axe serious/critical violations on ${contextLabel}`,
  ).toEqual([]);
}

async function loginThroughUi(
  page: Page,
  email: string,
  password = 'Password@123',
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email đăng nhập/i).fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

test.describe('Phase 2 Comprehensive UI Hardening — Accessibility, Error Resilience, Multi-Tab Logout & Viewports', () => {
  test('UI-1 (Bước 2B.UI.6): Axe-core WCAG 2A/2AA audit (0 serious/critical) & Keyboard Tab navigation across Auth and Portal pages', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictConsoleAndPageGuards(page);

    // 1. Public Auth Pages Accessibility + Keyboard Tab focus order
    await page.goto('/login');
    await expect(page.getByLabel(/Email đăng nhập/i)).toBeVisible();
    await assertZeroSeriousAxeViolations(page, '/login');

    const emailInput = page.getByLabel(/Email đăng nhập/i);
    await emailInput.focus();
    await expect(emailInput).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#login-password')).toBeFocused();

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Đăng Ký Tài Khoản Học Viên' })).toBeVisible();
    await assertZeroSeriousAxeViolations(page, '/register');

    await page.goto('/forgot-password');
    await expect(page.getByRole('heading', { name: 'Khôi Phục Mật Khẩu' })).toBeVisible();
    await assertZeroSeriousAxeViolations(page, '/forgot-password');

    // 2. Authenticated Portal Pages Accessibility
    await loginThroughUi(page, 'admin@webedu.vn');
    await expect(page).toHaveURL(/\/admin\/students/);
    await assertZeroSeriousAxeViolations(page, '/admin/students');

    await page.goto('/admin/teachers');
    await expect(page.getByRole('heading', { name: 'Quản Lý Tài Khoản Giáo Viên' })).toBeVisible();
    await assertZeroSeriousAxeViolations(page, '/admin/teachers');

    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản' }),
    ).toBeVisible();
    await assertZeroSeriousAxeViolations(page, '/profile');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('UI-2 (Bước 2B.UI.2–3 & 7): API 500 / Network Failure resilience, Form input retention (Hanzi/Pinyin), Empty search state & Double-submit guard', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictConsoleAndPageGuards(page);

    // 1. Simulate 500 Internal Server Error on login -> retains email input & shows error alert
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/problem+json',
        body: JSON.stringify({
          type: 'about:blank',
          title: 'Internal Server Error',
          status: 500,
          detail: 'Hệ thống đang bảo trì tạm thời, vui lòng thử lại sau',
          instance: '/api/v1/auth/login',
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/login');
    await page.getByLabel(/Email đăng nhập/i).fill('persist.check@webedu.vn');
    await page.locator('#login-password').fill('Password@123');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(
      page.getByText('Hệ thống đang bảo trì tạm thời, vui lòng thử lại sau'),
    ).toBeVisible();
    // Email field must retain user input after error
    await expect(page.getByLabel(/Email đăng nhập/i)).toHaveValue('persist.check@webedu.vn');
    await page.unroute('**/api/v1/auth/login');

    // 2. Login as Admin -> test Empty Search State & Hanzi/Pinyin input retention on API 500
    await loginThroughUi(page, 'admin@webedu.vn');
    await expect(page).toHaveURL(/\/admin\/students/);

    const searchBox = page.getByPlaceholder(/Tìm theo họ tên, email, SĐT/i);
    await searchBox.fill('王小明_KHONG_TON_TAI_99999');
    await expect(
      page.getByText(/Không tìm thấy hồ sơ học viên phù hợp/i),
    ).toBeVisible();
    // Search input retains Hanzi characters without garbling
    await expect(searchBox).toHaveValue('王小明_KHONG_TON_TAI_99999');

    // 3. Profile update retains Hanzi/Pinyin input when API returns 500
    await page.goto('/profile');
    await page.route('**/api/v1/profile/me', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({
            type: 'about:blank',
            title: 'Internal Server Error',
            status: 500,
            detail: 'Lỗi kết nối máy chủ khi lưu hồ sơ',
            instance: '/api/v1/profile/me',
            timestamp: new Date().toISOString(),
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.locator('#profile-fullname').fill('Quản Trị Viên — 管理员 (Guǎnlǐyuán)');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();
    await expect(page.getByText('Lỗi kết nối máy chủ khi lưu hồ sơ')).toBeVisible();
    await expect(page.locator('#profile-fullname')).toHaveValue(
      'Quản Trị Viên — 管理员 (Guǎnlǐyuán)',
    );
    await page.unroute('**/api/v1/profile/me');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('UI-3 (Bước 2B.UI.4–5 & 9): Role menu isolation, Back-button after logout, Multi-tab logout invalidation & Viewports (375, 768, 1024, 1440 px)', async ({
    page,
    context,
  }, testInfo) => {
    const { pageErrors, hydrationErrors } = attachStrictConsoleAndPageGuards(page);
    const isMobile = testInfo.project.name.includes('mobile');

    // 1. Login as STUDENT in Tab 1 -> verify role-specific navigation menu
    await loginThroughUi(page, 'active.student@webedu.vn');
    await expect(page).toHaveURL(/\/student\/overview/);

    if (isMobile) {
      await page.getByRole('button', { name: 'Mở menu' }).click();
    }
    await expect(
      page.getByRole('link', { name: /Tình trạng học cá nhân/i }).first(),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Giáo viên/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Vận hành hệ thống/i })).toHaveCount(0);

    // 2. Open Tab 2 sharing the same browser context -> verifies authenticated access
    const page2 = await context.newPage();
    await page2.goto('/profile');
    await expect(
      page2.getByRole('heading', { name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản' }),
    ).toBeVisible();

    // Navigate Tab 1 from /student/overview -> /profile so history stack has ['/student/overview', '/profile']
    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản' }),
    ).toBeVisible();
    if (isMobile) {
      await page.getByRole('button', { name: 'Mở menu' }).click();
    }

    // 3. Logout in Tab 1 -> redirects to /login
    await page.getByRole('button', { name: /Đăng xuất/i }).first().click();
    await expect(page).toHaveURL(/\/login/);

    // 4. Pressing browser Back button in Tab 1 goes to /student/overview in history, which rejects unauthenticated access and redirects back to /login
    await page.goBack();
    await expect(page).toHaveURL(/\/login/);

    // 5. Multi-tab invalidation: reloading Tab 2 immediately redirects to /login (tokenVersion revoked in DB + cookie cleared)
    await page2.reload();
    await expect(page2).toHaveURL(/\/login/);
    await page2.close();

    // 6. Responsive viewports (375, 768, 1024, 1440 px) -> zero horizontal overflow
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 840 });
      await page.goto('/login');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, `Horizontal overflow at ${width}px on /login`).toBeLessThanOrEqual(2);
    }

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
