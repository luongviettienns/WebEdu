# Kho Lưu Trữ Bề Mặt API Backend (Backend API Surface Inventory)

> **Đồng bộ gần nhất:** 2026-11-13 (đối chiếu kiểm toán `#6` trên nhánh `develop` và `#7` trên nhánh `feature/phase-05-question-bank-and-import`)
> **Phạm vi kiểm chứng hiện tại:** **71 HTTP Endpoints** trên **11 Controllers** (gồm **54 endpoints / 10 controllers** đã merge trên `develop` cho Phases 1–4 + **17 endpoints / 1 controller** `AssessmentsController` trên nhánh `feature/phase-05-question-bank-and-import`), đối chiếu khớp 100% với `DECLARED_PHASE2_API_INVENTORY` trong [`backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts).

---

## 1. Quy Ước Nền Tảng (API Contract & Security Invariants)

- **Prefix & Tài liệu:** Toàn bộ API nghiệp vụ dùng prefix `/api/v1` (Swagger UI tại `/api/docs`). Múi giờ chuẩn hệ thống: `Asia/Ho_Chi_Minh`.
- **Rule 1 — RFC 7807 Problem Details:** `AllExceptionsFilter` ([`all-exceptions.filter.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/common/filters/all-exceptions.filter.ts)) chuẩn hóa mọi lỗi HTTP / Prisma `P2002` / body parser (`413`, `400`) với `Content-Type: application/problem+json` gồm: `type`, `title`, `status`, `detail`, `instance`, `timestamp`, và `invalidParams` (tùy chọn khi lỗi `ValidationPipe`). *(Lưu ý: `AllExceptionsFilter` hiện **không** sinh/trả về trường `requestId`.)*
- **Rule 2 — Global Strict Validation:** `ValidationPipe` toàn cục cấu hình `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` — từ chối thuộc tính lạ với `400 Bad Request` + `invalidParams`. Giới hạn JSON mặc định toàn cục là `100kb`; riêng `PUT /api/v1/system-settings/config` dùng route-scoped JSON parser `4mb` (`413 Payload Too Large` nếu vượt ngưỡng).
- **Rule 3 — Default-Deny RBAC & Auth:** Toàn bộ endpoint chạy qua Global `JwtAuthGuard` và `RolesGuard` (cookie HttpOnly `webedu_access_token` hoặc Bearer JWT, kiểm tra Origin CSRF cho mutating requests dùng cookie). Mọi endpoint không gắn `@Public()` yêu cầu JWT hợp lệ (`401`). `@AuthenticatedOnly()` cho phép mọi vai trò đã đăng nhập; `@Roles(...)` kiểm tra vai trò được phép (pure `SUPERADMIN` bị chặn khỏi dữ liệu học vụ nếu endpoint không khai báo `Role.SUPERADMIN`).
- **Rule 4 — Chống BOLA / IDOR & Concurrency:** Mọi endpoint thao tác theo `:id` / `:studentId` / `:qid` đều kiểm tra quyền sở hữu/phạm vi lớp theo vai trò (`ClassAccessService`, `ScheduleAccessPolicy`, `AttendancePolicy`, `AssessmentAccessPolicy`); các thao tác ghi danh/xếp lớp/sửa buổi học dùng PostgreSQL transaction (`FOR UPDATE` / partial unique index) để tránh deadlock/race condition.

---

## 2. Danh Sách 71 API Endpoints Theo Controller

### A. Hạ Tầng & Xác Thực (Phases 1–2 — `develop`)

#### 2.1 `HealthController` (`/api/v1/health` — 1 endpoint)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / Params | Output & Mã trạng thái chính |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 1 | `GET` | `/health` | `@Public()` | Không | `200 OK` `{ status: 'ok', service: 'webedu-backend', database: 'ok', timezone: 'Asia/Ho_Chi_Minh', timestamp }` hoặc `503` khi DB lỗi |

