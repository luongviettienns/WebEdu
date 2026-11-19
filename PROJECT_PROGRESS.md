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
* **Giai đoạn hiện tại**: **Hoàn thành 100% toàn bộ 10 giai đoạn (`Phase 0 → Phase 9`) trên nhánh `develop`** — Sẵn sàng nghiệm thu bàn giao & chờ xác nhận phát hành sang `main` ([Báo cáo nghiệm thu cuối kỳ Phase 9](./docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md)).

---

## 🎨 Hạng Mục Đặc Biệt: Đại Tu UI/UX Chuẩn Prototype Á Đông & Dọn Dẹp Chức Năng Thừa *(HOÀN THÀNH — 100% PASS)*
- [x] **Phản biện Kiến trúc 3 Bên (Triad Debate)**: `akit-debater`, `akit-critic`, `akit-judge` ban hành và phê duyệt kế hoạch thực thi `implementation_plan.md`.
- [x] **Nền tảng Tokens, Font & Typography Á Đông**: Thiết lập CSS Variables (giấy dó, mực tàu, son triện, ngọc bích, xanh chàm, `.seal`, `.fret`, `.han`, `.num`), tích hợp `Be_Vietnam_Pro` và CJK font stack; cập nhật [`DESIGN.md`](./DESIGN.md).
- [x] **Cỗ Máy Layout Phân Rã (Anti-God-File $\le 100$ LOC)**: Phân rã `nav-links.ts`, `SidebarBrand`, `SidebarNav`, `SidebarFooter`, `PortalSidebar` (252px desktop), `MobileNavDrawer`, `PortalTopbar` (header duy nhất), `PortalShell` (skeleton shimmer chống CLS/FOIN), xóa bỏ triệt để thẻ lồng nhau gây 2 headers.
- [x] **Đại Tu Màn Hình Xác Thực 2 Cột Responsive**: `AuthArtSide` (đại tự `學` 240px, con dấu triện -7deg, Luận Ngữ), `LoginFormCard` và `StudentRegisterForm` reskin giấy dó/son triện, an toàn trên mobile 375px (`scrollWidth - innerWidth <= 2`).
- [x] **Nâng Cấp 7 Trang Portal & Xóa Landing Page Thừa**: Gỡ bỏ landing page demo marketing `/` (chuyển hướng 307 về `/login`), tích hợp Hanzi eyebrow, loại bỏ nhầm lẫn font serif tiếng Việt, nâng màu chữ đạt chuẩn WCAG AA.
- [x] **Dọn Dẹp Triệt Để Code Môi Trường Phát Triển & Cô Lập CSDL Test**: Xóa 100% mã `FUNC-xxx`/`DEC-xxx` khỏi Production Code; gỡ bỏ placeholder và chuông thông báo giả; cô lập `webedu_test` độc lập cho Playwright E2E.
- [x] **Tối Ưu Công Thái Học Form & Chống Tràn Cuộn (Above the Fold)**: Tái cấu trúc form Đăng ký thành Grid 2 cột responsive (giảm chiều cao từ 788px xuống ~480px), chuẩn hóa modal nghiệp vụ với `max-h-[90vh] overflow-y-auto`.
- [x] **Bộ Tài Liệu & Kiểm Thử E2E Toàn Diện**: Xuất bản [`docs/TEST_SCENARIOS_COMPREHENSIVE.md`](./docs/TEST_SCENARIOS_COMPREHENSIVE.md) và bộ kiểm thử [`frontend/e2e/phase2-edge-cases.spec.ts`](./frontend/e2e/phase2-edge-cases.spec.ts) (10/10 tests PASS cả Desktop và Mobile).

---

## 🧭 Lộ Trình Phát Triển Toàn Dự Án (10 Phases — 71 Mã Chức Năng)

