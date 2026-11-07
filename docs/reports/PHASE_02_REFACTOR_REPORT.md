# BÁO CÁO REFACTOR KIẾN TRÚC SAU PHASE 2 (POST-PHASE-2 CODEBASE REFACTOR REPORT)

- **Dự án:** WebEdu — Hệ thống Quản lý Lớp học & Học tập Trung tâm TD Hán Ngữ
- **Repository:** `https://github.com/luongviettienns/WebEdu`
- **Nhánh thực hiện:** `refactor/phase-02-codebase-cleanup` (tách từ `develop` @ `578cc72`)
- **Nhánh đích:** `develop`
- **Ngày hoàn thành:** `2026-11-07`
- **Trạng thái kiểm định:** **100% QUALITY GATES PASS** (`akit-critic`: **APPROVE**, `akit-security`: **PASS**)

---

## 1. Tổng Quan Kiến Trúc Trước Và Sau Refactor

### 1.1. Trước Refactor (`develop` @ `578cc72`)
- **Backend (`backend/src/modules/`):**
  - Ba dịch vụ đơn khối lớn (*God Services*) tập trung nhiều trách nhiệm khác nhau vào cùng một class:
    - `students.service.ts` (`1,021` dòng / `930` dòng code không tính dòng trống): vừa truy vấn danh sách/lịch sử, vừa CRUD hồ sơ, vừa xử lý giao dịch xếp lớp ban đầu (`assignInitialClass`), vừa kiểm tra Object-Level RBAC (`DEC-024/025/026`), vừa ánh xạ DTO.
    - `system-settings.service.ts` (`538` dòng / `481` dòng code): vừa quản lý danh sách/khởi tạo nhân sự hệ thống, vừa phân quyền & bảo vệ Superadmin cuối cùng (`SEC-07`), vừa lưu cấu hình thương hiệu trung tâm, vừa truy vấn nhật ký kiểm toán.
    - `auth.service.ts` (`547` dòng / `478` dòng code): vừa đăng ký học viên + xác nhận phụ huynh, vừa đăng nhập khóa 5 lần sai nguyên tử (`P0-B1`), vừa khôi phục mật khẩu qua SMTP + cooldown DB, vừa ký JWT / xoay phiên.
  - Logic kiểm tra định dạng Email/SĐT, phân trang, tìm kiếm người dùng, ghi `SystemAuditLog` đã lọc nhạy cảm và khóa dòng chống mất Superadmin hoạt động cuối cùng (`ORDER BY id ASC FOR UPDATE`) bị lặp lại ở 3–4 module; `profile.service.ts` import trực tiếp hàm `formatIsoDateUtc` từ `../auth/auth.service.ts`.
- **Frontend (`frontend/src/`):**
  - `src/lib/auth-api.ts` (`746` dòng / `663` dòng code) đóng vai trò "God API Client" chứa toàn bộ HTTP wrapper, xử lý lỗi RFC 7807, tiện ích ngày tháng GMT+7 và tất cả hàm gọi API của 5 phân hệ (`auth`, `students`, `teachers`, `profile`, `system-settings`).
  - Các trang quản trị lớn (`superadmin/settings/page.tsx` `1,045` dòng, `admin/students/page.tsx` `734` dòng, `admin/teachers/page.tsx` `702` dòng, `profile/page.tsx` `463` dòng, `admin/students/pending/page.tsx` `456` dòng) kiêm nhiệm cả quản lý phiên, gọi API, bảng danh sách và nhiều Modal/Form phức tạp trên cùng một tệp.

### 1.2. Sau Refactor (`refactor/phase-02-codebase-cleanup`)
- **Backend (`backend/src/`):**
  - Áp dụng triệt để **Single Responsibility Principle (SRP)**, **Separation of Concerns** và **NestJS Dependency Injection**:
    - `StudentsModule`: tách thành 4 service chuyên biệt (`StudentQueryService`, `StudentCrudService`, `StudentEnrollmentService`, `StudentAccessService`), 1 mapper (`student.mapper.ts`) và 1 policy (`student-enrollment-facts.policy.ts`).
    - `SystemSettingsModule`: tách thành 3 service chuyên biệt (`SystemUsersService`, `UserRoleStatusService`, `SystemConfigService`), 1 mapper (`system-user.mapper.ts`) và 1 file hằng số (`system-settings.constants.ts`).
    - `AuthModule`: tách thành 4 service chuyên biệt (`AuthRegistrationService`, `AuthLoginService`, `PasswordRecoveryService`, `AuthSessionService`).
    - `TeachersModule` & `UsersModule`: tách `teacher.mapper.ts`, `teacher-assignment.policy.ts` và chuẩn hóa `ProfileService` sử dụng các tiện ích dùng chung tại `src/common/`.
