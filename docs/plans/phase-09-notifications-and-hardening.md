# Phase 9 — Module 10 & Production Hardening: Thông Báo In-App, Dọn Prototype & Nghiệm Thu UAT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** READY FOR EXECUTION (19/11/2026 — `DEC-042` & `DEC-043` CONFIRMED). Đã hoàn tất đồng bộ tài liệu tiền Phase 9 trên nhánh `develop`.

**Lệnh gọi thực thi nhanh cho phiên sau:** `"Thực thi Phase 9 theo docs/plans/phase-09-notifications-and-hardening.md"`

**Goal:** Hoàn thiện Module 10 (`FUNC-080` — Hệ thống thông báo In-App theo 14 sự kiện nghiệp vụ cho `STUDENT` / `TEACHER` / `ADMIN`, nhắc hạn 24 giờ và dọn lưu trữ tự động), dọn sạch 100% 16 hạng mục Prototype Cleanup (`PROTO-01` / `DEC-043`, bao gồm xóa hoàn toàn khối `"Đăng nhập nhanh (Dev)"` khỏi `/login` và 10 chỗ sót mã đặc tả nội bộ), kiểm chứng trọn bộ 5 Bất biến Kiến trúc + Playwright E2E toàn hệ thống, và xuất bản Báo cáo Nghiệm thu cuối kỳ [`docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md`](../reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md).

**Architecture:** Bổ sung `@Global()` `NotificationsModule` (`backend/src/modules/notifications/`) độc lập không import feature module khác (chỉ phụ thuộc `PrismaService`) để tránh vòng phụ thuộc DI; các service miền hiện hữu nhận `@Optional() private readonly academicNotifications?: NotificationAcademicTriggersService` ở tham số constructor cuối cùng nhằm giữ tương thích 100% với bộ unit test hiện có (`579` tests). Dữ liệu thông báo lưu trong bảng `notifications` kèm Partial Unique Index `idx_notifications_recipient_dedup_key` (chống trùng nhắc hạn 24h và gom nhóm bài nộp chờ chấm cho giáo viên) và `CHECK` constraints chống Open Redirect / sai lệch trạng thái đọc. Trên Frontend, gắn `NotificationBellPopover` vào `PortalTopbar` (chỉ hiển thị với `STUDENT`/`TEACHER`/`ADMIN`, ẩn hoàn toàn với thuần `SUPERADMIN`) và thực thi dọn sạch toàn bộ tàn dư prototype.

**Tech Stack:** NestJS 12, Prisma ORM 6 (SQL Migration chuẩn), PostgreSQL 16+, Next.js 16 App Router, React 19, Tailwind CSS v4 (Theme Thư họa Á Đông), Vitest + Supertest, Playwright + `@axe-core/playwright`.

