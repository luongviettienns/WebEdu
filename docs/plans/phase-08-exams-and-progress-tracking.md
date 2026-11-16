# Phase 8 — Module 08 & 09: Kiểm Tra Tổng Kết & Theo Dõi Tiến Độ Học Tập Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** COMPLETED (16/11/2026 — `DEC-039`, `DEC-040`, `DEC-041` CONFIRMED & IMPLEMENTED). Đã hoàn tất 100% Tasks 8.1 đến 8.5, qua kiểm toán độc lập & cổng Verification Gates.

**Lệnh gọi thực thi nhanh cho phiên sau:** `"Thực thi Phase 8 theo docs/plans/phase-08-exams-and-progress-tracking.md"`

**Goal:** Xây dựng hoàn chỉnh hệ thống cấu hình động công thức điểm tổng kết theo từng khóa HSK (`FUNC-065`, `FUNC-068`, `FUNC-070`), thống kê chuyên cần BTVN (`FUNC-069`), theo dõi tiến độ buổi học & ngày kết thúc dự kiến (`FUNC-071`, `FUNC-072`), cùng bộ 3 giao diện Tiến độ & Kết quả cho Học viên (`/student/overview`, `/student/results` — `FUNC-073`), Giáo viên (tab `"Tiến độ & Kết quả"` trong Chi tiết lớp — `FUNC-074`) và Admin (`/admin/overview` — `FUNC-075`).

**Architecture:** Mở rộng bảng `Course` với 4 cột cấu hình công thức điểm tổng kết (`miniTestWeight`, `midtermWeight`, `finalWeight`, `passingScore`) kèm `CHECK` constraint PostgreSQL; bổ sung `ProgressModule` (`backend/src/modules/progress/`) tách biệt Policy tính toán thuần hàm (`grade-calculation.policy.ts`) với các Query Services dùng batch `groupBy`/`findMany` chống N+1; cưỡng chế tuyệt đối cổng Zero-Leak (`SubmissionStatus.RETURNED`) và cô lập quyền xem lịch sử lớp (`DEC-024`, `DEC-025`). Trên Frontend, nâng cấp `/admin/courses`, thêm preset tạo đề ở `/teacher/assessments`, hoàn thiện `/student/overview`, mở mới `/student/results`, `/admin/overview` và tab `"Tiến độ & Kết quả"` trong `ClassDetailView`.

**Tech Stack:** NestJS 12, Prisma ORM 6 (SQL Migration chuẩn), PostgreSQL 16+, Next.js 16 App Router, React 19, Tailwind CSS v4 (Theme Thư họa Á Đông), Vitest + Supertest, Playwright + Axe.

**Spec:** [`08-kiem-tra-tong-ket.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/modules/08-kiem-tra-tong-ket.md), [`09-theo-doi-tien-do.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/modules/09-theo-doi-tien-do.md), [`decision-log.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/01-business/decision-log.md) (`DEC-039`, `DEC-040`, `DEC-041`), [`prototype-review.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/prototype-review.md).

---

## Global Constraints

- **Anti-God-File LOC Limits (`node scripts/check-loc.js`):** Backend Services `<= 350` LOC, Backend Guards `<= 200` LOC, Backend Controllers / Policies / Mappers / Parsers `<= 250` LOC, Frontend App Pages `<= 250` LOC, Frontend Feature Hooks `<= 300` LOC, Frontend Feature Components `<= 300` LOC.
- **TypeScript Strict & Linter:** Cấm `any` (`typescript/no-explicit-any: "error"` trong `.oxlintrc.json`), strict null checks ở cả `backend/` và `frontend/`.
- **Production Code Hygiene:** Tuyệt đối không chèn mã đặc tả nội bộ (`FUNC-xxx`, `DEC-xxx`, `SEC-xxx`, `BR-xxx`, `EXAM-xx`) vào bất kỳ tệp non-test nào trong `backend/src/**` và `frontend/src/**`.
- **Database Migrations:** Cấm `prisma db push`. Mọi thay đổi schema thực hiện qua SQL migration trong `backend/prisma/migrations/` kèm ràng buộc `CHECK` mức PostgreSQL.
- **API & UI Inventory Sync:** Mọi route HTTP mới phải đăng ký vào `DECLARED_PHASE2_API_INVENTORY` trong `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts` và [`docs/test-inventory-api.md`](../test-inventory-api.md); mọi trang `page.tsx` mới phải cập nhật vào [`docs/test-inventory-ui.md`](../test-inventory-ui.md), `nav-links.ts` và `PortalTopbar.tsx`.
- **Default Landing Route Preservation:** Giữ nguyên điều hướng mặc định sau đăng nhập Admin là `/admin/students` để bảo toàn 100% tương thích E2E Phase 2 (`phase2-browser-qa.spec.ts`, `phase2-comprehensive-ui.spec.ts`); `/admin/overview` được gắn rõ ràng trong sidebar nhóm `VẬN HÀNH & DANH MỤC`.
- **Out-of-Scope Enforcement:** Không triển khai nhập điểm kiểm tra giấy thủ công (`FUNC-076`), không tính `HOMEWORK` vào điểm tổng kết (`DEC-014`).
- **Tái sử dụng Helpers hiện hữu:** Dùng `sumQuestionMaxScore` (`backend/src/modules/grading/policies/answer-normalizer.policy.ts`), `AttendancePolicy` (`backend/src/modules/attendance/policies/attendance.policy.ts`), `resolveVnToday` / `formatIsoDateUtc` (`backend/src/common/utils/timezone.util.ts`), `ClassAccessService` (`backend/src/modules/classes/services/class-access.service.ts`), `BaseDialog` và `StatusTag`.