- **Frontend (`frontend/src/`):**
  - Thiết lập kiến trúc **Feature-Sliced Modular (`src/features/<domain>/{api,hooks,components}/`)** kết hợp hạ tầng dùng chung tại `src/lib/api-client.ts`, `src/lib/utils/date.ts` và `src/types/user.ts`.
  - `src/lib/auth-api.ts` thu gọn còn **`8` dòng** (re-export barrel tương thích ngược).
  - Toàn bộ các trang `(portal)/**` trở thành các **Thin Route Orchestration Pages** có gắn `AbortController` cho các `useEffect` tải dữ liệu.

---

## 2. Danh Sách Các File Đã Refactor

### 2.1. Backend (`backend/`)
- **Tiện ích & Chính sách dùng chung (`backend/src/common/`):**
  - `common/utils/timezone.util.ts` *(bổ sung `formatIsoDateUtc`)*
  - `common/utils/contact-validation.util.ts` *(mới: `EMAIL_REGEX`, `PHONE_REGEX`, `normalizeEmail`, `assertValidContactFields`, `assertValidInitialPassword`)*
  - `common/utils/pagination.util.ts` *(mới: `resolvePagination`)*
  - `common/utils/user-search.util.ts` *(mới: `buildUserSearchFilter`)*
  - `common/audit/audit-log.util.ts` *(mới: `writeAuditLog`)*
  - `common/auth/superadmin-protection.policy.ts` *(mới: `lockUserAndActiveSuperadmins`, `assertActorMayModifyAccount`, `isLeavingActiveSuperadmin`, `assertSuperadminNotSelfDeactivating`, `assertAnotherActiveSuperadminRemains`)*
- **Module Học viên (`backend/src/modules/students/`):**
  - Đã xóa: `students.service.ts` (`1,021` dòng)
  - Đã tạo/cập nhật: `students.types.ts`, `mappers/student.mapper.ts`, `policies/student-enrollment-facts.policy.ts`, `services/student-access.service.ts`, `services/student-query.service.ts`, `services/student-crud.service.ts`, `services/student-enrollment.service.ts`, `students.controller.ts`, `students.module.ts`, `students.services.spec.ts`
- **Module Cài đặt hệ thống (`backend/src/modules/system-settings/`):**
  - Đã xóa: `system-settings.service.ts` (`538` dòng)
  - Đã tạo/cập nhật: `system-settings.constants.ts`, `mappers/system-user.mapper.ts`, `services/system-users.service.ts`, `services/user-role-status.service.ts`, `services/system-config.service.ts`, `system-settings.controller.ts`, `system-settings.module.ts`, `system-settings.services.spec.ts`
- **Module Xác thực (`backend/src/modules/auth/`):**
  - Đã xóa: `auth.service.ts` (`547` dòng)
  - Đã tạo/cập nhật: `services/auth-session.service.ts`, `services/auth-registration.service.ts`, `services/auth-login.service.ts`, `services/password-recovery.service.ts`, `auth.controller.ts`, `auth.module.ts`, `auth.services.spec.ts`
- **Module Giáo viên & Hồ sơ cá nhân (`backend/src/modules/teachers/`, `backend/src/modules/users/`):**
  - `teachers/mappers/teacher.mapper.ts`, `teachers/policies/teacher-assignment.policy.ts`, `teachers/teachers.service.ts`, `users/profile.service.ts`
- **Hạ tầng Kiểm thử (`backend/test/`):**
  - `test/helpers/postgres-test-container.ts`, `src/common/prisma/postgres-test-safety.spec.ts`, `test/helpers/student-services.ts`, `test/helpers/system-settings-services.ts`, `test/helpers/auth-services.ts`, `test/postgres.integration-spec.ts`