#### 2.2 `AuthController` (`/api/v1/auth` — 8 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / DTO (`forbidNonWhitelisted`) | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 2 | `POST` | `/auth/send-verification-code` | `@Public()` | `SendVerificationCodeDto`: `{ email }` | `200 OK` — Gửi mã OTP 6 số qua SMTP; áp rate-limit / cooldown (`429`) |
| 3 | `POST` | `/auth/register` | `@Public()` | `RegisterDto`: `{ fullName, dateOfBirth, phone, email, password, confirmPassword?, verificationCode?, guardianEmail?, guardianConsent? }` | `201 Created` — HV tự đăng ký ($\ge 12$ tuổi, $< 16$ bắt buộc `guardianConsent = true`, `DEC-001`), trạng thái `PENDING_CLASS`; trùng SĐT/email $\rightarrow$ `409` |
| 4 | `POST` | `/auth/register/student` | `@Public()` | Alias của `/auth/register` (`RegisterDto`) | `201 Created` — Tương đương `#3` (Express đăng ký 2 route riêng) |
| 5 | `POST` | `/auth/login` | `@Public()` | `LoginDto`: `{ email, password, rememberMe? }` | `200 OK` — Set cookie `webedu_access_token` luôn có `maxAge` (**7 ngày** khi `rememberMe=true`, **`3600s` (1 giờ)** khi `rememberMe=false`); sai 5 lần khóa tài khoản 15 phút trên `users` trả **`403 Forbidden`** (`AuthRateLimit` theo IP 15 lần/60s trả **`429`**) |
| 6 | `GET` | `/auth/me` | `@AuthenticatedOnly()` | Cookie / Bearer JWT | `200 OK` — Hồ sơ xác thực, `roles`, trạng thái tài khoản |
| 7 | `POST` | `/auth/logout` | `@AuthenticatedOnly()` | Cookie / Bearer JWT | `200 OK` — Thu hồi `tokenVersion` phiên hiện tại & xóa cookie |
| 8 | `POST` | `/auth/forgot-password` | `@Public()` | `ForgotPasswordDto`: `{ email }` | `200 OK` (generic không lộ tồn tại email); gửi link khôi phục; cooldown 60s (`429`) |
| 9 | `POST` | `/auth/reset-password` | `@Public()` | `ResetPasswordDto`: `{ token, newPassword, confirmPassword? }` | `200 OK` — Đặt lại mật khẩu và thu hồi các phiên cũ |

#### 2.3 `ProfileController` (`/api/v1/profile` — 3 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / DTO (`forbidNonWhitelisted`) | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 10 | `GET` | `/profile/me` | `@AuthenticatedOnly()` | JWT | `200 OK` — Thông tin hồ sơ cá nhân theo vai trò |
| 11 | `PATCH` | `/profile/me` | `@AuthenticatedOnly()` | `UpdateProfileDto`: `{ fullName?, phone?, email?, currentPassword?, dateOfBirth? }` | `200 OK` — Cập nhật hồ sơ; học viên không tự sửa `dateOfBirth` (`ProfileService` tự kiểm tra); xoay cookie nếu đổi thông tin nhạy cảm. *(Lưu ý drift `FUNC-078`: backend chưa chặn đổi email của HV $<16$ hay yêu cầu OTP khi đổi email tại endpoint này.)* |
| 12 | `POST` | `/profile/change-password` | `@AuthenticatedOnly()` | `ChangePasswordDto`: `{ currentPassword, newPassword, confirmPassword? }` | `200 OK` — Đổi mật khẩu, tăng `tokenVersion` & cấp cookie phiên mới |

### B. Quản Lý Nhân Sự, Học Viên & Hệ Thống (Phase 2 — `develop`)