---

## Review Focus

1. **Zero-Leak Điểm Chưa Công Bố (`SubmissionStatus.RETURNED`):** Bài nộp ở trạng thái `IN_PROGRESS`, `SUBMITTED_WAITING`, `AUTO_GRADED_PENDING_REVIEW`, `GRADED`, hoặc `SUPERSEDED` tuyệt đối không được lọt vào `miniTestAvg`, `midtermAvg`, `finalAvg`, `finalScore`, `homeworkAverageScore10`, hay danh sách `Kết quả gần đây` / `Điểm đã công bố` của học viên; ở phía Giáo viên cũng chỉ lấy bài `RETURNED` cho điểm thành phần/tổng kết.
2. **Bản Ghi Ghi `0 Điểm` Quá Hạn Không Nộp (`submittedAt === null`):** Khi GV/Admin chốt `0 điểm` cho bài quá hạn chưa nộp:
   - Với `HOMEWORK`: **không** tính là đã nộp trong `homeworkSubmittedCount` (chỉ tính bài có `submittedAt !== null` và `status !== 'SUPERSEDED'`), nhưng nếu bản ghi `0 điểm` đã `RETURNED` thì vẫn tính vào `homeworkAverageScore10` tham khảo.
   - Với `MINI_TEST | MIDTERM | FINAL`: khi bản ghi `0 điểm` đã `RETURNED`, điểm `0/maxScore` vẫn tính vào điểm thành phần và điểm tổng kết.
3. **Quy Đổi Thang Điểm 10 & Trọng Số Khóa Học Có Thành Phần `0%`:** Đề có tổng điểm `maxScore !== 10` (ví dụ `20` hoặc `40`) phải quy chuẩn `(totalScore / maxScore) * 10` trước khi lấy trung bình cộng từng loại; nếu khóa học đặt trọng số một thành phần bằng `0%` (ví dụ `miniTestWeight=30, midtermWeight=0, finalWeight=70`), học viên chỉ cần đủ bài `RETURNED` cho các thành phần có trọng số `> 0%` là tính được `finalScore` (không trả `"Chưa đủ dữ liệu"` do thiếu thành phần `0%`).
4. **Cô Lập Dữ Liệu Theo Khoảng Ghi Danh & Quyền Xem Lớp (`DEC-008`, `DEC-024`, `DEC-025`):** Bài tập giao trong lớp chỉ tính cho học viên nếu bài giao nằm trong khoảng ghi danh `[enrolledDate, leftDate]` hoặc học viên thực sự có `Submission` ở bài giao đó; Giáo viên lớp mới tuyệt đối không thấy kết quả từ lớp cũ của học viên; `SUPERADMIN` thuần nhận `403 Forbidden` ở mọi endpoint học vụ của `ProgressController`.
5. **Chống N+1 Truy Vấn Trên Dashboard & Bảng Tiến Độ Lớp:** Danh sách tiến độ 30+ học viên trong lớp và tổng quan nhiều lớp của Admin chỉ dùng truy vấn gộp theo lô (`findMany` / `groupBy` với `in: [...]`), không lặp query DB trong vòng lặp từng học viên hoặc từng lớp.

---

## File Structure & Interfaces (Consumes / Produces)

- **Consumes:**
  - Models: `Course`, `Class`, `Enrollment`, `LessonSession`, `AttendanceRecord`, `Assessment`, `Question`, `ClassAssignment`, `Submission`.
  - Policies & Services: `AttendancePolicy`, `ClassAccessService`, `sumQuestionMaxScore`, `timezone.util.ts`.
