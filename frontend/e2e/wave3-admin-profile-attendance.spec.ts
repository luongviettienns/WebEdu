import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

interface MockUser {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  roles: Array<'SUPERADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT'>;
  effectiveRole: 'SUPERADMIN' | 'ADMIN' | 'TEACHER' | 'STUDENT';
  status: 'ACTIVE' | 'PENDING_CLASS' | 'INACTIVE';
  dateOfBirth?: string;
  canSelfChangeEmail?: boolean;
  assignedClass?: string | null;
  activeClassesCount?: number;
}

function attachStrictGuards(page: Page) {
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

async function assertZeroSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
    `Axe serious/critical violations on ${label}`,
  ).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, `Horizontal overflow on ${label}`).toBeLessThanOrEqual(2);
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

async function setMockAuthCookie(page: Page, userId: string, baseURL?: string) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }),
  ).toString('base64url');
  await page.context().addCookies([
    {
      name: 'webedu_access_token',
      value: `${header}.${payload}.mocksignature`,
      url: baseURL || 'http://localhost:3005',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

async function setupCommonApiMocks(
  page: Page,
  currentUser: MockUser,
  baseURL?: string,
  extraHandler?: (route: Route, pathname: string, method: string, url: URL) => Promise<boolean>,
) {
  await setMockAuthCookie(page, currentUser.id, baseURL);
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    const method = req.method();

    if (extraHandler && (await extraHandler(route, pathname, method, url))) {
      return;
    }

    if (pathname.endsWith('/auth/me') && method === 'GET') {
      return fulfillJson(route, currentUser);
    }
    if (pathname.endsWith('/system-settings/config') && method === 'GET') {
      return fulfillJson(route, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        centerLogoUrl: null,
        centerLogoBase64: null,
      });
    }
    if (pathname.endsWith('/students/pending-enrollment') && method === 'GET') {
      return fulfillJson(route, { items: [], totalPending: 0 });
    }

    return fulfillJson(
      route,
      {
        type: 'about:blank',
        title: 'Not Mocked',
        status: 404,
        detail: `Unmocked endpoint: ${method} ${pathname}`,
        instance: pathname,
      },
      404,
    );
  });
}