### Phase 0: Thiết lập Môi trường, AKit & Hiến chương Kiến trúc *(HOÀN THÀNH)*
- [x] Khởi tạo Git repository (`main`), cấu hình `.gitignore` chuẩn Fullstack.
- [x] Khởi tạo tài liệu dự án ban đầu (`README.md`, `PROJECT_PROGRESS.md`).
- [x] Tạo Public Repository `WebEdu` trên GitHub (`luongviettienns/WebEdu`) và push commit đầu tiên.
- [x] Cài đặt bộ công cụ AKit v0.4.0 (30 skills, 6 specialist subagents, hooks, engineering rules, runtime CLI).
- [x] Triad Debate phê duyệt Hiến chương Kiến trúc [`architecture-decision-contract.md`](./TD_Han_Ngu_Project_Context_v1.0/docs/03-technical/architecture-decision-contract.md).
- [x] Lập Kế hoạch Tổng thể [`MASTER_PLAN.md`](./MASTER_PLAN.md), chốt `DEC-021` (Next.js + Tailwind CSS) & `DEC-022` (Git Flow).
- [x] Trích xuất Sub-Plan chi tiết cho Phase 1 tại [`docs/plans/phase-01-foundation-bootstrap.md`](./docs/plans/phase-01-foundation-bootstrap.md).

### Phase 1: Khởi tạo Nền tảng Kỹ thuật Fullstack *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Thiết lập nhánh Git Flow (`develop` & `feature/phase-01-foundation`).
- [x] **Slice 1.1**: NestJS backend (`strict: true`, cấm `any`, class-validator).
- [x] **Slice 1.2**: Docker Compose (PostgreSQL 16) + Prisma ORM (SQL migrations chuẩn, `TIMESTAMPTZ(3)` UTC).
- [x] **Slice 1.3**: Global ValidationPipe, Problem Details filter (RFC 7807/9457), CORS whitelist, Swagger, `GET /api/v1/health`.
- [x] **Slice 1.4**: Helper múi giờ `timezone.util.ts` (`Asia/Ho_Chi_Minh` GMT+7) kèm unit tests.
- [x] **Slice 1.5**: Frontend Next.js App Router + Tailwind CSS, design tokens Á Đông, API client đồng bộ RFC 7807.
- [x] **Slice 1.6 & Audit**: Bật luật OxLint cấm `any` (0 errors); vượt qua phản biện độc lập của `akit-critic` (`VERDICT: APPROVE`).

### Phase 2: Module 01 — Tài khoản, Xác thực & Phân quyền RBAC (`FUNC-001..013, 078`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-02-auth-users-rbac.md`](./docs/plans/phase-02-auth-users-rbac.md) & chốt `DEC-023` (email/phone unique), `DEC-024` (cô lập lịch sử HV), `DEC-025` (xem lớp cũ GV), `DEC-026` (quyền học thuật Admin).
- [x] **Slice 2.1**: Schema Migration `User`, `StudentProfile`, `TeacherProfile`, `GuardianConsent`, `PasswordResetToken`, `SystemAuditLog`.
- [x] **Slice 2.2**: Học viên tự đăng ký (`FUNC-001`) + Xác nhận Phụ huynh cho HV 12–15 tuổi (`FUNC-002`, `DEC-001`).
- [x] **Slice 2.3**: Đăng nhập Email + Khóa tạm 15p sau 5 lần sai + Cookie `HttpOnly` + CSRF (`FUNC-003`), Đăng xuất (`FUNC-004`), Khôi phục mật khẩu SHA-256 (`FUNC-005`, `DEC-016`).
- [x] **Slice 2.4**: RBAC Guards & Đa vai trò dương tính (`FUNC-009..013`), bảo vệ Superadmin cuối cùng (`SEC-07`) và chống leo thang đặc quyền (`SEC-08`).
- [x] **Slice 2.5**: Quản lý tài khoản GV (`FUNC-006`), Hồ sơ HV & Hàng đợi chờ lớp (`FUNC-007, 008`), Hồ sơ cá nhân (`FUNC-078`), Cấu hình & Upload Logo (`FUNC-013`), 15/15 portal routes.
- [x] **Slice 2.6 – 2.8**: Remediation CSDL thật, SmtpEmailProvider, Cookie-Only Auth, phân rã Anti-God-File; nghiệm thu qua [`PHASE_02_ACCEPTANCE_REPORT.md`](./docs/reports/PHASE_02_ACCEPTANCE_REPORT.md), PR #1 & PR #2.
- [x] **Slice 2.9 – 2.11**: Hoàn thiện Resend SMTP (`test:mail`), Zero `FUNC-xxx` trong Production code, cô lập `webedu_test`.
- [x] **Slice 2.12**: Hardening toàn diện: Kiểm kê 28 API ([`docs/test-inventory-api.md`](./docs/test-inventory-api.md)) & 12 UI ([`docs/test-inventory-ui.md`](./docs/test-inventory-ui.md)), Stryker mutation testing, Axe WCAG AA; báo cáo nghiệm thu [`docs/test-report-phase-02.md`](./docs/test-report-phase-02.md).
- [x] **Slice 2.13**: Khắc phục 100% audit RBAC, đồng bộ phiên đa tab `usePortalSession.ts`, cô lập dữ liệu Superadmin thuần.
- [x] **Slice 2.14**: Kiểm chứng trực quan Chromium thật 4 vai trò, xuất bản [`live_cross_user_test_report.md`](./docs/reports/live_cross_user_test_report.md).
- [x] **Slice 2.15**: Tối ưu đăng ký <16 tuổi (1 Email duy nhất, Checkbox cam kết, OTP 6 số qua SMTP, bảo tồn lịch sử giám hộ), hợp nhất **PR #5** vào `develop`.