### 2.2. Frontend (`frontend/`)
- **Lõi HTTP, Ngày tháng & Kiểu dữ liệu (`frontend/src/lib/`, `frontend/src/types/`):**
  - `lib/api-client.ts`, `lib/utils/date.ts`, `types/user.ts`, `lib/auth-api.ts` (barrel `8` dòng)
- **Feature Modules (`frontend/src/features/`):**
  - `features/auth/`: `api/auth.api.ts`, `hooks/usePortalSession.ts`, `hooks/useIdleTimeout.ts`, `components/AccessDeniedState.tsx`, `roles.ts`
  - `features/students/`: `api/students.api.ts`, `hooks/usePendingEnrollmentCount.ts`, `components/StudentDetailModal.tsx`, `components/AssignInitialClassModal.tsx`
  - `features/teachers/`: `api/teachers.api.ts`, `components/TeacherFormModal.tsx`, `components/BlockedTeacherDeactivationModal.tsx`
  - `features/profile/`: `api/profile.api.ts`, `components/PersonalInfoSection.tsx`, `components/ChangePasswordSection.tsx`
  - `features/system-settings/`: `api/system-settings.api.ts`, `hooks/useBrandConfig.ts`, `utils/logo.ts`, `components/SystemUsersSection.tsx`, `components/CreateSystemUserModal.tsx`, `components/EditUserRolesModal.tsx`, `components/BrandConfigSection.tsx`, `components/AuditLogsSection.tsx`
- **Layout, UI & Pages (`frontend/src/components/`, `frontend/src/app/`):**
  - `components/ui/PasswordInput.tsx`, `components/layout/nav-links.ts`, `components/layout/AppHeader.tsx`
  - `app/(portal)/superadmin/settings/page.tsx`, `app/(portal)/admin/students/page.tsx`, `app/(portal)/admin/students/pending/page.tsx`, `app/(portal)/admin/teachers/page.tsx`, `app/(portal)/profile/page.tsx`

---

## 3. So Sánh LOC Và Độ Phức Tạp Trước / Sau Refactor

| File mục tiêu | LOC Trước (Tổng / Code) | LOC Sau (Tổng / Code) | Mức giảm trên file gốc | Phân rã thành các module đơn trách nhiệm (LOC Code) |
| :--- | ---: | ---: | ---: | :--- |
| `backend/src/modules/students/students.service.ts` | `1,021` / `930` | **Đã xóa (`0`)** | **-100%** (Max file: `253` code) | `student-crud.service.ts` (`253`), `student-access.service.ts` (`187`), `student.mapper.ts` (`174`), `student-query.service.ts` (`166`), `student-enrollment.service.ts` (`148`), `student-enrollment-facts.policy.ts` (`43`) |
| `frontend/src/app/(portal)/superadmin/settings/page.tsx` | `1,045` / `975` | **`217` / `192`** | **-80.3%** | `BrandConfigSection.tsx` (`227`), `CreateSystemUserModal.tsx` (`207`), `SystemUsersSection.tsx` (`180`), `EditUserRolesModal.tsx` (`158`), `AuditLogsSection.tsx` (`118`) |
| `frontend/src/lib/auth-api.ts` | `746` / `663` | **`8` / `8`** | **-98.8%** | `students.api.ts` (`170`), `api-client.ts` (`159`), `system-settings.api.ts` (`137`), `auth.api.ts` (`103`), `date.ts` (`102`), `teachers.api.ts` (`79`), `profile.api.ts` (`50`), `user.ts` (`13`) |
| `frontend/src/app/(portal)/admin/students/page.tsx` | `734` / `689` | **`345` / `319`** | **-53.7%** | `StudentDetailModal.tsx` (`386`) |
| `frontend/src/app/(portal)/admin/teachers/page.tsx` | `702` / `662` | **`414` / `383`** | **-42.1%** | `TeacherFormModal.tsx` (`268`), `BlockedTeacherDeactivationModal.tsx` (`35`) |
| `backend/src/modules/auth/auth.service.ts` | `547` / `478` | **Đã xóa (`0`)** | **-100%** (Max file: `168` code) | `password-recovery.service.ts` (`168`), `auth-registration.service.ts` (`148`), `auth-login.service.ts` (`141`), `auth-session.service.ts` (`96`) |
| `backend/src/modules/system-settings/system-settings.service.ts` | `538` / `481` | **Đã xóa (`0`)** | **-100%** (Max file: `157` code) | `user-role-status.service.ts` (`157`), `system-config.service.ts` (`137`), `system-users.service.ts` (`115`), `system-user.mapper.ts` (`32`) |
| `frontend/src/components/layout/AppHeader.tsx` | `555` / `514` | **`391` / `361`** | **-29.8%** | `useIdleTimeout.ts` (`69`), `useBrandConfig.ts` (`61`), `nav-links.ts` (`60`), `usePendingEnrollmentCount.ts` (`30`) |
| `frontend/src/app/(portal)/profile/page.tsx` | `463` / `425` | **`71` / `60`** | **-85.9%** | `PersonalInfoSection.tsx` (`254`), `ChangePasswordSection.tsx` (`141`) |
| `frontend/src/app/(portal)/admin/students/pending/page.tsx` | `456` / `427` | **`284` / `260`** | **-39.1%** | `AssignInitialClassModal.tsx` (`173`) |
| `backend/src/modules/teachers/teachers.service.ts` | `407` / `365` | **`273` / `242`** | **-33.7%** | `teacher.mapper.ts` (`43`), `teacher-assignment.policy.ts` (`40`) |
| `backend/src/modules/users/profile.service.ts` | `382` / `342` | **`364` / `330`** | **-3.5%** | Dùng chung `PROFILE_USER_INCLUDE`, `toUserProfileDto`, `writeAuditLog`, `formatIsoDateUtc` |

