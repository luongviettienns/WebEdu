import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const INSPECTOR_URL = `http://127.0.0.1:${process.env.QA_MAIL_INSPECTOR_PORT || 4026}`;

function attachStrictGuards(page: Page): {
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

async function assertZeroSeriousAxeViolations(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`),
    `Axe serious/critical violations on ${label}`,
  ).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `Horizontal overflow on ${label}`).toBeLessThanOrEqual(2);
}

async function reseedQaDatabase(): Promise<void> {
  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.post(`${INSPECTOR_URL}/reseed`);
    expect(res.ok(), 'QA environment /reseed must succeed').toBeTruthy();
  } finally {
    await ctx.dispose();
  }
}

async function loginThroughUi(page: Page, email: string, password = 'Password@123'): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/Email đăng nhập/i).fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

test.describe('Phase 4 Browser QA — Schedules, Attendance, 30% Warning & Audit Logs', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('P4-E2E-1: Admin /admin/schedules calendar views, class schedule reschedule/cancel+makeup & /admin/schedule-logs', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/schedules');
    await expect(page.getByRole('heading', { name: /Lịch Học & Điểm Danh Toàn Trung Tâm/i })).toBeVisible();
    await expect(page.locator('.cal')).toBeVisible();

    await page.getByRole('button', { name: 'Tuần', exact: true }).click();
    await expect(page.locator('.cal')).toBeVisible();
    await page.getByRole('button', { name: 'Danh sách', exact: true }).click();
    await expect(page.locator('table')).toBeVisible();
    await page.getByRole('button', { name: 'Tháng', exact: true }).click();

    await assertZeroSeriousAxeViolations(page, 'admin-schedules');
    await assertNoHorizontalOverflow(page, 'admin-schedules');

    // Open HSK1-K26-01 class detail -> Lịch học tab
    await page.goto('/admin/classes');
    await page.locator('tr', { hasText: 'HSK1-K26-01' }).getByRole('link', { name: /Xem chi tiết lớp/i }).click();
    await page.getByRole('tab', { name: 'Lịch học' }).click();
    await expect(page.getByText('Tổng buổi khóa')).toBeVisible();
    const sessionsTable = page.getByTestId('class-sessions-table');
    await expect(sessionsTable.locator('tbody tr')).toHaveCount(24);

    // Reschedule session 1
    await sessionsTable.locator('tbody tr', { hasText: 'Buổi 1' }).first().getByRole('button', { name: 'Chi tiết' }).click();
    await page.getByRole('button', { name: 'Đổi lịch' }).click();
    await page.getByLabel(/Ngày học mới/i).fill('2026-11-21');
    await page.getByLabel(/Lý do đổi lịch/i).fill('GV bận công tác E2E');
    await page.getByRole('button', { name: 'Xác nhận đổi lịch' }).click();
    await expect(page.getByText('Đã đổi lịch buổi học thành công.')).toBeVisible();

    // Cancel session 2 with inline makeup session
    await sessionsTable.locator('tbody tr', { hasText: 'Buổi 2' }).first().getByRole('button', { name: 'Chi tiết' }).click();
    await page.getByRole('button', { name: 'Hủy buổi' }).click();
    await page.getByLabel(/Tạo buổi học bù ngay/i).check();
    await page.locator('#cancel-mk-date').fill('2026-12-03');
    await page.getByRole('button', { name: 'Xác nhận hủy buổi' }).click();
    await expect(page.getByText('Đã hủy buổi học thành công.')).toBeVisible();

    // Verify immutable change logs page
    await page.goto('/admin/schedule-logs');
    await expect(page.getByRole('heading', { name: /Lịch Sử Thay Đổi Lịch Học/i })).toBeVisible();
    const logsTable = page.locator('table');
    await expect(logsTable.getByText('Đổi lịch buổi').first()).toBeVisible();
    await expect(logsTable.getByText('Hủy buổi học').first()).toBeVisible();
    await expect(logsTable.getByText('Tạo buổi học bù').first()).toBeVisible();
    await assertZeroSeriousAxeViolations(page, 'admin-schedule-logs');
    await assertNoHorizontalOverflow(page, 'admin-schedule-logs');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P4-E2E-2: Teacher /teacher/schedules, 3-state attendance save + audit edit + matrix', async ({ page }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/teacher/schedules');
    await expect(page.getByRole('heading', { name: /Lịch Dạy & Điểm Danh Lớp Phụ Trách/i })).toBeVisible();
    await assertZeroSeriousAxeViolations(page, 'teacher-schedules');
    await assertNoHorizontalOverflow(page, 'teacher-schedules');

    // Open HSK2-K26-01 class detail -> Lịch học tab
    await page.goto('/teacher/classes');
    await page.locator('tr', { hasText: 'HSK2-K26-01' }).getByRole('link', { name: /Xem chi tiết lớp/i }).click();
    await page.getByRole('tab', { name: 'Lịch học' }).click();

    const sessionsTable = page.getByTestId('class-sessions-table');
    const markableRow = sessionsTable
      .locator('tbody tr', { has: page.getByRole('button', { name: 'Điểm danh' }) })
      .last();
    await expect(markableRow).toBeVisible();
    const sessionLabel = (await markableRow.locator('td').first().innerText()).trim();

    await markableRow.getByRole('button', { name: 'Điểm danh' }).click();
    await expect(page.getByRole('heading', { name: /Điểm danh HSK2-K26-01/i })).toBeVisible();

    await expect(page.getByText(/Hạn GV sửa:.*\d{2}\/\d{2}\/\d{4} \d{2}:\d{2} \(GMT\+7\)/)).toBeVisible();
    await page.getByRole('button', { name: 'Vắng', exact: true }).first().click();
    await page.getByLabel(/Ghi chú cho Phạm Gia Huy/i).fill('Vắng không báo');
    await page.getByRole('button', { name: 'Lưu điểm danh' }).click();
    await expect(page.getByText('Đã lưu điểm danh buổi học.')).toBeVisible();

    // Edit attendance with required reason -> verify audit history + no-op does not prompt for reason
    const savedRow = sessionsTable
      .locator('tbody tr')
      .filter({ has: page.locator('td').first().filter({ hasText: new RegExp(`^${sessionLabel}$`) }) })
      .first();
    await savedRow.getByRole('button', { name: 'Sửa ĐD' }).click();
    await expect(page.getByLabel(/Lý do chỉnh sửa điểm danh/i)).toHaveCount(0);
    await page.getByRole('button', { name: 'Có phép', exact: true }).first().click();
    await expect(page.getByLabel(/Lý do chỉnh sửa điểm danh/i)).toBeVisible();
    await page.getByLabel(/Lý do chỉnh sửa điểm danh/i).fill('Có đơn xin phép E2E');
    await page.getByRole('button', { name: 'Cập nhật điểm danh' }).click();
    await expect(page.getByText('Đã lưu điểm danh buổi học.')).toBeVisible();

    await savedRow.getByRole('button', { name: 'Sửa ĐD' }).click();
    await expect(page.getByText(/Lịch sử chỉnh sửa \(1\)/)).toBeVisible();
    await expect(page.locator('li', { hasText: /\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}.*Có đơn xin phép E2E/ })).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).last().click();

    // Check Matrix tab
    await page.getByRole('tab', { name: 'Điểm danh' }).click();
    await expect(page.getByText('Phạm Gia Huy')).toBeVisible();
    await expect(page.locator('tbody tr', { hasText: 'Phạm Gia Huy' }).getByText('P', { exact: true })).toBeVisible();
    await assertZeroSeriousAxeViolations(page, 'teacher-attendance-matrix');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P4-E2E-3: Student /student/schedule calendar, detail modal, >=30% absence warning & RBAC guard', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    // Admin marks 8 sessions (8/24 = 33% >= 30%) for Phạm Gia Huy to trigger DEC-033 warning
    await loginThroughUi(page, 'admin@webedu.vn');
    const classesRes = await page.request.get(`${API_BASE_URL}/classes?search=HSK2-K26-01`);
    expect(classesRes.ok()).toBeTruthy();
    const classesJson = (await classesRes.json()) as { items: Array<{ id: string }> };
    const hsk2Id = classesJson.items[0]!.id;

    const sessionsRes = await page.request.get(`${API_BASE_URL}/classes/${hsk2Id}/sessions`);
    expect(sessionsRes.ok()).toBeTruthy();
    const sessionsJson = (await sessionsRes.json()) as { sessions: Array<{ id: string }> };

    const sheet0Res = await page.request.get(`${API_BASE_URL}/sessions/${sessionsJson.sessions[0]!.id}/attendance`);
    expect(sheet0Res.ok()).toBeTruthy();
    const sheet0 = (await sheet0Res.json()) as { roster: Array<{ studentId: string }> };
    const studentId = sheet0.roster[0]!.studentId;

    const appOrigin = new URL(page.url()).origin;
    for (let i = 0; i < 8; i += 1) {
      const saveRes = await page.request.put(`${API_BASE_URL}/sessions/${sessionsJson.sessions[i]!.id}/attendance`, {
        headers: { Origin: appOrigin },
        data: {
          records: [
            {
              studentId,
              status: i === 0 ? 'EXCUSED' : 'ABSENT',
              note: i === 0 ? 'Xin nghỉ khám sức khỏe' : undefined,
            },
          ],
        },
      });
      expect(saveRes.ok(), `PUT attendance failed with ${saveRes.status()}`).toBeTruthy();
    }

    // Switch to Student account cleanly across desktop & mobile
    const logoutRes = await page.request.post(`${API_BASE_URL}/auth/logout`, {
      headers: { Origin: appOrigin },
    });
    expect(logoutRes.ok()).toBeTruthy();
    await loginThroughUi(page, 'active.student@webedu.vn');

    await page.goto('/student/schedule');
    await expect(page.getByRole('heading', { name: /Lịch Học & Chuyên Cần Cá Nhân/i })).toBeVisible();
    await expect(page.getByTestId('student-30pct-warning')).toBeVisible();
    await expect(page.getByText(/Vắng 7 · Phép 1/)).toBeVisible();
    await expect(page.locator('.cal.att')).toBeVisible();
    await expect(page.locator('.cal.att .dh').first()).toHaveText('T2');
    await expect(page.locator('.cal.att')).toHaveCSS('display', 'grid');

    // Navigate to Oct 2026 to click Buổi 1 (started 2026-10-01)
    await page.getByRole('button', { name: 'Tháng trước' }).click();
    const b1Pill = page.locator('.cal.att button', { hasText: 'B1' }).first();
    await expect(b1Pill).toBeVisible();
    await b1Pill.click();
    await expect(page.getByText('Chi tiết buổi học & Điểm danh')).toBeVisible();
    await expect(page.getByText('Xin nghỉ khám sức khỏe')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).last().click();

    await assertZeroSeriousAxeViolations(page, 'student-schedule');
    await assertNoHorizontalOverflow(page, 'student-schedule');

    // RBAC check: Student blocked on /admin/schedules
    await page.goto('/admin/schedules');
    await expect(page.getByText(/Không có quyền|Truy cập bị từ chối/i)).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