#### 2.4 `TeachersController` (`/api/v1/teachers` — 3 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 13 | `GET` | `/teachers` | `ADMIN`, `SUPERADMIN` | `ListTeachersQueryDto`: `{ search?, status?, page?, limit? }` | `200 OK` — Danh sách giáo viên phân trang (kèm tag vai trò `ADMIN` nếu kiêm nhiệm) |
| 14 | `POST` | `/teachers` | `ADMIN`, `SUPERADMIN` | `CreateTeacherDto`: `{ fullName, phone, email, initialPassword, notes? }` | `201 Created` — Tạo tài khoản `TEACHER` + `TeacherProfile` |
| 15 | `PATCH` | `/teachers/:id` | `ADMIN`, `SUPERADMIN` | `UpdateTeacherDto`: `{ fullName?, phone?, email?, notes?, status? }` (`ACTIVE` \| `INACTIVE`) | `200 OK` — Chặn vô hiệu hóa (`INACTIVE`) nếu GV đang phụ trách lớp chưa kết thúc (`409` kèm danh sách lớp ràng buộc) |

#### 2.5 `StudentsController` (`/api/v1/students` — 8 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 16 | `GET` | `/students` | `ADMIN`, `SUPERADMIN` | `ListStudentsQueryDto`: `{ search?, status?, className?, page?, limit? }` | `200 OK` — `SUPERADMIN` không nhận dữ liệu học vụ `currentClassId`/`assignedClass` (khắc phục `F6`) |
| 17 | `GET` | `/students/pending-enrollment` | `ADMIN` | `ListPendingEnrollmentQueryDto`: `{ search?, page?, limit? }` | `200 OK` — Danh sách HV trạng thái `PENDING_CLASS` chờ xếp lớp |
| 18 | `GET` | `/students/available-classes` | `ADMIN` | Không | `200 OK` — Danh sách lớp `UPCOMING` / `ACTIVE` phục vụ xếp lớp ban đầu |
| 19 | `GET` | `/students/:id` | `STUDENT`, `ADMIN`, `SUPERADMIN` | `:id` (Student User ID) | `200 OK` — `STUDENT` chỉ xem chính mình (`403` nếu ID khác); `SUPERADMIN` bị ẩn `currentClassId`/`assignedClass` |
| 20 | `PATCH` | `/students/:id` | `ADMIN`, `SUPERADMIN` | `UpdateStudentDto`: `{ fullName?, phone?, email?, dateOfBirth?, status?, internalNotes? }` | `200 OK` — Cập nhật thông tin/trạng thái HV (`INACTIVE` thu hồi phiên) |
| 21 | `POST` | `/students/:id/assign-initial-class` | `ADMIN` | `AssignInitialClassDto`: `{ classNameOrId, enrolledAt? }` | `200 OK` — Xếp lớp ban đầu trong DB transaction & kích hoạt `ACTIVE`; chặn race-condition nhờ Partial Unique Index (`400`/`409`) |
| 22 | `GET` | `/students/:id/learning-records` | `STUDENT`, `TEACHER`, `ADMIN` | `:id` | `200 OK` — Dữ liệu học tập theo phạm vi lớp được phép (pure `SUPERADMIN` $\rightarrow$ `403`) |
| 23 | `GET` | `/students/:id/class-history` | `STUDENT`, `TEACHER`, `ADMIN` (Guard) — **`ADMIN` & chính `STUDENT` (`200`), `TEACHER` $\rightarrow$ `403`** | `:id` | `200 OK` — Lịch sử các lớp đã học; `StudentAccessService.assertCanViewClassHistory` chặn `TEACHER` bằng `403 Forbidden` (chỉ `ADMIN` hoặc chính `STUDENT` được xem) |