- **Produces:**
  - **Database:** `backend/prisma/migrations/20261116180000_phase08_course_grading_weights/migration.sql` — 4 cột mới trên `courses`: `mini_test_weight INT DEFAULT 20`, `midterm_weight INT DEFAULT 30`, `final_weight INT DEFAULT 50`, `passing_score DOUBLE PRECISION DEFAULT 5.0` + `CHECK` constraints.
  - **Backend Courses & Classes Extensions:**
    - `CourseItemDto` bổ sung `miniTestWeight`, `midtermWeight`, `finalWeight`, `passingScore`.
    - `ClassItemDto` & `ClassDetailDto` bổ sung `remainingSessionsCount`, `progressPercent`, `nextSession: { id, sessionNumber, sessionDate, weekdayLabel, startTime, endTime, isMakeup } | null`.
  - **Backend `ProgressModule` (`backend/src/modules/progress/`):**
    - `progress.controller.ts` (3 endpoints):
      - `GET /api/v1/progress/me?classId=...` (`@Roles(Role.STUDENT)`)
      - `GET /api/v1/classes/:classId/progress` (`@Roles(Role.ADMIN, Role.TEACHER)`)
      - `GET /api/v1/progress/admin-overview?courseId=&teacherId=&status=&includeEnded=` (`@Roles(Role.ADMIN)`)
    - `policies/grade-calculation.policy.ts`
    - `services/student-progress.service.ts`, `services/class-progress.service.ts`, `services/admin-overview.service.ts`
  - **Frontend Modules & Routes:**
    - `frontend/src/features/courses/` (bổ sung cấu hình tỷ trọng điểm & điểm Đạt trên `CourseFormModal.tsx` & `CourseTable.tsx`)
    - `frontend/src/features/assessments/utils/assessment-presets.ts` + `AssessmentEditor.tsx` (Preset gợi ý theo 4 loại đề)
    - `frontend/src/features/progress/` (`api/progress.api.ts`, `types/progress.types.ts`, `components/ClassProgressResultsTab.tsx`, `components/StudentResultsView.tsx`, `components/AdminOverviewDashboard.tsx`)
    - `frontend/src/app/(portal)/student/results/page.tsx` & `frontend/src/app/(portal)/admin/overview/page.tsx`
    - Cập nhật `ClassSummary.tsx`, `ClassDetailView.tsx`, `StudentOverviewCards.tsx`, `StudentMetricsSidebar.tsx`, `nav-links.ts`, `PortalTopbar.tsx`.

---

### Task 8.1: Dynamic Course Grading Formula & Class Session Progress Enrichment

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261116180000_phase08_course_grading_weights/migration.sql`
- Modify: `backend/src/modules/courses/courses.types.ts`
- Modify: `backend/src/modules/courses/dto/courses.dto.ts`
- Modify: `backend/src/modules/courses/mappers/course.mapper.ts`
- Modify: `backend/src/modules/courses/services/courses.service.ts`
- Modify: `backend/src/modules/classes/classes.types.ts`
- Modify: `backend/src/modules/classes/mappers/class.mapper.ts`
- Modify: `backend/src/modules/classes/services/class-query.service.ts`
- Modify: `backend/src/modules/classes/services/class-crud.service.ts`
- Test: `backend/src/modules/courses/courses.service.spec.ts`
- Test: `backend/src/modules/classes/class-lifecycle-and-query.service.spec.ts`

**Interfaces:**
- Consumes: `Course`, `Class`, `LessonSession`, `resolveVnToday`, `formatIsoDateUtc`, `getWeekdayVnLabel`.
- Produces:
  - `CourseItemDto`: `{ ..., miniTestWeight: number; midtermWeight: number; finalWeight: number; passingScore: number }`
  - `validateCourseGradingConfig(input: { miniTestWeight: number; midtermWeight: number; finalWeight: number; passingScore: number }): { miniTestWeight: number; midtermWeight: number; finalWeight: number; passingScore: number }`
  - `ClassNextSessionDto`: `{ id: string; sessionNumber: number | null; sessionDate: string; weekdayLabel: string; startTime: string; endTime: string; isMakeup: boolean }`
  - `ClassItemDto` / `ClassDetailDto`: bổ sung `remainingSessionsCount: number; progressPercent: number; nextSession: ClassNextSessionDto | null`.

- [x] **Step 1: Write the failing unit tests for course grading weights validation and class progress enrichment**

Tạo/bổ sung test cases vào `backend/src/modules/courses/services/courses.service.spec.ts` và `backend/src/modules/classes/services/class-query.service.spec.ts`:
```ts
// courses.service.spec.ts
it('defaults course grading weights to 20/30/50 and passingScore 5.0 when omitted', async () => { /* assert created DTO has 20, 30, 50, 5 */ });
it('rejects course create/update when weights sum is not 100 or negative', async () => { /* expect BadRequestException */ });
it('rejects passingScore outside 0..10', async () => { /* expect BadRequestException */ });
it('updates partial weight fields against existing course weights and validates sum === 100', async () => { /* e.g., updating only finalWeight without balancing fails; balanced update succeeds */ });

// class-query.service.spec.ts
it('computes remainingSessionsCount, progressPercent and nearest SCHEDULED nextSession in GMT+7', async () => { /* mock completed count + next session */ });
it('returns nextSession: null and progressPercent: 100 when all sessions are completed', async () => { /* assert boundary */ });
```

- [x] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/courses/services/courses.service.spec.ts src/modules/classes/services/class-query.service.spec.ts`
Expected: FAIL with missing fields `miniTestWeight`, `remainingSessionsCount`, `nextSession`.

- [x] **Step 3: Create Prisma migration & implement Course weights + Class progress enrichment**

