import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

interface MockEnrollment {
  id: string;
  studentId: string;
  studentFullName: string;
  studentEmail: string;
  studentPhone: string;
  status: 'ACTIVE' | 'TRANSFERRED' | 'DROPPED' | 'COMPLETED';
  enrolledDate: string;
  leftDate: string | null;
  reason: string | null;
  absencesCount?: number;
}

interface MockClassRecord {
  id: string;
  code: string;
  status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  courseId: string;
  course: {
    id: string;
    code: string;
    name: string;
    level: 'HSK1' | 'HSK2' | 'HSK3' | 'HSK4' | 'BASIC_COMMUNICATION';
    defaultSessions: number | null;
  };
  teacherId: string;
  teacher: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  scheduleDays: number[];
  scheduleStartTime: string;
  scheduleEndTime: string;
  scheduleText: string;
  startDate: string;
  totalSessions: number;
  completedSessionsCount?: number;
  scheduledSessionsCount?: number;
  isStartDateLocked?: boolean;
  expectedEndDate: string | null;
  actualEndDate: string | null;
  closedReason: string | null;
  closedAt: string | null;
  notes: string | null;
  activeStudentsCount: number;
  totalEnrollmentsCount: number;
  scheduleConflictWarning?: string | null;
  createdAt: string;
  updatedAt: string;
  accessMode: 'FULL' | 'READ_ONLY';
  effectiveRole: 'ADMIN' | 'TEACHER';
  capabilities: {
    canEditClass: boolean;
    canManageEnrollments: boolean;
    canComplete: boolean;
    canReopen: boolean;
  };
  enrollments: MockEnrollment[];
  teacherHistory: Array<{
    id: string;
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    assignedFrom: string;
    assignedTo: string | null;
    changedById: string | null;
    changedByName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
}

function getTodayVnIso(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

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

function buildMockClasses(): Record<string, MockClassRecord> {
  const teacherLan = {
    id: 'teacher-lan',
    fullName: 'Trương Mỹ Lan',
    email: 'teacher.lan@webedu.vn',
    phone: '0901222333',
  };
  const teacherTuan = {
    id: 'teacher-tuan',
    fullName: 'Vương Quốc Tuấn',
    email: 'teacher.tuan@webedu.vn',
    phone: '0901444555',
  };
  const courseHsk1 = {
    id: 'course-hsk1',
    code: 'HSK1',
    name: 'Tiếng Trung Sơ Cấp HSK 1',
    level: 'HSK1' as const,
    defaultSessions: 24,
  };
  const courseHsk2 = {
    id: 'course-hsk2',
    code: 'HSK2',
    name: 'Tiếng Trung Sơ Cấp HSK 2',
    level: 'HSK2' as const,
    defaultSessions: 20,
  };

  return {
    'cls-locked-1': {
      id: 'cls-locked-1',
      code: 'HSK2-K26-LOCKED',
      status: 'ACTIVE',
      courseId: courseHsk2.id,
      course: courseHsk2,
      teacherId: teacherLan.id,
      teacher: teacherLan,
      scheduleDays: [1, 3, 5],
      scheduleStartTime: '18:00',
      scheduleEndTime: '19:30',
      scheduleText: 'Thứ 2, 4, 6 · 18:00–19:30',
      startDate: '2025-10-01',
      totalSessions: 20,
      completedSessionsCount: 0,
      scheduledSessionsCount: 7,
      isStartDateLocked: true,
      expectedEndDate: '2025-12-10',
      actualEndDate: null,
      closedReason: null,
      closedAt: null,
      notes: 'Lớp đã có dữ liệu điểm danh',
      activeStudentsCount: 3,
      totalEnrollmentsCount: 3,
      scheduleConflictWarning: null,
      createdAt: '2025-09-20T08:00:00.000Z',
      updatedAt: '2025-10-01T08:00:00.000Z',
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
          studentId: 'stu-1',
          studentFullName: 'Nguyễn Minh Anh',
          studentEmail: 'minhanh@webedu.vn',
          studentPhone: '0911000001',
          status: 'ACTIVE',
          enrolledDate: '2025-10-01',
          leftDate: null,
          reason: null,
          absencesCount: 6,
        },
        {
          id: 'enr-2',
          studentId: 'stu-2',
          studentFullName: 'Trần Quốc Bảo',
          studentEmail: 'quocbao@webedu.vn',
          studentPhone: '0911000002',
          status: 'ACTIVE',
          enrolledDate: '2025-10-01',
          leftDate: null,
          reason: null,
          absencesCount: 5,
        },
        {
          id: 'enr-3',
          studentId: 'stu-3',
          studentFullName: 'Lê Thu Hà',
          studentEmail: 'thuha@webedu.vn',
          studentPhone: '0911000003',
          status: 'ACTIVE',
          enrolledDate: '2025-10-01',
          leftDate: null,
          reason: null,
        },
      ],
      teacherHistory: [
        {
          id: 'hist-1',
          teacherId: teacherLan.id,
          teacherName: teacherLan.fullName,
          teacherEmail: teacherLan.email,
          assignedFrom: '2025-10-01',
          assignedTo: null,
          changedById: 'admin-1',
          changedByName: 'Quản trị viên',
          reason: 'Phân công ban đầu',
          createdAt: '2025-09-20T08:00:00.000Z',
        },
      ],
    },
    'cls-list-locked': {
      id: 'cls-list-locked',
      code: 'HSK2-K26-DONE4',
      status: 'ACTIVE',
      courseId: courseHsk2.id,
      course: courseHsk2,
      teacherId: teacherTuan.id,
      teacher: teacherTuan,
      scheduleDays: [2, 4, 6],
      scheduleStartTime: '19:00',
      scheduleEndTime: '20:30',
      scheduleText: 'Thứ 3, 5, 7 · 19:00–20:30',
      startDate: '2025-09-15',
      totalSessions: 24,
      completedSessionsCount: 4,
      expectedEndDate: '2025-11-30',
      actualEndDate: null,
      closedReason: null,
      closedAt: null,
      notes: 'Lớp đã học 4 buổi',
      activeStudentsCount: 1,
      totalEnrollmentsCount: 1,
      scheduleConflictWarning: null,
      createdAt: '2025-09-01T08:00:00.000Z',
      updatedAt: '2025-09-15T08:00:00.000Z',
      accessMode: 'FULL',
      effectiveRole: 'ADMIN',
      capabilities: {
        canEditClass: true,
        canManageEnrollments: true,
        canComplete: true,
        canReopen: false,
      },
      enrollments: [],
      teacherHistory: [],
    },
    'cls-unlocked-1': {
      id: 'cls-unlocked-1',
      code: 'HSK1-K26-OPEN',
      status: 'ACTIVE',
      courseId: courseHsk1.id,
      course: courseHsk1,
      teacherId: teacherTuan.id,
      teacher: teacherTuan,
      scheduleDays: [1, 3, 5],
      scheduleStartTime: '18:00',
      scheduleEndTime: '19:30',
      scheduleText: 'Thứ 2, 4, 6 · 18:00–19:30',
      startDate: '2025-10-05',
      totalSessions: 24,
      completedSessionsCount: 0,
      isStartDateLocked: false,
      expectedEndDate: '2025-12-20',
      actualEndDate: null,
      closedReason: null,
      closedAt: null,
      notes: 'Lớp chưa có điểm danh hoặc buổi hoàn thành',
      activeStudentsCount: 0,
      totalEnrollmentsCount: 0,
      scheduleConflictWarning: null,
      createdAt: '2025-09-25T08:00:00.000Z',
      updatedAt: '2025-09-25T08:00:00.000Z',
      accessMode: 'FULL',
      effectiveRole: 'ADMIN',
      capabilities: {
        canEditClass: true,
        canManageEnrollments: true,
        canComplete: true,
        canReopen: false,
      },
      enrollments: [],
      teacherHistory: [],
    },
  };
}

