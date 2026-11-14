import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Page } from '@playwright/test';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
const INSPECTOR_URL = `http://127.0.0.1:${process.env.QA_MAIL_INSPECTOR_PORT || 4026}`;

const FORBIDDEN_KEY_FIELDS = [
  'correctOptionIds',
  'acceptedAnswers',
  'correctSentence',
  'sampleAnswer',
  'rubric',
] as const;

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
    serious.map(
      (v) =>
        `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
    ),
    `Axe serious/critical violations on ${label}`,
  ).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
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

async function logoutViaApi(page: Page): Promise<void> {
  const appOrigin = new URL(page.url()).origin;
  const res = await page.request.post(`${API_BASE_URL}/auth/logout`, {
    headers: { Origin: appOrigin },
  });
  expect(res.ok()).toBeTruthy();
}

function futureLocalInputValue(daysAhead = 7): string {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(target);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${pick('year')}-${pick('month')}-${pick('day')}T${pick('hour')}:${pick('minute')}`;
}

async function seedPublishedHsk2Assessment(page: Page, title: string): Promise<string> {
  const appOrigin = new URL(page.url()).origin;
  const coursesRes = await page.request.get(`${API_BASE_URL}/courses`);
  expect(coursesRes.ok()).toBeTruthy();
  const coursesJson = (await coursesRes.json()) as {
    items: Array<{ id: string; code: string }>;
  };
  const hsk2Course = coursesJson.items.find((c) => c.code === 'HSK2');
  expect(hsk2Course, 'Seeded HSK2 course must exist').toBeTruthy();

  const createRes = await page.request.post(`${API_BASE_URL}/assessments`, {
    headers: { Origin: appOrigin },
    data: {
      title,
      type: 'MINI_TEST',
      courseId: hsk2Course!.id,
      durationMinutes: 45,
      description: 'Bài kiểm tra tổng hợp kỹ năng HSK2',
    },
  });
  expect(createRes.ok(), `Create assessment failed: ${createRes.status()}`).toBeTruthy();
  const created = (await createRes.json()) as { id: string };

  const questions = [
    {
      type: 'SINGLE_CHOICE',
      prompt: 'Chọn nghĩa đúng của từ "谢谢"',
      points: 2,
      payload: {
        options: [
          { id: 'a', text: 'Cảm ơn' },
          { id: 'b', text: 'Xin lỗi' },
        ],
        correctOptionIds: ['a'],
        explanation: '谢谢 nghĩa là Cảm ơn',
      },
    },
    {
      type: 'FILL_BLANK',
      prompt: 'Điền từ tiếng Trung cho "Xin chào": ____',
      points: 2,
      payload: {
        acceptedAnswers: ['你好'],
        explanation: 'Xin chào là 你好',
      },
    },
    {
      type: 'ORDERING',
      prompt: 'Sắp xếp thành câu đúng: "Tôi rất khỏe"',
      points: 3,
      payload: {
        tokens: ['我', '很', '好'],
        correctSentence: '我 很 好',
      },
    },
    {
      type: 'ESSAY',
      prompt: 'Viết 1 câu giới thiệu bản thân bằng tiếng Trung',
      points: 3,
      payload: {
        sampleAnswer: '我叫小明。',
        rubric: 'Đúng ngữ pháp cơ bản',
        maxLength: 500,
      },
    },
  ];

  for (const q of questions) {
    const qRes = await page.request.post(
      `${API_BASE_URL}/assessments/${created.id}/questions`,
      {
        headers: { Origin: appOrigin },
        data: q,
      },
    );
    expect(qRes.ok(), `Add question failed: ${qRes.status()}`).toBeTruthy();
  }

  const pubRes = await page.request.post(
    `${API_BASE_URL}/assessments/${created.id}/publish`,
    { headers: { Origin: appOrigin } },
  );
  expect(pubRes.ok(), `Publish assessment failed: ${pubRes.status()}`).toBeTruthy();

  return created.id;
}