1. Thêm 4 cột vào `model Course` trong `backend/prisma/schema.prisma`:
   `miniTestWeight Int @default(20) @map("mini_test_weight")`, `midtermWeight Int @default(30) @map("midterm_weight")`, `finalWeight Int @default(50) @map("final_weight")`, `passingScore Float @default(5) @map("passing_score")`.
2. Tạo `backend/prisma/migrations/20261116180000_phase08_course_grading_weights/migration.sql` chứa `ALTER TABLE "courses" ADD COLUMN ...` và `ADD CONSTRAINT "courses_grading_weights_check" CHECK ("mini_test_weight" >= 0 AND "midterm_weight" >= 0 AND "final_weight" >= 0 AND "mini_test_weight" + "midterm_weight" + "final_weight" = 100 AND "passing_score" >= 0 AND "passing_score" <= 10);`.
3. Chạy `cd backend && npx prisma migrate deploy && npm run prisma:generate` (đồng bộ cả DB dev và test khi chạy test).
4. Cập nhật `courses.dto.ts`, `courses.types.ts`, `course.mapper.ts` (hàm `validateCourseGradingConfig`), `courses.service.ts` (gộp kiểm tra từ cả `createCourse` và `updateCourse`, ghi vào `SystemAuditLog` metadata).
5. Cập nhật `classes.types.ts`, `class.mapper.ts`, `class-query.service.ts` (batch query `nextSession` gần nhất từ `resolveVnToday(new Date())` cho `listClasses` và `getClassById`), và `class-crud.service.ts` đồng bộ các trường mới trong `toClassItemDto` / `toClassDetailDto`.

- [x] **Step 4: Run tests, typecheck, lint & check-loc to verify Task 8.1 passes**

Run: `cd backend && npx vitest run src/modules/courses/services/courses.service.spec.ts src/modules/classes/services/class-query.service.spec.ts && npm run typecheck && npm run lint && npm run check:loc`
Expected: PASS (0 errors, LOC within limits).

- [x] **Step 5: Commit Task 8.1**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261116180000_phase08_course_grading_weights/ backend/src/modules/courses/ backend/src/modules/classes/
git commit -m "feat(courses,classes): add dynamic course grading weights and class session progress fields"
```

---

### Task 8.2: Pure Calculation Policy & Backend `ProgressModule` (`FUNC-069, 070, 073, 074, 075`)

**Files:**
- Create: `backend/src/modules/progress/progress.module.ts`
- Create: `backend/src/modules/progress/progress.controller.ts`
- Create: `backend/src/modules/progress/progress.types.ts`
- Create: `backend/src/modules/progress/dto/progress.dto.ts`
- Create: `backend/src/modules/progress/policies/grade-calculation.policy.ts`
- Create: `backend/src/modules/progress/services/student-progress.service.ts`
- Create: `backend/src/modules/progress/services/class-progress.service.ts`
- Create: `backend/src/modules/progress/services/admin-overview.service.ts`
- Create: `backend/src/modules/progress/mappers/progress.mapper.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts`
- Modify: `docs/test-inventory-api.md`
- Test: `backend/src/modules/progress/policies/grade-calculation.policy.spec.ts`
- Test: `backend/src/modules/progress/services/progress-services.spec.ts`
- Test: `backend/test/phase08-exams-and-progress.e2e-spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AttendancePolicy`, `ClassAccessService`, `sumQuestionMaxScore`, `timezone.util.ts`.
- Produces:
  - `computeStudentAcademicSummary(input: StudentAcademicCalculationInput): StudentAcademicSummaryDto` trong `grade-calculation.policy.ts`
  - `isAssignmentEligibleForEnrollment(assignment: { assignedAt: Date; dueAt: Date }, enrollment: { enrolledDate: Date; leftDate: Date | null }, hasSubmission: boolean): boolean`
  - `ProgressController` routes:
    - `GET /api/v1/progress/me` (`GetStudentProgressQueryDto { classId? }`) -> `StudentProgressResponseDto`
    - `GET /api/v1/classes/:classId/progress` (`@Param('classId', ParseUUIDPipe)`) -> `ClassProgressReportDto`
    - `GET /api/v1/progress/admin-overview` (`AdminOverviewQueryDto { courseId?, teacherId?, status?, includeEnded? }`) -> `AdminOverviewResponseDto`

- [x] **Step 1: Write the failing unit tests for `grade-calculation.policy.ts` and `ProgressModule` services**

Viết `backend/src/modules/progress/policies/grade-calculation.policy.spec.ts` kiểm chứng:
```ts
it('normalizes scores from arbitrary maxScore (e.g. 16/20 -> 8.0) and rounds averages to 1 decimal', () => { /* ... */ });
it('ignores non-RETURNED submissions (IN_PROGRESS, SUBMITTED_WAITING, AUTO_GRADED_PENDING_REVIEW, GRADED, SUPERSEDED)', () => { /* Zero-Leak */ });
it('counts overdue-zero RETURNED (submittedAt: null) in exam averages and finalScore, but NOT in homeworkSubmittedCount', () => { /* DEC-038 + DEC-040 */ });
it('computes finalScore using dynamic course weights and sets passStatus PASSED/FAILED against passingScore', () => { /* e.g. 20/30/50 -> PASSED >= 5.0 */ });
it('returns finalScore: null and INSUFFICIENT_DATA when a component with weight > 0 lacks a RETURNED submission, and succeeds when a component with weight === 0 has no submissions', () => { /* DEC-039 */ });
it('excludes HOMEWORK from finalScore and computes homeworkSubmissionRatePercent & homeworkAverageScore10 separately', () => { /* DEC-014 + DEC-040 */ });
```
Và `backend/src/modules/progress/services/progress-services.spec.ts` kiểm chứng:
```ts
it('StudentProgressService isolates data to the requested/active class and blocks unauthorized classId with 403', async () => { /* ... */ });
it('ClassProgressService blocks teachers who do not own the class and omits historical classes of students', async () => { /* DEC-024, DEC-025 */ });
it('AdminOverviewService returns 4 KPI cards, batched averageAttendanceRatePercent per class, todaySessions and upcoming5DaysSessions', async () => { /* ... */ });
```

- [x] **Step 2: Run unit tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/progress/policies/grade-calculation.policy.spec.ts src/modules/progress/services/progress-services.spec.ts`
Expected: FAIL with missing module/file.