### Phase 3: Module 02 & 03 — Khóa học HSK & Quản lý Lớp học (`FUNC-014, 016..024, 077, 079`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] **Chốt Quyết định Nghiệp vụ**: `DEC-006` (1 GV chính/lớp), `DEC-007` (1 lớp active/HV), `DEC-029` (cấu hình số buổi mặc định), `DEC-030` (đóng/lưu trữ `READ_ONLY` & mở lại trong 7 ngày).
- [x] Lập Sub-Plan [`docs/plans/phase-03-courses-and-classes.md`](./docs/plans/phase-03-courses-and-classes.md).
- [x] **Slice 3.1**: Schema Migration & Quản lý Khóa học HSK1–HSK4, Giao tiếp cơ bản (`FUNC-014`).
- [x] **Slice 3.2**: Tạo/Sửa Lớp học, tự tính `expectedEndDate`, cảnh báo trùng lịch dạy & Phân công Giáo viên (`FUNC-016..018`).
- [x] **Slice 3.3**: Vòng đời Ghi danh: Thêm HV (`FUNC-020`), Chuyển lớp (`FUNC-022`), Rút học viên (`FUNC-077`), Lịch sử lớp đã học (`FUNC-023`).
- [x] **Slice 3.4**: Danh sách/Chi tiết lớp theo phân quyền (`FUNC-024`, `DEC-025`), Đóng/Lưu trữ lớp & Mở lại trong 7 ngày (`FUNC-079`, `DEC-030`).
- [x] **Slice 3.5 & Hội Đồng Tranh Biện**: Kiểm kê 41 API Endpoints, 16 Trang UI; Hội đồng đa agent (`akit-judge`: 100/100 `APPROVE`), xuất bản [`docs/reports/PHASE_03_DEBATE_AND_ACCEPTANCE_REPORT.md`](./docs/reports/PHASE_03_DEBATE_AND_ACCEPTANCE_REPORT.md).
- [x] **Slice 3.6 & Merge `develop`**: Rà soát nghiệp vụ (chặn ngày tương lai, kiểm tra trùng lịch `hasActivePeriodOverlap`), phân quyền capability-based `class-permissions.ts`, đồng bộ giao diện Drawer trượt Prototype Á Đông, merge sạch vào `develop` (commit `e6f36e6`).

### Tech Debt & Security Hardening Backlog *(HOÀN THÀNH — 100% GATES PASS)*
- [x] **Tách trách nhiệm Backend & Guardrails LOC**: Rút gọn `jwt-auth.guard.ts` (68 LOC), tách service trích xuất token/CSRF/phiên; mở rộng `scripts/check-loc.js` kiểm soát 6 nhóm tệp; loại bỏ toàn bộ mock-bending.
- [x] **Phân rã Frontend & Preview Schedule**: Tách nhỏ các modal lớn (`StudentDetailModal`, `PersonalInfoSection`), triển khai `POST /api/v1/classes/preview-schedule` làm single source of truth cho lịch học.
- [x] **Siết Bảo Mật Toàn Ứng Dụng**: Áp dụng `APP_GUARD` toàn cục (`ThrottlerGuard`, `JwtAuthGuard`, `RolesGuard`), bật `helmet`, giới hạn payload JSON, Next.js `proxy.ts` kiểm tra phiên trước khi render.
- [x] **Toàn Vẹn Dữ Liệu PostgreSQL & Triggers**: Loại bỏ cửa hậu OTP, atomic update đếm thử, chặn CPU DoS bcrypt, bổ sung 5 ràng buộc `CHECK`, DB triggers đồng bộ trạng thái giáo viên và bất biến cam kết giám hộ.