#### 2.6 `SystemSettingsController` (`/api/v1/system-settings` — 6 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 24 | `GET` | `/system-settings/users` | `SUPERADMIN` | `ListSystemUsersQueryDto`: `{ search?, page?, limit? }` | `200 OK` — Danh sách tài khoản hệ thống phân trang *(chưa hỗ trợ lọc `role`/`status` ở query DTO)* |
| 25 | `POST` | `/system-settings/users` | `SUPERADMIN` | `CreateSystemUserDto`: `{ fullName, phone, email, initialPassword, roles, status? }` | `201 Created` — Tạo tài khoản nhân sự/quản trị đa vai trò |
| 26 | `PATCH` | `/system-settings/users/:id/roles` | `SUPERADMIN` | `UpdateUserRolesStatusDto`: `{ roles?, status? }` | `200 OK` — Cập nhật vai trò/trạng thái; bảo vệ chống tự hạ cấp hoặc mất `SUPERADMIN` hoạt động cuối cùng |
| 27 | `GET` | `/system-settings/config` | `@Public()` | Không | `200 OK` — Trả cấu hình tên trung tâm & logo (`Cache-Control: public, max-age=300, stale-while-revalidate=600`) |
| 28 | `PUT` | `/system-settings/config` | `SUPERADMIN` | `UpdateSystemConfigDto`: `{ centerName, centerLogoUrl?, centerLogoBase64?, updatedAt?, timezone? }` | `200 OK` — Parser riêng `4mb`; kiểm tra magic-bytes PNG/JPG tối đa 2MB *(trường `timezone` không còn tác dụng)* |
| 29 | `GET` | `/system-settings/audit-logs` | `SUPERADMIN` | `ListAuditLogsQueryDto`: `{ page?, limit? }` | `200 OK` — Nhật ký vận hành hệ thống phân trang *(chưa hỗ trợ filter `action` trên query DTO)* |

### C. Khóa HSK & Quản Lý Lớp Học (Phase 3 — `develop`)

#### 2.7 `CoursesController` (`/api/v1/courses` — 3 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 30 | `GET` | `/courses` | `ADMIN`, `TEACHER` | `ListCoursesQueryDto`: `{ activeOnly?, search?, level? }` | `200 OK` — Danh mục khóa học HSK (`HSK1..HSK4`, `BASIC_COMM`, HSK 3.0) |
| 31 | `POST` | `/courses` | `ADMIN` | `CreateCourseDto`: `{ code, name, level, defaultSessions?, description?, isActive? }` | `201 Created` — Tạo khóa học (`code` duy nhất `^[A-Z0-9_-]+$`, 2–30 ký tự) |
| 32 | `PATCH` | `/courses/:id` | `ADMIN` | `UpdateCourseDto`: `{ code?, name?, level?, defaultSessions?, description?, isActive? }` | `200 OK` — Cập nhật thông tin hoặc kích hoạt/tạm ngưng khóa học |