**Spec:** [`10-thong-bao.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/modules/10-thong-bao.md), [`decision-log.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/01-business/decision-log.md) (`DEC-015`, `DEC-042`, `DEC-043`), [`prototype-review.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/prototype-review.md), [`architecture-decision-contract.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/03-technical/architecture-decision-contract.md), [`acceptance-test-framework.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/acceptance-test-framework.md).

---

## Global Constraints

- **Anti-God-File LOC Limits (`node scripts/check-loc.js`):** Backend Services `<= 350` LOC, Backend Guards `<= 200` LOC, Backend Controllers / Policies / Mappers / Parsers `<= 250` LOC, Frontend App Pages `<= 250` LOC, Frontend Feature Hooks `<= 300` LOC, Frontend Feature Components `<= 300` LOC, Frontend Feature API Modules `<= 300` LOC.
  - *Cảnh báo trần LOC trên các service chỉnh sửa:* `assignment-delivery.service.ts` hiện đang `344` LOC, `grade-publication.service.ts` `337` LOC, `class-crud.service.ts` `336` LOC, `session-workflow.service.ts` `329` LOC, `class-enrollment.service.ts` `327` LOC, `student-submission.service.ts` `323` LOC. Mọi tích hợp trigger thông báo phải gọi qua hàm 1–2 dòng của `NotificationAcademicTriggersService`; riêng `assignment-delivery.service.ts` phải tách bớt helper tái mở lượt nộp sang `assignment-delivery.util.ts` để giữ file dịch vụ `<= 325` LOC.
- **TypeScript Strict & Linter:** Cấm `any` / `as any` / `@ts-ignore` (`typescript/no-explicit-any: "error"` trong `.oxlintrc.json`), `npm run typecheck` và `npm run lint` pass 100% ở cả `backend/` và `frontend/`.
- **Production Code Hygiene (Zero Spec Codes):** Lệnh `git grep -nE "FUNC-[0-9]+|DEC-[0-9]+|SEC-[0-9]+|SEC-RISK-|BR-[0-9]+|EXAM-[0-9]+|NOTIF-[0-9]+|PROTO-[0-9]+" -- "backend/src" "frontend/src" ":(exclude)*.spec.ts" ":(exclude)*.spec.tsx" ":(exclude)*.test.ts"` bắt buộc trả về **0 kết quả**.
- **Database Migrations & Test Isolation:** Cấm `prisma db push`. Mọi thay đổi schema thực hiện qua SQL migration chuẩn trong `backend/prisma/migrations/` kèm `CHECK` constraints và Partial Unique Index; bắt buộc bổ sung `"notifications"` vào `TRUNCATE TABLE` của `createSafeTruncateFn` trong `backend/test/helpers/postgres-test-container.ts`.
- **API & UI Inventory Sync:** Bổ sung 4 routes của `NotificationsController` (`100 -> 104` endpoints) vào `DECLARED_PHASE2_API_INVENTORY` trong `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts` (kèm cập nhật assertion `expect(actualRoutes).toHaveLength(104)` và ma trận RBAC cho `/notifications/*`) và [`docs/test-inventory-api.md`](../test-inventory-api.md). UI giữ nguyên **26 routes `page.tsx`** và cập nhật mô tả Topbar/Login tại [`docs/test-inventory-ui.md`](../test-inventory-ui.md).
- **Out-of-Scope Enforcement (`DEC-015`):** Chỉ thông báo In-App; tuyệt đối không phát sinh logic gửi email/Zalo thông báo nghiệp vụ (email chỉ dùng cho OTP xác thực đăng ký/đổi email và quên mật khẩu).
- **Acyclic DI & Backward-Compatible Constructors:** `NotificationsModule` chỉ import `PrismaModule` (hoặc dùng `@Global()` `PrismaService`), không import bất kỳ module nghiệp vụ nào khác. Các service nghiệp vụ inject `@Optional() private readonly academicNotifications?: NotificationAcademicTriggersService` ở vị trí tham số cuối cùng của `constructor`.

---

## Review Focus

1. **Zero-Leak Thông Báo Điểm (`DEC-012`, `DEC-038`, Bất biến 5):**
   - `confirmSubmissionGrade` và `confirmAssignmentGradesBatch` (chuyển sang `SubmissionStatus.GRADED`) và `adjustConfirmedOrPublishedGrade` khi `submission.status === SubmissionStatus.GRADED` tuyệt đối **không tạo bất kỳ thông báo nào** cho học viên.
   - Chỉ `publishAssignmentGrades` (chuyển `GRADED -> RETURNED`) phát `GRADE_PUBLISHED`, và `adjustConfirmedOrPublishedGrade` khi `submission.status === SubmissionStatus.RETURNED` mới phát `GRADE_UPDATED`.
2. **Chống IDOR, Cô Lập Pure `SUPERADMIN` & Lọc Học Viên Rời Lớp:**
   - `PATCH /api/v1/notifications/:id/read` cập nhật có điều kiện `where: { id, recipientId: actor.id }` (hoặc kiểm tra quyền sở hữu) và trả `404 Not Found` khi bản ghi không tồn tại hoặc thuộc người khác.
   - Toàn bộ 4 endpoint `/api/v1/notifications/*` gắn `@Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)` để `SUPERADMIN` thuần nhận `403 Forbidden`; trên Frontend không hiển thị chuông nếu người dùng chỉ có vai trò `SUPERADMIN`.
   - Các sự kiện của lớp (`SESSION_*`, `ASSIGNMENT_ASSIGNED`, `ASSIGNMENT_DUE_SOON`) chỉ gửi tới học viên có `EnrollmentStatus.ACTIVE` (không gửi cho `DROPPED` / `TRANSFERRED`), còn GV nhận theo `Class.teacherId` hiện tại.
3. **Khử Trùng, Gom Nhóm & An Toàn Điều Hướng Nội Bộ (`Open Redirect`):**
   - `ASSIGNMENT_DUE_SOON` dùng `dedupKey = "due_soon:${assignmentId}"` kết hợp Partial Unique Index `idx_notifications_recipient_dedup_key` (`UNIQUE(recipient_id, dedup_key) WHERE dedup_key IS NOT NULL`) và `skipDuplicates: true` để bắn tối đa 1 lần/bài/HV ngay cả khi chạy song song.
   - `SUBMISSION_PENDING_GRADING` dùng `INSERT ... ON CONFLICT ("recipient_id", "dedup_key") WHERE "dedup_key" IS NOT NULL DO UPDATE` với `dedupKey = "sub_pending:${assignmentId}"` để gộp thành 1 thông báo cập nhật số lượng (`"N bài nộp “...” đang chờ chấm"`) và đặt lại `is_read = false, read_at = NULL` khi có bài nộp mới.
   - DB constraint `notifications_link_path_safe_check` ép `link_path ~ '^/([^/]|$)'` và Frontend kiểm tra lại trước `router.push(linkPath)`.
4. **Không Tự Thông Báo & Kiểm Soát Lưu Lượng Polling:**
   - Mọi hàm phát thông báo loại bỏ `recipientId === actorId` trước khi ghi DB.
   - Hook `useNotifications` poll `GET /api/v1/notifications/unread-count` mỗi `60_000ms` **chỉ khi** `document.visibilityState === 'visible'` và hủy request cũ bằng `AbortController` khi unmount/logout hoặc mất phiên (tránh spam gây `429` như lỗi `BUG-M9-03` trước đây).
5. **Đối Chiếu Đầy Đủ 16 Mục Prototype Cleanup (`DEC-043`) & 5 Bất Biến Kiến Trúc:**
   - Khối `"Đăng nhập nhanh (Dev)"` biến mất hoàn toàn khỏi `/login` ở cả `next dev` lẫn `next build`.
   - Quét toàn hệ thống không còn nhãn `FUNC-xxx` / `DEC-xxx` / `SEC-xxx` trong code non-test, và cả 5 bất biến kiến trúc được chứng minh trên PostgreSQL 16 thật.

---

## File Structure & Interfaces (Consumes / Produces)

- **Consumes:**
  - `PrismaService`, `@CurrentUser()`, `@Roles()`, `AuthenticatedUser`, `resolvePagination`, `formatDateVn`, `formatDateTimeVn` (Backend `common/`).
  - Các service phát sự kiện: `AuthRegistrationService`, `StudentEnrollmentService`, `ClassEnrollmentService`, `ClassCrudService`, `SessionWorkflowService`, `AssignmentDeliveryService`, `StudentSubmissionService`, `GradePublicationService`, `GradeAdjustmentService`.
  - Frontend: `fetchApi`, `buildQueryString`, `RequestOptions` (`@/lib/api-client`), `PortalTopbar` (`@/components/layout/PortalTopbar`), `formatDateDdMmYyyy` (`@/lib/utils/date`).
- **Produces:**
  - **Database:** `backend/prisma/schema.prisma` (enum `NotificationType`, model `Notification`, relation `User.notifications`) + `backend/prisma/migrations/20261119235000_phase09_notifications/migration.sql`.
  - **Backend `NotificationsModule` (`backend/src/modules/notifications/`):**
    - `notifications.module.ts` (`@Global()`)
    - `notifications.types.ts` (`NotificationItemDto`, `NotificationListResponseDto`, `UnreadCountResponseDto`, `MarkReadResponseDto`, `MarkAllReadResponseDto`)
    - `dto/notifications.dto.ts` (`ListNotificationsQueryDto { status?, page?, limit? }`)
    - `mappers/notification.mapper.ts` (`toNotificationItemDto`)
    - `utils/notification-message.util.ts` (`buildNotificationContent` thuần hàm chuẩn tiếng Việt, `assertSafeInternalLinkPath`)
    - `services/notification-dispatch.service.ts` (`dispatchManyTx`, `upsertDedupNotificationTx`, `resolveActiveAdminRecipientIdsTx`)
    - `services/notification-academic-triggers.service.ts` (`onNewStudentRegisteredTx`, `onStudentPlacedTx`, `onStudentTransferredTx`, `onStudentDroppedTx`, `onTeacherAssignedClassTx`, `onSessionChangedTx`, `onAssignmentPublishedToClassTx`, `onSubmissionReopenedTx`, `onSubmissionPendingGradingTx`, `onGradesPublishedTx`, `onPublishedGradeAdjustedTx`)
    - `services/notification-query.service.ts` (`listForUser`, `getUnreadCount`, `markAsRead`, `markAllAsRead`)
    - `services/notification-deadline.service.ts` (`dispatchDueSoonReminders`, `ensureDueSoonForStudentIfDue` + timer 15p `.unref()`)
    - `services/notification-maintenance.service.ts` (`purgeExpiredNotifications` + timer 1h `.unref()`, batch `LIMIT 1000`, 90d đã đọc / 180d chưa đọc)
    - `notifications.controller.ts` (4 endpoints: `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`)
  - **Frontend (`frontend/src/features/notifications/` & Layout):**
    - `types/notifications.types.ts`, `api/notifications.api.ts`, `utils/notification-time.util.ts`
    - `hooks/useNotifications.ts`
    - `components/NotificationBellPopover.tsx`, `components/NotificationItemRow.tsx`
    - Cập nhật `frontend/src/components/layout/PortalTopbar.tsx`
  - **Prototype Cleanup (`PROTO-01`):**
    - Sửa `frontend/src/features/auth/components/LoginFormCard.tsx`, `frontend/src/app/(auth)/login/page.tsx` (xóa hoàn toàn Dev Quick-Login)
    - Sửa `backend/src/modules/grading/grading.controller.ts`, `frontend/src/features/grading/utils/grading-status.ts`, `frontend/src/proxy.ts` (xóa 10 chỗ sót mã đặc tả nội bộ)
  - **Verification & Acceptance Artifacts:**
    - `backend/test/phase09-notifications.e2e-spec.ts`
    - `backend/test/phase09-architecture-invariants.e2e-spec.ts`
    - `frontend/e2e/phase09-notifications-and-cleanup.spec.ts`
    - `docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md`

---

### Task 9.1: Database Schema, SQL Migration, `NotificationsModule` Core API (`100 -> 104`), Deadline Reminder & Retention Maintenance

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20261119235000_phase09_notifications/migration.sql`
- Modify: `backend/test/helpers/postgres-test-container.ts`
- Create: `backend/src/modules/notifications/notifications.types.ts`
- Create: `backend/src/modules/notifications/dto/notifications.dto.ts`
- Create: `backend/src/modules/notifications/mappers/notification.mapper.ts`
- Create: `backend/src/modules/notifications/utils/notification-message.util.ts`
- Create: `backend/src/modules/notifications/services/notification-dispatch.service.ts`
- Create: `backend/src/modules/notifications/services/notification-query.service.ts`
- Create: `backend/src/modules/notifications/services/notification-deadline.service.ts`
- Create: `backend/src/modules/notifications/services/notification-maintenance.service.ts`
- Create: `backend/src/modules/notifications/notifications.controller.ts`
- Create: `backend/src/modules/notifications/notifications.module.ts`
- Modify: `backend/src/app.module.ts`
- Modify: `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts`
- Modify: `docs/test-inventory-api.md`
- Test: `backend/src/modules/notifications/utils/notification-message.util.spec.ts`
- Test: `backend/src/modules/notifications/services/notification-query.service.spec.ts`
- Test: `backend/src/modules/notifications/services/notification-deadline-and-maintenance.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AuthenticatedUser`, `@CurrentUser()`, `@Roles()`, `resolvePagination`, `formatDateVn`, `formatDateTimeVn`.
- Produces:
  - `NotificationType` (14 values) & `Notification` Prisma model
  - `NotificationDispatchService.dispatchManyTx(tx: Prisma.TransactionClient, inputs: ReadonlyArray<DispatchNotificationInput>): Promise<number>`
  - `NotificationDispatchService.upsertDedupNotificationTx(tx: Prisma.TransactionClient, input: UpsertDedupNotificationInput): Promise<void>`
  - `NotificationDispatchService.resolveActiveAdminRecipientIdsTx(tx: Prisma.TransactionClient, excludeActorId?: string): Promise<string[]>`
  - `NotificationQueryService`: `listForUser(actor, query)`, `getUnreadCount(actor)`, `markAsRead(actor, notificationId)`, `markAllAsRead(actor)`
  - `NotificationDeadlineService`: `dispatchDueSoonReminders(now?: Date): Promise<number>`, `ensureDueSoonForStudentIfDue(studentId: string, minIntervalMs?: number): Promise<void>`
  - `NotificationMaintenanceService`: `purgeExpiredNotifications(now?: Date): Promise<{ deletedRead: number; deletedUnread: number }>`
  - `NotificationsController` routes (`/api/v1/notifications`, `/api/v1/notifications/unread-count`, `/api/v1/notifications/:id/read`, `/api/v1/notifications/read-all`)

- [ ] **Step 1: Write the failing unit tests for notification formatting, safe link validation, query IDOR guards, 24h deadline dedup, and retention cleanup**

Tạo 3 file unit test:
1. `backend/src/modules/notifications/utils/notification-message.util.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { NotificationType } from '@prisma/client';
import {
  assertSafeInternalLinkPath,
  buildNotificationContent,
} from './notification-message.util.js';

describe('notification-message.util', () => {
  it('accepts safe internal paths and rejects external or protocol-relative paths', () => {
    expect(assertSafeInternalLinkPath('/student/assignments/a1?mode=review')).toBe(
      '/student/assignments/a1?mode=review',
    );
    expect(() => assertSafeInternalLinkPath('https://evil.example/phish')).toThrow();
    expect(() => assertSafeInternalLinkPath('//evil.example')).toThrow();
    expect(() => assertSafeInternalLinkPath('student/overview')).toThrow();
  });

  it('builds exact Vietnamese copy for key student, teacher, and admin notification types', () => {
    const gradePub = buildNotificationContent({
      type: NotificationType.GRADE_PUBLISHED,
      assignmentTitle: 'Mini-test Bài 5',
      totalScore: 8.5,
      maxScore: 10,
    });
    expect(gradePub.title).toContain('Đã công bố điểm');
    expect(gradePub.body).toContain('8.5/10');

    const pendingAgg = buildNotificationContent({
      type: NotificationType.SUBMISSION_PENDING_GRADING,
      assignmentTitle: 'Đề kiểm tra HSK1',
      pendingCount: 3,
    });
    expect(pendingAgg.body).toContain('3 bài nộp');
    expect(pendingAgg.body).toContain('Đề kiểm tra HSK1');
  });
});
```
2. `backend/src/modules/notifications/services/notification-query.service.spec.ts`:
```ts
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../../../common/auth/auth.types.js';
import { NotificationQueryService } from './notification-query.service.js';

function makeActor(roles: Role[], effectiveRole: Role): AuthenticatedUser {
  return {
    id: 'user-1',
    email: 'u1@webedu.vn',
    fullName: 'User 1',
    phone: '0901000001',
    roles,
    effectiveRole,
    status: 'ACTIVE',
    tokenVersion: 0,
  };
}

describe('NotificationQueryService', () => {
  it('blocks pure SUPERADMIN from reading or mutating notifications', async () => {
    const prisma = { notification: { findMany: vi.fn(), count: vi.fn() } } as never;
    const service = new NotificationQueryService(prisma);
    const pureSa = makeActor([Role.SUPERADMIN], Role.SUPERADMIN);

    await expect(service.listForUser(pureSa, {})).rejects.toThrowError(ForbiddenException);
    await expect(service.getUnreadCount(pureSa)).rejects.toThrowError(ForbiddenException);
    await expect(service.markAsRead(pureSa, 'n-1')).rejects.toThrowError(ForbiddenException);
    await expect(service.markAllAsRead(pureSa)).rejects.toThrowError(ForbiddenException);
  });

  it('throws NotFoundException when markAsRead targets another user notification (IDOR)', async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    } as never;
    const service = new NotificationQueryService(prisma);
    await expect(
      service.markAsRead(makeActor([Role.STUDENT], Role.STUDENT), 'n-other'),
    ).rejects.toThrowError(NotFoundException);
  });
});
```
3. `backend/src/modules/notifications/services/notification-deadline-and-maintenance.service.spec.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { NotificationMaintenanceService } from './notification-maintenance.service.js';

describe('NotificationMaintenanceService', () => {
  it('purges read notifications > 90 days and unread notifications > 180 days in bounded batches', async () => {
    const prisma = {
      $executeRaw: vi.fn().mockResolvedValueOnce(4).mockResolvedValueOnce(2),
    } as never;
    const service = new NotificationMaintenanceService(prisma);
    const summary = await service.purgeExpiredNotifications(new Date('2026-11-19T10:00:00.000Z'));
    expect(summary).toEqual({ deletedRead: 4, deletedUnread: 2 });
  });
});
```

- [ ] **Step 2: Run unit tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/notifications/`
Expected: FAIL with missing module `notification-message.util.js`, `notification-query.service.js`, `notification-maintenance.service.js`.

- [ ] **Step 3: Create Prisma migration, implement `NotificationsModule` Core API, sync API inventory & `postgres-test-container.ts`**

1. Cập nhật `backend/prisma/schema.prisma`:
   - Thêm enum `NotificationType` gồm 14 giá trị: `NEW_STUDENT_PENDING_CLASS`, `STUDENT_ENROLLED`, `STUDENT_TRANSFERRED`, `STUDENT_DROPPED`, `TEACHER_ASSIGNED_CLASS`, `SESSION_RESCHEDULED`, `SESSION_CANCELLED`, `SESSION_MAKEUP_ADDED`, `ASSIGNMENT_ASSIGNED`, `ASSIGNMENT_DUE_SOON`, `SUBMISSION_REOPENED`, `SUBMISSION_PENDING_GRADING`, `GRADE_PUBLISHED`, `GRADE_UPDATED`.
   - Thêm `model Notification` với các trường `id`, `recipientId`, `type`, `title (@db.VarChar(180))`, `body (@db.VarChar(500))`, `linkPath (@db.VarChar(255))`, `dedupKey (@db.VarChar(160)?)`, `isRead (default false)`, `readAt (Timestamptz(3)?)`, `createdAt (Timestamptz(3))`, các index `(recipientId, isRead, createdAt DESC)`, `(recipientId, createdAt DESC)`, `(createdAt)`, và thêm `notifications Notification[] @relation("UserNotifications")` trên `model User`.
2. Tạo migration `backend/prisma/migrations/20261119235000_phase09_notifications/migration.sql` (chạy `npx prisma migrate dev --create-only` hoặc viết SQL chuẩn rồi chạy `npx prisma migrate deploy && npm run prisma:generate`):
   - `CREATE TYPE "NotificationType" AS ENUM (...)`
   - `CREATE TABLE "notifications" (...)` với `FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE`
   - 3 index chuẩn + Partial Unique Index: `CREATE UNIQUE INDEX "idx_notifications_recipient_dedup_key" ON "notifications"("recipient_id", "dedup_key") WHERE "dedup_key" IS NOT NULL;`
   - `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_link_path_safe_check" CHECK ("link_path" ~ '^/([^/]|$)');`
   - `ALTER TABLE "notifications" ADD CONSTRAINT "notifications_read_consistency_check" CHECK (("is_read" = false AND "read_at" IS NULL) OR ("is_read" = true AND "read_at" IS NOT NULL));`
3. Cập nhật `backend/test/helpers/postgres-test-container.ts`: thêm `"notifications"` vào danh sách `TRUNCATE TABLE` của `createSafeTruncateFn`.
4. Triển khai `backend/src/modules/notifications/`:
   - `dto/notifications.dto.ts`: `ListNotificationsQueryDto` (`status?: 'all' | 'unread'`, `page?: number | string`, `limit?: number | string` capped `<= 50`, dùng `@IsOptional()`, `@IsIn(['all', 'unread'])`, `@Type(() => Number)`, `@IsInt()`, `@Min(1)`, `@Max(50)`).
   - `utils/notification-message.util.ts`: `assertSafeInternalLinkPath` (chấp nhận path bắt đầu bằng `/`, từ chối `//`, ký tự điều khiển, hoặc vượt 255 ký tự) & `buildNotificationContent` thuần hàm trả `{ title, body }` tiếng Việt rõ ràng, dùng `formatDateVn`/`formatDateTimeVn` GMT+7.
   - `services/notification-dispatch.service.ts`:
     - `dispatchManyTx(tx, inputs)`: kiểm tra `assertSafeInternalLinkPath`, lọc trùng `(recipientId, dedupKey)` trong batch, dùng `tx.notification.createMany({ data, skipDuplicates: true })` (tương thích 100% Partial Unique Index trên PostgreSQL 16).
     - `upsertDedupNotificationTx(tx, input)`: dùng SQL nguyên tử `INSERT INTO "notifications" (...) VALUES (...) ON CONFLICT ("recipient_id", "dedup_key") WHERE "dedup_key" IS NOT NULL DO UPDATE SET "title" = EXCLUDED."title", "body" = EXCLUDED."body", "link_path" = EXCLUDED."link_path", "is_read" = false, "read_at" = NULL, "created_at" = EXCLUDED."created_at"`.
     - `resolveActiveAdminRecipientIdsTx(tx, excludeActorId?)`: query `users` có `status: UserStatus.ACTIVE`, `roles: { has: Role.ADMIN }`, `id !== excludeActorId`.
   - `services/notification-query.service.ts`:
     - Từ chối ngay với `ForbiddenException` nếu `!actor.roles.some((r) => r === Role.ADMIN || r === Role.TEACHER || r === Role.STUDENT)`.
     - Trước khi trả danh sách/đếm số cho người dùng có `Role.STUDENT`, gọi `this.deadlineService?.ensureDueSoonForStudentIfDue(actor.id, isUnreadCount ? 55_000 : 5_000)` để nhắc hạn 24h luôn cập nhật tức thì mà không tốn query lặp.
     - `listForUser`: dùng `resolvePagination(query, 20)` (tối đa `50`/trang), trả `{ items, unreadCount, total, page, limit, hasMore }`.
     - `markAsRead`: kiểm tra `findFirst({ where: { id, recipientId: actor.id } })` -> `404` nếu không tồn tại; cập nhật `isRead: true, readAt: new Date()` chỉ khi `isRead === false`.
     - `markAllAsRead`: `updateMany({ where: { recipientId: actor.id, isRead: false }, data: { isRead: true, readAt: new Date() } })`.
   - `services/notification-deadline.service.ts`:
     - `OnModuleInit` / `OnModuleDestroy` chạy timer `15 * 60 * 1000ms` (`.unref()`).
     - `dispatchDueSoonReminders(now = new Date(), onlyStudentId?: string)`: tìm các `ClassAssignment` thuộc lớp `UPCOMING`/`ACTIVE` có `dueAt > now` và `dueAt <= now + 24h` (và nếu có bản nháp `IN_PROGRESS` có `dueAtOverride`, kiểm tra `effectiveDueAt > now && effectiveDueAt <= now + 24h`), bỏ qua học viên đã có bài nộp chính thức (`status NOT IN ('IN_PROGRESS', 'SUPERSEDED')`), và phát `ASSIGNMENT_DUE_SOON` với `dedupKey = "due_soon:${assignment.id}"` qua `dispatchManyTx(..., skipDuplicates: true)`.
   - `services/notification-maintenance.service.ts`:
     - `OnModuleInit` / `OnModuleDestroy` chạy timer `60 * 60 * 1000ms` (`.unref()`).
     - `purgeExpiredNotifications(now = new Date())`: thực thi 2 câu `DELETE ... LIMIT 1000` xóa bản ghi `is_read = true` quá `90 ngày` và `is_read = false` quá `180 ngày`.
   - `notifications.controller.ts` & `notifications.module.ts` (`@Global()`):
     - Prefix `@Controller('notifications')` + `@Roles(Role.ADMIN, Role.TEACHER, Role.STUDENT)`:
       - `GET /notifications`
       - `GET /notifications/unread-count`
       - `PATCH /notifications/:id/read` (`@Param('id', ParseUUIDPipe)`)
       - `POST /notifications/read-all` (`@HttpCode(HttpStatus.OK)`)
5. Đăng ký `NotificationsModule` vào `backend/src/app.module.ts`.
6. Cập nhật `DECLARED_PHASE2_API_INVENTORY` (`100 -> 104`) + assertion `toHaveLength(104)` + test case RBAC cho `/notifications/*` (chặn `401` chưa đăng nhập, chặn `403` pure `SUPERADMIN`, cho `200` với `STUDENT`/`TEACHER`/`ADMIN`) trong `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts` và cập nhật mục `2.15 NotificationsController` vào [`docs/test-inventory-api.md`](../test-inventory-api.md).

- [ ] **Step 4: Run unit tests, migration check, inventory E2E, typecheck, lint & check-loc**

Run:
1. `cd backend && npx prisma migrate deploy && npm run prisma:generate`
2. `cd backend && npx vitest run src/modules/notifications/`
3. `cd backend && npx vitest run --config ./vitest.config.e2e.ts test/api-inventory-and-rbac-matrix.e2e-spec.ts`
4. `cd backend && npm run typecheck && npm run lint && npm run check:loc`
Expected: PASS 100% (`104` endpoints khớp 1-1, `0` lint/LOC errors).

- [ ] **Step 5: Commit Task 9.1**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261119235000_phase09_notifications/ backend/src/modules/notifications/ backend/src/app.module.ts backend/test/helpers/postgres-test-container.ts backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts docs/test-inventory-api.md
git commit -m "feat(notifications): add Notification schema, core module API, 24h reminders and retention job"
```

---

### Task 9.2: Cross-Module Academic Triggers (14 Event Types across 7 Modules) & Real-PG Notification E2E

**Files:**
- Create: `backend/src/modules/notifications/services/notification-academic-triggers.service.ts`
- Modify: `backend/src/modules/notifications/notifications.module.ts`
- Modify: `backend/src/modules/auth/services/auth-registration.service.ts`
- Modify: `backend/src/modules/students/services/student-enrollment.service.ts`
- Modify: `backend/src/modules/classes/services/class-enrollment.service.ts`
- Modify: `backend/src/modules/classes/services/class-crud.service.ts`
- Modify: `backend/src/modules/schedules/services/session-workflow.service.ts`
- Modify: `backend/src/modules/assignments/services/assignment-delivery.util.ts`
- Modify: `backend/src/modules/assignments/services/assignment-delivery.service.ts`
- Modify: `backend/src/modules/assignments/services/student-submission.service.ts`
- Modify: `backend/src/modules/grading/services/grade-publication.service.ts`
- Modify: `backend/src/modules/grading/services/grade-adjustment.service.ts`
- Create: `backend/test/phase09-notifications.e2e-spec.ts`
- Test: `backend/src/modules/notifications/services/notification-academic-triggers.service.spec.ts`

**Interfaces:**
- Consumes: `NotificationDispatchService`, `Prisma.TransactionClient`.
- Produces (`NotificationAcademicTriggersService`, mọi method nhận `tx` để commit nguyên tử cùng giao dịch gốc và tự loại `recipientId === actorId`):
  - `onNewStudentRegisteredTx(tx, { studentId, fullName }): Promise<void>` -> gửi `NEW_STUDENT_PENDING_CLASS` cho mọi Admin đang `ACTIVE` (`linkPath: '/admin/students/pending'`).
  - `onStudentPlacedTx(tx, { studentId, classCode, actorId }): Promise<void>` -> gửi `STUDENT_ENROLLED` cho `studentId` (`linkPath: '/student/overview'`).
  - `onStudentTransferredTx(tx, { studentId, sourceClassCode, targetClassCode, actorId }): Promise<void>` -> gửi `STUDENT_TRANSFERRED` cho `studentId` (`linkPath: '/student/overview'`).
  - `onStudentDroppedTx(tx, { studentId, classCode, actorId }): Promise<void>` -> gửi `STUDENT_DROPPED` cho `studentId` (`linkPath: '/student/overview'`).
  - `onTeacherAssignedClassTx(tx, { teacherId, classId, classCode, courseName, isReassignment, actorId }): Promise<void>` -> gửi `TEACHER_ASSIGNED_CLASS` cho `teacherId` (`linkPath: '/teacher/classes/' + classId`).
  - `onSessionChangedTx(tx, input: SessionChangedNotificationInput): Promise<void>` -> tra cứu `ACTIVE` enrollments + `Class.teacherId` và gửi `SESSION_RESCHEDULED` / `SESSION_CANCELLED` / `SESSION_MAKEUP_ADDED` (link `/student/schedule` cho HV, `/teacher/schedules` cho GV).
  - `onAssignmentPublishedToClassTx(tx, { assignmentId, classId, assessmentTitle, dueAt, actorId }): Promise<void>` -> gửi `ASSIGNMENT_ASSIGNED` cho toàn bộ HV `ACTIVE` của lớp (`linkPath: '/student/assignments/' + assignmentId`).
  - `onSubmissionReopenedTx(tx, { assignmentId, assessmentTitle, studentId, dueAt, actorId }): Promise<void>` -> gửi `SUBMISSION_REOPENED` cho `studentId` (`linkPath: '/student/assignments/' + assignmentId`).
  - `onSubmissionPendingGradingTx(tx, { assignmentId, studentId }): Promise<void>` -> đếm số bài nộp active đang chờ chấm (`SUBMITTED_WAITING`, `AUTO_GRADED_PENDING_REVIEW`) và upsert `SUBMISSION_PENDING_GRADING` (`dedupKey: 'sub_pending:' + assignmentId`, `linkPath: '/teacher/assignments/' + assignmentId + '/grading'`) cho `Class.teacherId` (loại trừ nếu `teacherId === studentId`).
  - `onGradesPublishedTx(tx, { assignmentId, studentIds, actorId }): Promise<void>` -> nạp `assessment.title` + `totalScore` & `maxScore` của từng học viên trong `studentIds` và gửi `GRADE_PUBLISHED` (`linkPath: '/student/assignments/' + assignmentId + '?mode=review'`).
  - `onPublishedGradeAdjustedTx(tx, { assignmentId, studentId, totalScore, maxScore, actorId }): Promise<void>` -> chỉ gọi khi `submission.status === SubmissionStatus.RETURNED`, gửi `GRADE_UPDATED` (`linkPath: '/student/assignments/' + assignmentId + '?mode=review'`).

- [ ] **Step 1: Write the failing unit tests for `NotificationAcademicTriggersService` & Real-PG E2E spec `phase09-notifications.e2e-spec.ts`**

1. Tạo `backend/src/modules/notifications/services/notification-academic-triggers.service.spec.ts` kiểm chứng:
   - `onSessionChangedTx` chỉ gửi tới học viên có `EnrollmentStatus.ACTIVE` (không gửi cho `DROPPED`) và giáo viên phụ trách (`recipientId !== actorId`).
   - `onSubmissionPendingGradingTx` gọi `upsertDedupNotificationTx` với `dedupKey = "sub_pending:a1"` và nội dung chứa đúng tổng số bài nộp đang chờ chấm.
   - `onGradesPublishedTx` tự loại `actorId` nếu giáo viên tự nộp bài giả lập trùng ID.
2. Tạo `backend/test/phase09-notifications.e2e-spec.ts` kiểm chứng toàn trình trên PostgreSQL 16 thật:
   - Đăng ký HV mới -> tất cả `ADMIN` active nhận `NEW_STUDENT_PENDING_CLASS`.
   - Admin xếp lớp (`assignInitialClass`), thêm HV (`enrollStudents`), chuyển lớp (`transferStudent`), rút lớp (`dropStudent`) -> HV nhận lần lượt `STUDENT_ENROLLED`, `STUDENT_TRANSFERRED`, `STUDENT_DROPPED`.
   - Admin tạo lớp / đổi GV -> GV nhận `TEACHER_ASSIGNED_CLASS`.
   - Admin đổi lịch / hủy buổi / tạo buổi bù -> HV `ACTIVE` và GV nhận `SESSION_*`, HV `DROPPED` **không** nhận.
   - GV giao đề -> HV `ACTIVE` nhận `ASSIGNMENT_ASSIGNED`; chạy `dispatchDueSoonReminders` cho bài sắp hết hạn `< 24h` -> HV chưa nộp nhận `ASSIGNMENT_DUE_SOON` đúng **1 lần** kể cả khi gọi lại lần 2 (dedup); HV đã nộp **không** nhận nhắc hạn.
   - 2 HV nộp bài -> GV nhận **1 thông báo gom nhóm** `"2 bài nộp “...” đang chờ chấm"` (unread).
   - **Zero-Leak Gate:** GV xác nhận điểm (`confirmSubmissionGrade` / `confirmAssignmentGradesBatch` -> `GRADED`) và sửa điểm khi đang `GRADED` -> số thông báo mới của HV vẫn bằng **0**. Sau khi GV bấm `publishAssignmentGrades` (`RETURNED`) -> HV nhận `GRADE_PUBLISHED` (kèm điểm đúng); sau đó sửa điểm khi đã `RETURNED` -> HV nhận `GRADE_UPDATED`.
   - Bảo mật & Dọn dẹp: `PATCH /notifications/:id/read` của user khác trả `404`; pure `SUPERADMIN` gọi `GET /notifications` và `/unread-count` trả `403`; `POST /notifications/read-all` đưa `unreadCount` về `0`; `purgeExpiredNotifications` xóa đúng bản ghi `isRead = true` > 90d và `isRead = false` > 180d.

- [ ] **Step 2: Run unit and E2E tests to verify they fail**

Run: `cd backend && npx vitest run src/modules/notifications/services/notification-academic-triggers.service.spec.ts`
Expected: FAIL with missing `notification-academic-triggers.service.js`.

- [ ] **Step 3: Implement `NotificationAcademicTriggersService` and wire `@Optional()` hooks across 7 domain modules while preserving `<= 350` LOC ceiling**

1. Triển khai `NotificationAcademicTriggersService` (`<= 280` LOC) và export từ `NotificationsModule`.
2. Tách helper `loadReopenAttemptSnapshotTx` trong `assignment-delivery.service.ts` sang `assignment-delivery.util.ts` để `assignment-delivery.service.ts` giảm xuống `< 310` LOC trước khi thêm 2 hook.
3. Gắn `@Optional() private readonly academicNotifications?: NotificationAcademicTriggersService` ở cuối `constructor` của các service sau (mỗi điểm chỉ gọi 1–2 dòng bên trong `$transaction`):
   - `AuthRegistrationService.register`: gọi `onNewStudentRegisteredTx` sau `tx.studentProfile.create`.
   - `StudentEnrollmentService.assignInitialClass` & `ClassEnrollmentService.enrollStudents`: gọi `onStudentPlacedTx`.
   - `ClassEnrollmentService.transferStudent`: gọi `onStudentTransferredTx`.
   - `ClassEnrollmentService.dropStudent`: gọi `onStudentDroppedTx`.
   - `ClassCrudService.createClass` & `ClassCrudService.updateClass` (khi `teacherChanged`): gọi `onTeacherAssignedClassTx`.
   - `SessionWorkflowService`: `rescheduleSession` (`SESSION_RESCHEDULED`), `cancelSession` (`SESSION_CANCELLED`, kèm ghi chú buổi bù nếu `dto.makeup` có mặt), `createMakeupSession` (`SESSION_MAKEUP_ADDED`).
   - `AssignmentDeliveryService`: `assignToClasses` (`onAssignmentPublishedToClassTx` cho từng lớp tạo mới), `reopenSubmission` (`onSubmissionReopenedTx`).
   - `StudentSubmissionService`: helper `notifyIfSubmittedFromInProgressTx(tx, assignmentId, studentId, status)` gọi `onSubmissionPendingGradingTx` khi chuyển khỏi `IN_PROGRESS` trong `submit`, `autosave`, `startOrResume`, và `finalizeExpiredReadDraft`.
   - `GradePublicationService.publishAssignmentGrades`: gọi `onGradesPublishedTx` bên trong `$transaction` (giữ nguyên `this.gradingEvents.emitScoresPublished(event)` sau commit; **tuyệt đối không** gắn vào `confirmSubmissionGrade` hay `confirmAssignmentGradesBatch`).
   - `GradeAdjustmentService.adjustConfirmedOrPublishedGrade`: chỉ gọi `onPublishedGradeAdjustedTx` khi `isPublished === true` (`submission.status === SubmissionStatus.RETURNED`).

- [ ] **Step 4: Run all backend unit, integration, E2E, typecheck, lint & check-loc**

Run: `cd backend && npm run typecheck && npm run lint && npm run check:loc && npx vitest run && npx vitest run --config ./vitest.config.e2e.ts test/phase09-notifications.e2e-spec.ts`
Expected: PASS 100% (`579+` unit tests không gãy mock constructor nào, `phase09-notifications.e2e-spec.ts` PASS toàn bộ, `check:loc` 0 vi phạm).

- [ ] **Step 5: Commit Task 9.2**

```bash
git add backend/src/modules/notifications/ backend/src/modules/auth/ backend/src/modules/students/ backend/src/modules/classes/ backend/src/modules/schedules/ backend/src/modules/assignments/ backend/src/modules/grading/ backend/test/phase09-notifications.e2e-spec.ts
git commit -m "feat(notifications): wire 14 academic notification triggers across modules with Zero-Leak E2E"
```

---

### Task 9.3: Frontend In-App Notification Bell & Popover UI (`PortalTopbar`) + Unit Tests

**Files:**
- Create: `frontend/src/features/notifications/types/notifications.types.ts`
- Create: `frontend/src/features/notifications/api/notifications.api.ts`
- Create: `frontend/src/features/notifications/utils/notification-time.util.ts`
- Create: `frontend/src/features/notifications/utils/notification-time.util.unit.spec.ts`
- Create: `frontend/src/features/notifications/hooks/useNotifications.ts`
- Create: `frontend/src/features/notifications/components/NotificationItemRow.tsx`
- Create: `frontend/src/features/notifications/components/NotificationBellPopover.tsx`
- Modify: `frontend/src/components/layout/PortalTopbar.tsx`
- Modify: `docs/test-inventory-ui.md`

**Interfaces:**
- Consumes: `GET /api/v1/notifications`, `GET /api/v1/notifications/unread-count`, `PATCH /api/v1/notifications/:id/read`, `POST /api/v1/notifications/read-all`, `fetchApi`, `buildQueryString`, `formatDateDdMmYyyy`, `PortalTopbar`.
- Produces:
  - `formatRelativeNotificationTime(isoTimestamp: string, now?: Date): string` (dưới 1 phút `"Vừa xong"`, `< 60p` `"N phút trước"`, `< 24h` `"N giờ trước"`, `<= 7 ngày` `"N ngày trước"`, `> 7 ngày` `"dd/mm/yyyy"` GMT+7)
  - `isSafeNotificationLink(linkPath: string): boolean` (`/^\/([^/]|$)/.test(linkPath)`)
  - `useNotifications(enabled: boolean, onAuthError?: (err: unknown) => boolean)`
  - `NotificationBellPopover` gắn vào `PortalTopbar` ngay bên trái tên trung tâm & avatar hồ sơ.

- [ ] **Step 1: Write the failing frontend unit test for relative timestamps, >7d dd/mm/yyyy GMT+7 formatting & safe link validation**

Tạo `frontend/src/features/notifications/utils/notification-time.util.unit.spec.ts`:
```ts
import { expect, test } from '@playwright/test';
import { formatRelativeNotificationTime, isSafeNotificationLink } from './notification-time.util';

test('formats relative notification timestamps and >7 days as dd/mm/yyyy in GMT+7', () => {
  const now = new Date('2026-11-19T10:00:00.000Z');
  expect(formatRelativeNotificationTime('2026-11-19T09:59:35.000Z', now)).toBe('Vừa xong');
  expect(formatRelativeNotificationTime('2026-11-19T09:55:00.000Z', now)).toBe('5 phút trước');
  expect(formatRelativeNotificationTime('2026-11-19T07:00:00.000Z', now)).toBe('3 giờ trước');
  expect(formatRelativeNotificationTime('2026-11-16T10:00:00.000Z', now)).toBe('3 ngày trước');
  expect(formatRelativeNotificationTime('2026-11-05T18:00:00.000Z', now)).toBe('06/11/2026');
});

test('validates safe internal notification navigation paths', () => {
  expect(isSafeNotificationLink('/student/assignments/123?mode=review')).toBe(true);
  expect(isSafeNotificationLink('//evil.example')).toBe(false);
  expect(isSafeNotificationLink('https://evil.example')).toBe(false);
});
```

- [ ] **Step 2: Run frontend unit test to verify it fails**

Run: `cd frontend && npm run test:unit`
Expected: FAIL with missing `./notification-time.util`.

- [ ] **Step 3: Implement Notification API client, hook, Popover UI & integrate into `PortalTopbar`**

1. Tạo `notifications.types.ts`, `notifications.api.ts` (4 hàm `listNotifications`, `getUnreadNotificationCount`, `markNotificationRead`, `markAllNotificationsRead` hỗ trợ `RequestOptions`), và `notification-time.util.ts`.
2. Tạo `useNotifications.ts`:
   - Chỉ kích hoạt khi `enabled === true` (tính từ `Boolean(user && user.roles?.some((r) => r !== 'SUPERADMIN'))`).
   - Fetch `unreadCount` khi mount, poll mỗi `60_000ms` **chỉ khi `document.visibilityState === 'visible'`**, làm mới có throttle (`10s`) khi `focus` / `visibilitychange`.
   - Khi mở Popover: tải trang 1 (`limit=20`); hỗ trợ `loadMore` cộng dồn danh sách khi `hasMore === true`; optimistic + rollback an toàn cho `markAsRead(id)` và `markAllAsRead()`; đóng Popover + điều hướng `router.push(item.linkPath)` khi `isSafeNotificationLink(item.linkPath)` hợp lệ.
   - Hủy toàn bộ `AbortController` khi unmount hoặc `enabled` đổi thành `false`.
3. Tạo `NotificationItemRow.tsx` (icon theo nhóm sự kiện: bài tập/lịch/điểm/lớp/hệ thống, trạng thái chưa đọc in đậm nền `--red-soft`/45 + chấm đỏ son nhỏ, trạng thái đã đọc nền trắng bình thường) và `NotificationBellPopover.tsx`:
   - Nút chuông `aria-label="Thông báo"`, `aria-haspopup="dialog"`, `aria-expanded={open}`, badge đỏ son `--red` (`unreadCount > 99 ? '99+' : unreadCount`).
   - Popover `role="dialog" aria-label="Thông báo"`, chiều rộng `w-[min(380px,calc(100vw-24px))]` (bám mép phải, không tràn ngang ở `375px` mobile), header `"Thông báo"` + nút `"Đánh dấu tất cả đã đọc"`, danh sách cuộn `max-h-[380px] overflow-y-auto`, nút `"Tải thêm"` khi còn trang sau, footer tinh gọn `"Thông báo trong hệ thống"`.
   - Đóng bằng click ngoài (`mousedown` trên `document`) hoặc phím `Escape` (trả focus về nút chuông).
4. Gắn `<NotificationBellPopover user={user} />` vào `PortalTopbar.tsx` (ẩn khi `!user` hoặc `user.roles` chỉ gồm `['SUPERADMIN']`), và cập nhật ghi chú thành phần Topbar trong [`docs/test-inventory-ui.md`](../test-inventory-ui.md).

- [ ] **Step 4: Run frontend checks, build & check-loc**

Run: `cd frontend && npm run test:unit && npm run typecheck && npm run lint && npm run build && cd .. && node scripts/check-loc.js`
Expected: PASS 100% (`next build` 29/29 routes pass, `check-loc.js` 0 vi phạm).

- [ ] **Step 5: Commit Task 9.3**

```bash
git add frontend/src/features/notifications/ frontend/src/components/layout/PortalTopbar.tsx docs/test-inventory-ui.md
git commit -m "feat(frontend): add In-App notification bell popover in PortalTopbar"
```

---

### Task 9.4: Toàn Diện 16 Hạng Mục Prototype Cleanup (`PROTO-01` / `DEC-043`)

**Files:**
- Modify: `frontend/src/features/auth/components/LoginFormCard.tsx`
- Modify: `frontend/src/app/(auth)/login/page.tsx`
- Modify: `backend/src/modules/grading/grading.controller.ts`
- Modify: `frontend/src/features/grading/utils/grading-status.ts`
- Modify: `frontend/src/proxy.ts`

**Interfaces:**
- Consumes: Danh mục 16 hạng mục từ [`prototype-review.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/prototype-review.md#L81-L101) & `DEC-043`.
- Produces: Mã nguồn `backend/src/**` và `frontend/src/**` sạch 100% khối Dev Quick-Login, sạch 100% mã đặc tả nội bộ (`FUNC-xxx`, `DEC-xxx`, `SEC-xxx`, `SEC-RISK-xxx`, `BR-xxx`), bảo toàn đủ 7 hạng mục UX thật đã được duyệt (#10, #11, #12, #14, #16...).

- [ ] **Step 1: Verify exact targets of remaining cleanup items before editing**

Run:
```bash
git grep -nE "FUNC-[0-9]+|DEC-[0-9]+|SEC-[0-9]+|SEC-RISK-|BR-[0-9]+|EXAM-[0-9]+|NOTIF-[0-9]+|PROTO-[0-9]+" -- "backend/src" "frontend/src" ":(exclude)*.spec.ts" ":(exclude)*.spec.tsx" ":(exclude)*.test.ts"
git grep -nE "DEV_ACCOUNTS|DEV_PASSWORD|onDevQuickLogin|handleDevQuickLogin|Đăng nhập nhanh|Tài khoản demo|Thử lỗi|luyen-nghe|chờ chốt|Đăng ký lúc|Buổi gần đây \(14 ngày\)|Nhập điểm thủ công" frontend/src
```
Expected: Khớp chính xác 10 dòng mã đặc tả nội bộ (`grading.controller.ts` x8, `grading-status.ts` x1, `proxy.ts` x1) và khối `DEV_ACCOUNTS` / `onDevQuickLogin` trong `LoginFormCard.tsx` + `login/page.tsx`.

- [ ] **Step 2: Remove Dev Quick-Login completely (`LoginFormCard.tsx`, `login/page.tsx`) & strip internal spec codes**

1. Trong `frontend/src/features/auth/components/LoginFormCard.tsx`:
   - Xóa prop `onDevQuickLogin` khỏi `LoginFormCardProps` và destructuring.
   - Xóa hằng số `DEV_ACCOUNTS`, `DEV_PASSWORD` và toàn bộ khối JSX `{process.env.NODE_ENV === 'development' && onDevQuickLogin && (...)}` (lines 184–205).
2. Trong `frontend/src/app/(auth)/login/page.tsx`:
   - Xóa hàm `handleDevQuickLogin` và xóa prop `onDevQuickLogin` truyền vào `<LoginFormCard ... />`.
3. Xóa sạch mã đặc tả nội bộ khỏi 3 tệp:
   - `backend/src/modules/grading/grading.controller.ts`: bỏ `(FUNC-058, 062)`, `(DEC-038)`, `(FUNC-059)`, `(FUNC-060)`, `(FUNC-063)`, `(FUNC-058)`, `(FUNC-059)`, `(FUNC-061, 064)` trong 8 `@ApiOperation({ summary: ... })`, giữ mô tả tiếng Việt tự nhiên.
   - `frontend/src/features/grading/utils/grading-status.ts`: bỏ `(FUNC-063)` khỏi JSDoc dòng 7.
   - `frontend/src/proxy.ts`: bỏ `` (`SEC-RISK-05`)`` khỏi JSDoc dòng 31.
4. Đối chiếu kiểm tra đủ 16/16 mục `prototype-review.md`:
   - Đã loại bỏ (9 mục): #1 (thanh đổi vai trò demo), #2 (tài khoản demo & Dev Quick-Login), #3 (dòng gợi ý thử lỗi), #4 (checkbox Xem như tài khoản Chờ xếp lớp), #5 (nút file mẫu `luyen-nghe-hsk1-bo3.docx`), #6 & #7 (mọi nhãn `FUNC-xxx`), #8 (ghi chú "chờ chốt"), #9 (menu Điểm danh riêng 14 ngày), #13 (trường "Đăng ký lúc" ở Hồ sơ HV), #15 (trường "Múi giờ" ở Cấu hình hệ thống).
   - Bảo toàn UX thật (7 mục): #10 (`Hôm nay` / `Chưa điểm danh`), #11 (`Điểm danh: x/y có mặt`), #12 (cột `Đồng ý cha mẹ` chỉ có `Đã xác nhận` / `Không áp dụng`), #14 (nút `Xem bài nộp`), #16 (tag `Admin` cạnh tên GV).

- [ ] **Step 3: Run hygiene verification, unit tests, typecheck, lint & build**

Run:
1. `git grep -nE "FUNC-[0-9]+|DEC-[0-9]+|SEC-[0-9]+|SEC-RISK-|BR-[0-9]+|EXAM-[0-9]+|NOTIF-[0-9]+|PROTO-[0-9]+" -- "backend/src" "frontend/src" ":(exclude)*.spec.ts" ":(exclude)*.spec.tsx" ":(exclude)*.test.ts"` *(Expected: 0 matches, exit code 1)*
2. `git grep -nE "DEV_ACCOUNTS|DEV_PASSWORD|onDevQuickLogin|handleDevQuickLogin|Đăng nhập nhanh|Tài khoản demo|Thử lỗi|luyen-nghe|chờ chốt|Đăng ký lúc" frontend/src` *(Expected: 0 matches, exit code 1)*
3. `cd backend && npm run typecheck && npm run lint && npm run test`
4. `cd frontend && npm run typecheck && npm run lint && npm run test:unit && npm run build`
5. `node scripts/check-loc.js`
Expected: 100% PASS.

- [ ] **Step 4: Commit Task 9.4**

```bash
git add frontend/src/features/auth/components/LoginFormCard.tsx frontend/src/app/\(auth\)/login/page.tsx backend/src/modules/grading/grading.controller.ts frontend/src/features/grading/utils/grading-status.ts frontend/src/proxy.ts
git commit -m "chore(cleanup): remove Dev Quick-Login and remaining internal spec tags across backend and frontend"
```

---

### Task 9.5: 5 Architecture Invariant Tests, Playwright E2E Phase 9, Full Regression Gate, Independent Audit & Bàn Giao

**Files:**
- Create: `backend/test/phase09-architecture-invariants.e2e-spec.ts`
- Create: `frontend/e2e/phase09-notifications-and-cleanup.spec.ts`
- Create: `docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md`
- Modify: `PROJECT_PROGRESS.md`
- Modify: `MASTER_PLAN.md`

**Interfaces:**
- Consumes: Toàn bộ hệ thống Backend (`AppModule`, PostgreSQL 16 thật) & Frontend (`next dev` / `next build`), `playwright.config.ts`.
- Produces:
  - Bộ test hợp nhất **5 Architecture Invariants** (`phase09-architecture-invariants.e2e-spec.ts`):
    1. *Bất biến 1 (`1 HV <= 1 ACTIVE class`):* Cưỡng chế Partial Unique Index `idx_unique_student_active_enrollment` khi xếp lớp đồng thời & bảo toàn lịch sử khi chuyển/rút lớp.
    2. *Bất biến 2 (`Under-16 Guardian Consent & Parent Email`):* Lưu vết bất biến `guardian_consents` (trigger PostgreSQL chặn `UPDATE`/`DELETE`), hỗ trợ 2 học viên cùng chia sẻ `guardian_email` và giữ nguyên lịch sử khi HV $\ge 16$ đổi sang email cá nhân.
    3. *Bất biến 3 (`Teacher Attendance T+2 Window GMT+7`):* Cho phép sửa tới `23:59:59.999` GMT+7 ngày thứ 2 sau buổi học, chặn `403` từ `00:00:00.000` ngày thứ 3 cho GV trong khi Admin override ghi đủ `AttendanceAuditLog`.
    4. *Bất biến 4 (`Multi-role Context & Privilege Audit Log`):* Tài khoản đa vai trò (`ADMIN + TEACHER`) giữ quyền hợp nhất cao hơn và mọi đặc quyền Admin (sửa điểm danh quá hạn, sửa điểm sau công bố) đều ghi `AttendanceAuditLog`/`GradeAuditLog` + `SystemAuditLog` có `actingRole`.
    5. *Bất biến 5 (`Zero-Leak Unpublished Grades & Notifications`):* Điểm ở `GRADED` bị chặn 100% khỏi kết quả, GPA tổng kết, BTVN không cộng tổng kết, và thông báo `GRADE_PUBLISHED` tuyệt đối không phát sinh trước khi `RETURNED`.
  - Bộ Playwright E2E `frontend/e2e/phase09-notifications-and-cleanup.spec.ts` (Desktop `1440×900` + Mobile `375×812` + Axe WCAG AA) kiểm chứng:
    - Màn `/login` sạch hoàn toàn `"Đăng nhập nhanh"`, `"Tài khoản demo"`, `"Thử lỗi"`, mã `FUNC-xxx`.
    - Chuông thông báo end-to-end qua nhiều vai trò: HV đăng ký -> Admin thấy badge `NEW_STUDENT_PENDING_CLASS` -> Admin xếp lớp -> HV nhận `STUDENT_ENROLLED` -> GV giao bài -> HV nhận `ASSIGNMENT_ASSIGNED` -> HV nộp bài -> GV nhận `SUBMISSION_PENDING_GRADING` -> GV xác nhận `GRADED` (**HV vẫn 0 thông báo điểm — Zero-Leak**) -> GV công bố `RETURNED` -> HV thấy chuông `GRADE_PUBLISHED`, mở Popover trên Desktop & Mobile không tràn ngang (`scrollWidth - innerWidth <= 2`), click thông báo chuyển sang `/student/assignments/[id]?mode=review` và tự động giảm `unreadCount`, kiểm tra `"Đánh dấu tất cả đã đọc"`.
    - Pure `SUPERADMIN` không hiển thị nút chuông thông báo trên `PortalTopbar`.
  - Báo cáo nghiệm thu cuối kỳ `docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md` (bảng truy vết 71/71 `FUNC`, kiểm kê 104 API, 26 UI routes, 16/16 Prototype Cleanup, 5/5 Invariants, bảng metrics chạy test thực tế, và checklist vận hành/release sang `main`).

- [ ] **Step 1: Write `phase09-architecture-invariants.e2e-spec.ts` & `phase09-notifications-and-cleanup.spec.ts`**

Tạo hai bộ kiểm thử theo mô tả chi tiết ở trên (tái sử dụng `createRealE2eAppHarness` ở Backend và `reseedQaDatabase` + `loginThroughUi` + `AxeBuilder` ở Frontend như `phase08-progress-and-results.spec.ts`).

- [ ] **Step 2: Run ALL quality, build, coverage, integration, HTTP E2E, and Full Playwright E2E regression suites**

Run đầy đủ theo đúng thứ tự (sau lần chỉnh sửa code cuối cùng):
1. `node scripts/check-loc.js`
2. `git grep -nE "FUNC-[0-9]+|DEC-[0-9]+|SEC-[0-9]+|SEC-RISK-|BR-[0-9]+|EXAM-[0-9]+|NOTIF-[0-9]+|PROTO-[0-9]+" -- "backend/src" "frontend/src" ":(exclude)*.spec.ts" ":(exclude)*.spec.tsx" ":(exclude)*.test.ts"` *(Expected: 0 matches)*
3. `cd backend && npm run typecheck && npm run lint && npm run build && npm run test:cov && npm run test:integration && npm run test:e2e`
4. `cd frontend && npm run typecheck && npm run lint && npm run test:unit && npm run build && npm run test:e2e`
Expected: 100% PASS toàn bộ test suites (`0` failed, coverage backend `>= 85%` lines / `>= 80%` branches, Playwright tất cả specs + Axe WCAG AA pass trên Desktop & Mobile).

- [ ] **Step 3: Independent Security & Critic Audit + Final Regression Re-Run**

1. Dispatch reviewer độc lập (tương đương `akit-security` + `akit-critic`) kiểm toán toàn bộ diff của Phase 9 (focus: `NotificationsModule`, 14 triggers, Zero-Leak, Open Redirect, IDOR, `SUPERADMIN` isolation, polling leak, 16 cleanup items).
2. Khắc phục triệt để 100% mọi phát hiện (nếu có) và chạy lại đầy đủ lệnh kiểm chứng ở Step 2 sau lần sửa cuối.

- [ ] **Step 4: Publish Final Acceptance Report, Update `PROJECT_PROGRESS.md` & `MASTER_PLAN.md`, and Commit**

1. Viết [`docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md`](../reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md) với số liệu đo thực tế 100% từ Step 2–3.
2. Cập nhật `PROJECT_PROGRESS.md` và `MASTER_PLAN.md`: đánh dấu hoàn thành `[x]` toàn bộ Tasks `9.1..9.5` / Phase 9, ghi rõ trạng thái dự án đã sẵn sàng nghiệm thu & đề xuất release sang `main`.
3. Commit sạch trên nhánh `feature/phase-09-notifications-and-hardening` và merge sạch vào `develop` (chờ xác nhận của người phụ trách trước khi merge `develop -> main`).

```bash
git add backend/test/phase09-architecture-invariants.e2e-spec.ts frontend/e2e/phase09-notifications-and-cleanup.spec.ts docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md PROJECT_PROGRESS.md MASTER_PLAN.md
git commit -m "docs(phase-09): complete architecture invariants, full E2E verification and final acceptance report"
```