- [x] **Step 3: Implement `ProgressModule`, Policy, 3 Services, Controller, and Real-DB E2E Test**

1. Triển khai `grade-calculation.policy.ts` với hàm thuần `computeStudentAcademicSummary` và `isAssignmentEligibleForEnrollment` (không side effect, mỗi file `< 250` LOC).
2. Triển khai `StudentProgressService` (trả thông tin lớp đang chọn + tiến độ buổi học + `nextSession` + chuyên cần từ `AttendancePolicy` + thống kê BTVN + 4 chỉ số tổng kết + `publishedResults` chỉ lấy `RETURNED` mới nhất trước + lịch sử các lớp đã học cho chính học viên).
3. Triển khai `ClassProgressService` (kiểm tra quyền qua `ClassAccessService.resolveClassDetailAccess`; nạp theo lô `enrollments`, `lessonSessions`, `attendanceRecords`, `classAssignments`, `submissions`; trả về `classSummary`, `gradingFormula`, và mảng `students` gồm `absencesCount`, `attendanceRatePercent`, `homeworkSubmittedCount`, `homeworkGivenCount`, `homeworkSubmissionRatePercent`, `miniTestAvg`, `midtermAvg`, `finalAvg`, `finalScore`, `passStatus`, `isAtRisk`).
4. Triển khai `AdminOverviewService` (`@Roles(Role.ADMIN)`: 4 KPI `activeClassesCount`, `upcomingClassesCount`, `activeStudentsCount`, `pendingEnrollmentCount`, `todaySessionsCount`; bảng `classes` có `averageAttendanceRatePercent` tính theo lô từ `attendanceRecords` + `totalSessions`/`completedSessionsCount`/`nextSession`; `todaySessions` và `upcomingSessions` 5 ngày tới GMT+7).
5. Đăng ký `ProgressModule` vào `AppModule`, cập nhật `DECLARED_PHASE2_API_INVENTORY` trong `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts` (97 $\rightarrow$ 100 endpoints) và [`docs/test-inventory-api.md`](../test-inventory-api.md).
6. Tạo `backend/test/phase08-exams-and-progress.e2e-spec.ts` test trực tiếp trên PostgreSQL 16 thật: Zero-Leak (`GRADED` không lộ sang `progress/me`), ghi `0 điểm` quá hạn, trọng số động khóa học `30/0/70`, phân quyền IDOR giữa Student A/B, Teacher lớp khác, Superadmin thuần bị `403`, và danh sách KPI của Admin.

- [x] **Step 4: Run Unit, E2E Inventory, Phase 8 E2E, Typecheck, Lint & Check-LOC**

Run: `cd backend && npm run typecheck && npm run lint && npm run check:loc && npm run test && npm run test:e2e`
Expected: PASS 100% (bao gồm đối soát `100` endpoints khớp tuyệt đối).

- [x] **Step 5: Commit Task 8.2**

```bash
git add backend/src/modules/progress/ backend/src/app.module.ts backend/test/ docs/test-inventory-api.md
git commit -m "feat(progress): implement Phase 8 ProgressModule, dynamic grading formula & RBAC E2E tests"
```

---

### Task 8.3: Frontend Course Weights Config (`FUNC-070`), Assessment Presets (`FUNC-068`) & Class Progress Tab (`FUNC-071, 072, 074`)