### Phase 4: Module 04 & 05 — Lịch học, Buổi học & Điểm danh (`FUNC-026..032, 034..037`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-04-schedule-and-attendance.md`](./docs/plans/phase-04-schedule-and-attendance.md) & chốt `SCHED-01` (`DEC-031`), `ATT-01` (`DEC-032, 033`).
- [x] **Slice 4.1**: Khai báo lịch định kỳ & Sinh tự động các buổi học (`FUNC-026, 027`).
- [x] **Slice 4.2**: Cập nhật lịch (`FUNC-029`), Hủy buổi (`FUNC-030`), Tạo buổi bù (`FUNC-031`), Nhật ký đổi lịch (`FUNC-032`).
- [x] **Slice 4.3**: Điểm danh từng buổi 3 trạng thái Có mặt / Vắng có phép / Vắng không phép (`FUNC-034, 035`).
- [x] **Slice 4.4**: Sửa điểm danh giới hạn 2 ngày GMT+7 cho GV, Admin Override Audit Log (`FUNC-037`), Cảnh báo nghỉ $\ge 30\%$ (`FUNC-036`).
- [x] **Slice 4.5**: Giao diện Calendar Lịch học & Điểm danh trực tiếp trên buổi học (loại bỏ menu rời theo Cleanup #9).
- [x] **Audit Remediation & Merge `develop`**: Khóa `FOR UPDATE` lớp trước khi đọc buổi học, CSS Paper-Ink đồng bộ, merge vào `develop` qua PR #7 (commit `ef68198`).

### Phase 5: Module 06 (Phần 1) — Ngân hàng Câu hỏi HSK & Import Đề Word/PDF (`FUNC-039..050`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-05-question-bank-and-import.md`](./docs/plans/phase-05-question-bank-and-import.md).
- [x] **Slice 5.1**: Schema `Assessment`, `Question`, `MediaAsset`, `QuestionMedia` + `MediaUploadPolicy` kiểm tra magic bytes (`FUNC-049, 050`).
- [x] **Slice 5.2**: CRUD Bài tập/Đề kiểm tra (`FUNC-039`) & Trình biên tập 7 dạng câu hỏi HSK (`FUNC-043..048`), DTO bảo mật Zero-Leak đáp án.
- [x] **Slice 5.3**: Pipeline chuyển đổi đề Word/PDF sang câu hỏi tương tác (`FUNC-040, 041`) + Màn hình GV duyệt đề `needsReview` (`FUNC-042`).
- [x] **Slice 5.4**: Giao diện `/teacher/assessments` & soạn thảo đề thi.
- [x] **Audit Remediation Waves 1–3**: Khóa bi quan `$transaction`, bảo vệ magic bytes ảnh $\le 5\text{MB}$, đồng bộ menu đa vai trò, gắn `requestId` RFC 7807, mount modal timeout phiên `IdleTimeoutWarningModal`, bảo vệ đổi email OTP cho học viên $<16$ tuổi.
- [x] **Follow-up Parser Import & Tối Ưu UX**: Hỗ trợ 5 dạng câu chữ, bảng đáp án cuối đề, file mẫu chính thức `mau-de-import.docx`; khung xem đề gốc song song `OriginalPaperPreview.tsx`; hướng dẫn gõ file Word trực quan cho người dùng non-tech.

### Phase 6: Module 06 (Phần 2) — Giao bài, Làm bài, Autosave & Nộp bài 1 lượt (`FUNC-051..054`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-06-assignment-delivery-and-submission.md`](./docs/plans/phase-06-assignment-delivery-and-submission.md) & chốt `ASSIGN-02..03` (`DEC-034, 035`).
- [x] **Slice 6.1**: Schema `ClassAssignment`, `Submission`, `SubmissionAnswer`, `SubmissionReopenLog` & `assignedClassCount`.
- [x] **Slice 6.2**: Giao bài cho lớp (`FUNC-051`) & Danh sách bài được giao (`FUNC-052`).
- [x] **Slice 6.3**: Lưu nháp đang làm autosave (`FUNC-053`), Nộp bài 1 lượt & GV mở lại lượt nộp (`FUNC-054`).
- [x] **Slice 6.4**: Giao diện Học viên làm bài tương tác trực quan & Xem lại bài nộp.
- [x] **Audit Remediation Rounds 1 & 2**: Đồng hồ thi neo wall-clock chống tua giờ, đếm lượt nghe audio chống gian lận, xáo trộn đáp án bảo mật HMAC-SHA256, gia hạn từng học viên qua `due_at_override`, rate limit nộp bài/autosave.
- [x] **Tích hợp `develop`**: Vượt qua 100% cổng kiểm thử (Unit 450/450, PG integration 16/16, HTTP E2E 56/56, Playwright 78/78), hợp nhất vào `develop`.

### Phase 7: Module 07 — Chấm điểm Rule-based, AI Gợi ý Tự luận & Công bố 2 bước (`FUNC-056..064`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-07-grading-and-publication.md`](./docs/plans/phase-07-grading-and-publication.md) & chốt `GRADE-01..02` (`DEC-036..038`).
- [x] **Slice 7.1**: Rule-based Auto-Grading Engine trắc nghiệm/nghe/nối/sắp xếp (`FUNC-056`, `DEC-037`).
- [x] **Slice 7.2**: Dynamic Multi-Provider AI Config (OpenAI/Gemini/DeepSeek) & Chấm tự luận On-Demand (`FUNC-057`, `DEC-036`) kèm chốt chặn bảo mật Zero-PII và IP Pinning.
- [x] **Slice 7.3**: Giáo viên chấm tự luận (`FUNC-058`) & Theo dõi danh sách Đã nộp / Quá hạn chưa nộp (`FUNC-062`, `DEC-038`).
- [x] **Slice 7.4**: Quy trình 2 bước Xác nhận điểm (`GRADED` - `FUNC-059`) $\rightarrow$ Công bố điểm (`RETURNED` - `FUNC-060`) + Cổng Zero-Leak (`FUNC-063`) + Chỉnh sửa điểm & `GradeAuditLog` (`FUNC-061, 064`).
- [x] **Slice 7.5**: Giao diện Superadmin cấu hình AI (`/superadmin/settings`) & Giao diện GV/Admin chấm bài, ghi 0 điểm quá hạn, xác nhận 2 bước (`/teacher/assignments/[assignmentId]/grading`).
- [x] **Slice 7.6**: Giao diện Học viên xem kết quả sau công bố (`/student/assignments/[id]`), Negative Security Test chống lộ điểm trước khi công bố.
- [x] **Kiểm Toán & Khắc Phục Hoàn Thiện**: Hỗ trợ Batch AI tối đa 20 bài, bảo vệ PII NFKC tiếng Việt, khóa dòng `classes -> assignments -> submissions FOR UPDATE` chống race condition, chuẩn hóa thang điểm bước 0.25, tối ưu bảng đề thi `AssessmentList.tsx` hiển thị vừa vặn 1366px, tách vùng cuộn Topbar mượt mà và nâng cấp hiệu ứng lá trúc rơi Canvas (`bamboo-leaf`).
- [x] **Kiểm Chứng Toàn Diện**: Unit 526/526 PASS, Real PostgreSQL E2E 58/58 PASS, Frontend Unit 27/27 PASS, `next build` 27/27 static pages PASS, Playwright E2E PASS.

---

### Phase 8: Module 08 & 09 — Kiểm tra Tổng kết & Theo dõi Tiến độ (`FUNC-065, 068..075`) *(HOÀN THÀNH — 100% GATES PASS)*
- [x] Lập Sub-Plan [`docs/plans/phase-08-exams-and-progress-tracking.md`](./docs/plans/phase-08-exams-and-progress-tracking.md) & chốt `EXAM-01` (`DEC-039`), `ATT-02` (`DEC-040`), `DEC-041`.
- [x] **Slice 8.1**: Cấu hình động công thức điểm tổng kết trên từng Khóa học HSK (`DEC-039`, `CHECK` SQL, `CourseFormModal`/`CourseTable`) & Bổ sung tiến độ buổi học / buổi tiếp theo cho Lớp học (`FUNC-071, 072`, `ClassSummary`).
- [x] **Slice 8.2**: Policy tính điểm thuần hàm (`grade-calculation.policy.ts`) & `ProgressModule` (`StudentProgressService`, `ClassProgressService`, `AdminOverviewService` — `FUNC-069, 070, 073..075`), đồng bộ kiểm kê **100 HTTP Endpoints** ([`docs/test-inventory-api.md`](./docs/test-inventory-api.md)).
- [x] **Slice 8.3**: Giao diện cấu hình tỷ trọng khóa học (`/admin/courses`), Preset biểu mẫu 4 loại đề (`FUNC-068`), Tab `"Tiến độ & Kết quả"` trong Chi tiết lớp (`FUNC-074`) & khắc phục lỗi cutoff trùng lịch GV cùng ngày trong `class-session-lifecycle.util.ts`.
- [x] **Slice 8.4**: Nối số liệu thật trên `/student/overview` & Xây dựng trang `/student/results` (`FUNC-069, 070, 073`) kèm chốt chặn link xem lại cho lớp `TRANSFERRED`/`DROPPED`.
- [x] **Slice 8.5 & Kiểm chứng**: Dashboard `/admin/overview` (`FUNC-075`), đồng bộ **26 UI Routes** ([`docs/test-inventory-ui.md`](./docs/test-inventory-ui.md)), kiểm toán độc lập qua TDD Superpowers Subagent + Security/Critic Audit (`Backend Unit 566/566 PASS · Coverage 90.96% Stmts / 81.46% Branch / 92.31% Lines, PG Integration 18/18 PASS, Real-PG E2E 70/70 PASS, Frontend Unit 37/37 PASS, next build 29/29 PASS, Playwright Toàn Hệ Thống 11/11 files 100/100 PASS + Axe WCAG AA, check-loc 246/246 PASS`).
- [x] **Kiểm Thử Trình Duyệt Toàn Diện 9 Module (`M1 → M9`) & Đồng Bộ Đa Tác Nhân (`SYNC-01 → SYNC-14`)**: Quét `26/26` routes trên Dev (`1440×900` & `375×812` + `@axe-core/playwright`), phát hiện **30 lỗi** (`1 Critical`, `6 High`, `19 Medium`, `4 Low`) cần xử lý trong Phase 9 / Bugfix tại [`docs/reports/UI_BROWSER_BUG_REPORT.md`](./docs/reports/UI_BROWSER_BUG_REPORT.md).
- [x] **Khắc Phục Toàn Bộ 30 Lỗi Kiểm Thử Trình Duyệt (`BUG-M1-01` → `BUG-M9-03`)**: Sửa triệt để toàn bộ 30 lỗi `M1–M9` (auth landmarks/`<h1>`, SPA relogin logout & idle-timeout, `no-store` + SPA brand sync kể cả `/student/overview` + AI preset switch, xóa mã `FUNC-057/061` & `DEC-038`, đếm lớp GV + `AssignInitialClassModal`, `SUPERADMIN` `0` lỗi `403`, lọc `DROPPED` khỏi `/student/schedule`, bộ lọc buổi học & tự làm mới sau điểm danh, khử trùng option PDF + `LISTENING` MCQ + auto-match `IMAGE_BASED` `mediaId` + preview học viên sạch + giữ thứ tự option + cảnh báo rời trang + responsive mobile/1366px + quyền sửa/duyệt đề, badge buổi học bài tập, lọc trạng thái tracker, bảo toàn cờ `flaggedIds` sau `Lưu nháp`/F5, nút Gợi ý AI hàng loạt Zero-PII ưu tiên bài chưa có nháp, validation & sửa triệt để `<audio>`/`<img>` trong `mode=review` + chấm điểm, đồng thời sửa lỗi timezone `phase07-grading-and-publication.e2e-spec.ts`). Kiểm chứng toàn phần sau lần sửa cuối: `check:loc` (`270/270` PASS), Backend `lint` (`0` lỗi) + `build` PASS, Backend Unit+Cov (`57/57` files · `579/579` PASS · `90.42%` Stmts / `81.31%` Branch / `92.1%` Funcs / `91.97%` Lines), PG Integration (`20/20` PASS), Backend HTTP E2E (`12/12` files · `75/75` PASS), Frontend `typecheck` + `lint` + `build` (`29/29` routes) PASS, Frontend Unit (`44/44` PASS), Playwright Toàn Hệ Thống (`13/13` specs · `107` PASS / `3` skip desktop-only + Axe WCAG AA).

---

### Phase 9: Module 10 & Production Hardening — Thông báo In-App, Dọn Prototype & Nghiệm thu UAT (`FUNC-080`) *(HOÀN THÀNH — 100% GATES PASS — MERGED `develop`)*
- [x] Lập Sub-Plan [`docs/plans/phase-09-notifications-and-hardening.md`](./docs/plans/phase-09-notifications-and-hardening.md) & chốt `NOTIF-01` (`DEC-042`), `PROTO-01` (`DEC-043`).
- [x] **Task 9.1**: Schema `Notification`, SQL Migration (`20261119235000_phase09_notifications`), `NotificationsModule` Core API (`100 -> 104`), nhắc hạn 24h & dọn lưu trữ tự động 90d/180d (`FUNC-080`).
- [x] **Task 9.2**: Gắn 14 sự kiện thông báo liên module (`STUDENT` / `TEACHER` / `ADMIN`, Zero-Leak `GRADED` vs `RETURNED`, không self-notify) & Real-PG E2E (`phase09-notifications.e2e-spec.ts`).
- [x] **Task 9.3**: Giao diện Popover chuông thông báo In-App trên `PortalTopbar` (tải 20 mục + `Tải thêm`, polling 60s khi tab hiển thị + focus, ẩn với thuần `SUPERADMIN`, responsive Desktop/Mobile).
- [x] **Task 9.4**: Kiểm toán & xóa 100% 16 hạng mục `prototype-review.md` (xóa hẳn Dev Quick-Login khỏi `LoginFormCard.tsx`/`login/page.tsx` & 10 mã nội bộ còn sót khỏi non-test `backend/src`, `frontend/src` — `git grep` = 0).
- [x] **Task 9.5, Kiểm toán Bảo mật & Hợp nhất `develop`**: Khắc phục triệt để toàn bộ phát hiện kiểm toán độc lập (commit `b5a5b00`: `@SkipActivityTouch()` trên `/unread-count` bảo toàn Idle Timeout 60p + tạm dừng polling khi cảnh báo mở, sửa race `useNotifications`, migration `20261120003000_phase09_notification_link_check_hardening` chặn `/\` + control chars, `due_soon` hỗ trợ bài mở lại); xác nhận 100% sau commit cuối (`check-loc` **281/281**, Backend Unit+Cov **61/61 · 591/591 PASS · 90.67% Lines / 80.6% Branches**, PG Integration **20/20 PASS**, Backend E2E **14/14 · 80/80 PASS** gồm **5/5 Architecture Invariants**, Frontend Unit **47/47 PASS**, `next build` **29/29**, Full Playwright E2E **111 passed / 3 pre-existing desktop-only skips / 0 failed** + Axe WCAG AA) và xuất bản [`docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md`](./docs/reports/PHASE_09_FINAL_ACCEPTANCE_REPORT.md).
- [x] **Kiểm Thử Trực Tiếp UI Trên Chromium (`playwright-cli`) & `ponytail-audit` Toàn Dự Án Trước Deploy**: Thực thi kế hoạch [`docs/plans/pre-deploy-live-ui-and-ponytail-audit-plan.md`](./docs/plans/pre-deploy-live-ui-and-ponytail-audit-plan.md) trên Chromium thật xuyên suốt 7 chặng nghiệp vụ (`Stages 1 → 7`), 26 UI routes, 6 vai trò, đối chiếu chéo 4 chiều (`100% KHỚP`), quét responsive Desktop (`1440×900`) & Mobile (`375×812`) đạt `0px` tràn ngang, kết hợp `ponytail-audit` toàn diện (Frontend + Backend + Scale 200+ học viên thi đồng thời + CI/Deploy); xuất bản báo cáo tổng hợp [`docs/reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md`](./docs/reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md) (ghi nhận 11 mục `Must fix`, 16 mục `Should fix`, 5 mục `Nice to have`, tiềm năng rút gọn `-420 LOC`, giữ nguyên mã nguồn ứng dụng Read-Only chờ đợt Fix tiếp theo).
