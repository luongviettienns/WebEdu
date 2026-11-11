import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const SCREENSHOT_DIR =
  process.env.QA_SCREENSHOT_DIR ||
  path.join(os.tmpdir(), 'webedu-qa-screenshots');

function attachErrorGuards(page: Page): { pageErrors: string[] } {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => {
    pageErrors.push(err.message);
  });
  return { pageErrors };
}

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth - window.innerWidth;
  });
  expect(overflow).toBeLessThanOrEqual(2);
}

async function assertZeroClientSideTokenLeakage(page: Page): Promise<void> {
  const storageSummary = await page.evaluate(() => ({
    localKeys: Object.keys(window.localStorage),
    sessionKeys: Object.keys(window.sessionStorage),
    visibleCookies: document.cookie,
  }));
  expect(storageSummary.localKeys).not.toContain('webedu_access_token');
  expect(storageSummary.sessionKeys).not.toContain('webedu_access_token');
  expect(storageSummary.visibleCookies).not.toContain('webedu_access_token');
}

async function saveQaScreenshot(
  page: Page,
  projectName: string,
  slug: string,
): Promise<void> {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const prefix = projectName.includes('mobile') ? 'mobile' : 'desktop';
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, `${prefix}-${slug}.png`),
    fullPage: true,
  });
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

const VN_YEAR = Number(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).format(new Date()),
);
const DOB_UNDER_12 = `${VN_YEAR - 8}-01-01`;
const DOB_TEEN_14 = `${VN_YEAR - 14}-01-01`;
const DOB_ADULT_25 = `${VN_YEAR - 25}-04-15`;

