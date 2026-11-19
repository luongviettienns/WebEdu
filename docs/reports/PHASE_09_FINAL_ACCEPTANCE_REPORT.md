# Báo Cáo Nghiệm Thu Cuối Kỳ Phase 9 & Bàn Giao Hệ Thống WebEdu (`PHASE_09_FINAL_ACCEPTANCE_REPORT`)

> **Ngày hoàn tất:** 2026-11-20  
> **Nhánh triển khai:** `feature/phase-09-notifications-and-hardening` $\rightarrow$ hợp nhất vào `develop`  
> **Phạm vi:** Module 10 (`FUNC-080` Thông báo In-App) & Production Hardening (`PROTO-01` / 16 hạng mục Prototype Cleanup, 5 Architecture Invariants, Full E2E Regression & Independent Security Audit)

---

## 1. Tổng Quan Phase 9 & Các Quyết Định Kiến Trúc Đã Chốt (`DEC-042`, `DEC-043`)

1. **Module 10 — Thông Báo In-App (`FUNC-080`, `NOTIF-01` / `DEC-042`):**
   - Triển khai **chỉ In-App Notification** (tuân thủ `DEC-015`, không gửi Zalo hay Email thông báo nghiệp vụ).
   - Hỗ trợ đầy đủ **14 loại sự kiện (`NotificationType`)** trải trên 7 module (`Auth`, `Students`, `Classes`, `Schedules`, `Assignments`, `Grading`, `Notifications`) cho `STUDENT`, `TEACHER`, `ADMIN`:
     - Học vụ & Lớp học: `NEW_STUDENT_PENDING_CLASS`, `STUDENT_ENROLLED`, `STUDENT_TRANSFERRED`, `STUDENT_DROPPED`, `TEACHER_ASSIGNED_CLASS`.
     - Lịch & Buổi học: `SESSION_RESCHEDULED`, `SESSION_CANCELLED`, `SESSION_MAKEUP_ADDED` (tự động loại học viên `DROPPED`/`TRANSFERRED`).
     - Bài tập & Sắp hết hạn: `ASSIGNMENT_ASSIGNED`, `ASSIGNMENT_DUE_SOON` (cửa sổ 24 giờ trên scheduler nền 15 phút `.unref()` + kiểm tra throttled khi học viên truy vấn danh sách/badge, `dedupKey: due_soon:<assignmentId>:<effectiveDueAtMs>`), `SUBMISSION_REOPENED`, `SUBMISSION_PENDING_GRADING` (cộng dồn nguyên tử `ON CONFLICT` theo bài tập cho giáo viên qua `dedupKey: sub_pending:<assignmentId>`).
     - Chấm điểm & Công bố (**Zero-Leak Gate**): Tuyệt đối **0 thông báo** khi bài ở `GRADED`; chỉ phát `GRADE_PUBLISHED` khi chuyển `RETURNED` và `GRADE_UPDATED` khi chỉnh sửa bài đang ở `RETURNED`.
   - Loại trừ tự thông báo (`recipientId !== actorId`); tài khoản `SUPERADMIN` thuần bị chặn `403 Forbidden` trên `/api/v1/notifications/*` và không render nút chuông trên `PortalTopbar`.
   - Giao diện Chuông & Popover trực tiếp trên `PortalTopbar` (không sinh route mới; tải 20 mục + `"Tải thêm"`, bộ lọc `Tất cả` / `Chưa đọc`, polling 60s chỉ chạy khi tab hiển thị + làm mới theo focus có throttle 10s, dọn lưu trữ tự động mỗi giờ `.unref()` xóa tin đã đọc $>90$ ngày và chưa đọc $>180$ ngày).

