# Tiến Độ Dự Án WebEdu — Trung Tâm TD Hán Ngữ (PROJECT_PROGRESS)

Tài liệu theo dõi trạng thái tiến độ, các mốc quan trọng và hạng mục công việc trong dự án WebEdu, đồng bộ 100% với Kế hoạch Tổng thể [`MASTER_PLAN.md`](./MASTER_PLAN.md).

---

## 📌 Tổng Quan Dự Án
* **Tên dự án**: WebEdu (Hệ thống Quản lý Lớp học & Học tập Trung tâm TD Hán Ngữ)
* **Repository**: [https://github.com/luongviettienns/WebEdu](https://github.com/luongviettienns/WebEdu)
* **Kiến trúc & Công nghệ đã chốt (`DEC-021`, `DEC-022`)**:
  - **Backend**: `backend/` — NestJS + Prisma ORM (SQL Migrations chuẩn, cấm `prisma db push`) + PostgreSQL 16+ + TypeScript Strict (`"strict": true`, cấm `any`).
  - **Frontend**: `frontend/` — Next.js (App Router) + Tailwind CSS (Phong cách xanh lá tối giản, hiển thị chuẩn chữ Hán / Pinyin).
  - **Múi giờ chuẩn**: Lưu trữ UTC, tính toán hạn nghiệp vụ theo `Asia/Ho_Chi_Minh` (GMT+7).
  - **Quy trình Git**: Git Flow chuyên nghiệp (`main`, `develop`, `feature/*`, `bugfix/*`, Conventional Commits).
* **Giai đoạn hiện tại**: **Phase 1 — Khởi tạo Nền tảng Kỹ thuật Fullstack (HOÀN THÀNH - SẴN SÀNG CHUYỂN PHASE 2)**

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
- [x] **Slice 1.2**: Thiết lập `docker-compose.yml` (PostgreSQL 16) + khởi tạo Prisma ORM (`prisma/schema.prisma`, `PrismaService` với `$connect` graceful fallback) + tệp migration SQL chuẩn `20261106155900_init_system_settings`.
- [x] **Slice 1.3**: Cấu hình Global `ValidationPipe`, `AllExceptionsFilter` (RFC 7807, stack trace che giấu ở production), CORS whitelist an toàn, prefix `/api/v1`, Swagger (`/api/docs`, bảo mật chỉ chạy non-production) và endpoint `GET /api/v1/health` (ping Prisma DB thực tế, trả về 503 degraded khi mất kết nối CSDL, kèm Unit + E2E tests).
- [x] **Slice 1.4**: Xây dựng helper múi giờ `timezone.util.ts` (`Asia/Ho_Chi_Minh`) kèm bộ Unit tests kiểm chứng mốc cuối ngày (23:59:59 GMT+7) và chặn cận dưới trước ngày học.
- [x] **Slice 1.5**: Khởi tạo `frontend/` (Next.js 16 App Router + Tailwind CSS v4), thiết lập Design System tokens (`DESIGN.md` tone xanh trúc Á Đông) và Layout / Home sạch sẽ (loại bỏ triệt để 16 mục prototype demo từ `prototype-review.md`).
- [x] **Adversarial Audit & Debate (`akit-critic`)**: Hoàn thành vòng phản biện độc lập, khắc phục 100% các khuyến nghị bảo mật & bất biến nghiệp vụ, nhận phán quyết chính thức: **VERDICT: APPROVE**.

### Phase 2: Module 01 — Tài khoản, Xác thực & Phân quyền RBAC (`FUNC-001..013`, `FUNC-078`)
- [ ] Lập Sub-Plan `docs/plans/phase-02-auth-users-rbac.md` & chốt Open Issues `AUTH-01..04`.
- [ ] **Slice 2.1**: Schema & Migration cho `User`, `StudentProfile`, `TeacherProfile`, `GuardianConsent`, `PasswordResetToken`.
- [ ] **Slice 2.2**: Học viên tự đăng ký (`FUNC-001`, $\ge 12$ tuổi) + Xác nhận Email phụ huynh cho HV $< 16$ tuổi (`FUNC-002`, `DEC-001`).
- [ ] **Slice 2.3**: Đăng nhập + Lockout 15p sau 5 lần sai (`FUNC-003`), Đăng xuất (`FUNC-004`), Khôi phục mật khẩu qua Email (`FUNC-005`, `DEC-016`).
- [ ] **Slice 2.4**: Hệ thống Guards RBAC & Đa vai trò (`FUNC-009..013`, `DEC-020`) + Bài test chống truy cập chéo IDOR.
- [ ] **Slice 2.5**: Quản lý tài khoản GV (`FUNC-006`), Hồ sơ HV & Chờ xếp lớp (`FUNC-007, 008`), Hồ sơ cá nhân & Đổi mật khẩu (`FUNC-078`), Cấu hình trung tâm (`FUNC-013`).

### Phase 3: Module 02 & 03 — Khóa học HSK & Quản lý Lớp học (`FUNC-014`, `FUNC-016..024`, `077`, `079`)
- [ ] Lập Sub-Plan `docs/plans/phase-03-courses-and-classes.md` & chốt Open Issues `COURSE-01`, `CLASS-01..02`.
- [ ] **Slice 3.1**: Danh mục Khóa học HSK1–HSK4 & Giao tiếp cơ bản (`FUNC-014`) + Tạo/Sửa Lớp học, Phân công 1 GV (`FUNC-016..018`).
- [ ] **Slice 3.2**: Schema `ClassEnrollment` + SQL Migration Partial Unique Index (`WHERE status = 'ACTIVE'`) + Thêm HV vào lớp (`FUNC-020`).
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
