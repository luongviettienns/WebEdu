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

test.describe('Phase 3 Browser QA — Courses, Classes, Enrollments, Multi-Role RBAC & A11y', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('P3-E2E-1: HSK Courses CRUD, filter-empty clear, deactivate ConfirmDialog & reactivate', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/courses');
    await expect(page.getByRole('heading', { name: 'Quản lý danh mục khóa học HSK' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'HSK1' })).toBeVisible();

    // 1. Create new course via BaseDialog modal
    await page.getByRole('button', { name: '+ Thêm khóa học' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog).toBeVisible();
    await createDialog.locator('#course-code').fill('HSK3-QA');
    await createDialog.locator('#course-level').selectOption('HSK3');
    await createDialog.locator('#course-name').fill('Tiếng Trung HSK 3 — QA 汉语水平考试三级');
    await createDialog.locator('#course-sessions').fill('30');
    await createDialog.getByRole('button', { name: 'Lưu khóa học' }).click();

    await expect(createDialog).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Đã thêm khóa học HSK3-QA');
    await expect(page.locator('tr', { hasText: 'HSK3-QA' })).toContainText('30 buổi');

    // 2. Edit course -> 32 sessions
    await page.locator('tr', { hasText: 'HSK3-QA' }).getByRole('button', { name: 'Chỉnh sửa' }).click();
    const editDialog = page.getByRole('dialog');
    await editDialog.locator('#course-sessions').fill('32');
    await editDialog.getByRole('button', { name: 'Lưu khóa học' }).click();
    await expect(editDialog).toHaveCount(0);
    await expect(page.locator('tr', { hasText: 'HSK3-QA' })).toContainText('32 buổi');

    // 3. Filter-empty state -> "Xóa bộ lọc" restores list
    await page.getByLabel('Tìm kiếm khóa học').fill('KHONG_TON_TAI_XYZ');
    await expect(page.getByText('Không tìm thấy khóa học nào phù hợp với bộ lọc.')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(page.locator('tr', { hasText: 'HSK3-QA' })).toBeVisible();

    // 4. Deactivate requires ConfirmDialog, then Reactivate succeeds
    await page.locator('tr', { hasText: 'HSK3-QA' }).getByRole('button', { name: 'Ngừng sử dụng' }).click();
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toContainText('Ngừng sử dụng khóa học HSK3-QA?');
    await confirmDialog.getByRole('button', { name: 'Xác nhận ngừng sử dụng' }).click();
    await expect(confirmDialog).toHaveCount(0);
    await expect(page.locator('tr', { hasText: 'HSK3-QA' })).toContainText('Ngừng sử dụng');

    await page.locator('tr', { hasText: 'HSK3-QA' }).getByRole('button', { name: 'Kích hoạt lại' }).click();
    await expect(page.locator('tr', { hasText: 'HSK3-QA' })).toContainText('Đang sử dụng');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P3-E2E-2: Class creation (no auto-selected teacher), teacher search, date-range conflict check & future reassignment guard', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/classes');
    await expect(page.getByRole('heading', { name: /Quản Lý Lớp Học/i })).toBeVisible();

    // 1. Open create dialog: NO teacher is auto-selected; submitting empty form fails validation
    await page.getByRole('button', { name: '+ Mở lớp học mới' }).click();
    const dialog = page.getByRole('dialog');
    const teacherPicker = dialog.getByTestId('teacher-picker');
    await expect(teacherPicker.locator('label', { hasText: 'Trương Mỹ Lan' })).toBeVisible();
    await expect(teacherPicker.locator('input[type="radio"]:checked')).toHaveCount(0);
    await expect(teacherPicker.getByText(/^Đã chọn:/)).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Tạo lớp học' }).click();
    await expect(dialog.getByRole('alert')).toBeVisible();

    // 2. Create HSK1-QA-01 assigned to Trương Mỹ Lan (T2-T4-T6 18:30-20:00, start 2026-10-05)
    await dialog.locator('#class-code').fill('HSK1-QA-01');
    const hsk1Value = await dialog
      .locator('#class-course option', { hasText: /^HSK1\b/ })
      .first()
      .getAttribute('value');
    expect(hsk1Value).toBeTruthy();
    await dialog.locator('#class-course').selectOption(hsk1Value!);
    await dialog.getByRole('button', { name: 'T2 - T4 - T6' }).click();
    await dialog.locator('#class-start-time').fill('18:30');
    await dialog.locator('#class-end-time').fill('20:00');
    await dialog.locator('#class-start-date').fill('2026-10-05');
    await dialog.locator('#class-total-sessions').fill('24');
    await expect(dialog.getByTestId('expected-end-date')).not.toHaveText('Chưa đủ dữ liệu');
    await dialog.locator('#class-status').selectOption('ACTIVE');

    await teacherPicker.getByPlaceholder(/Tìm giáo viên/i).fill('Quốc Tuấn');
    await teacherPicker.locator('label', { hasText: 'Vương Quốc Tuấn' }).locator('input[type="radio"]').check();
    await expect(teacherPicker).toContainText('Đã chọn: Vương Quốc Tuấn');

    await dialog.getByRole('button', { name: 'Tạo lớp học' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('tr', { hasText: 'HSK1-QA-01' })).toBeVisible();

    // 3. Create overlapping HSK1-QA-02 for Vương Quốc Tuấn in same period -> shows scheduleConflictWarning
    await page.getByRole('button', { name: '+ Mở lớp học mới' }).click();
    const overlapDialog = page.getByRole('dialog');
    await overlapDialog.locator('#class-code').fill('HSK1-QA-02');
    await overlapDialog.locator('#class-course').selectOption(hsk1Value!);
    await overlapDialog.getByRole('button', { name: 'T2 - T4 - T6' }).click();
    await overlapDialog.locator('#class-start-time').fill('19:00');
    await overlapDialog.locator('#class-end-time').fill('20:30');
    await overlapDialog.locator('#class-start-date').fill('2026-10-12');
    await overlapDialog.locator('#class-total-sessions').fill('24');
    await overlapDialog.locator('#class-status').selectOption('ACTIVE');
    await overlapDialog
      .getByTestId('teacher-picker')
      .locator('label', { hasText: 'Vương Quốc Tuấn' })
      .locator('input[type="radio"]')
      .check();
    await overlapDialog.getByRole('button', { name: 'Tạo lớp học' }).click();
    await expect(overlapDialog).toHaveCount(0);
    await expect(page.getByTestId('schedule-warning-banner')).toContainText('HSK1-QA-01');

    // 4. Create future non-overlapping HSK1-QA-FUT starting 2027-06-01 (same days/hours, distinct period) -> NO warning
    await page.getByRole('button', { name: '+ Mở lớp học mới' }).click();
    const futureDialog = page.getByRole('dialog');
    await futureDialog.locator('#class-code').fill('HSK1-QA-FUT');
    await futureDialog.locator('#class-course').selectOption(hsk1Value!);
    await futureDialog.getByRole('button', { name: 'T2 - T4 - T6' }).click();
    await futureDialog.locator('#class-start-time').fill('19:00');
    await futureDialog.locator('#class-end-time').fill('20:30');
    await futureDialog.locator('#class-start-date').fill('2027-06-01');
    await futureDialog.locator('#class-total-sessions').fill('24');
    await futureDialog.locator('#class-status').selectOption('UPCOMING');
    await futureDialog
      .getByTestId('teacher-picker')
      .locator('label', { hasText: 'Vương Quốc Tuấn' })
      .locator('input[type="radio"]')
      .check();
    await futureDialog.getByRole('button', { name: 'Tạo lớp học' }).click();
    await expect(futureDialog).toHaveCount(0);
    await expect(page.locator('tr', { hasText: 'HSK1-QA-FUT' })).toBeVisible();
    await expect(page.getByTestId('schedule-warning-banner')).toHaveCount(0);

    // 5. Reassign HSK1-QA-01 teacher to Trương Mỹ Lan -> block future date, allow today, update history
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK1-QA-01' }).click();
    await expect(page.getByRole('heading', { name: 'HSK1-QA-01' })).toBeVisible();

    await page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' }).click();
    const editDialog = page.getByRole('dialog');
    const editTeacherPicker = editDialog.getByTestId('teacher-picker');
    await editTeacherPicker.getByPlaceholder(/Tìm giáo viên/i).fill('Mỹ Lan');
    await editTeacherPicker.locator('label', { hasText: 'Trương Mỹ Lan' }).locator('input[type="radio"]').check();

    await editDialog.locator('#teacher-assigned-from').fill('2099-01-01');
    await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(editDialog.getByRole('alert')).toContainText('tương lai');

    await editDialog.locator('#teacher-assigned-from').fill('2026-11-11');
    await editDialog.locator('#teacher-change-reason').fill('Bàn giao ca tối sang cô Lan');
    await editDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(editDialog).toHaveCount(0);

    await expect(page.getByTestId('teacher-history')).toContainText('Vương Quốc Tuấn');
    await expect(page.getByTestId('teacher-history')).toContainText('Trương Mỹ Lan');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P3-E2E-3: Enrollment search, awaiting-start vs active status, transfer/drop future-date blocks & complete + reopen restored count', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/classes');

    // 1. Open upcoming class HSK1-K26-01 (starts 2026-11-20 > today 2026-11-11)
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK1-K26-01' }).click();
    await expect(page.getByRole('heading', { name: 'HSK1-K26-01' })).toBeVisible();

    await page.getByRole('button', { name: '+ Thêm học viên vào lớp' }).click();
    const enrollUpcomingDialog = page.getByRole('dialog');
    await enrollUpcomingDialog.locator('#enroll-search').fill('Minh Châu');
    await enrollUpcomingDialog
      .locator('label', { hasText: 'Lê Minh Châu' })
      .locator('input[type="checkbox"]')
      .check();
    // P1-2: Future enrolledDate must be rejected on client & server
    await enrollUpcomingDialog.locator('#enroll-date').fill('2099-01-01');
    await enrollUpcomingDialog.getByRole('button', { name: 'Thêm vào lớp (1)' }).click();
    await expect(enrollUpcomingDialog.getByRole('alert')).toContainText('tương lai');

    const todayVnIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
    await enrollUpcomingDialog.locator('#enroll-date').fill(todayVnIso);
    await enrollUpcomingDialog.getByRole('button', { name: 'Thêm vào lớp (1)' }).click();
    await expect(enrollUpcomingDialog).toHaveCount(0);

    // Must render "Đã xếp lớp – Chờ khai giảng" instead of "Đang học"
    await expect(page.locator('[data-enrollment-status="AWAITING_START"]')).toContainText(
      'Đã xếp lớp – Chờ khai giảng',
    );
    await expect(page.getByTestId('class-headcount')).toContainText('1 học viên đã xếp lớp (chờ khai giảng)');

    // 2. Open active class HSK2-K26-01 (already started 2026-10-01, already has Phạm Gia Huy)
    await page.goto('/admin/classes');
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK2-K26-01' }).click();
    await expect(page.getByRole('heading', { name: 'HSK2-K26-01' })).toBeVisible();

    await page.getByRole('button', { name: '+ Thêm học viên vào lớp' }).click();
    const enrollActiveDialog = page.getByRole('dialog');
    await enrollActiveDialog.locator('#enroll-search').fill('Bảo Ngọc');
    await enrollActiveDialog
      .locator('label', { hasText: 'Trần Bảo Ngọc' })
      .locator('input[type="checkbox"]')
      .check();
    await enrollActiveDialog.getByRole('button', { name: 'Thêm vào lớp (1)' }).click();
    await expect(enrollActiveDialog).toHaveCount(0);

    await expect(page.locator('tr[data-enrollment-status="ACTIVE"]', { hasText: 'Trần Bảo Ngọc' })).toContainText(
      'Đang học',
    );
    await expect(page.getByTestId('class-headcount')).toContainText('2 học viên đang học');

    // 3. Transfer Trần Bảo Ngọc -> HSK1-K26-01: future transferDate rejected, valid transfer succeeds
    await page.getByRole('button', { name: 'Chuyển lớp cho Trần Bảo Ngọc (陈宝玉)' }).click();
    const transferDialog = page.getByRole('dialog');
    const targetPicker = transferDialog.getByTestId('transfer-target-picker');
    await targetPicker.getByPlaceholder(/Tìm lớp/i).fill('HSK1-K26-01');
    await targetPicker.locator('label', { hasText: 'HSK1-K26-01' }).locator('input[type="radio"]').check();
    await transferDialog.locator('#transfer-date').fill('2099-01-01');
    await transferDialog.getByRole('button', { name: 'Xác nhận chuyển lớp' }).click();
    await expect(transferDialog.getByRole('alert')).toContainText('tương lai');

    await transferDialog.locator('#transfer-date').fill('2026-11-11');
    await transferDialog.locator('#transfer-reason').fill('Chuyển về lớp HSK1 theo trình độ');
    await transferDialog.getByRole('button', { name: 'Xác nhận chuyển lớp' }).click();
    await expect(transferDialog).toHaveCount(0);
    await expect(page.getByTestId('class-headcount')).toContainText('1 học viên đang học');

    // 4. Complete HSK2-K26-01 (with Phạm Gia Huy ACTIVE) -> READ_ONLY, then Reopen via ConfirmDialog -> reports 1 restored student
    await page.getByRole('button', { name: 'Kết thúc lớp học' }).click();
    const completeDialog = page.getByRole('dialog');
    await completeDialog.locator('#complete-actual-end-date').fill('2099-01-01');
    await completeDialog.getByRole('button', { name: 'Xác nhận kết thúc lớp' }).click();
    await expect(completeDialog.getByRole('alert')).toContainText('tương lai');

    await completeDialog.locator('#complete-actual-end-date').fill('2026-11-10');
    await completeDialog.getByRole('button', { name: 'Xác nhận kết thúc lớp' }).click();
    await expect(completeDialog).toHaveCount(0);
    await expect(page.getByText('印 · CHỈ ĐỌC (READ_ONLY)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Mở lại lớp học (trong 7 ngày)' }).click();
    const reopenDialog = page.getByRole('dialog');
    await expect(reopenDialog).toContainText('Mở lại lớp HSK2-K26-01?');
    await reopenDialog.getByRole('button', { name: 'Xác nhận mở lại lớp' }).click();
    await expect(reopenDialog).toHaveCount(0);
    await expect(page.getByRole('status').first()).toContainText('Đã mở lại lớp học HSK2-K26-01: khôi phục 1 học viên');
    await expect(page.getByTestId('class-headcount')).toContainText('1 học viên đang học');

    // 5. Drop student from HSK1-K26-01: future leftDate rejected, valid drop sets DROPPED
    await page.goto('/admin/classes');
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK1-K26-01' }).click();
    await page.getByRole('button', { name: 'Rút Trần Bảo Ngọc (陈宝玉) khỏi lớp' }).click();
    const dropDialog = page.getByRole('dialog');
    await dropDialog.locator('#drop-left-date').fill('2099-01-01');
    await dropDialog.getByRole('button', { name: 'Xác nhận rút khỏi lớp' }).click();
    await expect(dropDialog.getByRole('alert')).toContainText('tương lai');

    await dropDialog.locator('#drop-left-date').fill('2026-11-11');
    await dropDialog.locator('#drop-reason').fill('Tạm dừng lịch học');
    await dropDialog.getByRole('button', { name: 'Xác nhận rút khỏi lớp' }).click();
    await expect(dropDialog).toHaveCount(0);
    await expect(page.locator('tr[data-enrollment-status="DROPPED"]', { hasText: 'Trần Bảo Ngọc' })).toContainText(
      'Tạm nghỉ / Rút lớp',
    );

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P3-E2E-4: RBAC & Multi-Role permissions (TEACHER, SUPERADMIN, [ADMIN, TEACHER]) and filter-independent teacher count', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    // 1. TEACHER-only: responsible-class-count stays 2 even when filtered; read-only detail; /admin/classes denied
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await expect(page).toHaveURL(/\/teacher\/classes/);
    await expect(page.getByTestId('responsible-class-count')).toHaveText('2');
    await expect(page.getByTestId('class-total')).toHaveText('Tổng: 2 lớp học');

    await page.getByLabel('Tìm kiếm lớp học').fill('HSK2');
    await expect(page.getByTestId('class-total')).toHaveText('Tổng: 1 lớp học');
    await expect(page.getByTestId('responsible-class-count')).toHaveText('2');

    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK2-K26-01' }).click();
    await expect(page.getByRole('heading', { name: 'HSK2-K26-01' })).toBeVisible();
    await expect(page.getByText('印 · CHỈ ĐỌC (READ_ONLY)')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '+ Thêm học viên vào lớp' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kết thúc lớp học' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Mở lại lớp học (trong 7 ngày)' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Chuyển lớp / })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Rút / })).toHaveCount(0);

    await page.goto('/admin/classes');
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible();

    // 2. Pure SUPERADMIN: denied on /admin/courses and /admin/classes + 403 on classes API
    await loginThroughUi(page, 'superadmin@webedu.vn');
    await page.goto('/admin/courses');
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible();
    await page.goto('/admin/classes');
    await expect(page.getByRole('heading', { name: 'Bạn không có quyền truy cập trang này' })).toBeVisible();

    const apiCtx = await playwrightRequest.newContext({
      baseURL: `${API_BASE_URL.replace(/\/$/, '')}/`,
      extraHTTPHeaders: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    try {
      const saLoginRes = await apiCtx.post('auth/login', {
        data: { email: 'superadmin@webedu.vn', password: 'Password@123' },
      });
      expect(saLoginRes.ok()).toBeTruthy();

      const blockedClassesRes = await apiCtx.get('classes');
      expect(blockedClassesRes.status()).toBe(403);

      // Promote teacher.lan -> dual-role ['ADMIN', 'TEACHER'] and seed a class owned by teacher.idle
      const usersRes = await apiCtx.get('system-settings/users?search=teacher.lan@webedu.vn');
      expect(usersRes.ok()).toBeTruthy();
      const usersJson = (await usersRes.json()) as { items: Array<{ id: string; email: string }> };
      const lanUser = usersJson.items.find((u) => u.email === 'teacher.lan@webedu.vn');
      expect(lanUser).toBeTruthy();

      const updateRoleRes = await apiCtx.patch(`system-settings/users/${lanUser!.id}/roles`, {
        data: { roles: ['ADMIN', 'TEACHER'], status: 'ACTIVE' },
      });
      expect(updateRoleRes.ok()).toBeTruthy();
    } finally {
      await apiCtx.dispose();
    }

    // 3. Re-login as dual-role [ADMIN, TEACHER]: /teacher/classes keeps own scope (count=2),
    // while /teacher/classes/:id & /admin/classes grant ADMIN write capabilities regardless of URL
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/admin/classes');
    await expect(page.getByRole('button', { name: '+ Mở lớp học mới' })).toBeVisible();

    await page.getByRole('button', { name: '+ Mở lớp học mới' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.locator('#class-code').fill('HSK1-IDLE-01');
    const hsk1Val = await dialog.locator('#class-course option', { hasText: /^HSK1\b/ }).first().getAttribute('value');
    await dialog.locator('#class-course').selectOption(hsk1Val!);
    await dialog.getByRole('button', { name: 'T3 - T5 - T7' }).click();
    await dialog.locator('#class-start-time').fill('18:00');
    await dialog.locator('#class-end-time').fill('19:30');
    await dialog.locator('#class-start-date').fill('2026-10-10');
    await dialog.locator('#class-total-sessions').fill('20');
    await dialog
      .getByTestId('teacher-picker')
      .locator('label', { hasText: 'Vương Quốc Tuấn' })
      .locator('input[type="radio"]')
      .check();
    await dialog.getByRole('button', { name: 'Tạo lớp học' }).click();
    await expect(dialog).toHaveCount(0);

    // On /teacher/classes: count stays 2 (her own classes, NOT 3) & "Quản lý toàn bộ lớp học" link appears
    await page.goto('/teacher/classes');
    await expect(page.getByTestId('responsible-class-count')).toHaveText('2');
    await expect(page.getByRole('link', { name: 'Quản lý toàn bộ lớp học' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'HSK1-IDLE-01' })).toHaveCount(0);

    // On /teacher/classes/:id for HER class: effectiveRole is ADMIN (not locked to READ_ONLY by URL!)
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK2-K26-01' }).click();
    await expect(page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' })).toBeVisible();
    await expect(page.getByRole('button', { name: '+ Thêm học viên vào lớp' })).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('P3-E2E-5: Load error + retry, stale data retention on refresh error, modal focus trap/Escape, responsive viewports & Axe WCAG', async ({
    page,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/classes');
    await expect(page.locator('tr', { hasText: 'HSK2-K26-01' })).toBeVisible();

    // 1. Refresh error keeps previously loaded table rows and shows stale banner + Retry button
    let failClassesApi = true;
    await page.route('**/api/v1/classes?**', async (route) => {
      if (failClassesApi) {
        await route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({ detail: 'Máy chủ tạm thời gián đoạn khi làm mới lớp' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel('Lọc theo trạng thái lớp').selectOption('ACTIVE');
    const errorAlert = page.getByTestId('list-error-banner');
    await expect(errorAlert).toContainText('đang hiển thị dữ liệu đã tải trước đó');
    await expect(page.locator('tr', { hasText: 'HSK2-K26-01' })).toBeVisible();

    failClassesApi = false;
    await errorAlert.getByRole('button', { name: 'Thử lại' }).click();
    await expect(errorAlert).toHaveCount(0);
    await expect(page.locator('tr', { hasText: 'HSK2-K26-01' })).toBeVisible();
    await expect(page.locator('tr', { hasText: 'HSK1-K26-01' })).toHaveCount(0);
    await page.unroute('**/api/v1/classes?**');

    // Clear filter before testing empty filter later
    await page.getByLabel('Lọc theo trạng thái lớp').selectOption('');

    // 2. Teacher & Course error in ClassFormModal + Retry button + Keyboard Focus Trap + Escape
    let failTeachersApi = true;
    await page.route('**/api/v1/teachers?**', async (route) => {
      if (failTeachersApi) {
        await route.fulfill({
          status: 500,
          contentType: 'application/problem+json',
          body: JSON.stringify({ detail: 'Lỗi tải danh sách giáo viên' }),
        });
      } else {
        await route.continue();
      }
    });

    const openBtn = page.getByRole('button', { name: '+ Mở lớp học mới' });
    await openBtn.focus();
    await page.keyboard.press('Enter');

    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
    await expect(modal.getByTestId('teacher-picker').getByRole('alert')).toContainText('Lỗi tải danh sách giáo viên');

    failTeachersApi = false;
    await modal.getByTestId('teacher-picker').getByRole('button', { name: 'Thử lại' }).click();
    await expect(modal.getByTestId('teacher-picker').locator('label', { hasText: 'Trương Mỹ Lan' })).toBeVisible();
    await page.unroute('**/api/v1/teachers?**');

    // P1-1: Aborting in-flight loadMore on search change must clear loadingMore & reset cleanly
    let releasePage2!: () => void;
    const page2Hold = new Promise<void>((resolve) => {
      releasePage2 = resolve;
    });
    await page.route('**/api/v1/teachers?**', async (route) => {
      const url = new URL(route.request().url());
      const reqPage = url.searchParams.get('page');
      const reqSearch = url.searchParams.get('search') ?? '';
      if (reqPage === '2') {
        await page2Hold;
        try {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ items: [], total: 25 }),
          });
        } catch {
          // Request aborted cleanly when user changed search query
        }
        return;
      }
      if (reqSearch === 'abctest') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: Array.from({ length: 10 }, (_, idx) => ({
              id: `t-p1-${idx}`,
              fullName: `GV Test ${idx + 1}`,
              email: `gv${idx + 1}@webedu.vn`,
              activeClassesCount: 0,
            })),
            total: 25,
          }),
        });
        return;
      }
      if (reqSearch === 'abctest2') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: Array.from({ length: 10 }, (_, idx) => ({
              id: `t-p2-${idx}`,
              fullName: `GV Next ${idx + 1}`,
              email: `gvnext${idx + 1}@webedu.vn`,
              activeClassesCount: 0,
            })),
            total: 15,
          }),
        });
        return;
      }
      await route.continue();
    });

    const teacherPicker = modal.getByTestId('teacher-picker');
    const teacherSearchInput = teacherPicker.getByPlaceholder('Tìm giáo viên theo tên, email, SĐT...');
    await teacherSearchInput.fill('abctest');
    const loadMoreBtn = teacherPicker.getByRole('button', { name: 'Tải thêm' });
    await expect(loadMoreBtn).toBeVisible();
    await loadMoreBtn.click();
    await expect(teacherPicker.getByRole('button', { name: 'Đang tải...' })).toBeDisabled();

    await teacherSearchInput.fill('abctest2');
    releasePage2();
    await expect(teacherPicker.getByText('Đang hiển thị 10 / 15')).toBeVisible();
    const nextLoadMore = teacherPicker.getByRole('button', { name: 'Tải thêm' });
    await expect(nextLoadMore).toBeVisible();
    await expect(nextLoadMore).toBeEnabled();
    await page.unroute('**/api/v1/teachers?**');
    await teacherSearchInput.fill('');
    await expect(teacherPicker.locator('label', { hasText: 'Trương Mỹ Lan' })).toBeVisible();

    // Focus trap check: Shift+Tab from inside dialog wraps cleanly inside dialog
    const inModal = async () =>
      page.evaluate(() => {
        const dlg = document.querySelector('[role="dialog"]');
        return Boolean(dlg && dlg.contains(document.activeElement));
      });
    expect(await inModal()).toBe(true);
    await page.keyboard.press('Shift+Tab');
    expect(await inModal()).toBe(true);
    await page.keyboard.press('Tab');
    expect(await inModal()).toBe(true);

    // Axe check while modal is open
    await assertZeroSeriousAxeViolations(page, 'ClassFormModal open');

    // Escape closes modal and restores focus to trigger button
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    await expect(openBtn).toBeFocused();

    // 3. Responsive sweep across Desktop (1440), Tablet (768), Mobile (375) + Axe WCAG
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'tablet-768', width: 768, height: 1024 },
      { name: 'mobile-375', width: 375, height: 812 },
    ] as const;

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      await page.goto('/admin/courses');
      await expect(page.getByRole('heading', { name: 'Quản lý danh mục khóa học HSK' })).toBeVisible();
      await assertNoHorizontalOverflow(page, `/admin/courses @ ${vp.name}`);
      await assertZeroSeriousAxeViolations(page, `/admin/courses @ ${vp.name}`);

      await page.goto('/admin/classes');
      await expect(page.locator('tr', { hasText: 'HSK2-K26-01' })).toBeVisible();
      await assertNoHorizontalOverflow(page, `/admin/classes @ ${vp.name}`);
      await assertZeroSeriousAxeViolations(page, `/admin/classes @ ${vp.name}`);

      await page.getByRole('link', { name: 'Xem chi tiết lớp HSK2-K26-01' }).click();
      await expect(page.getByRole('heading', { name: 'HSK2-K26-01' })).toBeVisible();
      await assertNoHorizontalOverflow(page, `/admin/classes/[id] @ ${vp.name}`);
      await assertZeroSeriousAxeViolations(page, `/admin/classes/[id] @ ${vp.name}`);
    }

    // Teacher viewports + Axe
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/teacher/classes');
      await expect(page.getByRole('heading', { name: 'Lớp Học Phụ Trách' })).toBeVisible();
      await assertNoHorizontalOverflow(page, `/teacher/classes @ ${vp.name}`);
      await assertZeroSeriousAxeViolations(page, `/teacher/classes @ ${vp.name}`);
    }

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