#### 2.8 `ClassesController` (`/api/v1/classes` — 10 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 33 | `GET` | `/classes` | `ADMIN`, `TEACHER` | `ListClassesQueryDto`: `{ search?, courseId?, teacherId?, excludeClassId?, status?, includeEnded?, page?, limit? }` | `200 OK` — `TEACHER` chỉ thấy lớp đang phụ trách hoặc lớp đã kết thúc/lưu trữ của chính mình (`DEC-025`) |
| 34 | `POST` | `/classes/preview-schedule` | `ADMIN` | `PreviewClassScheduleDto`: `{ scheduleDays, scheduleStartTime, scheduleEndTime, startDate, totalSessions, teacherId?, excludeClassId? }` | `200 OK` — Tính trước ngày dự kiến kết thúc & cảnh báo trùng lịch GV |
| 35 | `GET` | `/classes/:id` | `ADMIN`, `TEACHER` | `GetClassDetailQueryDto`: `{ includeInactiveEnrollments? }` | `200 OK` — Chi tiết lớp, danh sách HV, lịch sử thay đổi GV (`DEC-025` chặn GV đã bị thay thế) |
| 36 | `POST` | `/classes` | `ADMIN` | `CreateClassDto`: `{ code, courseId, teacherId, scheduleDays, scheduleStartTime, scheduleEndTime, startDate, totalSessions?, status?, notes? }` | `201 Created` — Tạo lớp mới (1 GV phụ trách, không giới hạn cứng 5 HV theo `DEC-005`/`DEC-006`) + tự động sinh các `LessonSession` ban đầu |
| 37 | `PATCH` | `/classes/:id` | `ADMIN` | `UpdateClassDto`: `{ code?, courseId?, teacherId?, teacherChangeReason?, teacherAssignedFrom?, scheduleDays?, scheduleStartTime?, scheduleEndTime?, startDate?, totalSessions?, status?, notes? }` | `200 OK` — Cập nhật lớp, thay đổi GV (ghi `ClassTeacherAssignment`) hoặc điều chỉnh lịch học |
| 38 | `POST` | `/classes/:id/enrollments` | `ADMIN` | `EnrollStudentsDto`: `{ studentIds, enrolledDate? }` | `200 OK` — Thêm nhiều HV vào lớp (tối đa 100 HV/lần); thực thi 1 HV tối đa 1 lớp `ACTIVE` (`DEC-007`) |
| 39 | `POST` | `/classes/:id/enrollments/:studentId/transfer` | `ADMIN` | `TransferStudentClassDto`: `{ targetClassId, transferDate?, reason? }` | `200 OK` — Chuyển lớp trong DB transaction, đánh dấu `TRANSFERRED` ở lớp cũ & tạo `ACTIVE` ở lớp mới (`DEC-008`) |
| 40 | `POST` | `/classes/:id/enrollments/:studentId/drop` | `ADMIN` | `DropStudentClassDto`: `{ leftDate?, reason? }` | `200 OK` — Rút/bảo lưu HV khỏi lớp (`DROPPED`), giữ nguyên lịch sử |
| 41 | `POST` | `/classes/:id/complete` | `ADMIN` | `CompleteClassDto`: `{ actualEndDate?, reason? }` | `200 OK` — Kết thúc lớp (`COMPLETED`, cho phép dừng trước khi đủ tổng buổi theo `DEC-019`) |
| 42 | `POST` | `/classes/:id/reopen` | `ADMIN` | `ReopenClassDto`: `{ reason? }` | `200 OK` — Mở lại lớp đã kết thúc trong thời hạn 7 ngày và khôi phục học viên hợp lệ |

### D. Lịch Học, Buổi Học & Điểm Danh (Phase 4 — `develop`)

#### 2.9 `SchedulesController` (8 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 43 | `GET` | `/classes/:id/sessions` | `ADMIN`, assigned `TEACHER`, enrolled `STUDENT` | `ListClassSessionsQueryDto`: `{ status?, from?, to? }` | `200 OK` — Danh sách buổi học + `summary`; thuần `SUPERADMIN` $\rightarrow$ `403`; HV `DROPPED` không được xem |
| 44 | `POST` | `/classes/:id/sessions` | `ADMIN` | `AddManualSessionDto`: `{ sessionDate, startTime, endTime, topic?, reason? }` | `201 Created` — Thêm buổi thủ công (`MANUAL`), tự đồng bộ đánh số buổi active & `expectedEndDate`, kiểm tra cảnh báo trùng lịch GV |
| 45 | `GET` | `/schedules/calendar` | `ADMIN`, `TEACHER`, `STUDENT` | `ListCalendarSessionsQueryDto`: `{ from?, to?, classId?, teacherId?, status? }` | `200 OK` — Khung lịch toàn hệ thống theo phạm vi role (`from..to` tối đa 93 ngày; pure `SUPERADMIN` $\rightarrow$ `403`) |
| 46 | `GET` | `/schedules/change-logs` | `ADMIN`, `SUPERADMIN` | `ListSessionChangeLogsQueryDto`: `{ classId?, action?, from?, to?, page?, limit? }` | `200 OK` — Nhật ký thay đổi lịch (`GENERATE`, `UPDATE_RECURRING_RULE`, `ADD_MANUAL`, `RESCHEDULE`, `CANCEL`, `ADD_MAKEUP`) |
| 47 | `GET` | `/sessions/:id` | `ADMIN`, assigned `TEACHER`, enrolled `STUDENT` | `:id` (Session ID) | `200 OK` — Chi tiết buổi học (`attendanceSummary` bị mask thành `null` đối với `STUDENT`) |
| 48 | `PATCH` | `/sessions/:id/reschedule` | `ADMIN` | `RescheduleSessionDto`: `{ sessionDate, startTime, endTime, reason, topic? }` | `200 OK` — Đổi lịch 1 buổi (`reason` bắt buộc, từ chối khoảng trắng), lưu `previousScheduleText` & `SessionChangeLog` |
| 49 | `POST` | `/sessions/:id/cancel` | `ADMIN` | `CancelSessionDto`: `{ reason, makeup?: { sessionDate, startTime, endTime, topic? } }` | `201 Created` — Hủy buổi (`sessionNumber = null`); không tự sinh buổi bù nếu không truyền `makeup` (`DEC-009`) |
| 50 | `POST` | `/sessions/:id/makeup` | `ADMIN` | `CreateMakeupSessionDto`: `{ sessionDate, startTime, endTime, topic?, reason? }` | `201 Created` — Tạo buổi học bù gắn `makeupForSessionId` mà không cộng trùng tổng buổi (`DEC-009`) |

