# Tiến Độ Dự Án WebEdu — Trung Tâm TD Hán Ngữ (PROJECT_PROGRESS)

Tài liệu theo dõi trạng thái tiến độ, các mốc quan trọng và hạng mục công việc trong dự án WebEdu, đồng bộ 100% với Kế hoạch Tổng thể [`MASTER_PLAN.md`](./MASTER_PLAN.md).

---

## 📌 Tổng Quan Dự Án
* **Tên dự án**: WebEdu (Hệ thống Quản lý Lớp học & Học tập Trung tâm TD Hán Ngữ)
* **Repository**: [https://github.com/luongviettienns/WebEdu](https://github.com/luongviettienns/WebEdu)
* **Kiến trúc & Công nghệ đã chốt (`DEC-021`, `DEC-022`)**:
  - **Backend**: `backend/` — NestJS + Prisma ORM (SQL Migrations chuẩn, cấm `prisma db push`) + PostgreSQL 16+ + TypeScript Strict (`"strict": true`, cấm `any`).
  - **Frontend**: `frontend/` — Next.js (App Router) + Tailwind CSS + Thiết kế Thư họa Á Đông kế thừa 100% Prototype (`prototype/TD Hán Ngữ (Copy).html`): Nền giấy dó (`#F5F6F2`), chữ mực tàu (`#1C2320`), son triện đỏ 朱砂 (`#B5322A`), ngọc bích (`#2B7760`), xanh chàm (`#31578A`), con dấu `.seal`, hồi văn `.fret`.
  - **Múi giờ chuẩn**: Lưu trữ UTC, tính toán hạn nghiệp vụ theo `Asia/Ho_Chi_Minh` (GMT+7).
  - **Quy trình Git**: Git Flow chuyên nghiệp (`main`, `develop`, `feature/*`, `bugfix/*`, `fix/*`, Conventional Commits).
* **Giai đoạn hiện tại**: **Phase 4: Module 04 & 05 — Lịch học, Buổi học & Điểm danh (`FUNC-026..032`, `FUNC-034..037`) — ĐANG KHỞI ĐỘNG**

---

## 🎨 Hạng Mục Đặc Biệt: Đại Tu UI/UX Chuẩn 100% Prototype Á Đông & Dọn Dẹp Chức Năng Thừa *(HOÀN THÀNH — 100% PASS)*
- [x] **Phản biện Kiến trúc 3 Bên (Triad Debate)**: `akit-debater` (Đề xuất giải pháp), `akit-critic` (Chỉ ra 5 rủi ro chí mạng: 2 headers crash E2E, SSR hydration mismatch / session flash, CJK font 20MB bloat, overflow 375px mobile, LOC bloat), `akit-judge` (Ban hành Phán quyết và Kế hoạch thực thi `implementation_plan.md` được phê duyệt).
- [x] **Pha 1: Nền tảng Tokens, Font & Typography An Toàn**: Thiết lập CSS Variables giấy dó, mực tàu, son triện, ngọc bích, xanh chàm, `.seal`, `.fret`, `.han`, `.num` trong `globals.css`; tích hợp Google Font `Be_Vietnam_Pro` và system CJK font stack trong `layout.tsx`; cập nhật `DESIGN.md`.
- [x] **Pha 2: Cỗ Máy Layout Phân Rã (Anti-God-File <= 100 LOC)**:
  - `components/layout/nav-links.ts` (62 LOC): Nhóm menu theo vai trò.
  - `components/layout/SidebarBrand.tsx` (39 LOC): Con dấu `.seal`, slogan, logo trung tâm.
  - `components/layout/SidebarNav.tsx` (65 LOC): Navigation items, vạch đỏ active 3px, badge đếm.
  - `components/layout/SidebarFooter.tsx` (79 LOC): Hồi văn `.fret`, user card, nút đăng xuất.
  - `components/layout/PortalSidebar.tsx` (32 LOC): Sidebar cố định 252px desktop (Notion/Linear style).
  - `components/layout/MobileNavDrawer.tsx` (77 LOC): Drawer trượt mobile có scrim chống tràn.
  - `components/layout/PortalTopbar.tsx` (79 LOC): `<header>` duy nhất toàn trang chứa breadcrumb, live center name và bell icon.
  - `components/layout/PortalShell.tsx` (89 LOC): Client coordinator có skeleton shimmer 252px chống CLS/FOIN.
  - `features/auth/components/AccessDeniedState.tsx`: Triệt tiêu hoàn toàn thẻ `<AppHeader />` lồng nhau gây lỗi 2 headers.
- [x] **Pha 3: Đại Tu Màn Hình Xác Thực 2 Cột Desktop / 1 Cột Mobile**:
  - `features/auth/components/AuthArtSide.tsx` (54 LOC): Cột nghệ thuật thư họa chữ `學` 240px, con dấu triện nghiêng -7deg, Luận Ngữ, có `hidden lg:flex` và `overflow-hidden`.
  - `features/auth/components/LoginFormCard.tsx` (169 LOC): Reskin son triện/giấy dó, bảo toàn 100% input IDs (`#login-email`, `#login-password`).
  - `features/auth/components/StudentRegisterForm.tsx` (299 LOC): Reskin Á Đông, bảo toàn khối xác nhận phụ huynh và input IDs.
  - `(auth)/login/page.tsx`, `(auth)/register/page.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`: Layout 2 cột responsive hoàn chỉnh.
- [x] **Pha 4: Nâng Cấp Bề Mặt Giao Diện 7 Trang Portal**:
  - Gỡ bỏ hoàn toàn `<AppHeader />` thừa khỏi toàn bộ 7 trang portal; đưa vào luồng `PortalShell`.
  - Bổ sung Hanzi eyebrow (`学员管理`, `待分班`, `教师队伍`, `个人档案`, `个人学情`, `系统运营`, `教学工作`).
  - Bảo toàn 100% headings nghiệp vụ, selectors, và phân quyền.
- [x] **Pha 5: Xóa Bỏ Landing Page Thừa & Khắc Phục Typography Bị Mờ**:
  - **Dọn dẹp Route Thừa**: Xóa bỏ trang landing page marketing demo tự phát `/` và tệp `AppHeader.tsx` (> 380 LOC); chuyển đổi `http://localhost:3000/` thành Smart Gateway tự động chuyển hướng (`HTTP 307`) sang `/login`.
  - **Khắc phục Typography Bị Mờ**: Loại bỏ triệt để việc áp dụng nhầm `font-serif` lên văn bản tiếng Việt; phân định rạch ròi `font-sans` (`Be Vietnam Pro`) cho tiếng Việt và `font-han` (`Noto Serif SC`/`SimSun`) cho chữ Hán; nâng cấp màu chữ từ `var(--ink-3)` lên `var(--ink-2)` (`#4A524C`) đạt chuẩn tương phản cao WCAG AA.
- [x] **Pha 6: Dọn Dẹp Triệt Để Yếu Tố Môi Trường Phát Triển, Mã `FUNC-xxx` & Cô Lập CSDL Kiểm Thử (`webedu_test`)**:
  - **Zero `FUNC-xxx` / `DEC-xxx` / `SEC-xxx` / `BR-xxx` trong Production Code**: Xóa sạch 100% mã đặc tả nội bộ khỏi toàn bộ giao diện, bình luận, JSDoc và Swagger `@ApiOperation` trong `frontend/src/**` và `backend/src/**`.
  - **Loại bỏ 100% UI giả lập / Dev / Placeholder**: Gỡ chuông thông báo giả trên `PortalTopbar.tsx`, gỡ hộp giải thích lộ trình tĩnh trên `teacher/classes/page.tsx`, đồng bộ 16 inner feature components sang bảng màu Thư họa Á Đông chính thức (`0` class `emerald-*` / `slate-*`), xóa 5 file SVG mẫu của Next.js.
  - **Cô lập CSDL Kiểm thử (`webedu_test`)**: Cấu hình Playwright E2E chạy độc lập trên `webedu_test`, làm sạch CSDL chính thức `webedu` chỉ giữ 5 tài khoản chuẩn và cấu hình `Trung Tâm TD Hán Ngữ`.
  - **Kiểm Chứng Toàn Diện**:
    - Backend: Typecheck 0 errors, Lint 0 errors/warnings (92 files), 72/72 Unit tests PASS, Build PASS.
    - Frontend: Typecheck 0 errors, Lint 0 errors/warnings, Turbopack Build 15/15 static pages.
    - Playwright E2E (`webedu_test`): **14/14 tests PASS (100%)** trên cả `desktop-chromium` và `mobile-chromium`.
    - Script `scripts/check-loc.js`: 15/15 services Backend $\le 350$ LOC, 12/12 pages Frontend $\le 250$ LOC.
- [x] **Tối Ưu Công Thái Học Form & Chống Tràn Cuộn (Form Compactness & Ergonomics)**:
  - Tái cấu trúc form Đăng ký (`StudentRegisterForm`) từ xếp dọc 1 cột kéo dài thành Grid 2 cột responsive (`Ngày sinh` + `SĐT`, `Mật khẩu` + `Xác nhận`), giảm chiều cao từ 788px xuống ~480px, hiển thị trọn vẹn trong màn hình (Above the Fold) không cần cuộn chuột.
  - Chuẩn hóa padding thẻ Card (`py-5` / `py-6`), khoảng cách field (`space-y-3` / `space-y-3.5`), chiều cao input (`py-2`) trên toàn bộ 4 trang xác thực và 5 Modal nghiệp vụ (`TeacherFormModal`, `CreateSystemUserModal`, `EditUserRolesModal`, `AssignInitialClassModal`, `StudentDetailModal`).
  - Trang bị an toàn `max-h-[90vh] overflow-y-auto` cho 100% Modal, chống che khuất nút Lưu/Đóng trên màn hình nhỏ hoặc zoom lớn.
- [x] **Xây dựng Tài liệu Kịch bản Kiểm thử Toàn diện ([`docs/TEST_SCENARIOS_COMPREHENSIVE.md`](./docs/TEST_SCENARIOS_COMPREHENSIVE.md))**: Bao phủ đầy đủ 8 luồng nghiệp vụ E2E, 4 cấp phân quyền RBAC, các case biên, bảo mật Rate limit/Lockout, bất biến nghiệp vụ, kiểm tra công thái học UI/UX và khả năng tiếp cận WCAG AA.
- [x] **Bổ sung Bộ Kiểm Thử E2E Phủ Kín 100% Edge Cases & Công Thái Học Giao Diện ([`frontend/e2e/phase2-edge-cases.spec.ts`](./frontend/e2e/phase2-edge-cases.spec.ts))**:
  - `EC-1`: Đo đạc Bounding Box form đăng ký và nút bấm `#reg-submit-btn` nằm trọn vẹn trong Viewport ban đầu (Above the Fold) không cần cuộn, xác minh chữ Hán nghệ thuật `學` mang sắc ngọc bích chuẩn `--jade: #2B7760` với độ đậm hiển thị mỹ cảm (opacity-85).
  - `EC-2`: Kiểm tra chặn và phản hồi tức thời khi Mật khẩu xác nhận không khớp (`Mật khẩu xác nhận không khớp`).
  - `EC-3`: Ràng buộc bảo mật và bất biến dữ liệu đối với học viên < 16 tuổi: Bắt buộc email người giám hộ và chặn tuyệt đối học viên khai email người giám hộ trùng với chính email của mình trên cả Client và Server.
  - `EC-4`: Kiểm tra bảo mật đổi mật khẩu cá nhân: Nhập sai mật khẩu hiện tại bị chặn và trả về cảnh báo an toàn.
  - `EC-5`: Kiểm tra cơ chế tự bảo vệ của Superadmin trên giao diện: Khi tự chỉnh sửa chính mình trong Quản trị hệ thống, ô chọn vai trò `SUPERADMIN` và dropdown trạng thái bị khóa cứng (`disabled`), hiển thị rõ ràng thông báo không thể tự vô hiệu hóa tài khoản của chính mình.
  - Đạt 100% PASS trên **10/10 test cases Playwright** (trên cả môi trường Desktop Chromium 1440x900 và Mobile Chromium 375x812).

---

## 🧭 Lộ Trình Phát Triển Toàn Dự Án (10 Phases — 71 Mã Chức Năng)

### Phase 0: Thiết lập Môi trường, AKit & Hiến chương Kiến trúc *(HOÀN THÀNH)*
- [x] Kiểm tra môi trường Node.js, npm, NestJS CLI trên máy local.
- [x] Khởi tạo Git repository cục bộ (branch `main`).
- [x] Thiết lập `.gitignore` chuẩn cho Node.js / NestJS / Next.js / Fullstack.
- [x] Khởi tạo tài liệu dự án ban đầu (`README.md`, `PROJECT_PROGRESS.md`).
- [x] Tạo Public Repository `WebEdu` trên GitHub (`luongviettienns/WebEdu`) và push commit đầu tiên.
- [x] Cài đặt bộ công cụ AKit v0.4.0 (`luongviettienns/AKit`): 30 skills (`.agents/skills/`), 6 specialist subagents (`.agents/agents/`), Safety Lifecycle Hooks (`.agents/hooks.json`), Engineering Rules (`.agents/rules/akit.md`, `GEMINI.md`), Runtime CLI (`.akit/runtime/akit_cli.py`).
- [x] Tổ chức phản biện kiến trúc Triad Debate (3 subagents: `akit-debater`, `akit-critic`, `akit-judge`) và ban hành Hiến chương Kiến trúc [`architecture-decision-contract.md`](./TD_Han_Ngu_Project_Context_v1.0/docs/03-technical/architecture-decision-contract.md).
- [x] Lập Kế hoạch Tổng thể toàn dự án [`MASTER_PLAN.md`](./MASTER_PLAN.md) và chốt `DEC-021` (Next.js + Tailwind CSS), `DEC-022` (Git Flow chuyên nghiệp).
- [x] Trích xuất Sub-Plan chi tiết cho Phase 1 tại [`docs/plans/phase-01-foundation-bootstrap.md`](./docs/plans/phase-01-foundation-bootstrap.md).

### Phase 1: Khởi tạo Nền tảng Kỹ thuật Fullstack (`docs/plans/phase-01-foundation-bootstrap.md`) *(HOÀN THÀNH - 100% GATES PASS)*
- [x] Thiết lập nhánh Git Flow (`develop` & `feature/phase-01-foundation`).
- [x] **Slice 1.1**: Khởi tạo `backend/` NestJS (Strict TS `"strict": true`, `"strictPropertyInitialization": true`, OxLint cấm `any`), cấu hình `@nestjs/config` (`.env`, `.env.example`, `env.validation.ts` với class-validator & class-transformer).
- [x] **Slice 1.2**: Thiết lập `docker-compose.yml` (PostgreSQL 16) + khởi tạo Prisma ORM (`prisma/schema.prisma`, `PrismaService` với `$connect` graceful fallback) + tệp migration SQL chuẩn `20261106155900_init_system_settings` và migration `20261106163500_alter_system_settings_timestamptz` (chuẩn hóa `TIMESTAMPTZ(3)` UTC đồng nhất).
- [x] **Slice 1.3**: Cấu hình Global `ValidationPipe`, `AllExceptionsFilter` (Problem Details chuẩn RFC 7807 / RFC 9457: `type`, `title`, `status`, `detail`, `instance`, `invalidParams`, `application/problem+json`), CORS whitelist an toàn, prefix `/api/v1`, Swagger (`/api/docs`, bảo mật chỉ chạy non-production) và endpoint `GET /api/v1/health` (ping Prisma DB thực tế, trả về 503 degraded khi mất kết nối CSDL, kèm Unit + E2E tests).
- [x] **Slice 1.4**: Xây dựng helper múi giờ `timezone.util.ts` (`Asia/Ho_Chi_Minh`) kèm bộ Unit tests kiểm chứng mốc cuối ngày (23:59:59 GMT+7) và chặn cận dưới trước ngày học.
- [x] **Slice 1.5**: Khởi tạo `frontend/` (Next.js 16 App Router + Tailwind CSS v4), thiết lập Design System tokens (`DESIGN.md` tone xanh trúc Á Đông), `api-client.ts` đồng bộ RFC 7807 Problem Details và Layout / Home sạch sẽ (loại bỏ triệt để 16 mục prototype demo từ `prototype-review.md`).
- [x] **Slice 1.6 (P0 Remediation & Linter Alignment)**: Bật lại luật `typescript/no-explicit-any: "error"` trong `.oxlintrc.json` (0 errors), đồng bộ 100% chính sách cấm `any` của Hiến chương Kiến trúc.
- [x] **Adversarial Audit & Debate (`akit-critic`)**: Hoàn thành vòng phản biện độc lập, khắc phục 100% các khuyến nghị bảo mật & bất biến nghiệp vụ, nhận phán quyết chính thức: **VERDICT: APPROVE**.

### Phase 2: Module 01 — Tài khoản, Xác thực & Phân quyền RBAC (`FUNC-001..013`, `FUNC-078`) *(HOÀN THÀNH & ĐÃ NGHIỆM THU - 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-02-auth-users-rbac.md`](./docs/plans/phase-02-auth-users-rbac.md) & chốt các quyết định `DEC-023` (`User.email` và `User.phone` đều bắt buộc & `UNIQUE`, đăng nhập chỉ dùng `email`, `guardianEmail` nullable cho phép anh/chị/em dùng chung email phụ huynh), `DEC-024` (cô lập lịch sử lớp học của HV), `DEC-025` (2 trường hợp quyền xem lớp cũ của GV), `DEC-026` (ma trận quyền học thuật mở rộng của Admin).
- [x] **Slice 2.1**: Schema & SQL Migration `20261106171000_init_auth_users_rbac` cho `User`, `StudentProfile`, `TeacherProfile`, `GuardianConsent`, `PasswordResetToken`, `SystemAuditLog` (`@db.Timestamptz(3)`, `onDelete: Restrict`, `calculateAgeInVnTimezone`, `role-hierarchy.util.ts`, `JwtAuthGuard`, `RolesGuard`, `audit-sanitize.util.ts`).
- [x] **Slice 2.2**: Học viên tự đăng ký (`FUNC-001`, $\ge 12$ tuổi theo `Asia/Ho_Chi_Minh`) + Xác nhận Phụ huynh cho HV $12\text{–}15$ tuổi (`FUNC-002`, `DEC-001`, lưu vết `GuardianConsent` IP/UA).
- [x] **Slice 2.3**: Đăng nhập bằng Email + Khóa tạm 15p sau 5 lần sai nguyên tử (`FOR UPDATE`) + Cookie `HttpOnly; SameSite=Lax` + CSRF `Origin`/`X-Requested-With` (`FUNC-003`), Đăng xuất + Idle Timeout 60 phút (`FUNC-004`), Khôi phục mật khẩu qua Email chống dò tài khoản & single-use SHA-256 token (`FUNC-005`, `DEC-016`).
- [x] **Slice 2.4**: Hệ thống Guards RBAC & Đa vai trò dương tính (`FUNC-009..013`, `DEC-020`, `DEC-024..026`) + Chốt chặn `SEC-07` (khóa dòng bảo vệ Superadmin hoạt động cuối cùng) & `SEC-08` (chặn leo thang đặc quyền ngang/dọc) + Bộ kiểm thử E2E chống truy cập chéo IDOR/BOLA (`rbac-isolation.e2e-spec.ts`, `auth.e2e-spec.ts`).
- [x] **Slice 2.5**: Quản lý tài khoản GV (`FUNC-006`), Hồ sơ HV & Hàng đợi chờ xếp lớp (`FUNC-007, 008`), Hồ sơ cá nhân & Đổi mật khẩu/Email xoay vòng phiên mượt mà (`FUNC-078`), Cấu hình trung tâm & Upload Logo kiểm định Magic Bytes PNG/JPG + Nhật ký kiểm toán (`FUNC-013`), Toàn bộ giao diện `(auth)/**` & `(portal)/**` (15/15 routes Next.js 16.4.5, dọn sạch 7/7 hạng mục Prototype Cleanup của Phase 2).
- [x] **Slice 2.6 (Initial Independent Audit)**: Phản biện độc lập vòng đầu với `akit-security` và `akit-critic`.
- [x] **Slice 2.7 (Final Remediation, Real PostgreSQL 16 Verification, Browser QA & CI Hardening — `fix/phase-02-final-remediation`)**:
  - Sửa triệt để lỗi P0 rollback bộ đếm đăng nhập sai trên PostgreSQL thật; chuẩn hóa khóa dòng `ORDER BY id ASC FOR UPDATE` chống Deadlock `40P01` và cập nhật cột từng phần chống ghi đè trạng thái.
  - Xây dựng `MailModule` (`SmtpEmailProvider` + `email_rate_limits` SHA-256 cooldown, xóa vĩnh viễn `debugResetToken`), migration `20261107103000_phase02_final_remediation` (`Course`, `Class`, `Enrollment`, FK `StudentProfile.currentClassId`, GIN index `users_roles_gin_idx`, Partial Unique Index `idx_unique_student_active_enrollment`), chuyển sang 100% Cookie-Only Auth, tắt `urlencoded` + kiểm tra `Origin` trên `@Public()`, và thu hẹp `FUNC-008` về `@Roles(Role.ADMIN)` (Default-Deny Superadmin thuần).
  - Xóa bỏ mock `in-memory-prisma.ts`; đạt 100% PASS trên **61/61 Unit tests**, **11/11 Real PostgreSQL 16 Integration scenarios**, **19/19 Real PostgreSQL Supertest E2E tests**, và **14/14 Playwright Browser QA tests** (Desktop + Mobile Chromium).
  - Thiết lập GitHub Actions CI (`.github/workflows/ci.yml` với `postgres:16-alpine`), hoàn thành tái kiểm toán Stage E (`akit-security`: **PASS**, `akit-critic`: **APPROVE** — 0 findings còn mở), xuất bản Báo cáo Nghiệm thu [`docs/reports/PHASE_02_ACCEPTANCE_REPORT.md`](./docs/reports/PHASE_02_ACCEPTANCE_REPORT.md), và tích hợp vào `develop` qua **PR #1** (`https://github.com/luongviettienns/WebEdu/pull/1` — GitHub Actions CI **PASS**).
- [x] **Slice 2.8 (Post-Phase-2 Codebase Refactor & Anti-God-File Guardrails — `refactor/phase-02-codebase-cleanup`)**:
  - **Backend NestJS Refactor**: Phân rã triệt để 3 monolithic services (`students.service.ts` `1,021` dòng, `auth.service.ts` `547` dòng, `system-settings.service.ts` `538` dòng) thành các services chuyên biệt theo Single Responsibility, mappers và policies dùng chung.
  - **Frontend Next.js Refactor**: Thu gọn `src/lib/auth-api.ts` từ `746` dòng xuống `8` dòng; tách `lib/api-client.ts`, `lib/utils/date.ts`, `types/user.ts` và cấu trúc `src/features/**` có gắn `AbortController` chống race condition; giảm mạnh quy mô các trang lớn.
  - **Test Infrastructure Safety & Regression**: Đạt 100% PASS trên **65/65 Unit tests**, **11/11 Real PostgreSQL Integration scenarios**, **19/19 Real PostgreSQL E2E tests**, và **14/14 Playwright Browser QA tests**.
  - **Architectural Guardrails Persistence & PR Integration**: Tích hợp vào `develop` qua **PR #2** (`https://github.com/luongviettienns/WebEdu/pull/2`).
- [x] **Slice 2.9 (Post-Phase-2 Security, Business Logic & Performance Remediation — `fix/post-phase-02-audit-remediation`)**:
  - Đạt 100% PASS trên **72/72 Unit tests**, **11/11 Real PostgreSQL 16 Integration scenarios**, **19/19 Real PostgreSQL Supertest E2E tests**, và **14/14 Playwright Browser QA tests**.
- [x] **Slice 2.10 (Full Prototype Reskin, East Asian Calligraphy & Production Hardening)**:
  - Tái hiện 100% linh hồn Thư họa Á Đông: Nền giấy dó, chữ mực tàu, son triện đỏ, ngọc bích, xanh chàm, con dấu `.seal`, hồi văn `.fret`.
  - Layout 2 cột: Desktop Sidebar 252px cố định + Topbar `<header>` duy nhất; Mobile/Tablet Off-canvas Drawer.
  - Màn hình Auth 2 cột với `AuthArtSide` chữ `學` 240px, con dấu triện nghiêng -7deg, Luận Ngữ; an toàn trên mobile 375px (`scrollWidth - innerWidth <= 2`).
  - Đạt 100% PASS: Typecheck 0 errors, Lint 0 errors/warnings, Playwright E2E 14/14 tests PASS, 15/15 Backend Services và 12/12 Frontend Pages đạt chuẩn Anti-God-File LOC.
- [x] **Slice 2.11 (Resend SMTP Configuration & Mail Verification Tooling)**:
  - Cấu hình template chuẩn Resend SMTP Relay (`smtp.resend.com:465`, SSL) vào `backend/.env` & `backend/.env.example`.
  - Tạo công cụ kiểm thử đường truyền `scripts/test-smtp.mjs` tích hợp lệnh `npm run test:mail` để xác thực kết nối và gửi thử email thật trực tiếp từ CLI; đã cấp phát API Key Resend và gửi email thực tế tới `luongviettienns@gmail.com` với trạng thái `delivered` (Message ID: `01a1c114-f2df-7df4-b3bf-c221da46374d`).
  - Đồng bộ và rà soát toàn diện cấu hình môi trường: CSDL PostgreSQL `DATABASE_URL` hoạt động chuẩn xác (5 migrations up to date), `JWT_SECRET` đạt chuẩn bảo mật $\ge 32$ ký tự, bổ sung `frontend/.env.example` và `frontend/.env.local` (`NEXT_PUBLIC_API_URL`), 100% Unit tests (118/118) và Builds (Backend & Frontend) đạt PASS tuyệt đối.
  - Khắc phục lỗi bắt nhầm thông điệp Ngày sinh trên form Đăng ký (`StudentRegisterForm`): Lắng nghe cờ HTML5 `validity.badInput` khi người dùng nhập ngày không tồn tại trên lịch (như 31/02), phân biệt chính xác giữa `"Ngày sinh không hợp lệ"` và `"Ngày sinh không được để trống"`.
- [x] **Slice 2.11 (Production Cleanup, Zero `FUNC-xxx` / Dev Artifacts & Test DB Isolation `webedu_test`)**:
  - Xóa sạch 100% mã `FUNC-xxx`, `DEC-xxx`, `SEC-xxx`, `BR-xxx`, `INV-xxx` khỏi toàn bộ mã nguồn Production (`backend/src/**` & `frontend/src/**`).
  - Loại bỏ chuông thông báo giả trên `PortalTopbar.tsx`, thẻ giải thích lộ trình tĩnh trên `teacher/classes/page.tsx`, và chuẩn hóa toàn bộ 16 inner feature components sang bảng màu Thư họa Á Đông chính thức (`0` class `emerald-*` / `slate-*`).
  - Tách biệt CSDL kiểm thử `webedu_test` cho Playwright E2E và làm sạch CSDL chính thức `webedu`.
- [x] **Slice 2.12 (Hardening Toàn Diện, Kiểm Kê API/UI & Chứng Minh Độ Tin Cậy Phase 2 — `test/hardening-phase-02`)**:
  - **Kiểm kê 100% API & UI**: Lập bảng kiểm kê đầy đủ **28 HTTP API Endpoints** (`docs/test-inventory-api.md`) và **12 Trang Giao Diện** (`docs/test-inventory-ui.md`).
  - **Kiểm thử Tự Động Đối Soát Endpoint**: Viết test E2E `api-inventory-and-rbac-matrix.e2e-spec.ts` tự động trích xuất Express routes từ NestJS và so khớp với danh mục kiểm kê; tự động báo FAIL nếu có endpoint mới chưa khai báo.
  - **Ma Trận Phân Quyền & Bất Biến DB Thật**: Kiểm chứng ma trận `Vai trò × Endpoint × Trạng thái` (Unauthenticated, Revoked, Inactive, Student, Teacher 4 trạng thái, Admin, Superadmin thuần, Multi-role) + Kiểm tra chống Race Condition xếp lớp/đăng ký trùng trên PostgreSQL 16 thật.
  - **Coverage Gate Vượt Ngưỡng**: Nâng ngưỡng kiểm soát trong `vitest.config.ts` và CI (`.github/workflows/ci.yml`) lên Lines $\ge 85\%$, Branches $\ge 80\%$; kết quả thực tế đạt **93.72% Lines** và **82.23% Branches** (101 Unit tests).
  - **Mutation Testing (Stryker)**: Thiết lập `stryker.config.mjs` chạy đột biến 16 tệp nguồn cốt lõi (1.766 mutants); bổ sung 29 unit test chuyên sâu kiểm tra chặt chẽ giá trị biên thời gian (23:59:59 GMT+7, năm nhuận 29/02, 60s cooldown, 15m lockout, 60m idle timeout).
  - **Khả Năng Tiếp Cận (WCAG 2.1 AA) & Phát Hiện Lỗi Thật**: Tích hợp `@axe-core/playwright`; phát hiện và sửa tối thiểu 2 lỗi thật nghiêm trọng: sửa thẻ `<Link>` nằm trong khối `aria-hidden="true"` tại `AuthArtSide.tsx` và nâng cấp tỷ lệ tương phản màu chữ/badge tại `globals.css` ($\ge 4.5:1$).
  - **Chứng Minh Độ Ổn Định 3 Lần Chạy Liên Tiếp**: 100% lệnh kiểm thử chạy qua 3 lượt độc lập trên PostgreSQL 16 thật (Backend: 101 unit + 11 integration + 23 E2E = 135 tests; Frontend: 20 Playwright E2E tests) **đạt 100% PASS, 0 flaky tests**.
  - **Xuất Bản Báo Cáo Nghiệm Thu**: Hoàn thành Báo Cáo Kiểm Thử Toàn Diện & Chứng Minh Độ Tin Cậy Phase 2 bằng tiếng Việt tại [`docs/test-report-phase-02.md`](./docs/test-report-phase-02.md).
- [x] **Slice 2.13 (Khắc Phục 100% Phát Hiện Audit RBAC & Tính Nhất Quán Dữ Liệu Trước Phase 3 — `docs/rbac-phase3-audit.md`)**:
  - **F1 (P1 - Backend)**: Tái kiểm tra quyền `assertActorMayModifyAccount(actor, targetUser.roles)` trên bản ghi đã khóa dòng `lockTargetUser(tx, id)` chống Admin sửa tài khoản vừa được nâng quyền Superadmin đồng thời; trả về 403 Forbidden nguyên tử, bảo toàn email và nhật ký kiểm toán.
  - **F2 (P1 - Backend)**: Tái kiểm tra người thao tác `freshActor` và `tokenVersion` bên trong transaction cấp quyền chống Superadmin vừa bị giáng chức thành Admin vẫn cấp quyền Superadmin cho người khác.
  - **F3 (P1 - Backend & Frontend)**: Chặn cấp quyền Admin/Superadmin cho tài khoản `INACTIVE` trên Backend; Frontend `EditUserRolesModal.tsx` chỉ gửi delta các trường thực sự thay đổi chống form cũ khôi phục vai trò Admin bị gỡ.
  - **F4 (P1 - Backend)**: Tự động khởi tạo `StudentProfile` khi gán vai trò `STUDENT` cho tài khoản hệ thống/giáo viên; chặn gỡ vai trò `STUDENT` khi học viên còn lớp `ACTIVE` (`BadRequestException`) bảo toàn tính nhất quán dữ liệu.
  - **F5 (P1 - Frontend)**: Bổ sung cơ chế đồng bộ danh tính đa tab trên `usePortalSession.ts` lắng nghe `focus` và `visibilitychange`; tự động phát hiện phiên/tài khoản/vai trò đổi chéo giữa các tabs và vô hiệu hóa kịp thời.
  - **F6 (P2 - Backend)**: Cô lập hoàn toàn dữ liệu lớp học (`currentClassId: null`, `assignedClass: null`, `enrolledAt: null`) đối với Superadmin thuần trong DTO danh sách và chi tiết học viên; ẩn ô lọc lớp trên giao diện Admin.
  - **F7 (P2 - Backend)**: Bổ sung trạng thái `ClassStatus.ARCHIVED` vào bộ lọc bản ghi học tập của giáo viên, bảo toàn quyền `READ_ONLY` xem lại dữ liệu học sinh của lớp đã lưu trữ (DEC-025).
  - **F8 (P2 - Frontend)**: Ẩn liên kết hàng đợi chờ xếp lớp đối với Superadmin thuần; bổ sung mục chờ xếp lớp trên sidebar cho tài khoản kiêm nhiệm `SUPERADMIN + ADMIN`; phát sự kiện `notifyPendingEnrollmentUpdated()` cập nhật số badge tức thì từ 2 về 1 khi hoàn tất xếp lớp.
  - **F9 (P2 - Frontend)**: Ẩn nút "Sửa" và "Vô hiệu hóa" đối với giáo viên kiêm nhiệm tài khoản đặc quyền (`ADMIN`/`SUPERADMIN`) trong giao diện Admin; hiển thị lỗi 403 cục bộ trong modal mà không làm sập toàn bộ trang sang `AccessDeniedState`.
  - **Mobile Accessibility & Typography Hardening**: Bổ sung `tabIndex={0} role="region" aria-label="..."` cho toàn bộ vùng cuộn bảng trên mobile (`scrollable-region-focusable` đạt 0 lỗi Axe); khắc phục font chữ Hán và độ tương phản trong `globals.css` và `AuthArtSide.tsx`.
  - **Kiểm Chứng Toàn Diện 100% PASS**: Bộ audit độc lập `rbac-phase3.audit-spec.ts` 9/9 tests PASS; Unit test 117/117 tests PASS (92.77% Lines, 81.55% Branches); Integration 11/11 tests PASS; E2E Backend 23/23 tests PASS; Playwright E2E 20/20 tests PASS (Desktop & Mobile); LOC Guardrails 0 vi phạm.
- [x] **Slice 2.14 (Kiểm Chứng Trực Quan Trình Duyệt Thật Đa Người Dùng — Live Chromium Cross-User Verification)**:
  - Tự động hóa kiểm thử trực tiếp trên Chromium có giao diện đồ họa thực tế tương tác chéo giữa 4 vai trò (Học viên 14 tuổi, Admin, Giáo viên, Superadmin).
  - Hoàn thành trọn vẹn 6/6 kịch bản cross-user: (1) Học viên vị thành niên đăng ký kèm phụ huynh, (2) Đăng nhập chờ lớp & Chặn 403 khi vào Admin, (3) Phản chiếu tức thời sang Hàng đợi Admin, (4) Chặn vô hiệu hóa GV đang phụ trách lớp hoạt động, (5) Giáo viên chỉ thấy lớp được giao & Chặn vào Superadmin, (6) Superadmin đổi thương hiệu trung tâm & đồng bộ thời gian thực sang Học viên (`cache: 'no-store'`).
  - Đạt 100% PASS trên cả 6 kịch bản, xuất bản Báo Cáo Kiểm Thử Trực Tiếp kèm 10 ảnh chụp minh chứng tại `live_cross_user_test_report.md`.

- [x] **Slice 2.15 (Tối ưu Đăng ký Dưới 16 tuổi: 1 Email Duy nhất, Checkbox Cam kết, OTP Xác minh & Bảo tồn Lịch sử Giám hộ — `feature/auth-email-verification-and-consent`)**:
  - **1 Trường Email Duy Nhất & Đơn Giản Hóa Form**: Gỡ bỏ hoàn toàn ô "Email phụ huynh" riêng trên form đăng ký. Thống nhất 1 trường `email` duy nhất dùng cho cả Đăng nhập (`FUNC-003`) và Quên mật khẩu (`FUNC-005`): Học viên $< 16$ tuổi nhập email cha mẹ/người giám hộ; học viên $\ge 16$ tuổi nhập email cá nhân.
  - **Cam Kết Giám Hộ Bằng Checkbox**: Học viên 12–15 tuổi chỉ cần tích chọn checkbox cam kết đồng ý của cha mẹ (`guardianConsent: true`), hệ thống lưu vết pháp lý bất biến (`GuardianConsent` kèm IP, User Agent, snapshot văn bản cam kết và thời gian).
  - **Xác Minh Quyền Sở Hữu Email Bằng Mã OTP 6 Số**: Bổ sung bảng `email_verifications` (`20261110100000_create_email_verifications`), endpoint `POST /api/v1/auth/send-verification-code` gửi mã OTP 6 số ngẫu nhiên qua SMTP (hiệu lực 10 phút, mã hóa SHA-256, rate limit 60 giây chống spam mail), và kiểm tra mã OTP hợp lệ khi hoàn tất đăng ký.
  - **Chống Trùng Email/SĐT & Race Condition (409 Conflict)**: Phân loại thông báo lỗi cụ thể (trùng Email, trùng SĐT, hoặc cả hai) thay vì gộp chung; bắt mã lỗi PostgreSQL `P2002` chuẩn RFC 7807 Problem Details; bổ sung kiểm thử tự động đa luồng 5 requests đồng thời.
  - **Bảo Tồn Lịch Sử Giám Hộ Tuyệt Đối**: Ràng buộc bất biến đảm bảo khi học viên đủ 16 tuổi tự cập nhật email cá nhân (`FUNC-078` `ProfileService.updateMyProfile`), hệ thống chỉ cập nhật `User.email`, **tuyệt đối không ghi đè** lên bản ghi `GuardianConsent.guardianEmail` ban đầu.
  - **Đồng Bộ Checklist Kiểm Thử & Kiểm Kê API**: Cập nhật tệp Excel `WebEdu_Checklist_KiemThu_TrucQuan.xlsx` (sheet `CHECKLIST`, các ca `REG-01`, `REG-02`, `REG-03`, `REG-04`, `REG-07`, `REG-08`, `REG-09`, `REG-10`) và tài liệu `docs/TEST_SCENARIOS_COMPREHENSIVE.md` phản ánh chính xác luồng 1 Email duy nhất, xác thực OTP 6 số, thông báo 409 tách bạch và checkbox cam kết phụ huynh. Đồng thời đồng bộ danh mục 29 endpoints trong `docs/test-inventory-api.md` và kiểm thử tự động `backend/test/api-inventory-and-rbac-matrix.e2e-spec.ts` (100% E2E PASS).
  - **100% Cổng Kỹ Thuật Đạt Chuẩn**: Unit tests 120/120 PASS, Typecheck Backend & Frontend 0 lỗi, Lint Backend (OxLint) & Frontend (ESLint) 0 warnings/errors, Anti-God-File LOC 15/15 Backend Services và 12/12 Frontend Pages đạt chuẩn.
  - **Tích Hợp & Dọn Dẹp Nhánh Git Flow**: Tạo và hợp nhất thành công **PR #5** ([https://github.com/luongviettienns/WebEdu/pull/5](https://github.com/luongviettienns/WebEdu/pull/5)) vào nhánh `develop`; đóng PR #4 (đã được bao hàm toàn diện); xóa toàn bộ nhánh tính năng và kiểm thử của Phase 2 trên cả local và remote (`feature/auth-email-verification-and-consent`, `test/hardening-phase-02`, `fix/phase-02-final-remediation`).

### Phase 3: Module 02 & 03 — Khóa học HSK & Quản lý Lớp học (`FUNC-014`, `FUNC-016..024`, `077`, `079`) *(HOÀN THÀNH & ĐÃ NGHIỆM THU - 100% GATES PASS)*
- [x] **Chốt Quyết định Nghiệp vụ Tiền Đề (`DEC-027`, `DEC-028`, `DEC-029`, `DEC-030`)**:
  - `DEC-027`: Mỗi lớp học chỉ có duy nhất **1 Giáo viên chính thức phụ trách** tại một thời điểm (không có trợ giảng).
  - `DEC-028`: Tại một thời điểm, mỗi Học viên chỉ được ở trạng thái `ACTIVE` trong **tối đa 1 lớp học duy nhất** (muốn học lớp khác phải `COMPLETED` hoặc `TRANSFERRED`).
  - `DEC-029` (`COURSE-01`): Số buổi mặc định (`defaultSessions`) của từng khóa HSK được Admin tự cấu hình linh hoạt, tự điền làm gợi ý khi tạo lớp mới; khóa đã gắn lớp không xóa vật lý mà chuyển sang `Ngừng sử dụng` (`isActive = false`).
  - `DEC-030` (`CLASS-02`): Khi đóng/kết thúc lớp (`FUNC-079`), chuyển lớp sang `COMPLETED` (`READ_ONLY`), bảo toàn 100% lịch sử học tập và giải phóng trạng thái lớp hiện tại của học viên để có thể xếp lên lớp HSK cấp tiếp theo; hỗ trợ mở lại lớp trong 7 ngày.
- [x] Lập Sub-Plan [`docs/plans/phase-03-courses-and-classes.md`](./docs/plans/phase-03-courses-and-classes.md) (tích hợp Superpowers Subagent TDD & Hội đồng Phản biện Đa Agent trước nghiệm thu) & chốt Open Issues `COURSE-01`, `CLASS-02`.
- [x] **Slice 3.1**: Schema Migration (`20261110120000_phase03_courses_and_classes`) & Module 02 — Danh mục Khóa học HSK1–HSK4 & Giao tiếp cơ bản (`FUNC-014`, Backend `CoursesModule` + Frontend `/admin/courses`) — *Commit `cb9a32c`, Review `akit-critic` PASS*.
- [x] **Slice 3.2**: Tạo/Sửa Lớp học, tự tính `expectedEndDate`, cảnh báo trùng lịch dạy & Phân công 1 Giáo viên kèm lịch sử `ClassTeacherAssignment` (`FUNC-016..018`) — *Commit `37ea94f`, Review `akit-critic` PASS*.
- [x] **Slice 3.3**: Vòng đời Ghi danh Học viên: Thêm 1/nhiều HV vào lớp (`FUNC-020`), Chuyển lớp (`FUNC-022`), Rút học viên khỏi lớp (`FUNC-077`), Xem lịch sử các lớp đã học (`FUNC-023`) bảo toàn 100% lịch sử — *Commit `bb906bc`, Review `akit-critic` & `akit-security` PASS*.
- [x] **Slice 3.4**: Danh sách/Chi tiết lớp theo phân quyền (`FUNC-024`, `DEC-025`) & Kết thúc/Lưu trữ lớp chuyển sang `READ_ONLY` + Mở lại trong 7 ngày (`FUNC-079`, `DEC-030`) — *Commit `07d8d93`, Review `akit-critic` & `akit-security` PASS*.
- [x] **Slice 3.5 & Hội Đồng Tranh Biện Đa Agent Trước Nghiệm Thu (`87c5f61..4257a54`)**:
  - Xây dựng bộ kiểm thử E2E trên PostgreSQL 16 thật ([`backend/test/phase3-courses-classes.e2e-spec.ts`](./backend/test/phase3-courses-classes.e2e-spec.ts) — 5 kịch bản toàn trình), đồng bộ kiểm kê **41 HTTP API Endpoints** ([`docs/test-inventory-api.md`](./docs/test-inventory-api.md)) và **16 Trang Giao Diện** ([`docs/test-inventory-ui.md`](./docs/test-inventory-ui.md)).
  - Tổ chức **Hội đồng Tranh biện Ba Bên & Kiểm toán Bảo mật Toàn Nhánh** (`akit-debater`, `akit-critic`, `akit-security`, `akit-judge`); khắc phục triệt để 6 hạng mục (`REM-01`..`REM-06`: khóa BOLA đa vai trò `[SUPERADMIN, TEACHER]`, bảo toàn trạng thái tài khoản kiêm nhiệm `[STUDENT, TEACHER]` khi rời/đóng lớp, chuẩn hóa thứ tự khóa bi quan `classes -> users` chống deadlock, đồng bộ `assignedClass` khi đổi mã lớp, chặn `reopenClass` kéo ngược học viên đã chuyển tiếp, và đồng bộ `READ_ONLY` toàn hệ thống).
  - Đạt điểm tuyệt đối **100 / 100 (`VERDICT: APPROVE`)** từ Thẩm phán Độc lập (`akit-judge`), xuất bản Báo cáo Nghiệm thu [`docs/reports/PHASE_03_DEBATE_AND_ACCEPTANCE_REPORT.md`](./docs/reports/PHASE_03_DEBATE_AND_ACCEPTANCE_REPORT.md) (**150/150 Unit Tests**, **11/11 Integration Tests**, **28/28 E2E Tests** PASS).
  - **Xuất Bản Nhánh Tính Năng Phase 3 (`feature/phase-03-courses-and-classes`)**: Bổ sung tài liệu nghiệp vụ `Trạm Hán Ngữ Nǐhǎo - Tổng hợp nghiệp vụ - Quản lý lớp học.xlsx` vào `TD_Han_Ngu_Project_Context_v1.0/`, commit và publish nhánh lên remote GitHub (`origin/feature/phase-03-courses-and-classes`), bảo lưu độc lập chưa merge vào `develop`.
- [x] **Slice 3.6 (Rà soát Toàn diện Trước Merge vào `develop` — Business Logic, Phân quyền UI/UX, Refactor Frontend & Kiểm toán Độc lập)**:
  - **Business Logic & Concurrency Hardening**: Chặn chọn ngày tương lai (khi chưa có scheduler) trên toàn bộ thao tác có hiệu lực ngay (`teacherAssignedFrom`, `enrolledDate`, `enrolledAt`, `transferDate`, `leftDate`, `actualEndDate`) với helper dùng chung `assertVnDateNotInFuture`; kiểm tra trùng lịch dạy theo thứ + khung giờ + khoảng thời gian hoạt động thực tế (`hasActivePeriodOverlap`) và trả về `scheduleConflictWarning` trực tiếp trên `GET /classes/:id` và `reopenClass`; sửa điều kiện khôi phục học viên khi mở lại lớp (`createdAt > closedAt || enrolledDate > closeDate`); chặn chuyển lớp đối với học viên `INACTIVE` (`SEC-01`); khóa hàng đồng nhất `[teacherId, ...studentIds]` theo thứ tự tăng dần trong `completeClass` (`SEC-02`); đưa kiểm tra khóa học active (`FOR SHARE`) và trùng lịch vào trong transaction `createClass` (`SEC-04`); bổ sung tham số lọc `excludeClassId` phía server cho danh sách lớp đích chuyển lớp.
  - **Phân quyền UI/UX Chuẩn Capability & Refactor Frontend**: Tập trung logic phân quyền vào `features/classes/permissions/class-permissions.ts` (`assignedRoles`, `effectiveRole`, `accessMode`, backend `capabilities`), xử lý đồng nhất Admin, Teacher, Superadmin và tài khoản đa vai trò (`ADMIN + TEACHER`, `SUPERADMIN + TEACHER`); tách `ClassDetailView` thành `ClassHeader`, `ClassSummary`, `ClassStudentsTable`, `ClassTeacherHistory`; tách hooks `useClassList`, `useClassDetail`, `usePagedOptions` (tìm kiếm & phân trang server-side bỏ giới hạn ngầm 100 bản ghi, quản lý trạng thái theo `queryKey` + `AbortController` chống race condition khi gõ tìm kiếm lúc đang "Tải thêm"); tạo `BaseDialog` dùng chung hỗ trợ focus trap, Escape và khôi phục focus; tách form state & validation sang `useClassForm.ts`; phân tách `classes.types.ts` / `classes.api.ts` / `enrollments.api.ts`; đồng bộ xử lý ngày/lịch học (`schedule.util.ts`); bỏ tự chọn giáo viên đầu tiên khi tạo lớp; bổ sung xác nhận trước khi mở lại lớp/ngừng sử dụng khóa học; phân biệt `"Đã xếp lớp – Chờ khai giảng"` (`AWAITING_START`) với `"Đang học"` (`ACTIVE`), hiển thị chính xác `restoredStudentsCount` khi mở lại lớp, và tách riêng `listError` / `mutationError` trên `/admin/courses` (`CourseTable.tsx`).
  - **Đồng bộ `origin/develop` (PR #5) & Kiểm Thử E2E Toàn Trình**: Merge sạch `origin/develop` (không conflict), đồng bộ `StudentRegisterForm.tsx` (`#reg-submit-btn`, chặn < 12 tuổi) và Playwright Phase 2 OTP qua `qa-environment.mjs` (`GET /latest-otp`); bổ sung bộ Playwright riêng Phase 3 [`frontend/e2e/phase3-courses-classes.spec.ts`](./frontend/e2e/phase3-courses-classes.spec.ts) (`P3-E2E-1..5` trên desktop 1440px, tablet 768px, mobile 375px, keyboard navigation, Axe WCAG) cùng các regression tests mới (Unit, Real Postgres Integration Scenario 14, Backend E2E Scenario 6).
  - **Kiểm Chứng & Nghiệm Thu Độc Lập Sau Khắc Phục**: `node scripts/check-loc.js` PASS (21/21 backend services $\le 350$ LOC, 16/16 frontend pages $\le 250$ LOC); Backend `typecheck` PASS, `oxlint` 0 warnings/0 errors, `nest build` PASS, `vitest` Unit **166/166 PASS** (91.89% lines), Real PG Integration **13/13 PASS** (gồm Scenario 15 kiểm tra partial unique index `class_teacher_assignments_active_unique_idx`), Backend E2E **29/29 PASS**; Frontend `tsc` PASS, `eslint` 0 errors, `next build` PASS, Playwright E2E **40/40 PASS** (Desktop + Mobile); bảo vệ `seed.mjs` khỏi TRUNCATE production, nâng cấp OTP CSPRNG (`crypto.randomInt`), bind localhost cho postgres trong `docker-compose.yml`; tinh chỉnh `/profile` ẩn trường `Ngày sinh (Chỉ xem)` cho tài khoản không phải `STUDENT`; đồng bộ 100% giao diện học viên với Prototype (`prototype/TD Hán Ngữ (Copy).html`): chuyển chi tiết học viên thành Drawer trượt bên phải (`DRAWERS.stu`), đổi bộ lọc lớp thành `<select>` dropdown (`Mọi lớp`), tách 2 dòng SĐT và Email trên thẻ GV phụ trách (`ClassSummary.tsx`), và chuẩn hóa layout 2 cột 4 khối (Lớp đang học kèm ring tiến độ, Bài cần làm, Chuyên cần, Kết quả gần đây) cho `/student/overview` (`VIEWS.dash`); `akit-critic` kết luận **`ACCEPT`** (0 P0/P1/P2) và `akit-security` kết luận **`PASS`** (0 findings mở). Đã merge sạch vào `develop` (commit `e6f36e6`), đẩy lên remote và tạo nhánh mới `feature/phase-04-schedule-and-attendance`.

### Phase 4: Module 04 & 05 — Lịch học, Buổi học & Điểm danh (`FUNC-026..032`, `FUNC-034..037`)
- [ ] Lập Sub-Plan `docs/plans/phase-04-schedule-and-attendance.md` & chốt Open Issues `SCHED-01`, `ATT-01`.
- [ ] **Slice 4.1**: Khai báo lịch định kỳ & Sinh các buổi học (`FUNC-026, 027` — không tự chuyển 'Đã học' khi chưa điểm danh).
- [ ] **Slice 4.2**: Cập nhật lịch (`FUNC-029`), Hủy buổi (`FUNC-030`), Tạo buổi học bù (`FUNC-031`), Nhật ký thay đổi lịch (`FUNC-032`).
- [ ] **Slice 4.3**: Điểm danh từng buổi 3 trạng thái (`FUNC-034, 035`).
- [ ] **Slice 4.4**: Sửa điểm danh giới hạn 2 ngày GMT+7 cho GV & Admin Override Audit Log (`FUNC-037`) + Cảnh báo nghỉ chạm 30% (`FUNC-036`).
- [ ] **Slice 4.5**: Giao diện Calendar Lịch học & Điểm danh trực tiếp trên buổi học (bỏ menu Điểm danh rời 14 ngày theo Cleanup #9).

### Phase 5: Module 06 (Phần 1) — Ngân hàng Câu hỏi HSK & Import Đề Word/PDF (`FUNC-039..050`)
- [ ] Lập Sub-Plan `docs/plans/phase-05-question-bank-and-import.md`, chạy `akit-prior-art` & chốt `ASSIGN-01`.
- [ ] **Slice 5.1**: Schema `Assessment`, `Question`, `MediaAsset` + Dịch vụ upload Audio/Image bảo mật (`FUNC-049, 050`).
- [ ] **Slice 5.2**: CRUD Bài tập/Đề kiểm tra (`FUNC-039`) & Trình biên tập 7 dạng câu hỏi HSK (`FUNC-043..048`).
- [ ] **Slice 5.3**: Pipeline chuyển đổi đề Word/PDF sang câu hỏi tương tác (`FUNC-040, 041`) + Màn hình GV duyệt đề (`FUNC-042`).
- [ ] **Slice 5.4**: Giao diện Ngân hàng đề & Soạn thảo câu hỏi (bỏ nút dùng file mẫu demo theo Cleanup #5).

### Phase 6: Module 06 (Phần 2) — Giao bài, Làm bài, Autosave & Nộp bài 1 lượt (`FUNC-051..054`)
- [ ] Lập Sub-Plan `docs/plans/phase-06-assignment-delivery-and-submission.md` & chốt `ASSIGN-02..03`.
- [ ] **Slice 6.1**: Schema `ClassAssignment`, `Submission`, `SubmissionAnswer` (chống nộp trùng).
- [ ] **Slice 6.2**: Giao bài cho lớp (`FUNC-051`) & Danh sách bài được giao (`FUNC-052`).
- [ ] **Slice 6.3**: Lưu nháp đang làm (`FUNC-053`), Nộp bài chính thức 1 lượt & GV mở lại lượt nộp (`FUNC-054`).
- [ ] **Slice 6.4**: Giao diện Học viên làm bài tương tác & Xem bài nộp (Cleanup #14).

### Phase 7: Module 07 — Chấm điểm Rule-based, Tự luận & Công bố 2 bước (`FUNC-056`, `FUNC-058..064`)
- [ ] Lập Sub-Plan `docs/plans/phase-07-grading-and-publication.md` & chốt `GRADE-01..02`.
- [ ] **Slice 7.1**: Rule-based Auto-Grading Engine (`FUNC-056` — loại bỏ `FUNC-057` AI chấm bài mở).
- [ ] **Slice 7.2**: Giáo viên chấm tự luận (`FUNC-058`) & Theo dõi học viên Đã nộp / Chưa nộp (`FUNC-062`).
- [ ] **Slice 7.3**: Quy trình 2 bước Xác nhận điểm (`FUNC-059`) $\rightarrow$ Công bố điểm (`FUNC-060`) + Cổng Zero-Leak cho `FUNC-063`.
- [ ] **Slice 7.4**: Chỉnh sửa điểm (`FUNC-061`) & Lịch sử sửa điểm `GradeAuditLog` (`FUNC-064`).
- [ ] **Slice 7.5**: Giao diện Chấm bài, Công bố điểm & Xem kết quả.

### Phase 8: Module 08 & 09 — Kiểm tra Tổng kết & Theo dõi Tiến độ (`FUNC-065`, `068..075`)
- [ ] Lập Sub-Plan `docs/plans/phase-08-exams-and-progress-tracking.md` & chốt `EXAM-01`, `ATT-02`.
- [ ] **Slice 8.1**: Theo dõi tiến độ buổi học & Tự động tính ngày dự kiến kết thúc lớp (`FUNC-071, 072`).
- [ ] **Slice 8.2**: Quản lý kỳ kiểm tra Mini-test / Giữa kỳ / Cuối kỳ (`FUNC-065, 068`), chuyên cần BTVN (`FUNC-069`), Điểm tổng kết (`FUNC-070` — loại bỏ `FUNC-076`).
- [ ] **Slice 8.3**: Dashboard theo dõi tiến độ cho Học viên (`FUNC-073`), Giáo viên (`FUNC-074`) và Admin (`FUNC-075`).

### Phase 9: Module 10 & Production Hardening — Thông báo In-App, Dọn Prototype & Nghiệm thu UAT (`FUNC-080`)
- [ ] Lập Sub-Plan `docs/plans/phase-09-notifications-and-hardening.md` & chốt `NOTIF-01`, `PROTO-01`.
- [ ] **Slice 9.1**: Hệ thống Thông báo In-App (`FUNC-080` — chỉ bắn thông báo điểm khi `PUBLISHED`).
- [ ] **Slice 9.2**: Kiểm toán loại bỏ 100% 16 hạng mục demo trong `prototype-review.md`.
- [ ] **Slice 9.3**: Chạy bộ 5 Integration Invariant Tests + Full Playwright E2E Regression Suite.
- [ ] **Slice 9.4**: Thực hiện `akit-simplify`, `akit-security` audit, `akit-review` độc lập và đóng gói bàn giao (`akit-deliver`).
