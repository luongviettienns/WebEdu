# Bộ Kịch Bản Kiểm Thử Toàn Diện (Comprehensive Test Scenarios — Phases 1–5)

> **Cập nhật lần cuối:** 2026-11-13 (Phiên bản v2.0 — đồng bộ trạng thái thực tế của `develop` [Modules 01–05] và nhánh `feature/phase-05-question-bank-and-import` [Module 06 P1] theo kiểm toán `#6` & `#7`)
> **Phạm vi hệ thống hiện tại:** **21 màn hình `page.tsx`** (`20` trên `develop` + `1` trên Phase 5) · **71 API Endpoints trên 11 Controllers** (`54` trên `develop` + `17` trên Phase 5) · **22 Models Prisma / 13 SQL Migrations** (`18` models / `10` migrations trên `develop` + `4` models / `3` migrations trên Phase 5).

---

## 1. Tổng Quan Phạm Vi & Bộ Kiểm Thử Tự Động Đã Xác Minh

| Lớp kiểm thử | Công cụ & Lệnh chạy | Độ phủ thực tế (`feature/phase-05...` working tree, theo `#7`) | Tài liệu tham chiếu |
| :--- | :--- | :--- | :--- |
| **LOC & Structure Gate** | `node scripts/check-loc.js` | **167 files checked — PASS** | [`scripts/check-loc.js`](file:///c:/Users/ASUS/Desktop/WebEdu/scripts/check-loc.js) |
| **Backend Static & Build** | `cd backend && npm run typecheck && npm run lint && npm run build` | `tsc --noEmit` PASS · `oxlint --type-aware` (**178 files**, 0 errors, 0 warnings) PASS · `nest build` PASS | [`backend/package.json`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/package.json) |
| **Backend Unit Tests** | `cd backend && npm run test` (Vitest; `npm run test:cov` để đo coverage) | **37/37 files, 266/266 PASS** (`89.55%` Stmts / `80.32%` Branch / `90.31%` Funcs / `90.41%` Lines) | [`backend/src/`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src) |
| **PostgreSQL Integration** | `cd backend && npm run test:integration` | **1/1 file, 16/16 PASS** (`postgres.integration-spec.ts`: lockout DB, token rotation, partial unique index, concurrency) | [`postgres.integration-spec.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/postgres.integration-spec.ts) |
| **Backend HTTP E2E** | `cd backend && npm run test:e2e` | **8/8 files, 43/43 PASS** (`*.e2e-spec.ts`; lưu ý `rbac-phase3.audit-spec.ts` 9 cases nằm ngoài pattern của `vitest.config.e2e.ts`) | [`backend/test/`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test) |
| **Frontend Static & Build** | `cd frontend && npm run typecheck && npm run lint && npm run build` | `tsc --noEmit` PASS · `eslint` PASS · `next build` (**24 entries** gồm 21 `page.tsx` + `/_not-found` + Next metadata routes) PASS | [`frontend/package.json`](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/package.json) |
| **Playwright Browser E2E** | `cd frontend && npm run test:e2e` | **6 spec files, 52/52 PASS** (2 projects) | [`frontend/e2e/`](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/e2e) |

> Chi tiết toàn bộ bề mặt API và UI được lập danh mục tại [`test-inventory-api.md`](file:///c:/Users/ASUS/Desktop/WebEdu/docs/test-inventory-api.md) và [`test-inventory-ui.md`](file:///c:/Users/ASUS/Desktop/WebEdu/docs/test-inventory-ui.md).

---

## 2. Ma Trận Phân Quyền Toàn Hệ Thống (RBAC Route Matrix — 21 Routes)

*(Mỗi ô phản ánh đúng `ALLOWED_ROLES` / quyền truy cập UI của tài khoản chỉ có role đơn tương ứng; người dùng đa vai trò có quyền hợp nhất theo tất cả role được gán trong `user.roles`.)*

| Route | Khách | `STUDENT` | `TEACHER` | `ADMIN` | `SUPERADMIN` (thuần) | Ghi chú kiểm chứng UI & API |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `/`, `/login`, `/register`, `/forgot-password`, `/reset-password` | ✅ | ✅ | ✅ | ✅ | ✅ | Trang public & auth |
| `/profile` | ❌ | ✅ | ✅ | ✅ | ✅ | Mọi vai trò đã xác thực |
| `/student/overview` | ❌ | ✅ | ❌ | ✅ | ❌ | `ALLOWED_ROLES = ['STUDENT', 'ADMIN']` (`PendingClassNotice` / `AdminAccessNotice`) |
| `/student/schedule` | ❌ | ✅ | ❌ | ❌ | ❌ | `ALLOWED_ROLES = ['STUDENT']`; gọi `GET /attendance/me` |
| `/teacher/classes` | ❌ | ❌ | ✅ | ✅ | ❌ | `ALLOWED_ROLES = ['TEACHER', 'ADMIN']`; `TEACHER` chỉ thấy lớp của mình (`DEC-025`) |
| `/teacher/classes/[id]` | ❌ | ❌ | ✅* | ✅ | ❌ | `TEACHER*`: chỉ lớp đang phụ trách hoặc lớp `COMPLETED`/`ARCHIVED` của chính mình (`DEC-025`) |
| `/teacher/schedules` | ❌ | ❌ | ✅ | ❌ | ❌ | `ALLOWED_ROLES = ['TEACHER']` (`ADMIN` dùng `/admin/schedules`) |
| `/teacher/assessments` *(Phase 5)* | ❌ | ❌ | ✅ | ✅ | ❌ | `ALLOWED_ROLES = ['ADMIN', 'TEACHER']`; sửa/xóa câu/đề của GV khác bị chặn (`403`) |
| `/admin/students` | ❌ | ❌ | ❌ | ✅ | ✅* | `SUPERADMIN*`: xem quản trị chung, bị ẩn `currentClassId`/`assignedClass` (`F6`) |
| `/admin/students/pending` | ❌ | ❌ | ❌ | ✅ | ❌ | `ALLOWED_ROLES = ['ADMIN']`; pure `SUPERADMIN` bị chặn |
| `/admin/teachers` | ❌ | ❌ | ❌ | ✅ | ✅ | Quản lý danh sách GV & trạng thái |
| `/admin/courses` | ❌ | ❌ | ❌ | ✅ | ❌ | Quản lý danh mục khóa học HSK |
| `/admin/classes` | ❌ | ❌ | ❌ | ✅ | ❌ | Quản lý lớp học |
| `/admin/classes/[id]` | ❌ | ❌ | ❌ | ✅ | ❌ | Chi tiết lớp, ghi danh, chuyển/rút lớp, đổi lịch, ma trận điểm danh & Admin Override |
| `/admin/schedules` | ❌ | ❌ | ❌ | ✅ | ❌ | Lịch học toàn trung tâm & điều chỉnh buổi |
| `/admin/schedule-logs` | ❌ | ❌ | ❌ | ✅ | ✅ | Nhật ký thay đổi lịch (`GET /schedules/change-logs`) |
| `/superadmin/settings` | ❌ | ❌ | ❌ | ❌ | ✅ | Cấu hình thương hiệu, quản trị tài khoản/role & Audit Logs |

---

## 3. Nhóm Kịch Bản Chi Tiết Theo Module (Phases 1–5)

### 3.1 Module 01: Xác Thực, Đăng Ký, Hồ Sơ & RBAC (`Phase 2`)

| ID | Kịch bản kiểm thử | Điều kiện & Bước thực hiện | Kết quả mong đợi / Thực tế đã xác minh |
| :--- | :--- | :--- | :--- |
| **AUTH-01** | Đăng ký HV $\ge 16$ tuổi + OTP Email | 1. Nhập `fullName`, `dateOfBirth` ($\ge 16$ tuổi), `phone`, `#reg-email`<br>2. Bấm `Gửi mã` (`POST /auth/send-verification-code`)<br>3. Nhập mã 6 số vào `#reg-verification-code` + mật khẩu $\ge 8$ ký tự $\rightarrow$ Submit | `201 Created`, user vào trạng thái `PENDING_CLASS`, không hiện hộp đồng ý cha mẹ; redirect `/login?registered=1` |
| **AUTH-02** | Chặn đăng ký dưới 12 tuổi | Nhập `dateOfBirth` có tuổi $< 12$ | Nút đăng ký bị chặn / backend trả `400` RFC 7807 |
| **AUTH-03** | Đăng ký HV $12\text{–}15$ tuổi (`DEC-001`) | Nhập ngày sinh $12\text{–}15$ tuổi; nhãn `#reg-email` đổi sang *"Email cha mẹ / người giám hộ"*; kiểm tra checkbox `RegisterGuardianConsentBox` | Bắt buộc OTP cho `#reg-email` và tick đồng ý (`guardianConsent = true`); lưu `GuardianConsent` và `StudentProfile.guardianEmail` |
| **AUTH-04** | Khóa tài khoản 15 phút sau 5 lần sai mật khẩu | `POST /auth/login` sai mật khẩu liên tiếp 5 lần; thử lại lần 6 | Lần 6 khóa tài khoản 15 phút trên `users` (`failedLoginAttempts`/`lockedUntil`) trả **`403 Forbidden`** (RFC 7807); đồng thời IP rate limit (`15` lần/`60s` trên `AuthRateLimit`) trả **`429 Too Many Requests`** |
| **AUTH-05** | Đăng nhập Ghi nhớ (`rememberMe`) | Tick checkbox *"Ghi nhớ đăng nhập"* (`rememberMe: true`) và không tick rồi đăng nhập | `TokenService` luôn set `maxAge` cho cookie `webedu_access_token` (`HttpOnly`): **7 ngày** (`604800s`) khi `rememberMe: true`, **`3600s` (1 giờ)** khi `rememberMe: false` (không phải session cookie) |
| **AUTH-06** | Idle Timeout 60 phút (`TD-07`) | Kiểm tra cảnh báo phút 55 và tự đăng xuất phút 60 trên `PortalShell` (`useIdleTimeout.ts`, `IdleTimeoutWarningModal.tsx`) và banner `/login?reason=idle_timeout` | Hook `useIdleTimeout` đã được mount vào `PortalShell`; phút 55 hiện modal cảnh báo gia hạn, phút 60 tự đăng xuất và redirect `/login?reason=idle_timeout` |
| **AUTH-07** | Khôi phục mật khẩu (`forgot` / `reset`) | Gửi `POST /auth/forgot-password` (thử lại ngay trong 60s), lấy token đặt mật khẩu mới qua `/reset-password` | Cooldown 60s trả `429`; dùng xong token cũ vô hiệu (`400`); phiên cũ bị thu hồi khi đổi mật khẩu |
| **AUTH-08** | Vô hiệu hóa tài khoản (`INACTIVE`) & Bảo vệ Superadmin | Đặt `status = INACTIVE` cho user hoặc hạ cấp `SUPERADMIN` duy nhất | Tài khoản `INACTIVE` bị thu hồi phiên tức thì (`401`/`403`); hệ thống chặn tự hạ cấp hoặc mất `SUPERADMIN` hoạt động cuối cùng |
| **AUTH-09** | Đổi thông tin hồ sơ, OTP đổi email & mật khẩu (`/profile`) | HV sửa `fullName`/`phone`, thử gửi `dateOfBirth` lên `PATCH /profile/me`, HV `<16` vs `>=16` đổi email qua `/profile/me/send-email-change-code`, đổi mật khẩu | Chặn HV tự sửa ngày sinh (`400`/`403`); HV `<16` bị khóa tự đổi email (`403`, `canSelfChangeEmail = false`); user $\ge 16$ / GV / Admin bắt buộc xác thực mật khẩu hiện tại + OTP 6 số; đổi email/mật khẩu xoay cookie & thu hồi phiên cũ; giữ nguyên `GuardianConsent.guardianEmail` |
| **AUTH-10** | RFC 7807 & Giới hạn Payload (`SEC-RISK-02/03`) | Gửi JSON > `100kb` vào `/auth/login`, gửi logo `PUT /system-settings/config` > `4mb` hoặc sai magic bytes, gửi field lạ | `100kb` global trả `413`; `/system-settings/config` cho phép tới `4mb` (ảnh tối đa `2mb`); field lạ bị `forbidNonWhitelisted` trả `400` + `invalidParams`; body lỗi trả `application/problem+json` kèm `requestId` (`x-request-id`) |

### 3.2 Module 02 & 03: Khóa HSK, Lớp Học & Ghi Danh (`Phase 3`)

| ID | Kịch bản kiểm thử | Điều kiện & Bước thực hiện | Kết quả mong đợi / Thực tế đã xác minh |
| :--- | :--- | :--- | :--- |
| **CLS-01** | CRUD Khóa học HSK (`FUNC-014`) | `ADMIN` tạo/sửa khóa học `HSK1..HSK4` / `BASIC_COMM`, thử trùng `code` | Trùng `code` trả `409 Conflict`; `TEACHER` chỉ được xem danh sách (`GET /courses`), bị chặn tạo/sửa (`403`) |
| **CLS-02** | Tạo lớp, Preview lịch & 1 GV/lớp (`DEC-005/006`) | Tạo lớp ở `/admin/classes` có `scheduleDays`, `startDate`, `totalSessions`, kiểm tra cảnh báo trùng giờ GV | `POST /classes/preview-schedule` tính ngày kết thúc dự kiến; mỗi lớp chỉ có 1 GV phụ trách (`teacherId`), không giới hạn cứng 5 HV; đồng thời sinh các `LessonSession` |
| **CLS-03** | Partial Unique Index: 1 HV tối đa 1 lớp `ACTIVE` (`DEC-007`) | Bắn đồng thời 4 request `assign-initial-class` hoặc thêm HV đang `ACTIVE` ở lớp A vào lớp B | Chỉ 1 request thành công (`200`), các request đụng độ trả `400`/`409`; DB duy trì đúng 1 bản ghi `ACTIVE` |
| **CLS-04** | Chuyển lớp & Rút khỏi lớp bảo toàn lịch sử (`DEC-008`) | Chuyển HV từ lớp A sang lớp B (`/transfer`), rút HV (`/drop`), bật *"Hiện cả học viên đã chuyển / rời lớp"* | Lớp A giữ nguyên enrollment cũ (`TRANSFERRED`/`DROPPED`) kèm `leftDate`; lớp B tạo enrollment `ACTIVE` mới |
| **CLS-05** | Cô lập quyền GV sau thay đổi GV & Lịch sử lớp HV (`DEC-024/025`) | Thay GV1 bằng GV2 ở lớp L; gọi `GET /classes/:id` bằng GV1 và `GET /students/:id/class-history` bằng GV2 | GV1 mất hoàn toàn quyền xem lớp L đang học (`403`); GV2 không thấy lịch sử các lớp cũ của HV |
| **CLS-06** | Kết thúc lớp & Mở lại trong 7 ngày (`DEC-019`) | Kết thúc lớp (`/complete`) trước khi học đủ buổi; thử mở lại (`/reopen`) trong 7 ngày và ngoài 7 ngày | Lớp `COMPLETED` chuyển chỉ đọc; mở lại trong 7 ngày khôi phục các HV chưa xếp lớp khác; quá 7 ngày bị từ chối |
| **CLS-07** | Chặn vô hiệu hóa GV đang dạy lớp | Đổi trạng thái GV đang phụ trách lớp `UPCOMING`/`ACTIVE` sang `INACTIVE` | Trả `409 Conflict`, UI mở `BlockedTeacherDeactivationModal` liệt kê lớp đang phụ trách |

### 3.3 Module 04 & 05: Lịch Học, Buổi Học & Điểm Danh (`Phase 4`)

| ID | Kịch bản kiểm thử | Điều kiện & Bước thực hiện | Kết quả mong đợi / Thực tế đã xác minh |
| :--- | :--- | :--- | :--- |
| **SCH-01** | Khung lịch Calendar & Giới hạn 93 ngày | Mở `/admin/schedules`, `/teacher/schedules`, `/student/schedule`; gọi `GET /schedules/calendar` với `from..to > 93` ngày | Khoảng $>93$ ngày trả `400`; `TEACHER` chỉ thấy lớp mình phụ trách; `STUDENT` chỉ thấy lớp của mình; pure `SUPERADMIN` bị chặn (`403`) |
| **SCH-02** | Quyền điều chỉnh lịch (`DEC-031`) | `TEACHER` thử gọi `PATCH /sessions/:id/reschedule` hoặc `POST /cancel`; `ADMIN` gửi `reason` chỉ có khoảng trắng | `TEACHER` nhận `403`; lý do toàn khoảng trắng trả `400`; `ADMIN` hợp lệ lưu `previousScheduleText` & ghi `SessionChangeLog` |
| **SCH-03** | Hủy buổi & Học bù không cộng trùng tổng buổi (`DEC-009`) | `ADMIN` hủy buổi #2 không kèm `makeup`, sau đó tạo buổi bù qua `POST /sessions/:id/makeup` | Buổi hủy có `sessionNumber = null`, không tự sinh buổi bù khi thiếu `makeup`; khi tạo buổi bù, tổng buổi active & đánh số buổi tự đồng bộ chính xác |
| **ATT-01** | Lưu điểm danh & Chuyển trạng thái `COMPLETED` (`DEC-009`) | GV mở `SessionAttendanceModal` cho buổi quá khứ/hôm nay (`MISSED_ATTENDANCE`/`TODAY`), lưu `PRESENT`/`ABSENT`/`EXCUSED` | Buổi học chỉ chuyển thành `COMPLETED` sau khi lưu điểm danh; `GET /sessions/:id` mask `attendanceSummary = null` cho `STUDENT` |
| **ATT-02** | Cửa sổ sửa điểm danh T+2 GMT+7 & Admin Override (`DEC-032`) | GV sửa điểm danh buổi cách hiện tại $> 2$ ngày theo `Asia/Ho_Chi_Minh`; `ADMIN` sửa không nhập `reason`, sau đó nhập `reason` | GV bị chặn `403`; `ADMIN` thiếu `reason` bị chặn `400`, có `reason` lưu thành công và ghi `AttendanceAuditLog` (`isAdminOverride = true`) |
| **ATT-03** | Ngưỡng cảnh báo vắng $\ge 30\%$ (`DEC-033`) | HV có $(ABSENT + EXCUSED) \times 100 \ge totalSessions \times 30$ (chỉ tính buổi đã `COMPLETED` trong khoảng ghi danh) | `GET /classes/:id/attendance/matrix` và `GET /attendance/me` trả `isAt30PercentWarning = true` |
| **ATT-04** | UI Điểm danh & Tổng quan Học viên (`TD-08`, `TD-10`) | Kiểm tra `/student/overview`, `ClassStudentsTable`, `ClassAttendanceMatrixTab`, `SessionAttendanceModal` | `/student/overview` lấy dữ liệu thật từ `/attendance/me`; `ClassStudentsTable` hiển thị cột `Số buổi nghỉ` + badge $\ge 30\%$; ma trận điểm danh gắn marker `"Đã sửa"`; nút Lưu khóa trước khi chấm 100% học viên |

### 3.4 Module 06 (Phần 1): Ngân Hàng Câu Hỏi & Import Word/PDF (`Phase 5 + Wave 1`)

| ID | Kịch bản kiểm thử | Điều kiện & Bước thực hiện | Kết quả mong đợi / Thực tế đã xác minh |
| :--- | :--- | :--- | :--- |
| **QB-01** | RBAC & Zero-Leak Ngân hàng đề | `STUDENT` và pure `SUPERADMIN` gọi `GET /api/v1/assessments` hoặc truy cập `/teacher/assessments`; `TEACHER B` sửa/xóa đề của `TEACHER A` | `STUDENT` / pure `SUPERADMIN` bị chặn (`403`); `TEACHER B` sửa/xóa đề của `TEACHER A` bị chặn `403` |
| **QB-02** | Tạo đề & Biên tập 7 dạng câu hỏi HSK (`FUNC-039, 043..050`) | Tạo đề `DRAFT`, thêm đầy đủ 7 dạng (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_BLANK`, `ORDERING`, `ESSAY`, `LISTENING`, `IMAGE_BASED`), kiểm tra validation payload & media | `POST /questions` trả `201`; `points <= 1000`; media PNG/JPG $\le 5\text{MB}$ và MP3/WAV/M4A $\le 20\text{MB}$ kiểm tra magic bytes; xem trước HV ẩn đáp án |
| **QB-03** | Khắc phục `QuestionTypeFields` & `IMAGE_BASED` (`QB-BUG-01`) | Thêm 3 phương án (`a,b,c`), xóa phương án giữa (`b`), bấm `+ Thêm phương án`; kiểm tra `IMAGE_BASED` | Cấp ID phương án kế tiếp không trùng (không còn đụng `'c'` -> `400`); `IMAGE_BASED` hỗ trợ đầy đủ nút xóa phương án, chế độ chọn nhiều đáp án và text-only |
| **QB-04** | Khóa sửa khi đã phát hành & Nhân bản sâu | Phát hành đề (`POST /publish`), thử `PATCH`/`DELETE` đề; thực hiện `POST /duplicate` | Đề `PUBLISHED` hoặc `isLocked = true` trả **`409 Conflict`** khi sửa/xóa; `duplicate` tạo bản `DRAFT` mới kèm toàn bộ câu hỏi, file gốc và media |
| **QB-05** | Import đề `.docx` / `.pdf` & Bảo mật ảnh nhúng (`QB-SEC-01`) | Upload `.docx`/`.pdf` hợp lệ, `.doc` cũ, file giả mạo magic bytes, ảnh nhúng PNG/JPEG giả mạo bên trong `.docx`, khóa học `isActive = false` | `.docx`/`.pdf` parse thành `DRAFT` + lưu file gốc (`GET /original`); `.doc` và khóa học ngừng hoạt động bị chặn (`400`); ảnh nhúng `.docx` kiểm tra magic bytes `PNG`/`JPEG` $\le 5\text{MB}$ (bỏ qua EMF/WMF nội bộ Word, từ chối giả mạo `400`) |
| **QB-06** | Màn hình Duyệt & Soạn thảo đề 2 cột (`QB-UI-01`) | Mở `ImportReviewPane` và `AssessmentEditor`: dùng `Lên`/`Xuống`, chỉnh `points`, `Lưu nháp` thật, sửa `prompt`/`points`, `Xóa câu`, `Phát hành` | Nút `Phát hành` vô hiệu hóa khi còn `needsReview = true`; sửa `prompt`/`points` giữ nguyên `needsReview` cho tới khi xác nhận hoặc sửa `payload`; cả Editor & ReviewPane có đủ `Xuống`, `Xóa câu`, `Phát hành` |