function createStructurallyValidTestJwt(): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: 'admin-1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.test-sig`;
}

async function installClassesMockApi(page: Page, baseURL?: string) {
  await page.context().addCookies([
    {
      name: 'webedu_access_token',
      value: createStructurallyValidTestJwt(),
      url: baseURL || 'http://localhost:3005',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  const classes = buildMockClasses();
  const patchPayloads: Array<{ id: string; body: Record<string, unknown> }> = [];
  const completePayloads: Array<{ id: string; body: Record<string, unknown> }> = [];

  const fulfillJson = (route: Route, data: unknown, status = 200) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const pathname = url.pathname;
    const method = req.method();

    if (pathname.endsWith('/auth/me') && method === 'GET') {
      return fulfillJson(route, {
        id: 'admin-1',
        email: 'admin@webedu.vn',
        fullName: 'Quản trị viên',
        phone: '0901000001',
        roles: ['ADMIN'],
        effectiveRole: 'ADMIN',
        status: 'ACTIVE',
      });
    }

    if (pathname.endsWith('/system-settings/config') && method === 'GET') {
      return fulfillJson(route, {
        centerName: 'Trung Tâm TD Hán Ngữ',
        centerLogoUrl: null,
        centerLogoBase64: null,
      });
    }

    if (pathname.endsWith('/students/pending-enrollment') && method === 'GET') {
      return fulfillJson(route, { items: [], totalPending: 0, total: 0, page: 1, limit: 20 });
    }

    if (pathname.endsWith('/courses') && method === 'GET') {
      return fulfillJson(route, {
        items: [
          {
            id: 'course-hsk1',
            code: 'HSK1',
            name: 'Tiếng Trung Sơ Cấp HSK 1',
            level: 'HSK1',
            levelLabel: 'HSK 1',
            defaultSessions: 24,
            description: null,
            isActive: true,
            activeClassesCount: 1,
            totalClassesCount: 1,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
          {
            id: 'course-hsk2',
            code: 'HSK2',
            name: 'Tiếng Trung Sơ Cấp HSK 2',
            level: 'HSK2',
            levelLabel: 'HSK 2',
            defaultSessions: 20,
            description: null,
            isActive: true,
            activeClassesCount: 2,
            totalClassesCount: 2,
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:00.000Z',
          },
        ],
        total: 2,
      });
    }

    if (pathname.endsWith('/teachers') && method === 'GET') {
      return fulfillJson(route, {
        items: [
          {
            id: 'teacher-lan',
            fullName: 'Trương Mỹ Lan',
            phone: '0901222333',
            email: 'teacher.lan@webedu.vn',
            status: 'ACTIVE',
            roles: ['TEACHER'],
            isAdmin: false,
            activeClassesCount: 1,
          },
          {
            id: 'teacher-tuan',
            fullName: 'Vương Quốc Tuấn',
            phone: '0901444555',
            email: 'teacher.tuan@webedu.vn',
            status: 'ACTIVE',
            roles: ['TEACHER'],
            isAdmin: false,
            activeClassesCount: 2,
          },
        ],
        total: 2,
        page: 1,
        limit: 10,
      });
    }

    if (pathname.endsWith('/classes/preview-schedule') && method === 'POST') {
      const payload = req.postDataJSON() as { totalSessions?: number } | null;
      return fulfillJson(route, {
        normalizedScheduleDays: [1, 3, 5],
        scheduleText: 'Thứ 2, 4, 6 · 18:00–19:30',
        expectedEndDate: '2026-12-30',
        totalSessions: payload?.totalSessions ?? 20,
        scheduleConflictWarning: null,
      });
    }

    if (pathname.endsWith('/classes') && method === 'GET') {
      const listItems = Object.values(classes).map((c) => {
        const clone = { ...c };
        delete (clone as Partial<MockClassRecord>).enrollments;
        delete (clone as Partial<MockClassRecord>).teacherHistory;
        delete (clone as Partial<MockClassRecord>).scheduledSessionsCount;
        if (c.id === 'cls-list-locked') {
          delete (clone as Partial<MockClassRecord>).isStartDateLocked;
        }
        return clone;
      });
      return fulfillJson(route, {
        items: listItems,
        total: listItems.length,
        page: 1,
        limit: 20,
      });
    }

    const completeMatch = pathname.match(/\/classes\/([^/]+)\/complete$/);
    if (completeMatch && method === 'POST') {
      const id = decodeURIComponent(completeMatch[1]!);
      const cls = classes[id];
      if (!cls) return fulfillJson(route, { detail: 'Not found' }, 404);
      const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
      completePayloads.push({ id, body });
      cls.status = 'COMPLETED';
      cls.accessMode = 'READ_ONLY';
      cls.scheduledSessionsCount = 0;
      cls.actualEndDate = String(body.actualEndDate ?? getTodayVnIso());
      cls.closedReason = typeof body.reason === 'string' ? body.reason : null;
      cls.capabilities = {
        canEditClass: false,
        canManageEnrollments: false,
        canComplete: false,
        canReopen: true,
      };
      return fulfillJson(route, cls);
    }

    const classDetailMatch = pathname.match(/\/classes\/([^/]+)$/);
    if (classDetailMatch) {
      const id = decodeURIComponent(classDetailMatch[1]!);
      const cls = classes[id];
      if (!cls) return fulfillJson(route, { detail: 'Not found' }, 404);

      if (method === 'GET') {
        return fulfillJson(route, cls);
      }

      if (method === 'PATCH') {
        const body = (req.postDataJSON() ?? {}) as Record<string, unknown>;
        patchPayloads.push({ id, body });
        if (typeof body.notes === 'string' || body.notes === null) {
          cls.notes = body.notes;
        }
        if (typeof body.startDate === 'string') {
          cls.startDate = body.startDate;
        }
        return fulfillJson(route, cls);
      }
    }

    return fulfillJson(route, { detail: `Unmocked endpoint: ${method} ${pathname}` }, 404);
  });

  return { patchPayloads, completePayloads };
}

test.describe('Wave 3 Classes Lifecycle — Absences Column, Complete Warning & startDate Lock', () => {
  test('8.1 & 8.2: ClassStudentsTable "Số buổi nghỉ" (30% threshold) + CompleteClassModal "[n] buổi" warning + Axe', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const { completePayloads } = await installClassesMockApi(page, baseURL);

    await page.goto('/admin/classes/cls-locked-1');
    await expect(page.getByRole('heading', { name: 'HSK2-K26-LOCKED' })).toBeVisible();

    // 1. "Số buổi nghỉ" column & 30% parity (6/20 = 30% -> warning; 5/20 = 25% -> normal; omitted -> 0 buổi)
    const studentsRegion = page.getByRole('region', { name: 'Danh sách học viên trong lớp' });
    await expect(studentsRegion.getByRole('columnheader', { name: 'Số buổi nghỉ' })).toBeVisible();

    const rowMinhAnh = studentsRegion.locator('tbody tr', { hasText: 'Nguyễn Minh Anh' });
    await expect(rowMinhAnh).toContainText('6 buổi');
    await expect(rowMinhAnh).toContainText('Cảnh báo ≥ 30%');

    const rowQuocBao = studentsRegion.locator('tbody tr', { hasText: 'Trần Quốc Bảo' });
    await expect(rowQuocBao).toContainText('5 buổi');
    await expect(rowQuocBao).not.toContainText('Cảnh báo ≥ 30%');

    const rowThuHa = studentsRegion.locator('tbody tr', { hasText: 'Lê Thu Hà' });
    await expect(rowThuHa).toContainText('0 buổi');
    await expect(rowThuHa).not.toContainText('Cảnh báo ≥ 30%');

    await assertNoHorizontalOverflow(page, '/admin/classes/cls-locked-1');
    await assertZeroSeriousAxeViolations(page, '/admin/classes/cls-locked-1 (ClassStudentsTable)');

    // 2. CompleteClassModal displays explicit scheduledSessionsCount warning (7 buổi) & preserves Phase 3 selectors
    await page.getByRole('button', { name: 'Kết thúc lớp học' }).click();
    const completeDialog = page.getByRole('dialog');
    await expect(completeDialog).toBeVisible();
    await expect(completeDialog).toContainText(
      'Kết thúc lớp HSK2-K26-LOCKED? Các buổi Dự kiến còn lại (7 buổi) sẽ tự động chuyển sang Đã hủy.',
    );
    await expect(completeDialog.locator('#complete-actual-end-date')).toBeVisible();
    await expect(completeDialog.locator('#complete-reason')).toBeVisible();

    await assertZeroSeriousAxeViolations(page, 'CompleteClassModal open');

    await completeDialog.locator('#complete-actual-end-date').fill(getTodayVnIso());
    await completeDialog.getByRole('button', { name: 'Xác nhận kết thúc lớp' }).click();
    await expect(completeDialog).toHaveCount(0);
    expect(completePayloads).toHaveLength(1);
    await expect(page.getByText('印 · CHỈ ĐỌC (READ_ONLY)')).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('8.2 fallback & empty colSpan: CompleteClassModal defaults undefined scheduledSessionsCount to 0 buổi + empty table colSpan=7', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    await installClassesMockApi(page, baseURL);

    await page.goto('/admin/classes/cls-unlocked-1');
    await expect(page.getByRole('heading', { name: 'HSK1-K26-OPEN' })).toBeVisible();

    const studentsRegion = page.getByRole('region', { name: 'Danh sách học viên trong lớp' });
    const emptyCell = studentsRegion.locator('tbody td');
    await expect(emptyCell).toHaveAttribute('colspan', '7');

    await page.getByRole('button', { name: 'Kết thúc lớp học' }).click();
    const completeDialog = page.getByRole('dialog');
    await expect(completeDialog).toContainText(
      'Kết thúc lớp HSK1-K26-OPEN? Các buổi Dự kiến còn lại (0 buổi) sẽ tự động chuyển sang Đã hủy.',
    );
    await completeDialog.getByRole('button', { name: 'Hủy' }).click();
    await expect(completeDialog).toHaveCount(0);

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('8.3: ClassFormModal startDate lock (isStartDateLocked=true & completedSessionsCount>0) omits startDate on PATCH; unlocked & create remain editable', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    const { patchPayloads } = await installClassesMockApi(page, baseURL);

    // 1. Detail page where isStartDateLocked=true (attendance data exists, completedSessionsCount=0)
    await page.goto('/admin/classes/cls-locked-1');
    await expect(page.getByRole('heading', { name: 'HSK2-K26-LOCKED' })).toBeVisible();
    await page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' }).click();

    const lockedDetailDialog = page.getByRole('dialog');
    await expect(lockedDetailDialog.locator('#class-start-date')).toBeDisabled();
    await expect(lockedDetailDialog).toContainText(
      'Không thể đổi ngày khai giảng khi lớp đã có buổi hoàn thành hoặc dữ liệu điểm danh.',
    );
    await assertZeroSeriousAxeViolations(page, 'ClassFormModal locked startDate');

    await lockedDetailDialog.locator('#class-notes').fill('Cập nhật ghi chú khi startDate bị khóa');
    await lockedDetailDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(lockedDetailDialog).toHaveCount(0);
    expect(patchPayloads).toHaveLength(1);
    expect(patchPayloads[0]?.id).toBe('cls-locked-1');
    expect('startDate' in (patchPayloads[0]?.body ?? {})).toBe(false);
    expect(patchPayloads[0]?.body.notes).toBe('Cập nhật ghi chú khi startDate bị khóa');

    // 2. Class list row where completedSessionsCount=4 (> 0) and isStartDateLocked is omitted
    await page.goto('/admin/classes');
    await expect(page.locator('tr', { hasText: 'HSK2-K26-DONE4' })).toBeVisible();
    await assertNoHorizontalOverflow(page, '/admin/classes');

    await page.getByRole('button', { name: 'Chỉnh sửa lớp HSK2-K26-DONE4' }).click();
    const lockedListDialog = page.getByRole('dialog');
    await expect(lockedListDialog.locator('#class-start-date')).toBeDisabled();
    await expect(lockedListDialog).toContainText(
      'Không thể đổi ngày khai giảng khi lớp đã có buổi hoàn thành hoặc dữ liệu điểm danh.',
    );
    await lockedListDialog.locator('#class-notes').fill('Ghi chú mới lớp 4 buổi');
    await lockedListDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(lockedListDialog).toHaveCount(0);
    expect(patchPayloads).toHaveLength(2);
    expect(patchPayloads[1]?.id).toBe('cls-list-locked');
    expect('startDate' in (patchPayloads[1]?.body ?? {})).toBe(false);

    // 3. Create mode: startDate must remain unlocked without lock helper text
    await page.getByRole('button', { name: '+ Mở lớp học mới' }).click();
    const createDialog = page.getByRole('dialog');
    await expect(createDialog.locator('#class-start-date')).toBeEnabled();
    await expect(createDialog).not.toContainText(
      'Không thể đổi ngày khai giảng khi lớp đã có buổi hoàn thành hoặc dữ liệu điểm danh.',
    );
    await createDialog.getByRole('button', { name: 'Hủy' }).click();
    await expect(createDialog).toHaveCount(0);

    // 4. Unlocked edit mode: startDate stays enabled and IS submitted on PATCH (Phase 3 preservation)
    await page.goto('/admin/classes/cls-unlocked-1');
    await expect(page.getByRole('heading', { name: 'HSK1-K26-OPEN' })).toBeVisible();
    await page.getByRole('button', { name: 'Chỉnh sửa lớp / Đổi GV' }).click();
    const unlockedDialog = page.getByRole('dialog');
    await expect(unlockedDialog.locator('#class-start-date')).toBeEnabled();
    await expect(unlockedDialog).not.toContainText(
      'Không thể đổi ngày khai giảng khi lớp đã có buổi hoàn thành hoặc dữ liệu điểm danh.',
    );
    await unlockedDialog.locator('#class-start-date').fill('2026-12-01');
    await unlockedDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(unlockedDialog).toHaveCount(0);
    expect(patchPayloads).toHaveLength(3);
    expect(patchPayloads[2]?.id).toBe('cls-unlocked-1');
    expect(patchPayloads[2]?.body.startDate).toBe('2026-12-01');

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });

  test('Responsive Mobile (375x812) & Desktop (1440x900) layout + Axe WCAG sweep', async ({
    page,
    baseURL,
  }) => {
    const { pageErrors, hydrationErrors } = attachStrictGuards(page);
    await installClassesMockApi(page, baseURL);

    for (const vp of [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'mobile-375', width: 375, height: 812 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto('/admin/classes/cls-locked-1');
      await expect(page.getByRole('heading', { name: 'HSK2-K26-LOCKED' })).toBeVisible();
      await expect(page.getByText('Cảnh báo ≥ 30%')).toBeVisible();
      await assertNoHorizontalOverflow(page, `/admin/classes/cls-locked-1 @ ${vp.name}`);
      await assertZeroSeriousAxeViolations(page, `/admin/classes/cls-locked-1 @ ${vp.name}`);
    }

    expect(pageErrors).toEqual([]);
    expect(hydrationErrors).toEqual([]);
  });
});