test.describe('Phase 6 — Assignment delivery, interactive exam runner & reopen flow', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('Full E2E: assign -> student exam & autosave reload -> no key leaks -> submit -> reopen -> attempt 2 + Axe WCAG', async ({
    page,
  }, testInfo) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const assessmentTitle = 'Đề kiểm tra HSK2 Giao bài E2E';
    const isMobileProject = testInfo.project.name.includes('mobile');

    // Capture all student submission JSON payloads to verify zero answer-key leaks
    const capturedStudentPayloads: string[] = [];
    page.on('response', async (response) => {
      const url = response.url();
      if (
        url.includes('/assignments/') &&
        url.includes('/submissions/') &&
        response.status() < 400
      ) {
        try {
          const text = await response.text();
          capturedStudentPayloads.push(text);
        } catch {
          // Ignore non-text or cancelled bodies
        }
      }
    });

    // 1. Teacher seeds a PUBLISHED assessment and delivers it to HSK2-K26-01 via UI
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await seedPublishedHsk2Assessment(page, assessmentTitle);

    await page.goto('/teacher/assessments');
    const assessmentRow = page.locator('tr', { hasText: assessmentTitle });
    await expect(assessmentRow).toBeVisible();
    await assessmentRow.getByRole('button', { name: 'Giao bài' }).click();

    const assignDialog = page.getByRole('dialog');
    await expect(assignDialog).toBeVisible();
    await assignDialog.getByLabel(/HSK2-K26-01/i).check();
    await assignDialog.getByLabel(/Hạn nộp bài/i).fill(futureLocalInputValue(7));
    await assignDialog
      .getByLabel(/Hướng dẫn làm bài/i)
      .fill('Làm đủ 4 câu, không thoát khỏi trình duyệt.');
    await assignDialog.getByRole('button', { name: 'Xác nhận giao bài' }).click();
    await expect(assignDialog).toBeHidden();

    // Verify assignedClassCount updated to 1
    await expect(assessmentRow.locator('td').nth(7)).toHaveText('1');

    // Verify assignment appears inside Class Detail -> "Bài tập & Kiểm tra" tab
    await page.goto('/teacher/classes');
    await page
      .locator('tr', { hasText: 'HSK2-K26-01' })
      .getByRole('link', { name: /Xem chi tiết lớp/i })
      .click();
    await page.getByRole('tab', { name: 'Bài tập & Kiểm tra' }).click();
    await expect(page.getByText(assessmentTitle)).toBeVisible();
    await assertZeroSeriousAxeViolations(
      page,
      `class-assignments-tab-${testInfo.project.name}`,
    );
    await assertNoHorizontalOverflow(
      page,
      `class-assignments-tab-${testInfo.project.name}`,
    );

    // 2. Switch to Student -> check /student/overview & /student/assignments -> take exam
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');

    await page.goto('/student/overview');
    await expect(page.getByRole('heading', { name: 'Bài cần làm' })).toBeVisible();
    await expect(page.getByText(assessmentTitle)).toBeVisible();
    await expect(page.getByText(/Phase 6/i)).toHaveCount(0);

    await page.goto('/student/assignments');
    await expect(page.getByRole('heading', { name: 'Bài tập & Đề thi' })).toBeVisible();
    await assertZeroSeriousAxeViolations(
      page,
      `student-assignments-${testInfo.project.name}`,
    );
    await assertNoHorizontalOverflow(
      page,
      `student-assignments-${testInfo.project.name}`,
    );

    const studentCard = page.locator('article', { hasText: assessmentTitle });
    await expect(studentCard).toBeVisible();
    await studentCard.getByRole('link', { name: 'Làm bài' }).click();
    await expect(page).toHaveURL(/\/student\/assignments\/[^/?]+$/);

    // Answer Q1 (SINGLE_CHOICE)
    await expect(page.getByText('Chọn nghĩa đúng của từ "谢谢"')).toBeVisible();
    await page.getByRole('radio', { name: /Cảm ơn/i }).check();

    // Switch to Q2 (FILL_BLANK)
    await page.getByRole('button', { name: 'Câu tiếp' }).click();
    await expect(page.getByText('Điền từ tiếng Trung cho "Xin chào"')).toBeVisible();
    await page.getByLabel('Câu trả lời điền từ').fill('你好');

    // Switch to Q3 (ORDERING)
    await page.getByRole('button', { name: 'Câu tiếp' }).click();
    await expect(page.getByText('Sắp xếp thành câu đúng')).toBeVisible();
    const tokenBank = page.getByRole('group', { name: 'Kho mảnh từ' });
    await tokenBank.getByRole('button', { name: '我', exact: true }).click();
    await tokenBank.getByRole('button', { name: '很', exact: true }).click();
    await tokenBank.getByRole('button', { name: '好', exact: true }).click();

    // Switch to Q4 (ESSAY)
    await page.getByRole('button', { name: 'Câu tiếp' }).click();
    await expect(page.getByText('Viết 1 câu giới thiệu bản thân')).toBeVisible();
    await page.getByLabel('Bài viết tự luận').fill('我叫阿明，今年二十岁。');

    // Save draft and wait for saved indicator
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText(/Đã lưu lúc/i)).toBeVisible();

    // Accessibility & responsive check on Desktop and explicit 390x844 mobile
    if (!isMobileProject) {
      await assertZeroSeriousAxeViolations(page, 'student-exam-runner-desktop');
      await assertNoHorizontalOverflow(page, 'student-exam-runner-desktop');
      await page.setViewportSize({ width: 390, height: 844 });
      await assertZeroSeriousAxeViolations(page, 'student-exam-runner-390x844');
      await assertNoHorizontalOverflow(page, 'student-exam-runner-390x844');
      await page.setViewportSize({ width: 1440, height: 900 });
    } else {
      await assertZeroSeriousAxeViolations(page, 'student-exam-runner-mobile');
      await assertNoHorizontalOverflow(page, 'student-exam-runner-mobile');
    }

    // Reload and verify all 4 answers persisted from server
    await page.reload();
    await page.getByRole('button', { name: /Câu 1\b/i }).click();
    await expect(page.getByRole('radio', { name: /Cảm ơn/i })).toBeChecked();
    await page.getByRole('button', { name: /Câu 2\b/i }).click();
    await expect(page.getByLabel('Câu trả lời điền từ')).toHaveValue('你好');
    await page.getByRole('button', { name: /Câu 3\b/i }).click();
    const answerTray = page.getByRole('group', { name: 'Câu đã sắp xếp' });
    await expect(answerTray.getByRole('button')).toHaveCount(3);
    await page.getByRole('button', { name: /Câu 4\b/i }).click();
    await expect(page.getByLabel('Bài viết tự luận')).toHaveValue('我叫阿明，今年二十岁。');

    // 3. Verify zero answer-key leaks in network payloads and DOM
    const htmlContent = await page.content();
    for (const keyName of FORBIDDEN_KEY_FIELDS) {
      expect(htmlContent).not.toContain(keyName);
      for (const payloadText of capturedStudentPayloads) {
        expect(payloadText).not.toContain(keyName);
      }
    }

    // 4. Submit exam -> confirm modal -> read-only submitted view -> "Xem bài nộp"
    await page.getByRole('button', { name: 'Nộp bài' }).click();
    const confirmDialog = page.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(confirmDialog.getByText(/4 \/ 4/)).toBeVisible();
    await expect(confirmDialog.getByText(/Bài chỉ được nộp 1 lượt chính thức/i)).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Xác nhận nộp bài' }).click();

    await expect(page.getByText('Bài đã nộp, đang chờ giáo viên chấm')).toBeVisible();
    await expect(page.getByText('Đã nộp - Chờ chấm')).toBeVisible();
    await expect(page.getByLabel('Câu trả lời điền từ')).toBeDisabled();
    await expect(page.getByLabel('Bài viết tự luận')).toBeDisabled();

    await page.goto('/student/assignments');
    const submittedCard = page.locator('article', { hasText: assessmentTitle });
    await expect(submittedCard.getByRole('link', { name: 'Xem bài nộp' })).toBeVisible();
    await expect(submittedCard.getByRole('button', { name: /Làm lại/i })).toHaveCount(0);
    await expect(submittedCard.getByRole('link', { name: /Làm lại/i })).toHaveCount(0);

    // Verify clicking "Xem bài nộp" loads ?mode=review cleanly
    await submittedCard.getByRole('link', { name: 'Xem bài nộp' }).click();
    await expect(page).toHaveURL(/mode=review/);
    await expect(page.getByText('Bài đã nộp, đang chờ giáo viên chấm')).toBeVisible();

    // 5. Teacher opens Tracker modal -> sees student submitted -> reopens Attempt #2
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/teacher/classes');
    await page
      .locator('tr', { hasText: 'HSK2-K26-01' })
      .getByRole('link', { name: /Xem chi tiết lớp/i })
      .click();
    await page.getByRole('tab', { name: 'Bài tập & Kiểm tra' }).click();
    await page
      .locator('tr', { hasText: assessmentTitle })
      .getByRole('button', { name: 'Theo dõi nộp bài' })
      .click();

    const trackerDialog = page.getByRole('dialog');
    await expect(trackerDialog).toBeVisible();
    const studentTrackerRow = trackerDialog.locator('tr', { hasText: 'Phạm Gia Huy' });
    await expect(studentTrackerRow.getByText('Đã nộp - Chờ chấm')).toBeVisible();
    await studentTrackerRow.getByRole('button', { name: 'Mở lại lượt làm' }).click();

    await trackerDialog
      .getByLabel(/Lý do mở lại/i)
      .fill('Học viên rớt mạng giữa chừng E2E');
    await trackerDialog.getByRole('button', { name: 'Xác nhận mở lại' }).click();

    await expect(studentTrackerRow.getByText('Đang làm dở')).toBeVisible();
    await expect(studentTrackerRow.getByText(/Lần 2/)).toBeVisible();
    await expect(
      studentTrackerRow.getByText(/Học viên rớt mạng giữa chừng E2E/),
    ).toBeVisible();
    await trackerDialog.getByRole('button', { name: 'Đóng' }).click();

    // 6. Student sees "Đang làm dở" (Lần làm 2) -> clicks "Tiếp tục làm bài" -> answers carried over -> submits Attempt #2
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/student/assignments');
    const reopenedCard = page.locator('article', { hasText: assessmentTitle });
    await expect(reopenedCard.getByText('Đang làm dở')).toBeVisible();
    await expect(reopenedCard.getByText(/Lần làm 2/)).toBeVisible();
    await reopenedCard.getByRole('link', { name: 'Tiếp tục làm bài' }).click();

    await expect(page.getByText(/Học viên rớt mạng giữa chừng E2E/)).toBeVisible();
    await page.getByRole('button', { name: /Câu 2\b/i }).click();
    await expect(page.getByLabel('Câu trả lời điền từ')).toHaveValue('你好');
    await page.getByLabel('Câu trả lời điền từ').fill('您好');
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText(/Đã lưu lúc/i)).toBeVisible();

    await page.getByRole('button', { name: 'Nộp bài' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận nộp bài' }).click();
    await expect(page.getByText('Bài đã nộp, đang chờ giáo viên chấm')).toBeVisible();
    await expect(page.getByText('Lần làm 2').first()).toBeVisible();
    await expect(page.getByLabel('Câu trả lời điền từ')).toHaveValue('您好');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
