import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const INSPECTOR_URL = `http://127.0.0.1:${process.env.QA_MAIL_INSPECTOR_PORT || 4026}`;

function attachGuards(page: Page): { pageErrors: string[] } {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));
  return { pageErrors };
}

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

async function logoutViaApi(page: Page): Promise<void> {
  const appOrigin = new URL(page.url()).origin;
  const res = await page.request.post(`${API_BASE_URL}/auth/logout`, {
    headers: { Origin: appOrigin },
  });
  expect(res.ok()).toBeTruthy();
}

async function assertZeroSeriousAxe(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    serious.map(
      (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
    `Axe serious violations on ${label}`,
  ).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const delta = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(delta, `Horizontal overflow on ${label}`).toBeLessThanOrEqual(2);
}

test.describe('Phase 9 — Prototype Cleanup, Multi-Role Notification Bell & Zero-Leak', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('Clean /login removes Dev Quick-Login & internal spec tags cleanly; pure SUPERADMIN hides notification bell', async ({
    page,
  }) => {
    const { pageErrors } = attachGuards(page);

    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập hệ thống' })).toBeVisible();
    await expect(page.getByText(/Đăng nhập nhanh/i)).toHaveCount(0);
    await expect(page.getByText(/Tài khoản demo/i)).toHaveCount(0);
    await expect(page.getByText(/Thử lỗi/i)).toHaveCount(0);
    await expect(page.getByText(/FUNC-\d+/i)).toHaveCount(0);
    await assertZeroSeriousAxe(page, 'login-clean');
    await assertNoHorizontalOverflow(page, 'login-clean');

    await loginThroughUi(page, 'superadmin@webedu.vn');
    await expect(page).toHaveURL(/\/superadmin\/settings/);
    await expect(page.getByTestId('notification-bell-button')).toHaveCount(0);
    await assertZeroSeriousAxe(page, 'superadmin-no-bell');

    expect(pageErrors).toEqual([]);
  });

  test('End-to-end Bell Popover lifecycle across Admin/Teacher/Student with Zero-Leak, Desktop+Mobile & Axe WCAG AA', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const { pageErrors } = attachGuards(page);
    const runTag = testInfo.project.name.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';
    const studentEmail = `notif.p9.${runTag}@example.com`;
    const studentPhone = runTag === 'mobile' ? '0908777002' : '0908777001';

    // 1. Register a fresh adult student via HTTP OTP flow -> triggers NEW_STUDENT_PENDING_CLASS for Admin
    await page.goto('/login');
    const origin = new URL(page.url()).origin;
    const sendOtpRes = await page.request.post(`${API_BASE_URL}/auth/send-verification-code`, {
      headers: { Origin: origin },
      data: { email: studentEmail },
    });
    expect(sendOtpRes.ok()).toBeTruthy();

    const otpRes = await page.request.get(
      `${INSPECTOR_URL}/latest-otp?email=${encodeURIComponent(studentEmail)}`,
    );
    expect(otpRes.ok()).toBeTruthy();
    const { otp } = (await otpRes.json()) as { otp: string | null };
    expect(otp).toMatch(/^\d{6}$/);

    const regRes = await page.request.post(`${API_BASE_URL}/auth/register`, {
      headers: { Origin: origin },
      data: {
        fullName: `Học Viên Phase 9 (${runTag})`,
        dateOfBirth: '2003-04-12',
        phone: studentPhone,
        email: studentEmail,
        password: 'Password@123',
        verificationCode: otp,
      },
    });
    expect(regRes.status()).toBe(201);
    const regJson = (await regRes.json()) as { user: { id: string } };
    const newStudentId = regJson.user.id;

    // 2. Admin sees NEW_STUDENT_PENDING_CLASS in Bell Popover, clicks -> navigates to /admin/students/pending & places student into HSK2-K26-01
    await loginThroughUi(page, 'admin@webedu.vn');
    await expect(page.getByTestId('notification-bell-button')).toBeVisible();
    await expect(page.getByTestId('notification-unread-badge')).toBeVisible();

    await page.getByTestId('notification-bell-button').click();
    const adminPopover = page.getByTestId('notification-popover');
    await expect(adminPopover).toBeVisible();
    await expect(adminPopover).toContainText(`Học Viên Phase 9 (${runTag})`);

    const pendingItem = adminPopover.getByTestId('notification-item').first();
    await pendingItem.click();
    await expect(page).toHaveURL(/\/admin\/students\/pending/);
    await expect(page.getByTestId('notification-unread-badge')).toHaveCount(0);

    const classesRes = await page.request.get(`${API_BASE_URL}/classes`);
    expect(classesRes.ok()).toBeTruthy();
    const classesJson = (await classesRes.json()) as {
      items: Array<{ id: string; code: string; course: { id: string } }>;
    };
    const hsk2Class = classesJson.items.find((c) => c.code === 'HSK2-K26-01')!;
    const assignClassRes = await page.request.post(
      `${API_BASE_URL}/students/${newStudentId}/assign-initial-class`,
      {
        headers: { Origin: origin },
        data: { classNameOrId: hsk2Class.id, enrolledAt: '2026-10-02' },
      },
    );
    expect(assignClassRes.ok()).toBeTruthy();

    // 3. Teacher creates, publishes & assigns a 1-question MINI_TEST to HSK2-K26-01
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');

    const createAssRes = await page.request.post(`${API_BASE_URL}/assessments`, {
      headers: { Origin: origin },
      data: {
        title: `Mini-test Thông Báo P9 (${runTag})`,
        type: 'MINI_TEST',
        courseId: hsk2Class.course.id,
      },
    });
    expect(createAssRes.ok()).toBeTruthy();
    const assJson = (await createAssRes.json()) as { id: string };

    const qRes = await page.request.post(`${API_BASE_URL}/assessments/${assJson.id}/questions`, {
      headers: { Origin: origin },
      data: {
        type: 'SINGLE_CHOICE',
        prompt: 'Chọn đáp án đúng cho 你好',
        points: 10,
        payload: {
          options: [
            { id: 'a', text: 'Xin chào' },
            { id: 'b', text: 'Tạm biệt' },
          ],
          correctOptionIds: ['a'],
        },
      },
    });
    expect(qRes.ok()).toBeTruthy();
    const qJson = (await qRes.json()) as { id: string };

    const pubAssRes = await page.request.post(`${API_BASE_URL}/assessments/${assJson.id}/publish`, {
      headers: { Origin: origin },
    });
    expect(pubAssRes.ok()).toBeTruthy();

    const assignRes = await page.request.post(`${API_BASE_URL}/assessments/${assJson.id}/assign`, {
      headers: { Origin: origin },
      data: {
        classIds: [hsk2Class.id],
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    expect(assignRes.ok()).toBeTruthy();
    const assignJson = (await assignRes.json()) as { items: Array<{ id: string }> };
    const assignmentId = assignJson.items[0]!.id;

    // 4. Student opens Bell Popover -> verifies STUDENT_ENROLLED & ASSIGNMENT_ASSIGNED, Desktop/Mobile fit & Axe WCAG AA
    await logoutViaApi(page);
    await loginThroughUi(page, studentEmail);

    await expect(page.getByTestId('notification-unread-badge')).toHaveText('2');
    await page.getByTestId('notification-bell-button').click();
    const studentPopover = page.getByTestId('notification-popover');
    await expect(studentPopover).toBeVisible();
    await expect(studentPopover).toContainText('HSK2-K26-01');
    await expect(studentPopover).toContainText(`Mini-test Thông Báo P9 (${runTag})`);
    await assertNoHorizontalOverflow(page, `student-popover-${runTag}`);
    await assertZeroSeriousAxe(page, `student-popover-${runTag}`);

    // Close popover with Escape & verify submission -> Teacher notification
    await page.keyboard.press('Escape');
    await expect(studentPopover).toBeHidden();

    const startRes = await page.request.post(
      `${API_BASE_URL}/assignments/${assignmentId}/submissions/start`,
      { headers: { Origin: origin } },
    );
    expect(startRes.ok()).toBeTruthy();
    const started = (await startRes.json()) as { submission: { id: string; revision: number } };

    const submitRes = await page.request.post(
      `${API_BASE_URL}/assignments/${assignmentId}/submissions/submit`,
      {
        headers: { Origin: origin },
        data: {
          submissionId: started.submission.id,
          revision: started.submission.revision,
          answers: [{ questionId: qJson.id, answerPayload: { selectedOptionIds: ['a'] } }],
        },
      },
    );
    expect(submitRes.ok()).toBeTruthy();

    // 5. Teacher sees SUBMISSION_PENDING_GRADING in Bell Popover, confirms grade (GRADED), keeping Zero-Leak
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.getByTestId('notification-bell-button').click();
    const teacherPopover = page.getByTestId('notification-popover');
    await expect(teacherPopover).toContainText(`Mini-test Thông Báo P9 (${runTag})`);
    await expect(teacherPopover).toContainText('1 bài nộp');

    const confirmRes = await page.request.post(
      `${API_BASE_URL}/submissions/${started.submission.id}/confirm-grade`,
      { headers: { Origin: origin } },
    );
    expect(confirmRes.ok()).toBeTruthy();

    // Zero-Leak check on Student while status is GRADED
    await logoutViaApi(page);
    await loginThroughUi(page, studentEmail);
    await page.getByTestId('notification-bell-button').click();
    await expect(page.getByTestId('notification-popover')).not.toContainText('Đã công bố điểm');

    // 6. Teacher publishes grade via Grading Console UI -> Student clicks GRADE_PUBLISHED & tests Mark All Read
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto(`/teacher/assignments/${assignmentId}/grading`);
    await page.locator('#btn-publish-confirmed-grades').click();
    await expect(page.getByText(/Đã công bố điểm cho 1 bài/i)).toBeVisible();

    await logoutViaApi(page);
    await loginThroughUi(page, studentEmail);
    await expect(page.getByTestId('notification-unread-badge')).toHaveText('3');

    await page.getByTestId('notification-bell-button').click();
    const studentPopoverAfterPublish = page.getByTestId('notification-popover');
    await expect(studentPopoverAfterPublish).toContainText('Đã công bố điểm bài làm');
    await expect(studentPopoverAfterPublish).toContainText(`Mini-test Thông Báo P9 (${runTag})`);
    await expect(studentPopoverAfterPublish).toContainText('10/10');
    await studentPopoverAfterPublish
      .getByTestId('notification-item')
      .filter({ hasText: 'Đã công bố điểm' })
      .first()
      .click();

    await expect(page).toHaveURL(new RegExp(`/student/assignments/${assignmentId}\\?mode=review`));
    await expect(page.getByText('Điểm tổng kết', { exact: true })).toBeVisible();
    await expect(page.getByText('10 / 10 điểm').first()).toBeVisible();
    await expect(page.getByTestId('notification-unread-badge')).toHaveText('2');

    // Mark all as read clears remaining unread notifications cleanly
    await page.getByTestId('notification-bell-button').click();
    await page.getByTestId('notification-mark-all-read').click();
    await expect(page.getByTestId('notification-unread-badge')).toHaveCount(0);

    expect(pageErrors).toEqual([]);
  });
});
