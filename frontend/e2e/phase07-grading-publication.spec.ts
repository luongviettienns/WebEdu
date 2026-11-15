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

function toVnOffsetIso(date: Date): string {
  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${vnDate.toISOString().slice(0, 19)}+07:00`;
}

test.describe('Phase 7 — AI Config, Grading Console, 2-Step Publication & Zero-Leak', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('Superadmin configures multi-provider AI key without leaking key in public config', async ({
    page,
  }) => {
    const { pageErrors } = attachGuards(page);
    await loginThroughUi(page, 'superadmin@webedu.vn');
    await page.goto('/superadmin/settings');

    await expect(
      page.getByRole('heading', { name: /Cấu hình AI Gợi ý Chấm Tự luận/i }),
    ).toBeVisible();

    await page.locator('#ai-cfg-enabled').check();
    await page.locator('#ai-cfg-provider').selectOption('GEMINI');
    await expect(page.locator('#ai-cfg-base-url')).toHaveValue(
      'https://generativelanguage.googleapis.com/v1beta',
    );
    await expect(page.locator('#ai-cfg-model')).toHaveValue('gemini-3.5-flash-lite');
    await page.locator('#ai-cfg-api-key').fill('AIzaSyTestSecretKey987654321');
    await page.locator('#btn-save-ai-cfg').click();

    await expect(page.getByText('Đã lưu cấu hình AI chấm tự luận thành công!')).toBeVisible();
    await expect(page.getByText(/Đã cấu hình API Key/i)).toBeVisible();

    await page.reload();
    await expect(page.locator('#ai-cfg-enabled')).toBeChecked();
    await expect(page.locator('#ai-cfg-provider')).toHaveValue('GEMINI');
    await expect(page.locator('#ai-cfg-api-key')).toHaveValue('');
    await expect(page.locator('#ai-cfg-api-key')).toHaveAttribute(
      'placeholder',
      /để trống nếu giữ nguyên/i,
    );

    // Switching provider clears keep-key hint and blocks Test connection without firing a request (#1)
    let testRequests = 0;
    page.on('request', (req) => {
      if (req.url().includes('/system-settings/ai-grading/test') && req.method() === 'POST') {
        testRequests += 1;
      }
    });
    await page.locator('#ai-cfg-provider').selectOption('CUSTOM');
    await page.locator('#ai-cfg-base-url').fill('https://custom.example.com/v1');
    await expect(page.locator('#ai-cfg-api-key')).not.toHaveAttribute(
      'placeholder',
      /để trống nếu giữ nguyên/i,
    );
    await page.locator('#btn-test-ai-cfg').click();
    await expect(page.getByText(/Vui lòng nhập API Key mới/i)).toBeVisible();
    expect(testRequests).toBe(0);

    const publicCfgRes = await page.request.get(`${API_BASE_URL}/system-settings/config`);
    expect(publicCfgRes.ok()).toBeTruthy();
    const publicCfgText = await publicCfgRes.text();
    expect(publicCfgText).not.toContain('AIzaSyTestSecretKey987654321');
    expect(publicCfgText).not.toContain('apiKey');

    expect(pageErrors).toEqual([]);
  });

  test('Full Grading Flow: Submit -> Grade Essay -> Confirm (Zero-Leak) -> Publish -> Overdue Zero -> Adjust + AuditLog -> Student Review', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { pageErrors } = attachGuards(page);

    // 1. Admin enrolls a 2nd active student into HSK2-K26-01 so we can verify DEC-038 overdue handling
    await loginThroughUi(page, 'admin@webedu.vn');
    const origin = new URL(page.url()).origin;
    const classesRes = await page.request.get(`${API_BASE_URL}/classes`);
    const classesJson = (await classesRes.json()) as { items: Array<{ id: string; code: string }> };
    const hsk2Class = classesJson.items.find((c) => c.code === 'HSK2-K26-01');
    expect(hsk2Class).toBeTruthy();

    const studentsRes = await page.request.get(
      `${API_BASE_URL}/students?search=${encodeURIComponent('lockout.desktop@webedu.vn')}`,
    );
    const studentsJson = (await studentsRes.json()) as { items: Array<{ id: string; email: string }> };
    const secondStudent = studentsJson.items.find((s) => s.email === 'lockout.desktop@webedu.vn');
    expect(secondStudent).toBeTruthy();

    const enrollRes = await page.request.post(
      `${API_BASE_URL}/classes/${hsk2Class!.id}/enrollments`,
      {
        headers: { Origin: origin },
        data: { studentIds: [secondStudent!.id], enrolledDate: '2026-10-15' },
      },
    );
    expect(enrollRes.ok(), `Enroll 2nd student failed: ${enrollRes.status()}`).toBeTruthy();

    // 2. Teacher creates, publishes, and assigns mixed (SINGLE_CHOICE + ESSAY) assessment with short future dueAt
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    const coursesRes = await page.request.get(`${API_BASE_URL}/courses`);
    const coursesJson = (await coursesRes.json()) as { items: Array<{ id: string; code: string }> };
    const hsk2Course = coursesJson.items.find((c) => c.code === 'HSK2')!;

    const asmRes = await page.request.post(`${API_BASE_URL}/assessments`, {
      headers: { Origin: origin },
      data: {
        title: 'Kiểm tra HSK2 Chấm Tự luận E2E',
        type: 'MINI_TEST',
        courseId: hsk2Course.id,
        durationMinutes: 30,
      },
    });
    expect(asmRes.ok()).toBeTruthy();
    const assessment = (await asmRes.json()) as { id: string };

    const q1Res = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/questions`, {
      headers: { Origin: origin },
      data: {
        type: 'SINGLE_CHOICE',
        prompt: 'Chọn nghĩa đúng của 你好',
        points: 4,
        payload: {
          options: [
            { id: 'a', text: 'Xin chào' },
            { id: 'b', text: 'Tạm biệt' },
          ],
          correctOptionIds: ['a'],
          explanation: '你好 nghĩa là Xin chào',
        },
      },
    });
    expect(q1Res.ok()).toBeTruthy();
    const q1 = (await q1Res.json()) as { id: string };

    const q2Res = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/questions`, {
      headers: { Origin: origin },
      data: {
        type: 'ESSAY',
        prompt: 'Viết 1 câu tiếng Trung nói về sở thích đọc sách',
        points: 6,
        payload: { sampleAnswer: '我喜欢看书。', rubric: 'Đúng ngữ pháp cơ bản' },
      },
    });
    expect(q2Res.ok()).toBeTruthy();
    const q2 = (await q2Res.json()) as { id: string };

    const pubRes = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/publish`, {
      headers: { Origin: origin },
    });
    expect(pubRes.ok()).toBeTruthy();

    const dueAtMs = Date.now() + 20_000;
    const assignRes = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/assign`, {
      headers: { Origin: origin },
      data: { classIds: [hsk2Class!.id], dueAt: toVnOffsetIso(new Date(dueAtMs)) },
    });
    expect(assignRes.ok()).toBeTruthy();
    const assignJson = (await assignRes.json()) as { items: Array<{ id: string }> };
    const assignmentId = assignJson.items[0]!.id;

    // 3. Student 1 (Phạm Gia Huy) starts & submits before dueAt expires
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    const startRes = await page.request.post(`${API_BASE_URL}/assignments/${assignmentId}/submissions/start`, {
      headers: { Origin: origin },
    });
    expect(startRes.ok(), `Student start failed: ${startRes.status()}`).toBeTruthy();
    const started = (await startRes.json()) as { submission: { id: string } };
    const submitRes = await page.request.post(
      `${API_BASE_URL}/assignments/${assignmentId}/submissions/submit`,
      {
        headers: { Origin: origin },
        data: {
          submissionId: started.submission.id,
          answers: [
            { questionId: q1.id, answerPayload: { selectedOptionIds: ['a'] } },
            { questionId: q2.id, answerPayload: { text: '我周末喜欢去图书馆看中文书。' } },
          ],
          elapsedSeconds: 45,
        },
      },
    );
    expect(submitRes.ok(), `Student submit failed: ${submitRes.status()}`).toBeTruthy();

    await page.goto(`/student/assignments/${assignmentId}?mode=review`);
    await expect(page.getByText('Bài đã nộp, đang chờ giáo viên chấm')).toBeVisible();
    await expect(page.getByText('Điểm tổng kết')).toHaveCount(0);

    // 4. Teacher opens Grading Workspace -> grades essay (5.5) -> Step 1 Confirm (GRADED)
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto(`/teacher/assignments/${assignmentId}/grading`);

    await expect(page.getByRole('heading', { name: 'Kiểm tra HSK2 Chấm Tự luận E2E' })).toBeVisible();
    await expect(page.locator('#btn-batch-ai-grade')).toBeVisible();
    await assertZeroSeriousAxe(page, 'teacher-grading-workspace');

    const stu1Row = page.locator('tr[data-student-email="active.student@webedu.vn"]');
    await stu1Row.getByRole('button', { name: 'Chấm bài' }).click();

    const gradingDialog = page.getByRole('dialog', { name: 'Chấm bài nộp học viên' });
    await expect(gradingDialog).toBeVisible();
    await gradingDialog.locator(`#score-${q2.id}`).fill('5.5');
    await gradingDialog.locator(`#comment-${q2.id}`).fill('Câu viết tự nhiên, đúng ngữ pháp');
    await gradingDialog.locator('#submission-teacher-feedback').fill('Hoàn thành rất tốt!');
    await expect(gradingDialog.locator('#btn-confirm-submission-grade')).toBeDisabled();
    await gradingDialog.locator('#btn-save-manual-grade').click();
    await expect(gradingDialog.getByText('Đã lưu điểm và nhận xét bài làm.')).toBeVisible();
    await expect(gradingDialog.locator('#btn-confirm-submission-grade')).toBeEnabled();

    await gradingDialog.locator('#btn-confirm-submission-grade').click();
    await expect(gradingDialog.getByText(/Đã xác nhận điểm bài nộp/i)).toBeVisible();
    await gradingDialog.getByRole('button', { name: 'Đóng' }).click();

    await expect(stu1Row.getByText('Đã xác nhận (Chưa công bố)')).toBeVisible();
    await expect(stu1Row.getByText('9.5 / 10')).toBeVisible();

    // 5. ZERO-LEAK CHECK: Student 1 still cannot see score while status === GRADED (confirmed, not published)
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    const prePublishApi = await page.request.get(
      `${API_BASE_URL}/assignments/${assignmentId}/published-result`,
    );
    const prePublishJson = (await prePublishApi.json()) as { isPublished: boolean; result: unknown };
    expect(prePublishJson.isPublished).toBe(false);
    expect(prePublishJson.result).toBeNull();

    await page.goto(`/student/assignments/${assignmentId}?mode=review`);
    await expect(page.getByText('Bài đã nộp, đang chờ giáo viên chấm')).toBeVisible();
    await expect(page.getByText('Điểm tổng kết')).toHaveCount(0);

    // 6. Teacher Step 2 Publish (RETURNED) + Explicit Overdue 0đ (DEC-038) + Adjust Grade with GradeAuditLog
    await expect.poll(Date.now, { timeout: 25_000 }).toBeGreaterThan(dueAtMs);
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto(`/teacher/assignments/${assignmentId}/grading`);

    await page.locator('#btn-publish-confirmed-grades').click();
    await expect(page.getByText(/Đã công bố điểm cho 1 bài/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Quá hạn chưa nộp' }).click();
    const stu2Row = page.locator('tr[data-student-email="lockout.desktop@webedu.vn"]');
    await expect(stu2Row.getByText('Quá hạn chưa nộp')).toBeVisible();
    await stu2Row.getByRole('button', { name: 'Ghi 0 điểm' }).click();
    const zeroDialog = page.getByRole('dialog', { name: 'Xác nhận ghi nhận 0 điểm quá hạn' });
    await expect(zeroDialog).toBeVisible();
    await zeroDialog.getByRole('button', { name: 'Xác nhận ghi 0 điểm' }).click();
    await expect(page.getByText(/Đã ghi nhận 0 điểm cho học viên/i)).toBeVisible();

    await page.getByRole('tab', { name: 'Đã công bố' }).click();
    await page
      .locator('tr[data-student-email="active.student@webedu.vn"]')
      .getByRole('button', { name: 'Xem / Sửa điểm' })
      .click();

    await gradingDialog.locator('#btn-open-adjust-grade').click();
    const adjustDialog = page.getByRole('dialog', { name: /Chỉnh sửa điểm/i });

    // Simulate another tab adjusting Q1 comment while this dialog is already open (#5)
    const trackerForSubRes = await page.request.get(
      `${API_BASE_URL}/assignments/${assignmentId}/grading-tracker`,
    );
    const trackerForSubJson = (await trackerForSubRes.json()) as {
      students: Array<{ email: string; submissionId: string | null }>;
    };
    const stu1SubId = trackerForSubJson.students.find(
      (s) => s.email === 'active.student@webedu.vn',
    )?.submissionId;
    expect(stu1SubId).toBeTruthy();
    const concurrentCommentRes = await page.request.patch(
      `${API_BASE_URL}/submissions/${stu1SubId!}/adjust-grade`,
      {
        headers: { Origin: origin },
        data: {
          reason: 'Tab khác nhận xét câu 1',
          answers: [
            { questionId: q1.id, teacherComment: 'Trắc nghiệm chuẩn', previousTeacherComment: null },
          ],
        },
      },
    );
    expect(concurrentCommentRes.ok()).toBeTruthy();

    await adjustDialog.locator('#adjust-score-2').fill('6');
    await adjustDialog.locator('#adjust-reason').fill('Cộng 0.5 điểm diễn đạt tốt sau phúc khảo');
    await adjustDialog.locator('#btn-submit-adjust-grade').click();

    const auditPanel = gradingDialog.getByTestId('grade-audit-log-panel');
    await expect(auditPanel).toContainText('5.5 → 6 đ');
    await expect(auditPanel).toContainText('Cộng 0.5 điểm diễn đạt tốt sau phúc khảo');
    await gradingDialog.getByRole('button', { name: 'Đóng' }).click();

    // 7. Student sees published 10/10 score, concurrent Q1 comment, "Đã cập nhật" badge, explanation, and feedback
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto(`/student/assignments/${assignmentId}?mode=review`);

    await expect(page.getByText('Điểm tổng kết')).toBeVisible();
    await expect(page.getByText('10 / 10 điểm')).toBeVisible();
    await expect(page.getByText(/Đã cập nhật \d{2}\/\d{2}\/\d{4}/).first()).toBeVisible();
    await expect(page.getByText('Hoàn thành rất tốt!')).toBeVisible();
    await expect(page.getByText('Trắc nghiệm chuẩn')).toBeVisible();
    await expect(page.getByText('Câu viết tự nhiên, đúng ngữ pháp')).toBeVisible();
    await expect(page.getByText('你好 nghĩa là Xin chào')).toBeVisible();
    await assertZeroSeriousAxe(page, 'student-published-result');

    expect(pageErrors).toEqual([]);
  });
});