**Files:**
- Modify: `frontend/src/features/courses/api/courses.api.ts`
- Create: `frontend/src/features/courses/utils/course-grading.util.ts`
- Create: `frontend/src/features/courses/components/CourseGradingWeightsFields.tsx`
- Modify: `frontend/src/features/courses/components/CourseFormModal.tsx`
- Modify: `frontend/src/features/courses/components/CourseTable.tsx`
- Create: `frontend/src/features/assessments/utils/assessment-presets.ts`
- Modify: `frontend/src/features/assessments/components/AssessmentEditor.tsx`
- Modify: `frontend/src/features/assessments/hooks/useAssessments.ts`
- Create: `frontend/src/features/progress/types/progress.types.ts`
- Create: `frontend/src/features/progress/api/progress.api.ts`
- Create: `frontend/src/features/progress/utils/progress-format.ts`
- Create: `frontend/src/features/progress/components/ClassProgressResultsTab.tsx`
- Modify: `frontend/src/features/classes/api/classes.types.ts` (`re-exported by classes.api.ts`)
- Modify: `frontend/src/features/classes/components/ClassSummary.tsx`
- Modify: `frontend/src/features/classes/components/ClassDetailView.tsx`
- Test: `frontend/src/features/progress/utils/progress-format.unit.spec.ts`
- Test: `frontend/src/features/courses/utils/course-grading.unit.spec.ts`

**Interfaces:**
- Consumes: `PATCH/POST /courses`, `GET /classes/:classId/progress`, `CourseItemDto`, `ClassDetail`.
- Produces:
  - `ASSESSMENT_TYPE_PRESETS: Record<AssessmentType, { defaultDurationMinutes: number | null; sectionHint: string }>`
  - `ClassProgressResultsTab` component gắn vào tab `'progress'` (`Tiến độ & Kết quả`) của `ClassDetailView`.

- [x] **Step 1: Write the failing frontend unit test for progress formatting/sorting & assessment presets**

Tạo `frontend/src/features/progress/utils/progress-format.ts` & `frontend/src/features/progress/utils/progress-format.unit.spec.ts` kiểm tra:
```ts
test('formatScore10 renders dash for null and 1-decimal score otherwise', () => { /* ... */ });
test('sortClassProgressRows sorts by fullName A-Z by default and numerically by numeric columns', () => { /* ... */ });
test('ASSESSMENT_TYPE_PRESETS provides distinct duration and section structure hints for HOMEWORK, MINI_TEST, MIDTERM, FINAL', () => { /* ... */ });
```

- [x] **Step 2: Run frontend unit test to verify it fails**

Run: `cd frontend && npm run test:unit`
Expected: FAIL with missing module.

- [x] **Step 3: Implement Course weights UI, Assessment presets, ClassSummary enrichment & ClassProgressResultsTab**

1. Cập nhật `courses.api.ts`, `CourseFormModal.tsx` (thêm 4 input số: `Tỷ trọng Mini-test (%)`, `Giữa kỳ (%)`, `Cuối kỳ (%)`, `Điểm Đạt (thang 10)` kèm hiển thị tổng tỷ trọng thời gian thực và chặn submit nếu tổng `!== 100`), và `CourseTable.tsx` (cột `Công thức Tổng kết` hiển thị `20/30/50 · Đạt ≥ 5.0`).
2. Tạo `assessment-presets.ts` và tích hợp vào `useAssessments.ts` / `AssessmentEditor.tsx`: khi tạo đề mới (`assessmentId === null`), đổi loại đề (`HOMEWORK` / `MINI_TEST` / `MIDTERM` / `FINAL`) tự gợi ý `durationMinutes` mặc định nếu người dùng chưa nhập tay và hiển thị hộp gợi ý cấu trúc phần đề (`FUNC-068`).
3. Tạo `progress.types.ts`, `progress.api.ts` và `ClassProgressResultsTab.tsx` (bảng tiến độ & kết quả học viên theo Prototype `VIEWS.cls` tab `res`: cột `Họ tên`, `Buổi nghỉ`, `Chuyên cần`, `Nộp BTVN`, `TB Mini-test`, `Giữa kỳ`, `Cuối kỳ`, `Tổng kết`, `Kết quả`, cho phép sort theo cột, highlight dòng cảnh báo vắng $\ge 30\%$ hoặc nộp BTVN $< 60\%$, ghi chú công thức đang áp dụng của khóa học).
4. Cập nhật `classes/api/classes.api.ts`, `ClassSummary.tsx` (hiển thị tiến độ `X/Y buổi (Z%)` + thanh progress + `Buổi tiếp theo` + trạng thái `Chờ khai giảng` / `Đang học` / `Đã hoàn thành`), và `ClassDetailView.tsx` (thêm tab thứ 5 `['progress', 'Tiến độ & Kết quả']`).

- [x] **Step 4: Run frontend unit test, typecheck, lint & check-loc**

Run: `cd frontend && npm run test:unit && npm run typecheck && npm run lint && cd .. && node scripts/check-loc.js`
Expected: PASS 100%.

- [x] **Step 5: Commit Task 8.3**

```bash
git add frontend/src/features/courses/ frontend/src/features/assessments/ frontend/src/features/classes/ frontend/src/features/progress/
git commit -m "feat(frontend): add course grading weights config, assessment presets & class progress tab"
```