#### 2.10 `AttendanceController` (4 endpoints)

| STT | Method | Đường dẫn (`/api/v1/...`) | Phân quyền | Input / Query / DTO | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- | :--- |
| 51 | `GET` | `/sessions/:id/attendance` | `ADMIN`, assigned `TEACHER` | `:id` (Session ID) | `200 OK` — Danh sách HV đủ điều kiện điểm danh của buổi (`roster`), tổng hợp & `auditLogs` |
| 52 | `PUT` | `/sessions/:id/attendance` | `ADMIN`, assigned `TEACHER` | `SaveSessionAttendanceDto`: `{ records: [{ studentId, status, note? }], reason? }` | `200 OK` — Lưu điểm danh chuyển buổi thành `COMPLETED` (`DEC-009`); GV bị chặn sau cửa sổ T+2 ngày GMT+7 (`403`, `DEC-032`); `ADMIN` sửa sau T+2 bắt buộc `reason` & ghi `AttendanceAuditLog` (`isAdminOverride=true`) |
| 53 | `GET` | `/classes/:id/attendance/matrix` | `ADMIN`, assigned `TEACHER` | `:id` (Class ID) | `200 OK` — Ma trận điểm danh HV × buổi học kèm chỉ số chuyên cần & cờ cảnh báo vắng $\ge 30\%$ (`DEC-033`) |
| 54 | `GET` | `/attendance/me` | `STUDENT` | `GetMyAttendanceQueryDto`: `{ classId? }` | `200 OK` — Chuyên cần cá nhân & danh sách buổi học của HV đang theo học (`warningThresholdPercent: 30`) |

### E. Ngân Hàng Câu Hỏi & Import Đề Word/PDF (Phase 5 — Nhánh `feature/phase-05-question-bank-and-import`, chưa merge `develop`)

#### 2.11 `AssessmentsController` (`/api/v1/assessments` — 17 endpoints)

Toàn bộ endpoints dưới đây áp dụng `@Roles(Role.ADMIN, Role.TEACHER)` và `ParseUUIDPipe` cho `:id`, `:qid`, `:mediaId`. Tài liệu Zero-Leak: chưa mở route `STUDENT` ở Phase 5; mọi ngoại lệ sở hữu bởi `TEACHER` khác trả `403 Forbidden`, khóa chỉnh sửa khi `isLocked || status === 'PUBLISHED'` trả `409 Conflict`.