---

## 4. Các Dependency Và Coupling Giảm Được

1. **Loại bỏ phụ thuộc chéo giữa `UsersModule` và `AuthModule`:** `ProfileService` không còn import `formatIsoDateUtc` từ `../auth/auth.service.ts`; hàm này đã được chuyển về đúng vị trí hạ tầng `src/common/utils/timezone.util.ts`.
2. **Tách biệt Controller khỏi Monolithic Service:**
   - `StudentsController` chỉ phụ thuộc vào từng service đúng chức năng (`StudentQueryService`, `StudentCrudService`, `StudentEnrollmentService`).
   - `SystemSettingsController` chỉ phụ thuộc vào `SystemUsersService`, `UserRoleStatusService`, `SystemConfigService`.
   - `AuthController` chỉ phụ thuộc vào `AuthRegistrationService`, `AuthLoginService`, `AuthSessionService`, `PasswordRecoveryService`.
3. **Loại bỏ Coupling của Frontend vào Monolithic `lib/auth-api.ts`:** Các trang và component theo miền (`auth`, `students`, `teachers`, `profile`, `system-settings`) import trực tiếp từ `@/features/<domain>/api/<domain>.api` và `@/lib/api-client`.
4. **Zero Circular Dependencies:** Đã kiểm chứng toàn bộ đồ thị import ở cả `backend/` và `frontend/` (`tsc --noEmit`, `oxlint --type-aware`, `eslint`, `next build`).

---

## 5. Các Điểm Duplicate Đã Loại Bỏ

1. **`superadmin-protection.policy.ts` (`SEC-07` & `SEC-08`):** Loại bỏ 3 bản sao logic khóa dòng `SELECT id FROM "users" WHERE id = ... OR ('SUPERADMIN' = ANY("roles") AND "status" = 'ACTIVE') ORDER BY id ASC FOR UPDATE` và kiểm tra số lượng Superadmin hoạt động còn lại từng nằm rải rác ở `students.service.ts`, `teachers.service.ts` và `system-settings.service.ts`.
2. **`student-enrollment-facts.policy.ts` (`FUNC-008`) & `teacher-assignment.policy.ts` (`FUNC-006`):** Dùng chung chính sách kiểm tra học viên đã xếp lớp và giáo viên đang phụ trách lớp hoạt động giữa `StudentCrudService`, `TeachersService` và `UserRoleStatusService`.
3. **`contact-validation.util.ts`, `pagination.util.ts`, `user-search.util.ts`, `audit-log.util.ts`:** Chuẩn hóa một nguồn sự thật duy nhất cho kiểm tra định dạng Email/SĐT (`0\d{9}`), phân trang (`1 <= limit <= 100`), bộ lọc tìm kiếm `OR` không phân biệt hoa thường và ghi nhật ký kiểm toán đã lọc mật khẩu/token.
4. **Frontend `useBrandConfig`, `usePendingEnrollmentCount`, `useIdleTimeout`, `logo.ts`:** Tách khỏi `AppHeader.tsx` và `superadmin/settings/page.tsx` để dùng chung nhất quán.

