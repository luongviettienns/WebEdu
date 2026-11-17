import AxeBuilder from '@axe-core/playwright';
import { expect, request as playwrightRequest, test, type Locator, type Page } from '@playwright/test';

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
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map(
      (v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
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

async function withSidebarNav(
  page: Page,
  fn: (navScope: Locator, isMobile: boolean) => Promise<void>,
): Promise<void> {
  const isMobile = await page.evaluate(() => window.innerWidth < 1024);
  if (isMobile) {
    await page.getByRole('button', { name: 'Mở menu' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menu điều hướng di động' });
    await expect(drawer).toBeVisible();
    await fn(drawer, true);
    return;
  }
  await fn(page.locator('aside[aria-label="Điều hướng thanh bên"]'), false);
}

async function clickSidebarLink(page: Page, labelRegex: RegExp): Promise<void> {
  await withSidebarNav(page, async (nav) => {
    await nav.getByRole('link', { name: labelRegex }).click();
  });
}

async function expectSidebarLinkAbsent(page: Page, href: string): Promise<void> {
  await withSidebarNav(page, async (nav, isMobile) => {
    await expect(nav.locator(`a[href="${href}"]`)).toHaveCount(0);
    if (isMobile) {
      await nav.getByRole('button', { name: 'Đóng menu' }).click();
      await expect(nav).toBeHidden();
    }
  });
}

async function createAndAssignObjectiveAssessment(
  page: Page,
  origin: string,
  params: {
    title: string;
    type: 'HOMEWORK' | 'MINI_TEST' | 'MIDTERM' | 'FINAL';
    courseId: string;
    classId: string;
    durationMinutes: number | null;
    questions: Array<{ prompt: string; points: number }>;
  },
): Promise<{ assignmentId: string; questionIds: string[] }> {
  const createRes = await page.request.post(`${API_BASE_URL}/assessments`, {
    headers: { Origin: origin },
    data: {
      title: params.title,
      type: params.type,
      courseId: params.courseId,
      ...(params.durationMinutes !== null ? { durationMinutes: params.durationMinutes } : {}),
    },
  });
  expect(createRes.ok(), `Create ${params.title} failed: ${createRes.status()}`).toBeTruthy();
  const assessment = (await createRes.json()) as { id: string };

  const questionIds: string[] = [];
  for (const q of params.questions) {
    const qRes = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/questions`, {
      headers: { Origin: origin },
      data: {
        type: 'SINGLE_CHOICE',
        prompt: q.prompt,
        points: q.points,
        payload: {
          options: [
            { id: 'a', text: 'Đáp án đúng' },
            { id: 'b', text: 'Đáp án sai' },
          ],
          correctOptionIds: ['a'],
          explanation: 'Giải thích mẫu',
        },
      },
    });
    expect(qRes.ok(), `Add question failed: ${qRes.status()}`).toBeTruthy();
    const createdQ = (await qRes.json()) as { id: string };
    questionIds.push(createdQ.id);
  }

  const pubRes = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/publish`, {
    headers: { Origin: origin },
  });
  expect(pubRes.ok()).toBeTruthy();

  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const assignRes = await page.request.post(`${API_BASE_URL}/assessments/${assessment.id}/assign`, {
    headers: { Origin: origin },
    data: { classIds: [params.classId], dueAt },
  });
  expect(assignRes.ok()).toBeTruthy();
  const assignJson = (await assignRes.json()) as { items: Array<{ id: string }> };
  return { assignmentId: assignJson.items[0]!.id, questionIds };
}

async function submitObjectiveAnswers(
  page: Page,
  origin: string,
  assignmentId: string,
  answers: Array<{ questionId: string; optionId: 'a' | 'b' }>,
): Promise<void> {
  const startRes = await page.request.post(
    `${API_BASE_URL}/assignments/${assignmentId}/submissions/start`,
    { headers: { Origin: origin } },
  );
  expect(startRes.ok(), `Start submission failed: ${startRes.status()}`).toBeTruthy();
  const started = (await startRes.json()) as { submission: { id: string; revision: number } };

  const submitRes = await page.request.post(
    `${API_BASE_URL}/assignments/${assignmentId}/submissions/submit`,
    {
      headers: { Origin: origin },
      data: {
        submissionId: started.submission.id,
        revision: started.submission.revision,
        answers: answers.map((a) => ({
          questionId: a.questionId,
          answerPayload: { selectedOptionIds: [a.optionId] },
        })),
      },
    },
  );
  expect(submitRes.ok(), `Submit failed: ${submitRes.status()}`).toBeTruthy();
}

test.describe('Phase 8 — Grading Formula, Progress Tracking, Zero-Leak & Admin Overview', () => {
  test.beforeEach(async () => {
    await reseedQaDatabase();
  });

  test.afterAll(async () => {
    await reseedQaDatabase();
  });

  test('RBAC guardrails: pure SUPERADMIN, TEACHER, STUDENT blocked from /admin/overview; ADMIN login keeps /admin/students default', async ({
    page,
  }) => {
    const { pageErrors } = attachGuards(page);

    // 1. Pure SUPERADMIN sees no /admin/overview sidebar link and gets 403 on /admin/overview & /student/results
    await loginThroughUi(page, 'superadmin@webedu.vn');
    await expect(page).toHaveURL(/\/superadmin\/settings/);
    await expectSidebarLinkAbsent(page, '/admin/overview');

    await page.goto('/admin/overview');
    await expect(page.getByText('403 — Giới hạn quyền truy cập')).toBeVisible();

    await page.goto('/student/results');
    await expect(page.getByText('403 — Giới hạn quyền truy cập')).toBeVisible();

    // 2. TEACHER gets 403 on /admin/overview
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/admin/overview');
    await expect(page.getByText('403 — Giới hạn quyền truy cập')).toBeVisible();

    // 3. STUDENT gets 403 on /admin/overview
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/admin/overview');
    await expect(page.getByText('403 — Giới hạn quyền truy cập')).toBeVisible();

    // 4. ADMIN login STILL lands on /admin/students (Phase 2 compatibility) and sees /admin/overview link
    await logoutViaApi(page);
    await loginThroughUi(page, 'admin@webedu.vn');
    await expect(page).toHaveURL(/\/admin\/students/);
    await withSidebarNav(page, async (nav, isMobile) => {
      await expect(nav.locator('a[href="/admin/overview"]')).toBeVisible();
      if (isMobile) {
        await nav.getByRole('button', { name: 'Đóng menu' }).click();
      }
    });

    expect(pageErrors).toEqual([]);
  });

  test('Admin configures HSK2 grading weights and uses /admin/overview KPIs, filters & class drilldown', async ({
    page,
  }) => {
    const { pageErrors } = attachGuards(page);

    await loginThroughUi(page, 'admin@webedu.vn');
    await page.goto('/admin/courses');
    await expect(
      page.getByRole('heading', { name: 'Quản lý danh mục khóa học HSK' }),
    ).toBeVisible();
    await assertZeroSeriousAxe(page, 'admin-courses');

    // Edit HSK2 grading weights: invalid 30/30/50 -> blocked -> fix to 30/20/50 & passingScore 5.5
    const hsk2Row = page.locator('tr', { hasText: 'HSK2' });
    await hsk2Row.getByRole('button', { name: 'Chỉnh sửa' }).click();

    const dialog = page.getByRole('dialog', { name: 'Chỉnh Sửa Thông Tin Khóa Học' });
    await expect(dialog).toBeVisible();

    await dialog.locator('#course-mini-test-weight').fill('30');
    await dialog.locator('#course-midterm-weight').fill('30');
    await dialog.locator('#course-final-weight').fill('50');
    await expect(dialog.getByTestId('course-weights-sum')).toContainText('110% / 100%');
    await dialog.getByRole('button', { name: 'Lưu khóa học' }).click();
    await expect(dialog.getByRole('alert')).toContainText(
      'Tổng tỷ trọng Mini-test + Giữa kỳ + Cuối kỳ phải bằng 100%',
    );

    await dialog.locator('#course-midterm-weight').fill('20');
    await dialog.locator('#course-passing-score').fill('5.5');
    await expect(dialog.getByTestId('course-weights-sum')).toContainText('100% / 100%');
    await dialog.getByRole('button', { name: 'Lưu khóa học' }).click();

    await expect(page.getByText('Đã cập nhật khóa học HSK2 thành công.')).toBeVisible();
    await expect(hsk2Row).toContainText('30/20/50%');
    await expect(hsk2Row).toContainText('Đạt ≥ 5.5');

    // Navigate via sidebar "Tổng quan các lớp" to /admin/overview
    await clickSidebarLink(page, /Tổng quan các lớp/i);
    await expect(page).toHaveURL(/\/admin\/overview/);
    await expect(page.getByRole('heading', { name: 'Tổng Quan Các Lớp' })).toBeVisible();

    const kpis = page.getByTestId('admin-overview-kpis');
    await expect(kpis).toContainText('Lớp đang học');
    await expect(kpis).toContainText('1 lớp sắp mở');
    await expect(kpis).toContainText('Học viên đang học');
    await expect(kpis).toContainText('Buổi học hôm nay');

    const pendingCard = kpis.locator('a[href="/admin/students/pending"]');
    await expect(pendingCard).toContainText('Chờ xếp lớp');
    await expect(pendingCard).toContainText('2');
    await expect(pendingCard).toContainText('Xem hàng chờ ->');

    await expect(page.getByTestId('admin-overview-today-sessions')).toBeVisible();
    await expect(page.getByTestId('admin-overview-upcoming-sessions')).toBeVisible();

    const classesTable = page.getByTestId('admin-overview-classes-table');
    await expect(classesTable).toContainText('HSK2-K26-01');
    await expect(classesTable).toContainText('HSK1-K26-01');

    await assertZeroSeriousAxe(page, 'admin-overview');
    await assertNoHorizontalOverflow(page, 'admin-overview');

    // Clickable pending card navigates to /admin/students/pending, then back
    await pendingCard.click();
    await expect(page).toHaveURL(/\/admin\/students\/pending/);
    await page.goBack();
    await expect(page).toHaveURL(/\/admin\/overview/);

    // Filter by HSK2 course & teacher Trương Mỹ Lan
    const overviewRes = await page.request.get(`${API_BASE_URL}/progress/admin-overview`);
    expect(overviewRes.ok()).toBeTruthy();
    const overviewJson = (await overviewRes.json()) as {
      filterOptions: {
        courses: Array<{ id: string; code: string }>;
        teachers: Array<{ id: string; fullName: string }>;
      };
    };
    const hsk2CourseId = overviewJson.filterOptions.courses.find((c) => c.code === 'HSK2')!.id;
    const teacherLanId = overviewJson.filterOptions.teachers.find((t) =>
      t.fullName.includes('Trương Mỹ Lan'),
    )!.id;

    await page.locator('#overview-filter-course').selectOption(hsk2CourseId);
    await page.locator('#overview-filter-teacher').selectOption(teacherLanId);
    await expect(classesTable).toContainText('HSK2-K26-01');
    await expect(classesTable).not.toContainText('HSK1-K26-01');

    // Drill down to /admin/classes/[id] and verify enriched ClassSummary
    await classesTable.getByRole('link', { name: 'HSK2-K26-01' }).click();
    await expect(page).toHaveURL(/\/admin\/classes\/[^/]+$/);
    const classSummary = page.getByRole('region', { name: 'Tổng quan lớp học' });
    await expect(classSummary.getByText('0 / 24 buổi (0%)')).toBeVisible();
    await expect(classSummary.getByText('còn 24 buổi')).toBeVisible();
    await expect(classSummary.getByText('Buổi tiếp theo')).toBeVisible();
    await assertZeroSeriousAxe(page, 'admin-class-detail-enriched');

    expect(pageErrors).toEqual([]);
  });

  test('Teacher presets, Class Progress tab & Student Zero-Leak -> Publish weighted final grade flow', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const { pageErrors } = attachGuards(page);

    // 1. Admin configures HSK2 weights 30/20/50 & passingScore 5.5
    await loginThroughUi(page, 'admin@webedu.vn');
    const origin = new URL(page.url()).origin;
    const coursesRes = await page.request.get(`${API_BASE_URL}/courses`);
    expect(coursesRes.ok()).toBeTruthy();
    const coursesJson = (await coursesRes.json()) as { items: Array<{ id: string; code: string }> };
    const hsk2CourseId = coursesJson.items.find((c) => c.code === 'HSK2')!.id;

    const patchCourseRes = await page.request.patch(`${API_BASE_URL}/courses/${hsk2CourseId}`, {
      headers: { Origin: origin },
      data: { miniTestWeight: 30, midtermWeight: 20, finalWeight: 50, passingScore: 5.5 },
    });
    expect(patchCourseRes.ok()).toBeTruthy();

    const classesRes = await page.request.get(`${API_BASE_URL}/classes`);
    expect(classesRes.ok()).toBeTruthy();
    const classesJson = (await classesRes.json()) as { items: Array<{ id: string; code: string }> };
    const hsk2ClassId = classesJson.items.find((c) => c.code === 'HSK2-K26-01')!.id;

    // 2. Teacher verifies MINI_TEST preset (15m) in UI, then publishes & assigns 4 types to HSK2-K26-01
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto('/teacher/assessments');

    await page.getByRole('button', { name: '+ Tạo đề' }).click();
    const typeSelect = page.getByLabel('Loại đề');
    const durationInput = page.getByLabel('Thời gian làm bài');
    await typeSelect.selectOption('MINI_TEST');
    await expect(durationInput).toHaveValue('15');
    await expect(page.getByTestId('assessment-type-preset-hint')).toContainText('15 phút');

    await page.getByLabel('Tên đề').fill('Mini-test HSK2 Số 1');
    await page.getByLabel('Khóa HSK').selectOption(hsk2CourseId);
    await page.getByRole('button', { name: 'Lưu nháp' }).click();
    await expect(page.getByText('Đã lưu nháp')).toBeVisible();

    const listAsmRes = await page.request.get(
      `${API_BASE_URL}/assessments?search=${encodeURIComponent('Mini-test HSK2 Số 1')}`,
    );
    expect(listAsmRes.ok()).toBeTruthy();
    const listAsmJson = (await listAsmRes.json()) as { items: Array<{ id: string }> };
    const miniTestAsmId = listAsmJson.items[0]!.id;

    const miniQRes = await page.request.post(
      `${API_BASE_URL}/assessments/${miniTestAsmId}/questions`,
      {
        headers: { Origin: origin },
        data: {
          type: 'SINGLE_CHOICE',
          prompt: 'Chọn nghĩa đúng của 你好',
          points: 10,
          payload: {
            options: [
              { id: 'a', text: 'Xin chào' },
              { id: 'b', text: 'Tạm biệt' },
            ],
            correctOptionIds: ['a'],
          },
        },
      },
    );
    expect(miniQRes.ok()).toBeTruthy();
    const miniQ = (await miniQRes.json()) as { id: string };

    expect(
      (
        await page.request.post(`${API_BASE_URL}/assessments/${miniTestAsmId}/publish`, {
          headers: { Origin: origin },
        })
      ).ok(),
    ).toBeTruthy();

    const dueAtFuture = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const assignMiniRes = await page.request.post(
      `${API_BASE_URL}/assessments/${miniTestAsmId}/assign`,
      { headers: { Origin: origin }, data: { classIds: [hsk2ClassId], dueAt: dueAtFuture } },
    );
    expect(assignMiniRes.ok()).toBeTruthy();
    const miniTestAssignmentId = ((await assignMiniRes.json()) as { items: Array<{ id: string }> })
      .items[0]!.id;

    const homework = await createAndAssignObjectiveAssessment(page, origin, {
      title: 'BTVN Buổi 1 HSK2',
      type: 'HOMEWORK',
      courseId: hsk2CourseId,
      classId: hsk2ClassId,
      durationMinutes: null,
      questions: [
        { prompt: 'BTVN Câu 1', points: 9 },
        { prompt: 'BTVN Câu 2', points: 1 },
      ],
    });
    const midterm = await createAndAssignObjectiveAssessment(page, origin, {
      title: 'Thi Giữa Kỳ HSK2',
      type: 'MIDTERM',
      courseId: hsk2CourseId,
      classId: hsk2ClassId,
      durationMinutes: 45,
      questions: [
        { prompt: 'Giữa kỳ Câu 1', points: 8 },
        { prompt: 'Giữa kỳ Câu 2', points: 2 },
      ],
    });
    const finalExam = await createAndAssignObjectiveAssessment(page, origin, {
      title: 'Thi Cuối Kỳ HSK2',
      type: 'FINAL',
      courseId: hsk2CourseId,
      classId: hsk2ClassId,
      durationMinutes: 60,
      questions: [
        { prompt: 'Cuối kỳ Câu 1', points: 16 },
        { prompt: 'Cuối kỳ Câu 2', points: 4 },
      ],
    });

    // 3. Student completes all 4 assessments: HW=9/10, MINI_TEST=10/10, MIDTERM=8/10, FINAL=16/20 (8.0/10)
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    await submitObjectiveAnswers(page, origin, homework.assignmentId, [
      { questionId: homework.questionIds[0]!, optionId: 'a' },
      { questionId: homework.questionIds[1]!, optionId: 'b' },
    ]);
    await submitObjectiveAnswers(page, origin, miniTestAssignmentId, [
      { questionId: miniQ.id, optionId: 'a' },
    ]);
    await submitObjectiveAnswers(page, origin, midterm.assignmentId, [
      { questionId: midterm.questionIds[0]!, optionId: 'a' },
      { questionId: midterm.questionIds[1]!, optionId: 'b' },
    ]);
    await submitObjectiveAnswers(page, origin, finalExam.assignmentId, [
      { questionId: finalExam.questionIds[0]!, optionId: 'a' },
      { questionId: finalExam.questionIds[1]!, optionId: 'b' },
    ]);

    // 4. Teacher confirms all 4 (GRADED), publishes HOMEWORK + MIDTERM + FINAL, leaves MINI_TEST at GRADED (Zero-Leak!)
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    for (const id of [
      homework.assignmentId,
      miniTestAssignmentId,
      midterm.assignmentId,
      finalExam.assignmentId,
    ]) {
      const confirmRes = await page.request.post(`${API_BASE_URL}/assignments/${id}/confirm-grades`, {
        headers: { Origin: origin },
        data: {},
      });
      expect(confirmRes.ok(), `Confirm grades failed for ${id}`).toBeTruthy();
    }
    for (const id of [homework.assignmentId, midterm.assignmentId, finalExam.assignmentId]) {
      const pubGradesRes = await page.request.post(
        `${API_BASE_URL}/assignments/${id}/publish-grades`,
        { headers: { Origin: origin }, data: {} },
      );
      expect(pubGradesRes.ok(), `Publish grades failed for ${id}`).toBeTruthy();
    }

    // 5. ZERO-LEAK CHECK as Student on /student/overview and /student/results
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');

    await expect(page).toHaveURL(/\/student\/overview/);
    await expect(page.getByText('Mini-test HSK2 Số 1')).toHaveCount(0);
    const hwOverviewBox = page.getByText('Tỷ lệ nộp BTVN').locator('..');
    await expect(hwOverviewBox).toContainText('100%');
    await expect(hwOverviewBox).toContainText('1/1 bài');
    await expect(page.getByText('Thi Cuối Kỳ HSK2')).toBeVisible();
    await assertZeroSeriousAxe(page, 'student-overview-zero-leak');
    await assertNoHorizontalOverflow(page, 'student-overview-zero-leak');

    await clickSidebarLink(page, /Kết quả học tập/i);
    await expect(page).toHaveURL(/\/student\/results/);
    await expect(page.getByText('Mini-test HSK2 Số 1')).toHaveCount(0);

    const summaryRegion = page.getByRole('region', { name: 'Tổng hợp điểm thành phần' });
    const miniCard = summaryRegion.locator('> div').filter({ hasText: 'Điểm TB Mini-test' });
    const midCard = summaryRegion.locator('> div').filter({ hasText: 'Giữa kỳ' });
    const finCard = summaryRegion.locator('> div').filter({ hasText: 'Cuối kỳ' });
    const totalCard = summaryRegion.locator('> div').filter({ hasText: 'Điểm tổng kết' });

    await expect(miniCard).toContainText('—');
    await expect(miniCard).toContainText('0 bài · trọng số 30%');
    await expect(midCard).toContainText('8.0');
    await expect(finCard).toContainText('8.0');
    await expect(totalCard).toContainText('—');
    await expect(totalCard).toContainText('Chưa đủ dữ liệu');
    await expect(page.getByTestId('published-results-table')).not.toContainText(
      'Mini-test HSK2 Số 1',
    );
    await assertZeroSeriousAxe(page, 'student-results-zero-leak');
    await assertNoHorizontalOverflow(page, 'student-results-zero-leak');

    // 6. Teacher inspects "Tiến độ & Kết quả" tab before & after publishing MINI_TEST
    await logoutViaApi(page);
    await loginThroughUi(page, 'teacher.lan@webedu.vn');
    await page.goto(`/teacher/classes/${hsk2ClassId}`);
    const infoTab = page.getByRole('tab', { name: 'Thông tin & Học viên' });
    const resultsTab = page.getByRole('tab', { name: 'Tiến độ & Kết quả' });
    await expect(infoTab).toHaveAttribute('tabindex', '0');
    await expect(resultsTab).toHaveAttribute('tabindex', '-1');
    await infoTab.press('ArrowLeft');
    await expect(resultsTab).toBeFocused();
    await expect(resultsTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', { name: 'Tiến độ & Kết quả' })).toBeVisible();

    const progressTable = page.getByTestId('class-progress-table');
    const studentProgressRow = progressTable.locator('tbody tr', { hasText: 'Phạm Gia Huy' });
    await expect(studentProgressRow).toBeVisible();
    await expect(studentProgressRow.locator('td').nth(3)).toContainText('1/1 · 100%');
    await expect(studentProgressRow.locator('td').nth(4)).toHaveText('—');
    await expect(studentProgressRow.locator('td').nth(5)).toHaveText('8.0');
    await expect(studentProgressRow.locator('td').nth(6)).toHaveText('8.0');
    await expect(studentProgressRow.locator('td').nth(7)).toHaveText('—');
    await expect(studentProgressRow.locator('td').nth(8)).toContainText('Chưa đủ dữ liệu');

    // Publish MINI_TEST in Grading Console UI
    await page.goto(`/teacher/assignments/${miniTestAssignmentId}/grading`);
    await page.locator('#btn-publish-confirmed-grades').click();
    await expect(page.getByText(/Đã công bố điểm cho 1 bài/i)).toBeVisible();

    // Verify Teacher Class Progress Tab now shows 10.0 / 8.0 / 8.0 -> 8.6 Đạt
    await page.goto(`/teacher/classes/${hsk2ClassId}`);
    await page.getByRole('tab', { name: 'Tiến độ & Kết quả' }).click();
    await expect(
      page.getByText('Mini-test 30% · Giữa kỳ 20% · Cuối kỳ 50% · Điểm Đạt ≥ 5.5'),
    ).toBeVisible();
    await expect(studentProgressRow.locator('td').nth(4)).toHaveText('10.0');
    await expect(studentProgressRow.locator('td').nth(5)).toHaveText('8.0');
    await expect(studentProgressRow.locator('td').nth(6)).toHaveText('8.0');
    await expect(studentProgressRow.locator('td').nth(7)).toHaveText('8.6');
    await expect(studentProgressRow.locator('td').nth(8)).toContainText('Đạt');
    await assertZeroSeriousAxe(page, 'teacher-class-progress-published');

    // 7. Student reloads /student/results -> sees exact 10.0 / 8.0 / 8.0 -> 8.6 Đạt
    await logoutViaApi(page);
    await loginThroughUi(page, 'active.student@webedu.vn');
    await page.goto('/student/results');

    await expect(miniCard).toContainText('10.0');
    await expect(miniCard).toContainText('1 bài · trọng số 30%');
    await expect(midCard).toContainText('8.0');
    await expect(finCard).toContainText('8.0');
    await expect(totalCard).toContainText('8.6');
    await expect(totalCard).toContainText('Đạt');

    const publishedTable = page.getByTestId('published-results-table');
    await expect(publishedTable).toContainText('Mini-test HSK2 Số 1');
    await expect(publishedTable).toContainText('10/10');
    await assertZeroSeriousAxe(page, 'student-results-published');
    await assertNoHorizontalOverflow(page, 'student-results-published');

    expect(pageErrors).toEqual([]);
  });
});