| STT | Method | Đường dẫn (`/api/v1/...`) | Input / Params / Multipart | Output & Ghi chú nghiệp vụ |
| :---: | :---: | :--- | :--- | :--- |
| 55 | `POST` | `/assessments/import` | `multipart/form-data`: `file` (`.docx`/`.pdf` $\le 20\text{MB}$, chặn `.doc`) + `ImportAssessmentDto { courseId, type, title? }` | `201 Created` — Parse văn bản/cấu trúc thành đề `DRAFT` kèm danh sách câu hỏi và cờ `needsReview` |
| 56 | `GET` | `/assessments/:id/review` | `:id` (UUID) | `200 OK` — Trả dữ liệu đề + câu hỏi + `recognizedCount` + `needsReviewCount` + `summary` phục vụ duyệt 2 cột |
| 57 | `GET` | `/assessments/:id/original` | `:id` (UUID) | `200 OK` — Tải/stream file gốc `.docx`/`.pdf` lưu trên đĩa (`404` nếu đề tạo thủ công) |
| 58 | `GET` | `/assessments/:id/media` | `:id` (UUID) | `200 OK` — Liệt kê `MediaAsset` thuộc đề thi |
| 59 | `POST` | `/assessments/:id/media` | `:id` (UUID) + `multipart/form-data` `file` ($\le 20\text{MB}$; PNG/JPG $\le 5\text{MB}$; MP3/WAV/M4A $\le 20\text{MB}$) | `201 Created` — Kiểm tra magic bytes theo MIME cho media tải lên (khác `QuestionMedia` chưa được ghi từ nhánh CRUD) |
| 60 | `GET` | `/assessments/:id/media/:mediaId` | `:id` (UUID), `:mediaId` (UUID) | `200 OK` — Stream an toàn file audio/image gắn với đề |
| 61 | `POST` | `/assessments` | `CreateAssessmentDto { title, type, courseId, description?, durationMinutes? }` | `201 Created` — Tạo đề thủ công trạng thái `DRAFT` |
| 62 | `GET` | `/assessments` | `ListAssessmentsQueryDto { type?, courseId?, status?, search?, page?, limit? }` | `200 OK` — Danh sách ngân hàng đề phân trang (`assignedClassCount` cố định `0` ở Phase 5) |
| 63 | `GET` | `/assessments/:id` | `:id` (UUID) | `200 OK` — Chi tiết đề và mảng `questions` |
| 64 | `PATCH` | `/assessments/:id` | `:id` (UUID) + `UpdateAssessmentDto { title?, description?, durationMinutes? }` | `200 OK` — `409 Conflict` nếu `isLocked \|\| status === 'PUBLISHED'`; `403` nếu GV không phải chủ sở hữu |
| 65 | `DELETE` | `/assessments/:id` | `:id` (UUID) | `200 OK` — Chỉ xóa được khi `DRAFT` và `!isLocked` (`409` nếu đã phát hành/khóa) |
| 66 | `POST` | `/assessments/:id/duplicate` | `:id` (UUID) | `201 Created` — Nhân bản sâu (`DRAFT`) gồm câu hỏi, file gốc và media |
| 67 | `POST` | `/assessments/:id/publish` | `:id` (UUID) | **`201 Created`** — Chuyển sang `PUBLISHED` nếu có $\ge 1$ câu hỏi và không còn `needsReview = true` (`400`/`409`) |
| 68 | `POST` | `/assessments/:id/questions` | `:id` (UUID) + `CreateQuestionDto { type, prompt, payload, points (\le 1000) }` *(bắt buộc `points`, không có `position`)* | `201 Created` — Tạo câu hỏi theo `QuestionSchemaPolicy` (7 dạng `FUNC-044..050`) |
| 69 | `PUT` | `/assessments/:id/questions/reorder` | `:id` (UUID) + `ReorderQuestionsDto { questionIds }` | `200 OK` — Sắp xếp lại `position` câu hỏi trong transaction |
| 70 | `PATCH` | `/assessments/:id/questions/:qid` | `:id` (UUID), `:qid` (UUID) + `UpdateQuestionDto { prompt?, payload?, points? }` *(không nhận `needsReview`)* | `200 OK` — Cập nhật câu hỏi *(lưu ý kỹ thuật `#7`: `QuestionCrudService.update` tự reset `needsReview = false` khi cập nhật bất kỳ field nào)* |
| 71 | `DELETE` | `/assessments/:id/questions/:qid` | `:id` (UUID), `:qid` (UUID) | `200 OK` — Xóa câu hỏi trong đề `DRAFT` & `!isLocked` |