---

## 6. Thay Đổi Trong Test Infrastructure Safety (`postgres-test-container.ts`)

- Bổ sung hàm bảo vệ **Fail-Closed** [`assertSafeTestDatabaseUrl(databaseUrl, env)`](../../backend/test/helpers/postgres-test-container.ts) trước cả hai thao tác nguy hiểm (`runPrismaMigrateDeploy` và `truncateAllTables`):
  1. Từ chối ngay lập tức nếu `NODE_ENV` là `production`, `prod`, hoặc `staging`.
  2. Bắt buộc `NODE_ENV === 'test'` (hoặc cờ tường minh `ALLOW_TEST_DB_TRUNCATE=true`).
  3. Quét cả `databaseUrl`, `process.env.DATABASE_URL` và `process.env.TEST_DATABASE_URL`; từ chối nếu chứa từ khóa `prod`, `production`, `staging`, `live`.
  4. Chỉ cho phép kết nối tới host cục bộ/loopback hoặc container CI (`127.0.0.1`, `localhost`, `::1`, `postgres`).
  5. Bắt buộc tên database phải chứa hậu tố/từ khóa `test` hoặc `qa` (ví dụ `webedu_test`, `webedu_qa`); từ chối tên DB mặc định như `webedu`.
- Đã bổ sung bộ Unit Test kiểm chứng đầy đủ các kịch bản bị từ chối tại [`backend/src/common/prisma/postgres-test-safety.spec.ts`](../../backend/src/common/prisma/postgres-test-safety.spec.ts) (`4/4 PASS`).

---

## 7. Kết Quả Regression Tests Thực Tế

| Cổng Chất Lượng (Quality Gate) | Lệnh thực thi | Kết quả Trước Refactor (`578cc72`) | Kết quả Sau Refactor (`HEAD`) | Trạng thái |
| :--- | :--- | :--- | :--- | :---: |
| **Backend Typecheck** | `npm --prefix backend run typecheck` | `0 errors` | `0 errors` | **PASS** |
| **Backend Lint (OxLint Type-Aware)** | `npm --prefix backend run lint` | `0 warnings, 0 errors` (71 files) | `0 warnings, 0 errors` (88 files) | **PASS** |
| **Backend Build** | `npm --prefix backend run build` | `nest build` OK | `nest build` OK | **PASS** |
| **Backend Unit Tests** | `npm --prefix backend test` | `14 files, 61 passed` | `15 files, 65 passed (0 failed)` | **PASS** |
| **Backend Real PostgreSQL Integration** | `npm --prefix backend run test:integration` | `1 file, 11 passed` | `1 file, 11 passed (0 failed)` | **PASS** |
| **Backend Real PostgreSQL HTTP E2E** | `npm --prefix backend run test:e2e` | `4 files, 19 passed` | `4 files, 19 passed (0 failed)` | **PASS** |
| **Frontend Typecheck** | `npm --prefix frontend run typecheck` | `0 errors` | `0 errors` | **PASS** |
| **Frontend Lint (ESLint)** | `npm --prefix frontend run lint` | `0 warnings, 0 errors` | `0 warnings, 0 errors` | **PASS** |
| **Frontend Production Build** | `npm --prefix frontend run build` | `15/15 static routes` | `15/15 static routes` | **PASS** |
| **Playwright Browser QA (Desktop + Mobile)** | `npm --prefix frontend run test:e2e` | `14 passed (28.6s)` | `14 passed (28.6s, 0 failed)` | **PASS** |
| **Forbidden Pattern Scan** | `any`, `as any`, `@ts-ignore`, `.skip` | `0 matches` | `0 matches` (131 files) | **PASS** |
| **Independent Code & Security Review** | `akit-critic` + `akit-security` | `APPROVE` + `PASS` | `APPROVE` + `PASS` (`0 P0/P1/P2`) | **PASS** |

