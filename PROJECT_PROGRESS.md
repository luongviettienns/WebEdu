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
* **Giai đoạn hiện tại**: **Phase 2 & ĐỢT ĐẠI TU UI/UX PROTOTYPE Á ĐÔNG HOÀN TẤT & ĐÃ RÀ SOÁT TOÀN DIỆN (100% GATES PASS) — SẴN SÀNG KHỞI ĐỘNG PHASE 3 (Khóa học HSK & Quản lý Lớp học)**

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

### Phase 3: Module 02 & 03 — Khóa học HSK & Quản lý Lớp học (`FUNC-014`, `FUNC-016..024`, `077`, `079`)
- [x] **Chốt Quyết định Nghiệp vụ Tiền Đề (`DEC-027`, `DEC-028`)**:
  - `DEC-027`: Mỗi lớp học chỉ có duy nhất **1 Giáo viên chính thức phụ trách** tại một thời điểm (không có trợ giảng).
  - `DEC-028`: Tại một thời điểm, mỗi Học viên chỉ được ở trạng thái `ACTIVE` trong **tối đa 1 lớp học duy nhất** (muốn học lớp khác phải `COMPLETED` hoặc `TRANSFERRED`).
- [ ] Lập Sub-Plan `docs/plans/phase-03-courses-and-classes.md` & chốt Open Issues `COURSE-01`, `CLASS-02`.
- [ ] **Slice 3.1**: Mở rộng CRUD Danh mục Khóa học HSK1–HSK4 & Giao tiếp cơ bản (`FUNC-014`) + Tạo/Sửa Lớp học, Phân công 1 GV trên nền bảng `courses` & `classes` đã khởi tạo (`FUNC-016..018`).
- [ ] **Slice 3.2**: Nghiệp vụ `Enrollment` mở rộng: Thêm HV vào lớp (`FUNC-020`) trên nền bảng `enrollments` & Partial Unique Index `idx_unique_student_active_enrollment`.
- [ ] **Slice 3.3**: Chuyển lớp (`FUNC-022`), Rút học viên khỏi lớp (`FUNC-077`), Xem lịch sử các lớp đã học (`FUNC-023`) bảo toàn 100% lịch sử.
- [ ] **Slice 3.4**: Kết thúc/Lưu trữ lớp (`FUNC-079`) & Xem danh sách/chi tiết lớp theo quyền (`FUNC-024`).
- [ ] **Slice 3.5**: Giao diện Quản lý Khóa HSK, Lớp học, Xếp/Chuyển lớp & E2E tests.

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
