import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const INSPECTOR_URL = `http://127.0.0.1:${process.env.QA_MAIL_INSPECTOR_PORT || 4026}`;
const MINI_TEST_PDF = resolve(__dirname, '../../Test/MINI_TEST_01 (2).pdf');
const MINIMAL_MP3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xfb, 0x90, 0x00, 0x00]);
const MINIMAL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function reseedQaDatabase(): Promise<void> {
  const ctx = await playwrightRequest.newContext();
  try {
    const res = await ctx.post(`${INSPECTOR_URL}/reseed`);
    expect(res.ok(), 'QA /reseed must succeed').toBeTruthy();
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

async function clickLogoutButton(page: Page, isMobile: boolean): Promise<void> {
  if (isMobile) {
    await page.getByRole('button', { name: 'Mở menu' }).click();
  }
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
}

test.describe('UI Browser Bugfixes Verification (M1-M9)', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test('M1 & M9-02: public auth landmarks/h1, SPA relogin logout enabled, live & reload idle_timeout, and Axe WCAG AA', async ({
    page,
  }, testInfo) => {
    const isMobile = testInfo.project.name.includes('mobile');

    for (const route of ['/login', '/register', '/forgot-password', '/reset-password']) {
      await page.goto(route);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveCount(1);
    }

    await loginThroughUi(page, 'active.student@webedu.vn');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(axe.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

    // BUG-M1-01: SPA logout then re-login on same tab must keep logout button enabled
    await clickLogoutButton(page, isMobile);
    await expect(page).toHaveURL(/\/login(?:\?|$)/);
    await loginThroughUi(page, 'active.student@webedu.vn');
    if (isMobile) await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeEnabled();
    if (isMobile) await page.getByRole('button', { name: 'Đóng menu' }).click();

    // BUG-M1-02 (Live -59m57s without reload)
    const userId = await page.evaluate(() => {
      const k = Object.keys(localStorage).find((item) => item.startsWith('webedu_last_activity_'));
      return k ? k.replace('webedu_last_activity_', '') : '';
    });
    expect(userId).not.toBe('');
    await page.evaluate((id) => {
      localStorage.setItem(`webedu_last_activity_${id}`, String(Date.now() - (59 * 60 + 57) * 1000));
    }, userId);
    await expect(page).toHaveURL(/\/login\?reason=idle_timeout/, { timeout: 10_000 });
    await expect(page.getByText(/60 phút không có hoạt động/i)).toBeVisible();

    // BUG-M1-02 (Reload with expired timestamp -> ?reason=idle_timeout preserved, not overwritten by child 401)
    await loginThroughUi(page, 'active.student@webedu.vn');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await Promise.all([
      page.waitForNavigation(),
      page.evaluate((id) => {
        localStorage.setItem(`webedu_last_activity_${id}`, String(Date.now() - 60 * 60 * 1000));
        window.location.reload();
      }, userId),
    ]);
    await expect(page).toHaveURL(/\/login\?reason=idle_timeout/, { timeout: 10_000 });
    await expect(page.getByText(/60 phút không có hoạt động/i)).toBeVisible();
  });

  test('M2 & M9-03: settings headings, AI provider preset switch, Cache-Control no-store & SPA brand sync with 0 429s', async ({
    browser,
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop workflow check (mobile shell tested in Test 1)');
    let rateLimited = 0;
    page.on('response', (res) => {
      if (res.status() === 429) rateLimited += 1;
    });

    await loginThroughUi(page, 'superadmin@webedu.vn');
    await page.goto('/superadmin/settings');
    await expect(page.getByRole('heading', { name: '3. Cấu hình AI Gợi ý Chấm Tự luận' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '4. Nhật ký hệ thống' })).toBeVisible();
    expect(await page.locator('body').innerText()).not.toContain('FUNC-057');

    // BUG-M2-02: switching CUSTOM -> GEMINI overwrites old custom URL & model cleanly
    await page.locator('#ai-cfg-provider').selectOption('CUSTOM');
    await page.locator('#ai-cfg-base-url').fill('https://modelapi.vn/v1');
    await page.locator('#ai-cfg-model').fill('gpt-5.6-luna');
    await page.locator('#ai-cfg-provider').selectOption('GEMINI');
    await expect(page.locator('#ai-cfg-base-url')).toHaveValue(
      'https://generativelanguage.googleapis.com/v1beta',
    );
    await expect(page.locator('#ai-cfg-model')).toHaveValue('gemini-3.5-flash-lite');

    // BUG-M2-03 & M9-03: multi-actor brand sync across SPA navigation and /login
    const studentCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const studentPage = await studentCtx.newPage();
    studentPage.on('response', (res) => {
      if (res.status() === 429) rateLimited += 1;
    });
    await loginThroughUi(studentPage, 'active.student@webedu.vn');

    await page.locator('#cfg-center-name').fill('Trung Tâm QA Đồng Bộ');
    await page.getByRole('button', { name: 'Lưu cấu hình hệ thống' }).click();
    await expect(page.getByText('Lưu cấu hình hệ thống thành công')).toBeVisible();

    const cfgRes = await studentPage.request.get(`${API_BASE_URL}/system-settings/config`);
    expect(cfgRes.headers()['cache-control']).toContain('no-store');

    await studentPage.waitForTimeout(600);
    await studentPage.getByRole('link', { name: 'Lịch học' }).first().click();
    await expect(studentPage.locator('header')).toContainText('Trung Tâm QA Đồng Bộ');

    await studentPage.goto('/login');
    await expect(studentPage).toHaveTitle(/Trung Tâm QA Đồng Bộ/);
    await studentCtx.close();
    expect(rateLimited).toBe(0);
  });

  test('M3, M4 & M5: teacher blocked modal count, superadmin 0 403s, session filters, attendance refresh & dropped schedule', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Desktop workflow check');
    const errors403: string[] = [];
    page.on('response', (res) => {
      if (res.status() === 403) errors403.push(res.url());
    });

    // BUG-M3-03 & BUG-M5-02: pure SUPERADMIN triggers 0 HTTP 403s on student modal & schedule-logs
    await loginThroughUi(page, 'superadmin@webedu.vn');
    await page.goto('/admin/students');
    await page.locator('tr', { hasText: 'active.student@webedu.vn' }).getByRole('button', { name: 'Chi tiết & Sửa' }).click();
    await expect(page.locator('#stu-status')).toHaveValue('ACTIVE');
    await expect(page.getByText('Chưa được xếp lớp')).toHaveCount(0);
    await page.getByRole('button', { name: 'Đóng' }).click();

    await page.goto('/admin/schedule-logs');
    await expect(page.getByRole('heading', { name: 'Lịch Sử Thay Đổi Lịch Học' })).toBeVisible();
    await expect(page.getByLabel('Lọc theo lớp học')).toHaveCount(0);
    expect(errors403).toEqual([]);

    // BUG-M3-01: BlockedTeacherDeactivationModal shows 2 lớp for teacher.lan
    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: new URL(page.url()).origin } });
    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/teachers');
    await page.locator('tr', { hasText: 'teacher.lan@webedu.vn' }).getByRole('button', { name: 'Vô hiệu hóa' }).click();
    await expect(page.getByRole('dialog')).toContainText('2 lớp');
    await page.getByRole('button', { name: 'Đã hiểu' }).click();

    // BUG-M5-01 & M5-03: ClassSessionsTab filters & ClassStudentsTable absence count refreshes without F5
    await page.goto('/admin/classes');
    await page.getByRole('link', { name: 'Xem chi tiết lớp HSK2-K26-01' }).click();
    await page.getByRole('tab', { name: 'Lịch học' }).click();
    await expect(page.locator('#class-session-status-filter')).toBeVisible();
    await expect(page.locator('#class-session-from-filter')).toBeVisible();
    await expect(page.locator('#class-session-to-filter')).toBeVisible();
    const sessionWithAttendance = page.locator('[data-testid="class-sessions-table"] tbody tr').filter({
      has: page.getByRole('button', { name: /Điểm danh|Sửa ĐD/ }),
    }).last();
    await sessionWithAttendance.getByRole('button', { name: /Điểm danh|Sửa ĐD/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Vắng', exact: true }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: /Lưu điểm danh|Cập nhật điểm danh/ }).click();
    await page.getByRole('tab', { name: 'Thông tin & Học viên' }).click();
    await expect(page.locator('tr', { hasText: 'active.student@webedu.vn' })).toContainText('1 buổi');

    // BUG-M4-01: Drop active.student from HSK2-K26-01 -> /student/schedule shows empty state
    await page.locator('tr', { hasText: 'active.student@webedu.vn' }).getByRole('button', { name: /Rút .* khỏi lớp/ }).click();
    await page.getByLabel(/Lý do/i).fill('Bảo lưu QA M4');
    await page.getByRole('button', { name: 'Xác nhận rút khỏi lớp' }).click();
    await expect(page.locator('tr', { hasText: 'active.student@webedu.vn' })).toContainText('Tạm nghỉ / Rút lớp');

    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: new URL(page.url()).origin } });
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/student/schedule');
    await expect(page.getByText('HSK2-K26-01')).toHaveCount(0);
  });

  test('M6, M7, M8 & M9-01: PDF import zero dup keys + listening MCQ + preview clean + responsive + grading validation & media', async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name.includes('mobile'), 'Responsive 375x812 tested directly via setViewportSize below');
    test.setTimeout(90_000);
    const reactDupKeys: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && msg.text().includes('same key')) reactDupKeys.push(msg.text());
    });

    await loginThroughUi(page, 'teacher.lan@webedu.vn');

    // BUG-M6-04: 1366x768 assessment list table fits without horizontal overflow clipping buttons
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/teacher/assessments');
    const listRegionOverflow = await page
      .locator('[role="region"][aria-label="Danh sách đề và bài tập"]')
      .evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(listRegionOverflow).toBeLessThanOrEqual(2);

    // BUG-M6-03: 375x812 upload pane zero document overflow
    await page.setViewportSize({ width: 375, height: 812 });
    await page.getByRole('button', { name: 'Tải đề Word/PDF' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();

    // BUG-M6-07, M6-01, M6-02, M6-06: import MINI_TEST_01 (2).pdf + check Q1 listening options + clean preview + unsaved confirm
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByLabel('Tên đề').fill('QA PDF Listening Verification');
    await page.getByLabel('Tải đề Word hoặc PDF').setInputFiles(MINI_TEST_PDF);
    await page.getByLabel('Thêm audio').setInputFiles({ name: 'q1.mp3', mimeType: 'audio/mpeg', buffer: MINIMAL_MP3 });
    await page.getByRole('button', { name: 'Tải đề lên' }).click();
    await expect(page.getByText('3 · Hoàn tất')).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: 'Kiểm tra đề' }).click();
    const card1 = page.getByRole('article', { name: 'Câu 1', exact: true });
    await expect(card1).toBeVisible();
    expect(reactDupKeys).toEqual([]);
    await card1.getByLabel('Chọn audio có sẵn').selectOption({ index: 1 });
    await card1.getByLabel('Đáp án A').check();
    await card1.getByRole('button', { name: 'Lưu & xác nhận' }).click();
    await expect(card1.getByText('Cần kiểm tra')).toHaveCount(0);

    // BUG-M6-02: Student Preview has no teacher hints/dropdowns and plays audio
    await page.getByRole('button', { name: 'Xem trước như HV' }).click();
    await expect(card1.locator('select')).toHaveCount(0);
    await expect(card1.getByText('Gắn file nghe tại đây')).toHaveCount(0);
    await expect(card1.locator('audio')).toHaveCount(1);
    await page.getByRole('button', { name: 'Đóng xem trước' }).click();

    // BUG-M6-06: unsaved confirm when clicking back after title edit
    await page.getByLabel('Tên đề').fill('QA PDF Modified Unsaved');
    await page.getByRole('button', { name: '← Danh sách đề' }).click();
    await expect(page.getByRole('dialog', { name: /Rời trang khi chưa lưu/ })).toBeVisible();
    await page.getByRole('button', { name: 'Rời trang' }).click();

    // BUG-M6-08, M7-01, M7-02, M7-03, M8-01..03, M9-01: Create & assign assessment via API matching HSK2-K26-01 course
    const origin = new URL(page.url()).origin;
    const classesRes = await page.request.get(`${API_BASE_URL}/classes`);
    const cls = ((await classesRes.json()) as { items: Array<{ id: string; code: string; course: { id: string } }> }).items.find((c) => c.code === 'HSK2-K26-01')!;
    const createRes = await page.request.post(`${API_BASE_URL}/assessments`, {
      headers: { Origin: origin },
      data: { title: 'Đề E2E Audio & Tự luận M7-M8', type: 'MINI_TEST', courseId: cls.course.id, durationMinutes: 15 },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = (await createRes.json()) as { id: string };
    const mediaUpload = await page.request.post(`${API_BASE_URL}/assessments/${created.id}/media`, {
      headers: { Origin: origin },
      multipart: { file: { name: 'listen.mp3', mimeType: 'audio/mpeg', buffer: MINIMAL_MP3 } },
    });
    expect(mediaUpload.ok()).toBeTruthy();
    const media = (await mediaUpload.json()) as { id: string };
    const q1Res = await page.request.post(`${API_BASE_URL}/assessments/${created.id}/questions`, {
      headers: { Origin: origin },
      data: {
        type: 'LISTENING',
        prompt: 'Nghe đoạn audio và trả lời',
        points: 5,
        payload: { mediaId: media.id, options: [{ id: 'a', text: 'Đúng' }, { id: 'b', text: 'Sai' }], correctOptionIds: ['a'] },
      },
    });
    expect(q1Res.ok()).toBeTruthy();
    const q2Res = await page.request.post(`${API_BASE_URL}/assessments/${created.id}/questions`, {
      headers: { Origin: origin },
      data: { type: 'ESSAY', prompt: 'Viết 1 câu tiếng Trung', points: 5, payload: { sampleAnswer: '我很好', rubric: 'Đúng ngữ pháp' } },
    });
    expect(q2Res.ok()).toBeTruthy();
    expect(MINIMAL_PNG.byteLength).toBeGreaterThan(10);
    const pubRes = await page.request.post(`${API_BASE_URL}/assessments/${created.id}/publish`, { headers: { Origin: origin } });
    expect(pubRes.ok()).toBeTruthy();

    const sessRes = await page.request.get(`${API_BASE_URL}/classes/${cls.id}/sessions`);
    const sess1 = ((await sessRes.json()) as { sessions: Array<{ id: string }> }).sessions[0]!;
    const assignRes = await page.request.post(`${API_BASE_URL}/assessments/${created.id}/assign`, {
      headers: { Origin: origin },
      data: {
        classIds: [cls.id],
        sessionId: sess1.id,
        dueAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(assignRes.ok()).toBeTruthy();
    const assignment = ((await assignRes.json()) as { items: Array<{ id: string }> }).items[0]!;

    // BUG-M7-02: tracker filter pills
    await page.goto(`/teacher/classes/${cls.id}`);
    await page.getByRole('tab', { name: 'Bài tập & Kiểm tra' }).click();
    await page.getByRole('button', { name: 'Theo dõi nộp bài' }).first().click();
    await page.getByRole('button', { name: /Đã chấm:/ }).click();
    await expect(page.getByText('Không có học viên nào thuộc trạng thái đang lọc')).toBeVisible();
    await page.getByRole('button', { name: /Chưa làm:/ }).click();
    await expect(page.getByText('active.student@webedu.vn')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();

    // BUG-M6-08: colleague teacher sees Xem, not Sửa/Duyệt
    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: origin } });
    await loginThroughUi(page, 'teacher.idle@webedu.vn');
    await page.goto('/teacher/assessments');
    const colleagueRow = page.locator('tr', { hasText: 'Đề E2E Audio & Tự luận M7-M8' });
    await expect(colleagueRow.getByRole('button', { name: 'Xem' })).toBeVisible();
    await expect(colleagueRow.getByRole('button', { name: 'Duyệt' })).toHaveCount(0);

    // BUG-M7-01 & M7-03: Student sees session badge + flag persists across F5
    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: origin } });
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/student/assignments');
    await expect(page.getByText(/Gắn buổi: Buổi 1/i)).toBeVisible();

    await page.goto(`/student/assignments/${assignment.id}`);
    await page.locator('input[type="radio"]').first().check();
    await page.getByRole('button', { name: 'Đánh dấu xem lại' }).click();
    await expect(page.getByRole('button', { name: 'Đã đánh dấu xem lại' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Đã đánh dấu xem lại' })).toBeVisible();
    await page.getByRole('button', { name: 'Câu tiếp' }).click();
    await page.getByRole('textbox').fill('我喜欢学习汉语。');
    await page.getByRole('button', { name: 'Nộp bài' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nộp bài' }).click();
    await expect(page.getByText('Đã nộp - Chờ chấm')).toBeVisible();

    // BUG-M8-01, M8-02, M8-03, M9-01: Grading workspace
    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: origin } });
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto(`/teacher/assignments/${assignment.id}/grading`);
    expect(await page.locator('body').innerText()).not.toContain('DEC-038');
    await expect(page.locator('#btn-batch-ai-grade')).toBeVisible();
    await page.locator('#btn-batch-ai-grade').click();
    await expect(page.locator('#batch-ai-pii-confirm')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: 'Hủy' }).click();

    await page.locator('tr[data-student-email="active.student@webedu.vn"]').getByRole('button', { name: 'Chấm bài' }).click();
    const dlg = page.getByRole('dialog').first();
    await expect(dlg.locator('audio')).toHaveCount(1);
    expect(await dlg.innerText()).not.toContain('FUNC-061');
    const essayScoreInput = dlg.locator('input[type="number"]').nth(1);
    await essayScoreInput.fill('-1');
    await dlg.getByRole('button', { name: 'Lưu điểm & Nhận xét' }).click();
    await expect(dlg.getByRole('alert')).toContainText(/Điểm câu 2 phải là số từ 0 đến 5/i);
    await essayScoreInput.fill('4.5');
    await dlg.getByRole('button', { name: 'Lưu điểm & Nhận xét' }).click();
    await expect(dlg.getByText(/Đã lưu điểm/i)).toBeVisible();
    await dlg.getByRole('button', { name: /Xác nhận điểm/i }).click();
    await expect(dlg.getByRole('button', { name: /Chỉnh sửa điểm/i })).toBeVisible();
    await dlg.getByRole('button', { name: /Chỉnh sửa điểm/i }).click();
    const adjustDlg = page.getByRole('dialog').last();
    expect(await adjustDlg.innerText()).not.toContain('FUNC-061');
    await adjustDlg.getByRole('button', { name: 'Hủy' }).click();
    await dlg.getByRole('button', { name: 'Đóng' }).click();
    await page.locator('#btn-publish-confirmed-grades').click();
    await expect(page.getByText(/Đã công bố điểm/i)).toBeVisible();

    await page.request.post(`${API_BASE_URL}/auth/logout`, { headers: { Origin: origin } });
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto(`/student/assignments/${assignment.id}?mode=review`);
    await expect(page.locator('audio')).toHaveCount(1);
  });
});