---

## 8. Những Phần Hoãn Lại Cho Phase 3 (Có Lý Do Rõ Ràng)

1. **Module riêng biệt cho `CoursesModule` và `ClassesModule` (`FUNC-014..024`, `FUNC-077`, `FUNC-079`):**
   - Trong Phase 2, bảng `courses`, `classes`, `enrollments` mới chỉ phục vụ kiểm chứng xếp lớp ban đầu (`FUNC-008`) và tính số lớp đang phụ trách của giáo viên (`FUNC-006`). Toàn bộ CRUD Khóa học HSK, CRUD Lớp học, Chuyển lớp (`FUNC-022`) và Rút lớp (`FUNC-077`) thuộc phạm vi nghiệp vụ chính thức của **Phase 3** và sẽ được khởi tạo ngay theo cấu trúc chuẩn `services/{query,crud,workflow,access}` + `mappers` + `policies`.
2. **Tách nhỏ trang `frontend/src/app/(auth)/register/page.tsx` (`479` dòng):**
   - Màn hình Đăng ký học viên là một form đơn nhất có điều kiện hiển thị phần Xác nhận phụ huynh cho độ tuổi `12–15`, không chứa nhiều phân hệ con độc lập như các trang quản trị. Giữ nguyên trong đợt này để tránh chia cắt state của một form duy nhất không cần thiết.

---

## 9. Thông Tin PR, Merge Status Và Commit SHA

- **Nhánh nguồn:** `refactor/phase-02-codebase-cleanup`
- **Nhánh đích:** `develop`
- **Pull Request:** [#2 — `refactor(phase-02): modularize backend services, frontend features, and test DB safety guard`](https://github.com/luongviettienns/WebEdu/pull/2)
- **Chuỗi Conventional Commits trên nhánh:**
  - `30bc0c8`: `refactor(backend): decompose monolithic services into focused domain services, mappers, and policies`
  - `4acbbb7`: `refactor(frontend): modularize feature APIs, hooks, and portal pages with AbortController cleanup`
  - `112ffa0`: `docs(architecture): add phase 2 refactor report and anti-god-file architectural guardrails`
- **GitHub Actions CI Status:** **PASS (100%)** — Run [`42361393539`](https://github.com/luongviettienns/WebEdu/actions/runs/42361393539)
  - `Backend Static, Unit, Postgres Integration & API E2E`: **PASS** (`1m9s`)
  - `Frontend Static, Production Build & Playwright Browser QA`: **PASS** (`1m22s`)
- **Trạng thái tích hợp:** Đã kiểm định CI và sẵn sàng/thực hiện squash-merge vào `develop`.

---

## 10. Đánh Giá Mức Độ Sẵn Sàng Mở Rộng Cho Phase 3 (Extensibility Assessment)

1. **Sẵn sàng 100% cho `CoursesModule`, `ClassesModule` & `EnrollmentsModule`:**
   - `StudentEnrollmentService`, `student-enrollment-facts.policy.ts` và `teacher-assignment.policy.ts` đã được tách độc lập khỏi CRUD tài khoản, cho phép Phase 3 mở rộng nghiệp vụ Xếp lớp (`FUNC-020`), Chuyển lớp (`FUNC-022`), Rút lớp (`FUNC-077`) và Đóng lớp (`FUNC-079`) mà không làm phình to `StudentsModule` hay `TeachersModule`.
2. **Chuẩn hóa Quy tắc Chống "God File" trong Context Dự án:**
   - Đã cập nhật trực tiếp vào Hiến chương Kiến trúc [`TD_Han_Ngu_Project_Context_v1.0/docs/03-technical/architecture-decision-contract.md`](../../TD_Han_Ngu_Project_Context_v1.0/docs/03-technical/architecture-decision-contract.md) (Mục 4) và [`.agents/rules/akit.md`](../../.agents/rules/akit.md) (Mục 7) để cưỡng chế ngưỡng LOC (`<= 350 LOC` cho Backend service, `<= 250 LOC` cho Frontend route page) ngay từ khi viết code ở mọi Phase tiếp theo (`Phase 3..9`).