---

### Task 8.4: Student Overview Live Wiring & `/student/results` Page (`FUNC-069, 070, 073`)

**Files:**
- Create: `frontend/src/features/progress/components/StudentResultsView.tsx`
- Create: `frontend/src/features/progress/components/StudentResultsOverviewCards.tsx`
- Create: `frontend/src/features/progress/components/StudentResultsDetailSections.tsx`
- Create: `frontend/src/app/(portal)/student/results/page.tsx`
- Modify: `frontend/src/app/(portal)/student/overview/page.tsx`
- Modify: `frontend/src/features/students/components/StudentOverviewCards.tsx`
- Modify: `frontend/src/features/students/components/StudentMetricsSidebar.tsx`
- Modify: `frontend/src/components/layout/nav-links.ts`
- Modify: `frontend/src/components/layout/PortalTopbar.tsx`

**Interfaces:**
- Consumes: `GET /api/v1/progress/me`, `GET /api/v1/attendance/me`, `GET /api/v1/assignments/me`.
- Produces:
  - Route `/student/results` (`Học tập -> Kết quả học tập`, han `成绩`) với 4 thẻ thành phần (`Điểm TB Mini-test`, `Giữa kỳ`, `Cuối kỳ`, `Điểm tổng kết` kèm công thức khóa học & nhãn `Đạt`/`Chưa đạt`/`Chưa đủ dữ liệu`), bảng `Điểm đã công bố` (bấm vào đi tới `/student/assignments/[id]?mode=review`), khối `Chuyên cần & BTVN` tách biệt rõ ràng, và khối `Lịch sử lớp`.
  - `/student/overview` hiển thị đầy đủ dữ liệu thật ở `Tỷ lệ nộp BTVN`, `Điểm TB BTVN`, `Kết quả gần đây`, `còn N buổi · dự kiến kết thúc dd/mm/yyyy`.

- [x] **Step 1: Verify existing unit tests and inspect StudentOverview page/cards props**

Run: `cd frontend && npm run test:unit && npm run typecheck`
Đảm bảo không làm gãy bất kỳ prop hay selector nào mà E2E Phase 2 & Phase 6 đang kiểm tra trên `/student/overview`.

- [x] **Step 2: Update `StudentOverviewPage`, `StudentOverviewCards`, `StudentMetricsSidebar`, `nav-links.ts`, `PortalTopbar.tsx`**

1. Trên `student/overview/page.tsx`: gọi thêm `getMyProgress()` song song trong `Promise.allSettled` và truyền `myProgress` vào `ActiveStudentClassSection`.
2. Trên `StudentOverviewCards.tsx`: hiển thị dòng `còn N buổi · dự kiến kết thúc dd/mm/yyyy` (từ `myProgress?.classProgress` hoặc `activeClass`) trong thẻ `Lớp đang học`.
3. Trên `StudentMetricsSidebar.tsx`: thay 2 phần placeholder `"Tỷ lệ nộp BTVN"` (`Đang cập nhật`) và `"Kết quả gần đây"` (`Chờ tổng hợp`) bằng dữ liệu thật từ `myProgress.homeworkStats` và `myProgress.publishedResults.slice(0, 4)` (click mở `/student/assignments/[id]?mode=review`, link `"Xem tất cả"` trỏ `/student/results`).
4. Cập nhật `createStudentStudyGroup()` trong `nav-links.ts` thêm `{ href: '/student/results', label: 'Kết quả học tập', han: '成绩' }` và bổ sung `'/student/results': 'Kết quả học tập'` vào `STATIC_ROUTE_LABELS` của `PortalTopbar.tsx`.

- [x] **Step 3: Create `StudentResultsView.tsx` and `/student/results/page.tsx`**

Xây dựng `StudentResultsView.tsx` (< 260 LOC) và `student/results/page.tsx` (< 80 LOC) theo theme Giấy dó — Mực tàu — Son triện, xử lý cả trạng thái `PENDING_CLASS` (`PendingClassNotice`) và lọc lớp nếu học viên có nhiều lớp trong lịch sử.

- [x] **Step 4: Run frontend checks & build**

Run: `cd frontend && npm run typecheck && npm run lint && npm run test:unit && npm run build && cd .. && node scripts/check-loc.js`
Expected: PASS (`next build` xuất trang `/student/results` sạch sẽ, 0 LOC violations).

- [x] **Step 5: Commit Task 8.4**

```bash
git add frontend/src/app/\(portal\)/student/ frontend/src/features/students/ frontend/src/features/progress/ frontend/src/components/layout/
git commit -m "feat(student): wire live homework/progress metrics on overview and add /student/results page"
```

---

### Task 8.5: Admin Overview Dashboard `/admin/overview` (`FUNC-075`), Full E2E Verification & Quality Gates