2. **Prototype Cleanup Toàn Diện (`PROTO-01` / `DEC-043`):**
   - Gỡ bỏ hoàn toàn khối **Dev Quick-Login** (`DEV_ACCOUNTS`, `DEV_PASSWORD`, `onDevQuickLogin`, `handleDevQuickLogin` và khung `"Đăng nhập nhanh (Dev)"`) khỏi [`LoginFormCard.tsx`](../frontend/src/features/auth/components/LoginFormCard.tsx) và [`login/page.tsx`](../frontend/src/app/(auth)/login/page.tsx) ở cả môi trường development lẫn production.
   - Xóa 100% 10 nhãn đặc tả nội bộ còn sót (`FUNC-xxx`, `DEC-xxx`, `SEC-RISK-05`) tại [`grading.controller.ts`](../backend/src/modules/grading/grading.controller.ts), [`grading-status.ts`](../frontend/src/features/grading/utils/grading-status.ts) và [`proxy.ts`](../frontend/src/proxy.ts).
   - Đối chiếu xác nhận đủ **16/16 hạng mục** từ [`prototype-review.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/prototype-review.md) (**9 mục đã loại bỏ**: #1, #2, #3, #4, #5, #6/#7, #8, #9, #13, #15; **7 mục UX thật được bảo toàn**: #10, #11, #12, #14, #16 và chuẩn quy trình hiện hành).

---

## 2. Kiểm Kê Phạm Vi Hoàn Thiện Toàn Dự Án (Phases 0 $\rightarrow$ 9)

| Hạng mục kiểm kê | Giá trị thực tế | Tài liệu / Kiểm chứng đối chiếu |
| :--- | :---: | :--- |
| **Truy vết Mã Chức năng (`FUNC`)** | **71 / 71** *(70 triển khai + `FUNC-076` loại theo `DEC-018`)* | [`MASTER_PLAN.md`](../../MASTER_PLAN.md), [`PROJECT_PROGRESS.md`](../../PROJECT_PROGRESS.md) |
| **Backend HTTP Endpoints** | **104 endpoints** *(100 P1–P8 + 4 `/notifications/*`)* | [`docs/test-inventory-api.md`](../test-inventory-api.md), [`api-inventory-and-rbac-matrix.e2e-spec.ts`](../../backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts) |
| **Frontend UI Routes (`page.tsx`)** | **26 routes** *(+ Popover chuông trên `PortalTopbar`)* | [`docs/test-inventory-ui.md`](../test-inventory-ui.md), `next build` (29 routes app gồm static/dynamic) |
| **Prisma SQL Migrations** | **25 migrations** *(gồm 2 migration Phase 9)* | `npx prisma migrate deploy` trên PostgreSQL 16 |
| **Prototype Cleanup (`prototype-review.md`)** | **16 / 16 hạng mục** *(0 dấu vết dev/spec trong non-test src)* | `git grep` exit code 1 (0 matches), [`phase09-notifications-and-cleanup.spec.ts`](../../frontend/e2e/phase09-notifications-and-cleanup.spec.ts) |
| **Architecture Invariants (PostgreSQL thật)** | **5 / 5 Invariants PASS** | [`phase09-architecture-invariants.e2e-spec.ts`](../../backend/test/phase09-architecture-invariants.e2e-spec.ts) |

### Chi Tiết Kiểm Chứng 5 Bất Biến Kiến Trúc (`architecture-decision-contract.md`)
1. **Invariant 1 (`1 HV <= 1 ACTIVE class`):** Xếp lớp đồng thời (`Promise.all`) vào 2 lớp `ACTIVE` chặn race qua Partial Unique Index `idx_unique_student_active_enrollment` (1 `200`, 1 `409`); chèn trực tiếp bản ghi `ACTIVE` thứ 2 tại PostgreSQL bị từ chối; `transfer` & `drop` giữ nguyên toàn bộ lịch sử `TRANSFERRED` / `DROPPED`.
2. **Invariant 2 (`Under-16 Guardian Consent & Parent Email`):** HV $<16$ đăng ký sinh `guardian_consents`; trigger `trg_guardian_consents_immutable` chặn cả raw SQL `UPDATE` lẫn `DELETE`; HV $<16$ bị chặn tự đổi email (`403`), HV $\ge 16$ đổi email qua OTP vẫn bảo toàn dòng `guardian_consents` cũ; 2 anh/chị em $<16$ dùng chung `guardian_email` hợp lệ.
3. **Invariant 3 (`Teacher Attendance T+2 Window GMT+7`):** GV sửa điểm danh trong hạn $T+1/T+2$ thành công (`200`), quá hạn $T+3$ GMT+7 bị chặn `403`, Admin override thành công (`200`) kèm `AttendanceAuditLog`.
4. **Invariant 4 (`Multi-Role Context & Privilege Audit Log`):** Tài khoản kiêm nhiệm `ADMIN + TEACHER` giữ quyền hợp nhất cao hơn (`ADMIN`), mọi thao tác đặc quyền sửa điểm danh quá hạn và sửa điểm đã công bố ghi đủ `AttendanceAuditLog` / `GradeAuditLog` + `SystemAuditLog` với `actingRole = ADMIN`.
5. **Invariant 5 (`Zero-Leak Unpublished Grades, BTVN Weight & Notifications`):** Điểm ở `GRADED` bị chặn 100% ở `/assignments/:id/published-result` (`isPublished: false, result: null`) & `/progress/me`, điểm BTVN (`HOMEWORK`) không ảnh hưởng `finalScore`, và chỉ sinh `GRADE_PUBLISHED` sau khi chuyển `RETURNED`.

---

## 3. Kết Quả Kiểm Toán Bảo Mật & Kiến Trúc Độc Lập (`Security & Critic Audit`)

Phiên kiểm toán độc lập trước khi chốt nhánh đã rà soát toàn bộ diff Phase 9 và phát hiện **0 P0**, **1 P1**, **3 P2**, **5 P3** — đã khắc phục triệt để tại commit `b5a5b00`:

- **[P1 — Đã sửa] Polling chuông thông báo 60s vô hiệu hóa Idle Timeout 60 phút phía server (`lastActivityAt`):**
  - Bổ sung decorator `@SkipActivityTouch()` trong [`roles.decorator.ts`](../../backend/src/common/decorators/roles.decorator.ts) gắn lên `GET /api/v1/notifications/unread-count`, kết nối [`jwt-auth.guard.ts`](../../backend/src/common/guards/jwt-auth.guard.ts) và [`session-validator.service.ts`](../../backend/src/common/guards/session-validator.service.ts) (`{ touchActivity: false }`) để route polling vẫn **kiểm tra và thu hồi phiên hết hạn 60 phút**, nhưng **không làm mới `users.last_activity_at`**.
  - Frontend tạm dừng polling qua prop `pollingActive={canRenderChildren && remainingSeconds === null}` từ [`PortalShell.tsx`](../../frontend/src/components/layout/PortalShell.tsx) $\rightarrow$ [`PortalTopbar.tsx`](../../frontend/src/components/layout/PortalTopbar.tsx) $\rightarrow$ [`NotificationBellPopover.tsx`](../../frontend/src/features/notifications/components/NotificationBellPopover.tsx).
  - Kiểm chứng tự động bằng unit test trong [`jwt-auth.guard.spec.ts`](../../backend/src/common/guards/jwt-auth.guard.spec.ts) và Real-PG E2E trong [`phase09-notifications.e2e-spec.ts`](../../backend/test/phase09-notifications.e2e-spec.ts).
- **[P2 #1 & P3 #1 — Đã sửa] Race condition `isLoadingList` & stale polling overwrite trong [`useNotifications.ts`](../../frontend/src/features/notifications/hooks/useNotifications.ts):**
  - Luôn reset loading state khi `listAbortRef.current === controller` (kể cả khi silent refresh thay thế request đang chạy); đồng bộ `pageRef`; gộp luồng refresh khi popover đang mở ở trang 1 (tránh gọi trùng `/unread-count` và tránh xóa trang đã `"Tải thêm"`); chủ động abort `countAbortRef`/`listAbortRef` trước khi cập nhật lạc quan khi đánh dấu đã đọc.
- **[P2 #2 — Đã sửa] Đồng bộ DB `CHECK` constraint cho `/\` và ký tự điều khiển:**
  - Tạo migration [`20261120003000_phase09_notification_link_check_hardening/migration.sql`](../../backend/prisma/migrations/20261120003000_phase09_notification_link_check_hardening/migration.sql) ràng buộc `left("link_path", 1) = '/' AND left("link_path", 2) NOT IN ('//', '/\') AND "link_path" !~ '[[:cntrl:]]'`; kiểm chứng từ chối `'/\\evil'` và `'/bad\npath'` trực tiếp trên PostgreSQL.
- **[P2 #3 — Đã sửa] Nhắc hạn 24h cho bài nộp được giáo viên mở lại với `dueAtOverride` mới:**
  - Cập nhật `dedupKey` tại [`notification-deadline.service.ts`](../../backend/src/modules/notifications/services/notification-deadline.service.ts) thành `due_soon:${assignment.id}:${effectiveDueAt.getTime()}` và bổ sung E2E test kiểm chứng.
- **[P3 #5 — Đã sửa] Chặn tham số `page` quá lớn tràn `INT4 OFFSET`:**
  - Bổ sung `@Max(10000)` cho `ListNotificationsQueryDto.page` tại [`notifications.dto.ts`](../../backend/src/modules/notifications/dto/notifications.dto.ts).
- **3 điểm P3 ghi nhận ở mức thông tin (không gây rủi ro bảo mật hay hỏng dữ liệu):** (1) `READ COMMITTED` khi 2 HV nộp trùng mili-giây có thể khiến nội dung đếm `SUBMISSION_PENDING_GRADING` tạm ghi `1` trước khi lần cập nhật sau ghi đúng `2`; (2) `onPublishedGradeAdjustedTx` tin cậy kiểm tra `SubmissionStatus.RETURNED` ở service gọi duy nhất `GradeAdjustmentService`; (3) cửa sổ mili-giây khi 2 request `/unread-count` & `/notifications` khởi tạo cùng lúc trước khi transaction nhắc hạn 24h commit.

---

## 4. Số Liệu Kiểm Chứng Thực Tế (Chạy 100% Sau Commit Cuối `b5a5b00`)

| Cổng kiểm chứng | Phạm vi / Lệnh | Kết quả thực tế quan sát |
| :--- | :--- | :--- |
| **Giới hạn LOC kiến trúc** | `node scripts/check-loc.js` | **PASS** — **281/281 tệp** thuộc 7 nhóm đạt chuẩn |
| **Vệ sinh mã nội bộ** | `git grep` `FUNC-/DEC-/SEC-/BR-/...` (`backend/src`, `frontend/src` non-test) | **PASS** — **0 matches** (exit 1) |
| **Vệ sinh Prototype / Quick-Login** | `git grep` `DEV_ACCOUNTS\|DEV_PASSWORD\|Đăng nhập nhanh\|Thử lỗi\|...` (`frontend/src`) | **PASS** — **0 matches** (exit 1) |
| **Database Migration** | `backend`: `npx prisma migrate deploy` | **PASS** — **25 migrations** đồng bộ |
| **Backend Static Analysis & Build** | `backend`: `npm run typecheck`, `npm run lint`, `npm run build` | **PASS** — `0` TS errors, `0` warnings/`0` errors (`oxlint`, **272 files**), `nest build` OK |
| **Backend Unit & Coverage** | `backend`: `npm run test:cov` | **PASS** — **61/61 files · 591/591 tests PASS** (`29.13s`)<br>Coverage: **89.13% Stmts · 80.6% Branches · 89.64% Funcs · 90.67% Lines** *(đạt ngưỡng $\ge 85\%$ lines / $\ge 80\%$ branches)* |
| **Backend PG Integration** | `backend`: `npm run test:integration` | **PASS** — **1/1 file · 20/20 tests PASS** (`30.54s`) |
| **Backend Real-PG HTTP E2E** | `backend`: `npm run test:e2e` | **PASS** — **14/14 files · 80/80 tests PASS** (`168.52s`) *(gồm `api-inventory` 104 endpoints, `phase09-notifications` 1/1, `phase09-architecture-invariants` 4/4)* |
| **Frontend Static Analysis & Unit** | `frontend`: `npm run typecheck`, `npm run lint`, `npm run test:unit`, `npm run build` | **PASS** — `0` TS errors, `0` ESLint errors, **47/47 unit tests PASS** (`1.1s`), `next build` OK (**29 routes app**) |
| **Frontend Full Playwright E2E** | `frontend`: `npm run test:e2e` *(Desktop `1440×900` + Mobile `375×812` + `@axe-core/playwright`)* | **PASS** — **111 passed, 3 skipped** *(3 test desktop-only bỏ qua sẵn trên `mobile-chromium` tại `ui-browser-bugfixes.spec.ts`)*, **0 failed** (`5.0m`, gồm **4/4 PASS** tại `phase09-notifications-and-cleanup.spec.ts`) |

---

## 5. Lịch Sử Commit Trên Nhánh Phase 9 & Checklist Phát Hành Sang `main`

### Danh sách Commit (`feature/phase-09-notifications-and-hardening` trên nền `develop` `03562dc`)
1. `93cbac0` — `feat(notifications): add Notification schema, core module API, 24h reminders and retention job`
2. `6b2ab95` — `feat(notifications): wire 14 academic notification triggers across modules with Zero-Leak E2E`
3. `2a2ccaa` — `feat(frontend): add In-App notification bell popover in PortalTopbar`
4. `d8d70a8` — `chore(cleanup): remove Dev Quick-Login and remaining internal spec tags across backend and frontend`
5. `565c5a8` — `fix(frontend): avoid aborting notification fetch when popover open or filter state changes`
6. `45ee5e1` — `test(phase-09): add 5 architecture invariants E2E and Playwright notifications & cleanup E2E`
7. `b5a5b00` — `fix(phase-09): resolve security audit findings for idle timeout, polling races, DB link check, and reopen reminders`

### Checklist Sẵn Sàng Phát Hành Production (`develop -> main`)
- [x] Mọi SQL migration đã kiểm chứng áp dụng tuần tự qua `prisma migrate deploy` (tuyệt đối không dùng `db push`).
- [x] Loại bỏ hoàn toàn Dev Quick-Login và mã nội bộ khỏi bundle production (`next build` + `nest build`).
- [x] Biến môi trường production cần thiết được định nghĩa rõ (PostgreSQL URL, `JWT_SECRET`, `CORS_ORIGIN`, `FRONTEND_APP_URL`, `SMTP_*` / `RESEND_*` — tùy hạ tầng triển khai thực tế).
- [ ] Chờ xác nhận từ người phụ trách dự án trước khi `git push origin develop` và hợp nhất phát hành `develop -> main`.