test.describe('Phase 2 Browser QA — Auth, Users & RBAC (Desktop & Mobile)', () => {
  test('Journey 1: Student Registration (<12 block, 12-15 conditional Guardian Consent, >=16 pending enrollment)', async ({
    page,
    request,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const isMobile = testInfo.project.name.includes('mobile');
    const suffix = isMobile ? 'mob' : 'desk';

    await page.goto('/register');
    await expect(
      page.getByRole('heading', { name: 'Đăng Ký Tài Khoản Học Viên' }),
    ).toBeVisible();

    // 1. Under-12 age validation blocks submit
    await page.locator('#reg-dob').fill(DOB_UNDER_12);
    await expect(
      page.getByText('Học viên phải từ 12 tuổi trở lên'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng ký' })).toBeDisabled();

    // 2. Teen (12-15) displays conditional guardian consent section
    await page.locator('#reg-dob').fill(DOB_TEEN_14);
    await expect(
      page.getByRole('heading', {
        name: /Xác nhận đồng ý của cha mẹ \/ người giám hộ/i,
      }),
    ).toBeVisible();
    await saveQaScreenshot(page, testInfo.project.name, '01-register-guardian');

    // 3. Adult (>=16) hides guardian section & completes registration -> redirects to /login?registered=1
    await page.locator('#reg-fullname').fill(`Nguyễn Văn Tân (${suffix})`);
    await page.locator('#reg-dob').fill(DOB_ADULT_25);
    await expect(
      page.getByRole('heading', {
        name: /Xác nhận đồng ý của cha mẹ \/ người giám hộ/i,
      }),
    ).toBeHidden();
    await page
      .locator('#reg-phone')
      .fill(isMobile ? '0987654322' : '0987654321');
    const registerEmail = `new.student.${suffix}@example.com`;
    await page.locator('#reg-email').fill(registerEmail);
    await page.getByRole('button', { name: 'Gửi mã' }).click();
    await expect(
      page.getByText(/Mã xác thực đã được gửi tới email của bạn/i),
    ).toBeVisible();

    const otpRes = await request.get(
      `http://127.0.0.1:4026/latest-otp?email=${encodeURIComponent(registerEmail)}`,
    );
    expect(otpRes.ok()).toBe(true);
    const { otp } = (await otpRes.json()) as { otp: string | null };
    expect(otp).toMatch(/^\d{6}$/);
    await page.locator('#reg-verification-code').fill(otp!);

    await page.locator('#reg-password').fill('Password@123');
    await page.locator('#reg-confirm-password').fill('Password@123');

    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Đăng ký' }).click();

    await expect(page).toHaveURL(/\/login\?registered=1/);
    await expect(
      page.getByText(
        'Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp. Bạn có thể đăng nhập ngay để theo dõi trạng thái hồ sơ.',
      ),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('Journey 2: Login Lockout (5x wrong -> 15m lock) & Cookie-Only Session Verification', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const suffix = testInfo.project.name.includes('mobile')
      ? 'mobile'
      : 'desktop';
    const targetEmail = `lockout.${suffix}@webedu.vn`;

    await page.goto('/login');
    await page.getByLabel(/Email đăng nhập/i).fill(targetEmail);

    for (let i = 1; i <= 4; i += 1) {
      await page.locator('#login-password').fill('WrongPassword@999');
      const loginResp = page.waitForResponse(
        (res) =>
          res.url().includes('/api/v1/auth/login') &&
          res.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Đăng nhập' }).click();
      const resolved = await loginResp;
      expect(resolved.status()).toBe(401);
      await expect(
        page.getByText('Email hoặc mật khẩu không chính xác'),
      ).toBeVisible();
    }

    // 5th wrong attempt triggers real PostgreSQL 15-minute lockout banner
    await page.locator('#login-password').fill('WrongPassword@999');
    const fifthResp = page.waitForResponse(
      (res) =>
        res.url().includes('/api/v1/auth/login') &&
        res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    expect((await fifthResp).status()).toBe(403);
    await expect(
      page.getByText(
        'Tài khoản tạm khóa 15 phút do nhập sai mật khẩu quá 5 lần',
      ),
    ).toBeVisible();
    await saveQaScreenshot(page, testInfo.project.name, '02-login-lockout');

    // Valid login as active student redirects to /student/overview with zero JS/WebStorage token
    await loginThroughUi(page, 'active.student@webedu.vn');
    await expect(page).toHaveURL(/\/student\/overview/);
    await expect(
      page.getByRole('heading', { name: 'Tình Trạng Học Tập Cá Nhân' }),
    ).toBeVisible();
    await assertZeroClientSideTokenLeakage(page);
    await assertNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });

  test('Journey 3: Forgot Password Cooldown & End-to-End Real SMTP Reset Link Flow', async ({
    page,
    request,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const suffix = testInfo.project.name.includes('mobile')
      ? 'mobile'
      : 'desktop';
    const resetEmail = `reset.${suffix}@webedu.vn`;

    await page.goto('/forgot-password');
    await page.getByLabel(/Email đã đăng ký/i).fill(resetEmail);
    await page.getByRole('button', { name: 'Gửi yêu cầu' }).click();

    await expect(
      page.getByText(/Nếu tài khoản tồn tại, hướng dẫn đã được gửi/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Gửi lại sau \d+s/i }),
    ).toBeDisabled();

    // Inspect real SMTP message captured by QA SMTP server
    const mailRes = await request.get(
      `http://127.0.0.1:4026/latest-token?email=${encodeURIComponent(resetEmail)}`,
    );
    expect(mailRes.ok()).toBe(true);
    const { token } = (await mailRes.json()) as { token: string | null };
    expect(token).toMatch(/^[0-9a-f]{64}$/);

    // Follow email reset link in browser
    await page.goto(`/reset-password?token=${token}`);
    await page.locator('#reset-new-password').fill('ResetSuccess@456');
    await page.locator('#reset-confirm-password').fill('ResetSuccess@456');
    await page.getByRole('button', { name: 'Lưu mật khẩu' }).click();

    await expect(page).toHaveURL(/\/login\?reset=1/);
    await expect(
      page.getByText(
        'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
      ),
    ).toBeVisible();

    // Login with the newly reset password
    await loginThroughUi(page, resetEmail, 'ResetSuccess@456');
    await expect(page).toHaveURL(/\/student\/overview/);
    expect(pageErrors).toEqual([]);
  });

  test('Journey 4: Personal Profile View/Update & Teacher Hanzi/Pinyin Rendering', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);

    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await expect(page).toHaveURL(/\/teacher\/classes/);
    await expect(
      page.getByRole('heading', { name: 'Lớp Học Phụ Trách' }),
    ).toBeVisible();
    await expect(
      page.locator('main').getByText(/Trương Mỹ Lan.*张美兰/),
    ).toBeVisible();

    await page.goto('/profile');
    await expect(
      page.getByRole('heading', {
        name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản',
      }),
    ).toBeVisible();
    await expect(page.getByText('2 lớp đang phụ trách')).toBeVisible();

    await page.locator('#profile-fullname').fill('Trương Mỹ Lan — 张美兰');
    await page
      .getByRole('button', { name: 'Lưu thông tin cá nhân' })
      .click();
    await expect(
      page.getByText('Cập nhật thông tin cá nhân thành công'),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    await saveQaScreenshot(page, testInfo.project.name, '04-profile-teacher');
    expect(pageErrors).toEqual([]);
  });

  test('Journey 5: Admin Teachers Management & Active Class Deactivation Guard', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const isMobile = testInfo.project.name.includes('mobile');

    await loginThroughUi(page, 'admin@webedu.vn');
    await expect(page).toHaveURL(/\/admin\/students/);

    await page.goto('/admin/teachers');
    await expect(
      page.getByRole('heading', { name: 'Quản Lý Tài Khoản Giáo Viên' }),
    ).toBeVisible();

    // Attempting to deactivate teacher with 2 active classes shows blocking alert modal
    const lanRow = page.locator('tr', { hasText: 'teacher.lan@webedu.vn' });
    await lanRow.getByRole('button', { name: 'Vô hiệu hóa' }).click();
    await expect(
      page.getByRole('heading', {
        name: 'Không thể vô hiệu hóa giáo viên',
      }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Đã hiểu' }).click();

    // Create a new teacher account
    await page
      .getByRole('button', { name: '+ Tạo tài khoản giáo viên' })
      .click();
    await page
      .locator('#teacher-fullname')
      .fill(isMobile ? 'Thầy Lý Minh (李明)' : 'Cô Lâm Thu Hà (林秋河)');
    await page
      .locator('#teacher-phone')
      .fill(isMobile ? '0918880002' : '0918880001');
    await page
      .locator('#teacher-email')
      .fill(isMobile ? 'ly.minh@webedu.vn' : 'lam.ha@webedu.vn');
    await page.locator('#teacher-init-password').fill('Password@123');
    await page.locator('#teacher-notes').fill('Chuyên luyện HSK 5 (高级汉语)');
    await page.getByRole('button', { name: 'Lưu thông tin' }).click();

    await expect(
      page.getByText('Tạo tài khoản giáo viên mới thành công'),
    ).toBeVisible();
    await assertNoHorizontalOverflow(page);
    await saveQaScreenshot(page, testInfo.project.name, '05-admin-teachers');
    expect(pageErrors).toEqual([]);
  });

  test('Journey 6: Pending Class Enrollment (Dynamic DB Classes) & DOB Consent Lock', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);
    const suffix = testInfo.project.name.includes('mobile')
      ? 'mobile'
      : 'desktop';
    const teenEmail = `pending.${suffix}@webedu.vn`;

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/students/pending');
    await expect(
      page.getByRole('heading', { name: 'Tài Khoản Chờ Xếp Lớp' }),
    ).toBeVisible();

    const studentRow = page.locator('tr', { hasText: teenEmail });
    await expect(studentRow).toBeVisible();
    await studentRow.getByRole('button', { name: 'Xếp lớp' }).click();

    // Verify dynamic PostgreSQL classes with Hanzi & Pinyin are rendered in dropdown (no hardcoded mocks)
    const classSelect = page.locator('#assign-class-select');
    await expect(classSelect).toBeVisible();
    await expect(classSelect).toContainText(
      'HSK1-K26-01 — Tiếng Trung HSK 1 — 汉语水平考试一级 (Hànzì)',
    );
    await saveQaScreenshot(
      page,
      testInfo.project.name,
      '06-pending-enrollment-modal',
    );

    await page.getByRole('button', { name: 'Xác nhận' }).click();
    await expect(
      page.getByText(/vào lớp HSK1-K26-01 thành công/i),
    ).toBeVisible();

    // Open student detail on /admin/students -> verify DOB is disabled (GuardianConsent lock) & Admin sees internalNotes
    await page.goto('/admin/students');
    const enrolledRow = page.locator('tr', { hasText: teenEmail });
    await expect(enrolledRow).toContainText('HSK1-K26-01');
    await enrolledRow.getByRole('button', { name: 'Chi tiết & Sửa' }).click();

    await expect(page.locator('#stu-dob')).toBeDisabled();
    await expect(
      page.getByText(
        /Trường Ngày sinh đã khóa do học viên có xác nhận đồng ý của cha mẹ/i,
      ),
    ).toBeVisible();
    await expect(page.locator('#stu-internal-notes')).toBeVisible();
    await page.getByRole('button', { name: 'Hủy' }).click();

    await assertNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });

  test('Journey 7 & 8: Superadmin Settings, Live Branding Update, Pure Superadmin internalNotes Isolation & Cross-Role 403 Access Denied', async ({
    page,
  }, testInfo) => {
    const { pageErrors } = attachErrorGuards(page);

    // 1. Cross-role Access Denied: STUDENT navigating to /admin/students or /superadmin/settings sees 403 AccessDeniedState
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/admin/students');
    await expect(
      page.getByText('403 — Giới hạn quyền truy cập'),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Bạn không có quyền truy cập trang này',
      }),
    ).toBeVisible();
    await saveQaScreenshot(page, testInfo.project.name, '07-access-denied-403');

    // 2. Pure SUPERADMIN login -> /superadmin/settings branding update & audit logs
    await loginThroughUi(page, 'superadmin@webedu.vn');
    await expect(page).toHaveURL(/\/superadmin\/settings/);
    await expect(
      page.getByRole('heading', {
        name: 'Vận Hành Hệ Thống (Superadmin)',
      }),
    ).toBeVisible();

    await page
      .locator('#cfg-center-name')
      .fill('Trung Tâm TD Hán Ngữ — 天地汉语');
    await page
      .getByRole('button', { name: 'Lưu cấu hình hệ thống' })
      .click();
    await expect(
      page.getByText('Lưu cấu hình hệ thống thành công'),
    ).toBeVisible();
    // Header live updates via SYSTEM_CONFIG_UPDATED_EVENT
    await expect(
      page.locator('header').getByText('Trung Tâm TD Hán Ngữ — 天地汉语'),
    ).toBeVisible();

    // Audit log table displays new UPDATE_SYSTEM_CONFIG action
    await expect(page.getByText('UPDATE_SYSTEM_CONFIG').first()).toBeVisible();
    await saveQaScreenshot(
      page,
      testInfo.project.name,
      '08-superadmin-settings',
    );

    // 3. Pure SUPERADMIN visiting /admin/students does NOT see internalNotes field on student modal
    await page.goto('/admin/students');
    const activeRow = page.locator('tr', {
      hasText: 'active.student@webedu.vn',
    });
    await activeRow.getByRole('button', { name: 'Chi tiết & Sửa' }).click();
    await expect(page.locator('#stu-fullname')).toBeVisible();
    await expect(page.locator('#stu-internal-notes')).toHaveCount(0);
    await page.getByRole('button', { name: 'Hủy' }).click();

    // Pure SUPERADMIN navigating to /admin/students/pending or /student/overview gets 403 Access Denied (default-deny FUNC-008 & learning data isolation)
    await page.goto('/admin/students/pending');
    await expect(
      page.getByText('403 — Giới hạn quyền truy cập'),
    ).toBeVisible();

    await page.goto('/student/overview');
    await expect(
      page.getByText('403 — Giới hạn quyền truy cập'),
    ).toBeVisible();

    await assertNoHorizontalOverflow(page);
    expect(pageErrors).toEqual([]);
  });
});