**Files:**
- Create: `frontend/src/features/progress/components/AdminOverviewDashboard.tsx`
- Create: `frontend/src/features/progress/components/AdminOverviewClassesSection.tsx`
- Create: `frontend/src/features/progress/components/AdminOverviewScheduleColumn.tsx`
- Create: `frontend/src/app/(portal)/admin/overview/page.tsx`
- Modify: `frontend/src/components/layout/nav-links.ts`
- Modify: `frontend/src/components/layout/PortalTopbar.tsx`
- Modify: `docs/test-inventory-ui.md`
- Create: `frontend/e2e/phase08-progress-and-results.spec.ts`

**Interfaces:**
- Consumes: `GET /api/v1/progress/admin-overview`.
- Produces:
  - Route `/admin/overview` (`Tổng quan các lớp`, han `概览`, `@Roles: ['ADMIN']`, pure `SUPERADMIN` không hiển thị/bị chặn bởi `PortalGuardView`).
  - Bộ test Playwright E2E toàn trình Phase 8 + kiểm chứng Axe WCAG AA.

- [x] **Step 1: Implement `AdminOverviewDashboard.tsx`, `/admin/overview/page.tsx` and update navigation**

1. Thêm `{ href: '/admin/overview', label: 'Tổng quan các lớp', han: '概览' }` đầu nhóm `includeAdminOnly` trong `nav-links.ts` và `'/admin/overview': 'Tổng quan các lớp'` vào `PortalTopbar.tsx`.
2. Xây dựng `AdminOverviewDashboard.tsx` (< 280 LOC) và `admin/overview/page.tsx` (< 80 LOC):
   - 4 thẻ KPI (`Lớp đang học`, `Học viên đang học`, thẻ bấm được `Chờ xếp lớp` trỏ `/admin/students/pending`, `Buổi học hôm nay`).
   - Bảng `Các lớp` có filter theo Khóa HSK, Giáo viên, Trạng thái + checkbox hiện lớp đã kết thúc; hiển thị `Mã lớp`, `Giáo viên`, `Tiến độ (X/Y buổi · %)`, `Buổi tiếp theo`, `Sĩ số`, `Chuyên cần TB`, `Trạng thái`; click dòng mở `/admin/classes/[id]`.
   - Cột phải gồm 2 thẻ `Hôm nay` và `5 ngày tới` hiển thị các buổi học sắp diễn ra.
3. Cập nhật [`docs/test-inventory-ui.md`](../test-inventory-ui.md) bổ sung `/student/results` và `/admin/overview` (cùng `/teacher/assignments/[assignmentId]/grading` nếu chưa ghi).

- [x] **Step 2: Write Playwright E2E spec `frontend/e2e/phase08-progress-and-results.spec.ts`**

Kiểm chứng toàn trình trên trình duyệt thật (Desktop + Mobile + Axe WCAG AA):
1. Admin vào `/admin/courses` chỉnh sửa công thức tổng kết khóa học (kiểm tra chặn tổng $\ne 100\%$, lưu thành công `30/20/50`, Điểm đạt `5.5`).
2. Admin vào `/admin/overview` kiểm tra 4 thẻ KPI, bộ lọc lớp và bảng tiến độ + chuyên cần TB.
3. Giáo viên vào `/teacher/classes/[id]` xem thẻ Tiến độ + Buổi tiếp theo, mở tab `"Tiến độ & Kết quả"` kiểm tra cột chuyên cần, tỷ lệ nộp BTVN, điểm thành phần, điểm tổng kết và cờ cảnh báo.
4. Học viên vào `/student/overview` và `/student/results`: kiểm tra **Zero-Leak** (bài mới `GRADED` chưa công bố không xuất hiện ở kết quả), sau khi GV công bố (`RETURNED`) thì hiển thị chính xác điểm thành phần, điểm tổng kết, kết quả `Đạt`/`Chưa đạt` và tỷ lệ nộp BTVN tách biệt.

- [x] **Step 3: Run full verification gate across Backend & Frontend**

Run:
1. `node scripts/check-loc.js`
2. `git grep -nE "FUNC-[0-9]+|DEC-[0-9]+|SEC-[0-9]+|BR-[0-9]+|EXAM-[0-9]+" backend/src frontend/src` *(Expected: 0 matches)*
3. `cd backend && npm run typecheck && npm run lint && npm run build && npm run test:cov && npm run test:integration && npm run test:e2e`
4. `cd frontend && npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run test:e2e`
Expected: 100% PASS, 0 flaky tests, coverage $\ge 85\%$ lines / $\ge 80\%$ branches.

- [x] **Step 4: Independent Audit (`akit-security` & `akit-critic`), `PROJECT_PROGRESS.md` Update & Commit**

1. Dispatch reviewer kiểm toán độc lập toàn bộ Phase 8 diff (`akit-security` + `akit-critic`), khắc phục triệt để mọi phát hiện nếu có và chạy lại test verification sau sửa.
2. Cập nhật `PROJECT_PROGRESS.md` đánh dấu hoàn thành Phase 8 + ghi số liệu kiểm chứng thực tế.
3. Commit toàn bộ Phase 8 và sẵn sàng merge vào `develop`.