test.describe('Wave 3 Task 7 — Profile <16/OTP, SystemSettings Filters & Attendance Matrix/Modal Guards', () => {
  test('7.1a Profile <16 student locks email self-change while allowing name & phone save without OTP/password', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const patchPayloads: Array<Record<string, unknown>> = [];

    let profile: MockUser = {
      id: 'stu-u16',
      email: 'young.student@webedu.vn',
      fullName: 'Trần Tiểu Minh',
      phone: '0901234567',
      roles: ['STUDENT'],
      effectiveRole: 'STUDENT',
      status: 'ACTIVE',
      dateOfBirth: '2013-05-01',
      canSelfChangeEmail: false,
      assignedClass: 'HSK1-K26-01',
    };

    await setupCommonApiMocks(page, profile, baseURL, async (route, pathname, method) => {
      if (pathname.endsWith('/profile/me') && method === 'GET') {
        await fulfillJson(route, profile);
        return true;
      }
      if (pathname.endsWith('/profile/me') && method === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        patchPayloads.push(body);
        profile = {
          ...profile,
          fullName: String(body.fullName ?? profile.fullName),
          phone: String(body.phone ?? profile.phone),
        };
        await fulfillJson(route, profile);
        return true;
      }
      return false;
    });

    await page.goto('/profile');
    await expect(
      page.getByRole('heading', { name: 'Hồ Sơ Cá Nhân & Bảo Mật Tài Khoản' }),
    ).toBeVisible();

    const emailInput = page.locator('#profile-email');
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveValue('young.student@webedu.vn');
    await expect(
      page.getByText(
        'Học viên dưới 16 tuổi không thể tự thay đổi email; vui lòng nhờ Admin hỗ trợ.',
      ),
    ).toBeVisible();
    await expect(page.locator('#profile-email-confirm-password')).toHaveCount(0);
    await expect(page.locator('#profile-email-verification-code')).toHaveCount(0);

    await page.locator('#profile-fullname').fill('Trần Tiểu Minh — 陈小明');
    await page.locator('#profile-phone').fill('0909888777');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();

    await expect(
      page.getByText('Cập nhật thông tin cá nhân thành công'),
    ).toBeVisible();
    expect(patchPayloads).toHaveLength(1);
    expect(patchPayloads[0]?.fullName).toBe('Trần Tiểu Minh — 陈小明');
    expect(patchPayloads[0]?.phone).toBe('0909888777');
    expect(patchPayloads[0]?.currentPassword).toBeUndefined();
    expect(patchPayloads[0]?.verificationCode).toBeUndefined();

    await assertZeroSeriousAxeViolations(page, 'profile-under-16');
    await assertNoHorizontalOverflow(page, 'profile-under-16');
    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('7.1b Profile >=16/staff email change requires currentPassword + 6-digit SMTP OTP & resets OTP state on email change', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const otpRequests: Array<{ newEmail: string }> = [];
    const patchPayloads: Array<Record<string, unknown>> = [];

    let profile: MockUser = {
      id: 'teacher-1',
      email: 'teacher.lan@webedu.vn',
      fullName: 'Trương Mỹ Lan',
      phone: '0912345678',
      roles: ['TEACHER'],
      effectiveRole: 'TEACHER',
      status: 'ACTIVE',
      canSelfChangeEmail: true,
      activeClassesCount: 2,
    };

    await setupCommonApiMocks(page, profile, baseURL, async (route, pathname, method) => {
      if (pathname.endsWith('/profile/me') && method === 'GET') {
        await fulfillJson(route, profile);
        return true;
      }
      if (pathname.endsWith('/profile/me/send-email-change-code') && method === 'POST') {
        const body = route.request().postDataJSON() as { newEmail: string };
        otpRequests.push(body);
        await fulfillJson(route, {
          message: 'Mã xác thực 6 chữ số đã được gửi tới email mới',
          expiresInSeconds: 600,
        });
        return true;
      }
      if (pathname.endsWith('/profile/me') && method === 'PATCH') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        patchPayloads.push(body);
        profile = {
          ...profile,
          fullName: String(body.fullName ?? profile.fullName),
          phone: String(body.phone ?? profile.phone),
          email: String(body.email ?? profile.email),
        };
        await fulfillJson(route, profile);
        return true;
      }
      return false;
    });

    await page.goto('/profile');
    await expect(page.locator('#profile-email')).toBeEnabled();

    await page.locator('#profile-email').fill('teacher.lan.new@webedu.vn');
    await expect(page.locator('#profile-email-confirm-password')).toBeVisible();
    await expect(page.locator('#profile-email-verification-code')).toBeVisible();
    const sendOtpBtn = page.getByRole('button', { name: 'Gửi mã xác thực' });
    await expect(sendOtpBtn).toBeVisible();

    // Missing currentPassword blocks submit
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();
    await expect(
      page.getByText('Vui lòng nhập mật khẩu hiện tại để xác nhận đổi Email'),
    ).toBeVisible();

    // Missing/invalid 6-digit OTP blocks submit
    await page.locator('#profile-email-confirm-password').fill('Password@123');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();
    await expect(
      page.getByText(/Vui lòng nhập mã xác thực 6 chữ số/i),
    ).toBeVisible();

    // Send OTP -> shows feedback + starts 60s cooldown
    await sendOtpBtn.click();
    await expect(
      page.getByText('Mã xác thực 6 chữ số đã được gửi tới email mới'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Gửi lại sau \d+s/i })).toBeDisabled();
    expect(otpRequests).toEqual([{ newEmail: 'teacher.lan.new@webedu.vn' }]);

    // Editing email again resets OTP input + cooldown cleanly
    await page.locator('#profile-email-verification-code').fill('111222');
    await page.locator('#profile-email').fill('teacher.other@webedu.vn');
    await expect(page.locator('#profile-email-verification-code')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'Gửi mã xác thực' })).toBeEnabled();

    // Complete OTP email change flow
    await page.locator('#profile-email').fill('teacher.lan.new@webedu.vn');
    await page.getByRole('button', { name: 'Gửi mã xác thực' }).click();
    await expect(
      page.getByText('Mã xác thực 6 chữ số đã được gửi tới email mới'),
    ).toBeVisible();
    await page.locator('#profile-email-verification-code').fill('654321');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();

    await expect(
      page.getByText('Cập nhật thông tin cá nhân thành công'),
    ).toBeVisible();
    expect(patchPayloads).toHaveLength(1);
    expect(patchPayloads[0]).toMatchObject({
      email: 'teacher.lan.new@webedu.vn',
      currentPassword: 'Password@123',
      verificationCode: '654321',
    });
    await expect(page.locator('#profile-email-confirm-password')).toHaveCount(0);
    await expect(page.locator('#profile-email-verification-code')).toHaveCount(0);

    await assertZeroSeriousAxeViolations(page, 'profile-otp-email-change');
    await assertNoHorizontalOverflow(page, 'profile-otp-email-change');
    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('7.2 Superadmin Settings filters users (search/role/status/pagination) & filters/refreshes audit logs', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const userQueries: Array<Record<string, string | null>> = [];
    const auditQueries: Array<Record<string, string | null>> = [];
    let auditFetchCount = 0;

    const superadmin: MockUser = {
      id: 'sa-1',
      email: 'superadmin@webedu.vn',
      fullName: 'Tổng Quản Trị',
      phone: '0900000001',
      roles: ['SUPERADMIN'],
      effectiveRole: 'SUPERADMIN',
      status: 'ACTIVE',
    };

    const allUsers = Array.from({ length: 25 }, (_, i) => {
      const idx = i + 1;
      if (idx === 1) {
        return {
          id: 'sa-1',
          fullName: 'Tổng Quản Trị',
          email: 'superadmin@webedu.vn',
          phone: '0900000001',
          roles: ['SUPERADMIN'],
          status: 'ACTIVE',
        };
      }
      if (idx === 23) {
        return {
          id: 'u-23',
          fullName: 'Trương Mỹ Lan',
          email: 'teacher.lan@webedu.vn',
          phone: '0900000023',
          roles: ['TEACHER'],
          status: 'PENDING_CLASS',
        };
      }
      if (idx === 24) {
        return {
          id: 'u-24',
          fullName: 'Đỗ Thanh Hằng',
          email: 'teacher.hang@webedu.vn',
          phone: '0900000024',
          roles: ['TEACHER'],
          status: 'PENDING_CLASS',
        };
      }
      return {
        id: `u-${idx}`,
        fullName: `Nhân Sự Số ${idx}`,
        email: `staff${idx}@webedu.vn`,
        phone: `09000000${String(idx).padStart(2, '0')}`,
        roles: [idx % 2 === 0 ? 'ADMIN' : 'STUDENT'],
        status: idx % 3 === 0 ? 'INACTIVE' : 'ACTIVE',
      };
    });

    await setupCommonApiMocks(page, superadmin, baseURL, async (route, pathname, method, url) => {
      if (pathname.endsWith('/system-settings/users') && method === 'GET') {
        const search = url.searchParams.get('search');
        const role = url.searchParams.get('role');
        const status = url.searchParams.get('status');
        const pageNum = Number(url.searchParams.get('page') || '1');
        const limitNum = Number(url.searchParams.get('limit') || '20');
        userQueries.push({ search, role, status, page: String(pageNum) });

        const filtered = allUsers.filter((u) => {
          if (search) {
            const q = search.toLowerCase();
            if (
              !u.fullName.toLowerCase().includes(q) &&
              !u.email.toLowerCase().includes(q) &&
              !u.phone.includes(q)
            ) {
              return false;
            }
          }
          if (role && !u.roles.includes(role as never)) return false;
          if (status && u.status !== status) return false;
          return true;
        });

        const start = (pageNum - 1) * limitNum;
        await fulfillJson(route, {
          items: filtered.slice(start, start + limitNum),
          total: filtered.length,
          page: pageNum,
          limit: limitNum,
        });
        return true;
      }

      if (pathname.endsWith('/system-settings/audit-logs') && method === 'GET') {
        auditFetchCount += 1;
        const action = url.searchParams.get('action');
        const pageNum = Number(url.searchParams.get('page') || '1');
        auditQueries.push({ action, page: String(pageNum) });

        const baseLogs = [
          {
            id: 'log-1',
            actorName: 'Tổng Quản Trị',
            actingRole: 'SUPERADMIN',
            action: 'UPDATE_SYSTEM_CONFIG',
            targetType: 'SystemSetting',
            targetId: 'center_name',
            createdAt: '2026-11-13T10:00:00.000Z',
          },
          {
            id: 'log-2',
            actorName: 'Trương Mỹ Lan',
            actingRole: 'TEACHER',
            action: 'UPDATE_MY_PROFILE',
            targetType: 'User',
            targetId: 'teacher-1',
            createdAt: '2026-11-13T10:05:00.000Z',
          },
        ];
        if (auditFetchCount >= 3) {
          baseLogs.unshift({
            id: 'log-3',
            actorName: 'Học Viên Mới',
            actingRole: 'STUDENT',
            action: 'UPDATE_MY_PROFILE',
            targetType: 'User',
            targetId: 'stu-new-99',
            createdAt: '2026-11-13T10:15:00.000Z',
          });
        }
        const items = action ? baseLogs.filter((l) => l.action === action) : baseLogs;
        await fulfillJson(route, { items, total: items.length, page: pageNum, limit: 20 });
        return true;
      }

      return false;
    });

    await page.goto('/superadmin/settings');
    await expect(
      page.getByRole('heading', { name: '1. Quản lý tài khoản Admin & Gán đa vai trò' }),
    ).toBeVisible();

    const usersSection = page.locator('section', {
      has: page.getByRole('heading', { name: '1. Quản lý tài khoản Admin & Gán đa vai trò' }),
    });
    await expect(usersSection.getByText('Trang 1 / 2')).toBeVisible();
    await usersSection.getByRole('button', { name: 'Trang sau' }).click();
    await expect(usersSection.getByText('Trang 2 / 2')).toBeVisible();
    await expect(usersSection.getByText('Trương Mỹ Lan')).toBeVisible();

    // Typing in search from page 2 debounces cleanly without an extra stale-search page=1 request
    const queriesBeforeSearch = userQueries.length;
    await usersSection.getByLabel('Tìm kiếm tài khoản').fill('lan');
    await expect(usersSection.getByText('Trang 1 / 1')).toBeVisible();
    await expect(usersSection.getByText('teacher.lan@webedu.vn')).toBeVisible();
    expect(userQueries.slice(queriesBeforeSearch)).toEqual([
      { search: 'lan', role: null, status: null, page: '1' },
    ]);
    await usersSection.getByLabel('Tìm kiếm tài khoản').fill('');
    await expect(usersSection.getByText('Trang 1 / 2')).toBeVisible();

    // Role + status + search filters reset page to 1 and query backend
    await usersSection.getByLabel('Lọc theo vai trò').selectOption('TEACHER');
    await expect(usersSection.getByText('Trang 1 / 1')).toBeVisible();
    await usersSection.getByLabel('Lọc theo trạng thái').selectOption('PENDING_CLASS');
    await expect(usersSection.getByText('teacher.hang@webedu.vn')).toBeVisible();
    await usersSection.getByLabel('Tìm kiếm tài khoản').fill('lan');
    await expect(usersSection.getByText('teacher.hang@webedu.vn')).toHaveCount(0);
    await expect(usersSection.getByText('teacher.lan@webedu.vn')).toBeVisible();

    await expect
      .poll(() => userQueries[userQueries.length - 1])
      .toEqual({
        search: 'lan',
        role: 'TEACHER',
        status: 'PENDING_CLASS',
        page: '1',
      });

    // Audit logs action filter + refresh
    const auditSection = page.locator('section', {
      has: page.getByRole('heading', { name: '3. Nhật ký hệ thống' }),
    });
    const auditBody = auditSection.locator('tbody');
    // Regression guard for phase2-browser-qa.spec.ts:425 (<option> labels must not contain raw enum codes)
    await expect(page.getByText('UPDATE_SYSTEM_CONFIG').first()).toBeVisible();
    await expect(auditBody.getByText('UPDATE_SYSTEM_CONFIG')).toBeVisible();
    await auditSection.getByLabel('Lọc theo hành động').selectOption('UPDATE_MY_PROFILE');
    await expect(auditBody.getByText('UPDATE_MY_PROFILE')).toBeVisible();
    await expect(page.getByText('UPDATE_SYSTEM_CONFIG')).toHaveCount(0);

    await auditSection.getByRole('button', { name: 'Làm mới' }).click();
    await expect(auditBody.getByText('Học Viên Mới')).toBeVisible();
    expect(auditQueries[auditQueries.length - 1]).toEqual({
      action: 'UPDATE_MY_PROFILE',
      page: '1',
    });

    await assertZeroSeriousAxeViolations(page, 'superadmin-settings');
    await assertNoHorizontalOverflow(page, 'superadmin-settings');
    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('7.3 Attendance Matrix renders "Đã sửa" indicator & SessionAttendanceModal blocks partial save until 100% marked', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const putPayloads: Array<Record<string, unknown>> = [];

    const adminUser: MockUser = {
      id: 'admin-1',
      email: 'admin@webedu.vn',
      fullName: 'Quản Trị Viên',
      phone: '0900000002',
      roles: ['ADMIN'],
      effectiveRole: 'ADMIN',
      status: 'ACTIVE',
    };

    const classDetail = {
      id: 'cls-1',
      code: 'HSK1-K26-01',
      status: 'ACTIVE',
      courseId: 'crs-1',
      course: {
        id: 'crs-1',
        code: 'HSK1',
        name: 'Tiếng Trung HSK 1',
        level: 'HSK1',
        defaultSessions: 24,
      },
      teacherId: 'teacher-1',
      teacher: {
        id: 'teacher-1',
        fullName: 'Trương Mỹ Lan',
        email: 'teacher.lan@webedu.vn',
        phone: '0912345678',
      },
      scheduleDays: [2, 5],
      scheduleStartTime: '18:30',
      scheduleEndTime: '20:30',
      scheduleText: 'T3, T6 · 18:30–20:30',
      startDate: '2026-10-01',
      totalSessions: 24,
      completedSessionsCount: 1,
      expectedEndDate: '2026-12-25',
      actualEndDate: null,
      closedReason: null,
      closedAt: null,
      notes: null,
      activeStudentsCount: 2,
      totalEnrollmentsCount: 2,
      accessMode: 'FULL',
      effectiveRole: 'ADMIN',
      capabilities: {
        canEditClass: true,
        canManageEnrollments: true,
        canComplete: true,
        canReopen: false,
      },
      enrollments: [
        {
          id: 'enr-1',
          studentId: 'sv-1',
          studentFullName: 'Phạm Gia Huy',
          studentEmail: 'huy@webedu.vn',
          studentPhone: '0901111111',
          status: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          reason: null,
        },
        {
          id: 'enr-2',
          studentId: 'sv-2',
          studentFullName: 'Lê Bảo Ngọc',
          studentEmail: 'ngoc@webedu.vn',
          studentPhone: '0902222222',
          status: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          reason: null,
        },
      ],
      teacherHistory: [],
    };

    const matrix = {
      classId: 'cls-1',
      classCode: 'HSK1-K26-01',
      courseName: 'Tiếng Trung HSK 1',
      totalSessionsTarget: 24,
      editedRecordKeys: ['sv-1:ses-1'],
      sessions: [
        {
          id: 'ses-1',
          sessionNumber: 1,
          sessionDate: '2026-11-10',
          weekdayLabel: 'Thứ Ba',
          startTime: '18:30',
          endTime: '20:30',
          status: 'COMPLETED',
          displayStatus: 'COMPLETED',
          isMakeup: false,
          isRescheduled: false,
        },
        {
          id: 'ses-2',
          sessionNumber: 2,
          sessionDate: '2026-11-13',
          weekdayLabel: 'Thứ Sáu',
          startTime: '18:30',
          endTime: '20:30',
          status: 'SCHEDULED',
          displayStatus: 'TODAY',
          isMakeup: false,
          isRescheduled: false,
        },
      ],
      students: [
        {
          studentId: 'sv-1',
          fullName: 'Phạm Gia Huy',
          email: 'huy@webedu.vn',
          enrollmentStatus: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          metrics: {
            presentCount: 1,
            absentCount: 0,
            excusedCount: 0,
            totalAbsenceCount: 0,
            markedSessionsCount: 1,
            attendanceRatePercent: 100,
            absenceRateOfTotalPercent: 0,
            isAt30PercentWarning: false,
          },
          recordsBySessionId: { 'ses-1': 'PRESENT', 'ses-2': null },
        },
        {
          studentId: 'sv-2',
          fullName: 'Lê Bảo Ngọc',
          email: 'ngoc@webedu.vn',
          enrollmentStatus: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          metrics: {
            presentCount: 1,
            absentCount: 0,
            excusedCount: 0,
            totalAbsenceCount: 0,
            markedSessionsCount: 1,
            attendanceRatePercent: 100,
            absenceRateOfTotalPercent: 0,
            isAt30PercentWarning: false,
          },
          recordsBySessionId: { 'ses-1': 'PRESENT', 'ses-2': null },
        },
      ],
    };

    const sheet2 = {
      session: {
        id: 'ses-2',
        classId: 'cls-1',
        classCode: 'HSK1-K26-01',
        courseName: 'Tiếng Trung HSK 1',
        teacherName: 'Trương Mỹ Lan',
        sessionNumber: 2,
        type: 'MAIN',
        sessionDate: '2026-11-13',
        weekdayLabel: 'Thứ Sáu',
        startTime: '18:30',
        endTime: '20:30',
        status: 'SCHEDULED',
        displayStatus: 'TODAY',
        isMarked: false,
        canMarkAttendance: true,
        canEditAttendance: true,
        isWithinTeacherWindow: true,
        teacherEditDeadline: '15/11/2026 23:59',
        requiresEditReason: false,
        willBeAdminOverride: false,
      },
      summary: {
        totalStudents: 2,
        presentCount: 0,
        absentCount: 0,
        excusedCount: 0,
        unmarkedCount: 2,
      },
      roster: [
        {
          studentId: 'sv-1',
          fullName: 'Phạm Gia Huy',
          email: 'huy@webedu.vn',
          phone: '0901111111',
          enrollmentStatus: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          status: null,
          note: null,
          markedByName: null,
          updatedAt: null,
        },
        {
          studentId: 'sv-2',
          fullName: 'Lê Bảo Ngọc',
          email: 'ngoc@webedu.vn',
          phone: '0902222222',
          enrollmentStatus: 'ACTIVE',
          enrolledDate: '2026-10-01',
          leftDate: null,
          status: null,
          note: null,
          markedByName: null,
          updatedAt: null,
        },
      ],
      auditLogs: [],
    };

    await setupCommonApiMocks(page, adminUser, baseURL, async (route, pathname, method) => {
      if (pathname.endsWith('/classes/cls-1') && method === 'GET') {
        await fulfillJson(route, classDetail);
        return true;
      }
      if (pathname.endsWith('/classes/cls-1/attendance/matrix') && method === 'GET') {
        await fulfillJson(route, matrix);
        return true;
      }
      if (pathname.endsWith('/sessions/ses-2/attendance') && method === 'GET') {
        await fulfillJson(route, sheet2);
        return true;
      }
      if (pathname.endsWith('/sessions/ses-2/attendance') && method === 'PUT') {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        putPayloads.push(body);
        await fulfillJson(route, {
          ...sheet2,
          session: { ...sheet2.session, isMarked: true, requiresEditReason: true },
        });
        return true;
      }
      return false;
    });

    await page.goto('/admin/classes/cls-1');
    await page.getByRole('tab', { name: 'Điểm danh' }).click();

    const huyRow = page.locator('tbody tr', { hasText: 'Phạm Gia Huy' });
    await expect(huyRow).toBeVisible();
    await expect(huyRow.getByText('✓', { exact: true })).toBeVisible();
    const editedCell = huyRow.locator('td[data-edited="true"]');
    await expect(editedCell).toHaveCount(1);
    await expect(editedCell.getByText('Đã sửa')).toBeVisible();
    await expect(editedCell.locator('.mk[title="Có mặt (Đã sửa)"]')).toBeVisible();

    const ngocRow = page.locator('tbody tr', { hasText: 'Lê Bảo Ngọc' });
    await expect(ngocRow.locator('td[data-edited="true"]')).toHaveCount(0);

    await assertZeroSeriousAxeViolations(page, 'attendance-matrix-edited-badge');
    await assertNoHorizontalOverflow(page, 'attendance-matrix-edited-badge');

    // Open B2 attendance modal -> partial marking keeps save disabled with inline warning
    await page.getByRole('button', { name: /B2/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const saveBtn = dialog.getByRole('button', { name: 'Lưu điểm danh' });
    await expect(saveBtn).toBeDisabled();
    await expect(
      dialog.getByText(
        'Vui lòng điểm danh đầy đủ 100% học viên (còn 2 học viên chưa chọn trạng thái) trước khi lưu.',
      ),
    ).toBeVisible();

    // Mark only Phạm Gia Huy -> still disabled (1 remaining)
    await dialog
      .getByRole('group', { name: 'Trạng thái của Phạm Gia Huy' })
      .getByRole('button', { name: 'Có mặt', exact: true })
      .click();
    await expect(saveBtn).toBeDisabled();
    await expect(
      dialog.getByText(
        'Vui lòng điểm danh đầy đủ 100% học viên (còn 1 học viên chưa chọn trạng thái) trước khi lưu.',
      ),
    ).toBeVisible();
    expect(putPayloads).toHaveLength(0);

    await assertZeroSeriousAxeViolations(page, 'session-attendance-modal-guard');

    // Mark Lê Bảo Ngọc -> warning gone, Save enabled, PUT succeeds
    await dialog
      .getByRole('group', { name: 'Trạng thái của Lê Bảo Ngọc' })
      .getByRole('button', { name: 'Vắng', exact: true })
      .click();
    await expect(saveBtn).toBeEnabled();
    await expect(dialog.getByText(/Vui lòng điểm danh đầy đủ 100% học viên/)).toHaveCount(0);

    await saveBtn.click();
    await expect(dialog).toHaveCount(0);
    expect(putPayloads).toHaveLength(1);
    expect(putPayloads[0]?.records).toEqual([
      { studentId: 'sv-1', status: 'PRESENT', note: undefined },
      { studentId: 'sv-2', status: 'ABSENT', note: undefined },
    ]);

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
