# Báo Cáo Tranh Biện Đa Agent & Nghiệm Thu Phase 3 — Khóa Học HSK & Quản Lý Lớp Học (`PHASE_03_DEBATE_AND_ACCEPTANCE_REPORT`)

> [!NOTE]
> **Snapshot Lịch Sử (`feature/phase-03-courses-and-classes`, `5c83b0e..4257a54`, đã merge `develop`):** Lưu nguyên trạng biên bản nghiệm thu Phase 3. Lưu ý đính chính ID tài liệu: `DEC-027` và `DEC-028` được viết gọn trong dải `DEC-024..030` bên dưới thực chất là `DEC-006` và `DEC-007` trong [decision-log.md](../../TD_Han_Ngu_Project_Context_v1.0/docs/01-business/decision-log.md) (`DEC-027`/`028` không tồn tại). Trạng thái hiện hành toàn repo xem [PROJECT_PROGRESS.md](../../PROJECT_PROGRESS.md).

- **Nhánh phát triển**: `feature/phase-03-courses-and-classes` (`MERGE_BASE = 5c83b0e`, `HEAD = 4257a54`)
- **Phạm vi nghiệp vụ**: Module 02 (Khóa học HSK1–HSK4 & Giao tiếp cơ bản — `FUNC-014`) & Module 03 (Quản lý Lớp học, Phân công Giáo viên, Vòng đời Ghi danh Học viên, Đóng/Mở lại Lớp 7 ngày — `FUNC-016..024`, `FUNC-077`, `FUNC-079`)
- **Quyết định Kiến trúc & Nghiệp vụ áp dụng**: `DEC-005..008`, `DEC-017`, `DEC-019`, `DEC-024..030` (`COURSE-01` & `CLASS-02` đã đóng `RESOLVED`)
- **Phương pháp thực thi**: Superpowers Subagent-Driven TDD (`subagent-driven-development` + `akit-implement`) + Per-Slice Independent Review (`akit-critic`, `akit-security`) + Pre-Acceptance Multi-Agent Triad Debate (`akit-debater`, `akit-critic`, `akit-security`, `akit-judge`)

---

## 1. Tổng Quan Thực Thi 5 Vertical Slices (`3.1` $\rightarrow$ `3.5`)

| Slice | Hạng mục triển khai | Subagents thực thi | Independent Review (Per-Slice) | Commit SHA |
|---|---|---|---|---|
| **Slice 3.1** | Migration `20261110120000_phase03_courses_and_classes`, Seed 5 khóa HSK1–4 & Giao tiếp cơ bản, Backend `CoursesModule` (`GET/POST/PATCH /api/v1/courses`), Frontend `/admin/courses` | `Implementer-3.1` (`ee6119b0`) | `Reviewer-3.1` (`akit-critic` `462d69ad`): **Spec ✅, Quality ✅** | `cb9a32c` |
| **Slice 3.2** | `ClassCrudService` (Tạo/Sửa lớp, tự tính `expectedEndDate` theo ngày lịch học GMT+7, cảnh báo trùng lịch dạy `scheduleConflictWarning`, bàn giao GV kèm lịch sử `ClassTeacherAssignment`, đồng bộ `TeacherProfile.activeClassesCount`), Frontend `ClassFormModal` | `Implementer-3.2-BE` (`1c9c84c8`), `Implementer-3.2-FE` (`2aa1ace1`) | `Reviewer-3.2` (`akit-critic` `149c0cc0`): **Spec ✅, Quality ✅** | `37ea94f` |
| **Slice 3.3** | `ClassEnrollmentService` (`enrollStudents` hàng loạt, `transferStudent` đánh dấu `TRANSFERRED` trước khi tạo `ACTIVE` mới, `dropStudent`), làm giàu `pastClasses` / `classHistory`, Frontend Modals (`AddStudentsToClassModal`, `TransferStudentClassModal`, `DropStudentClassModal`, `PastClassesHistoryList`) | `Implementer-3.3-BE` (`bb66fa56`), `Implementer-3.3-FE` (`8c6e83e7`) | `Reviewer-3.3-Critic` (`c749ffb2`) & `Reviewer-3.3-Security` (`8ca0f268`): **Spec ✅, Quality ✅, Security ✅** | `bb906bc` |
| **Slice 3.4** | `ClassAccessService` (`DEC-025`), `ClassQueryService`, `ClassLifecycleService` (`completeClass` $\rightarrow$ `COMPLETED` `READ_ONLY`, giải phóng học viên thuần túy về `PENDING_CLASS`; `reopenClass` trong 7 ngày), `ClassesController` (9 routes), Frontend `/admin/classes`, `/admin/classes/[id]`, `/teacher/classes`, `/teacher/classes/[id]` | `Implementer-3.4-BE` (`eeb3ad4a`), `Implementer-3.4-FE` (`c11675ab`) | `Reviewer-3.4-Critic` (`628a49e4`) & `Reviewer-3.4-Security` (`379f15d3`): **Spec ✅, Quality ✅, Security ✅** | `07d8d93` |
| **Slice 3.5** | Bộ kiểm thử E2E trên PostgreSQL 16 thật (`backend/test/phase3-courses-classes.e2e-spec.ts`), đồng bộ kiểm kê `41` API routes (`docs/test-inventory-api.md`) & `16` UI pages (`docs/test-inventory-ui.md`), Tranh biện Đa Agent & Đợt Khắc phục (`REM-01`..`REM-06`) | `Implementer-3.5-E2E` (`fcd42a74`), `Implementer-3.5-Remediation` (`079a6c28`) | Hội đồng Triad Debate (`13e13d91`, `6e4955c7`, `fab04aba`, `848e37d6`): **100/100 APPROVE** | `87c5f61`, `4257a54` |

---

## 2. Biên Bản Hội Đồng Tranh Biện Đa Agent Trước Nghiệm Thu (Pre-Acceptance Triad Debate)

### 2.1. Các bên tham gia Hội đồng
1. **Turn 1 — Pragmatic Proposer (`akit-debater` — `13e13d91`)**: Bảo vệ kiến trúc phân rã module và chứng minh tính toàn vẹn của 5 trục nghiệp vụ (`Concurrency`, `History Preservation`, `RBAC Isolation`, `Counter Consistency`, `Anti-God-File & Clean Code`).
2. **Turn 2A — Contrarian Challenger (`akit-critic` — `6e4955c7`)**: Tấn công phản biện để tìm các kịch bản tương tranh đa bảng và biên trạng thái phức hợp.
3. **Turn 2B — Whole-Branch Security Auditor (`akit-security` — `fab04aba`)**: Kiểm toán bảo mật toàn nhánh (`5c83b0e..87c5f61`) theo OWASP API Top 10, BOLA/IDOR và leo thang đặc quyền đa vai trò.
4. **Turn 3 — Impartial Triad Judge (`akit-judge` — `848e37d6`)**: Thẩm định độc lập bản khắc phục `4257a54`, chấm điểm trên Thang 100 Điểm AKit Rubric và ra phán quyết nghiệm thu.

### 2.2. Tổng hợp 6 Phát hiện từ `akit-critic` & `akit-security` và Kết quả Khắc phục (`4257a54`)

| Mã hạng mục | Nguồn phát hiện | Mức độ | Mô tả vấn đề trước khắc phục (`87c5f61`) | Giải pháp khắc phục đã triển khai (`4257a54`) | Trạng thái |
|---|---|---|---|---|---|
| **`REM-01`** | `SEC-P3-01` & Critic 4b | **P1** | `student.mapper.ts` và `student-query.service.ts` cho phép `actorRoles.includes(Role.TEACHER)` trong `canViewClassData`. Tài khoản đa vai trò `[SUPERADMIN, TEACHER]` (không có `ADMIN`) gọi `GET /api/v1/students` hoặc `/students/:id` sẽ vượt qua `RolesGuard` nhờ `SUPERADMIN` và thấy dữ liệu học vụ nhờ `TEACHER`. | Thu hẹp `canViewClassData = isSelf \|\| actorRoles.includes(Role.ADMIN)` tại [`student.mapper.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/mappers/student.mapper.ts#L60-L85) và [`student-query.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/services/student-query.service.ts#L56-L153); khử trùng `classHistory` bằng `Set` và thêm sắp xếp phụ `{ createdAt: 'desc' }`. | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |
| **`REM-02`** | `SEC-P3-02` | **P1** | `completeClass` và `dropStudent` chuyển `User.status` từ `ACTIVE` sang `PENDING_CLASS` cho mọi học viên trong lớp mà không kiểm tra tài khoản có kiêm nhiệm vai trò khác (`[STUDENT, TEACHER]`) hay không. | Chỉ chuyển `User.status` sang `PENDING_CLASS` khi tài khoản là học viên thuần túy (`roles.length === 1 && roles[0] === Role.STUDENT`) tại [`class-enrollment.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-enrollment.service.ts#L271-L286) và [`class-lifecycle.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-lifecycle.service.ts#L68-L84); kiểm tra `roles.includes(Role.STUDENT)` khi `reopenClass`. | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |
| **`REM-03`** | `SEC-P3-03` & Critic 1, 2, 4a | **P1** | Chưa khóa dòng bảng `"classes"` `FOR UPDATE` trước bảng `"users"` trong các giao dịch ghi đa bảng; `updateClass` chưa kiểm tra `teacherAssignedFrom >= openAssignment.assignedFrom` và chưa đồng bộ `StudentProfile.assignedClass` khi đổi `Class.code`. | Thiết lập thứ tự khóa chuẩn chống deadlock (`"classes"` `FOR UPDATE` theo `id ASC` $\rightarrow$ `"users"` `FOR UPDATE` theo `id ASC`) trên toàn bộ 4 services; kiểm tra ngày bàn giao GV và đồng bộ `StudentProfile.assignedClass` khi đổi mã lớp tại [`class-crud.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-crud.service.ts#L118-L277). | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |
| **`REM-04`** | Critic Finding 3 | **P2** | Trong `reopenClass`, nếu học viên hoàn thành lớp B, ghi danh vào lớp C mới rồi sau đó rút khỏi lớp C (`DROPPED`), việc mở lại lớp B trong 7 ngày sẽ thấy học viên không có lớp `ACTIVE` và kéo ngược học viên về lớp B. | Tại [`class-lifecycle.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-lifecycle.service.ts#L186-L211), chỉ khôi phục bản ghi `COMPLETED` nếu `leftDate === actualEndDate` VÀ học viên không phát sinh bất kỳ bản ghi ghi danh nào ở lớp khác từ sau thời điểm kết thúc lớp (`!newerOtherEnrollment`). | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |
| **`REM-05`** | Critic Finding 5 | **P2** | `StudentAccessService.resolveAccessMode` và `verifyClassLearningAccess` trả về `FULL` cho `ADMIN`/`STUDENT` ngay cả khi lớp ở trạng thái `COMPLETED`/`ARCHIVED`; `ClassDetailView.tsx` gắn các modal ghi dưới `{isAdmin}` thay vì `{isFullAccess}`. | Đồng bộ trả về `'READ_ONLY'` cho mọi vai trò khi lớp `COMPLETED`/`ARCHIVED` hoặc bản ghi không còn `ACTIVE` tại [`student-access.service.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/services/student-access.service.ts#L135-L185); bọc toàn bộ modal chỉnh sửa dưới `{isFullAccess}` tại [`ClassDetailView.tsx`](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/classes/components/ClassDetailView.tsx#L321-L333). | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |
| **`REM-06`** | `SEC-P3-04` | **P3** | `EnrollStudentsDto.studentIds` và `scheduleDays` chưa có giới hạn kích thước mảng tối đa ở tầng DTO. | Bổ sung `@ArrayMaxSize(100)` cho `studentIds` và `@ArrayMaxSize(7)` cho `scheduleDays` tại [`classes.dto.ts`](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/dto/classes.dto.ts#L92-L218). | **ĐÃ KHẮC PHỤC & KIỂM CHỨNG** |

---

## 3. Kết Quả Chấm Điểm 100-Point AKit Rubric Của Thẩm Phán (`akit-judge` — `848e37d6`)

| Tiêu chí đánh giá | Trọng số | Điểm Trước Khắc Phục (`87c5f61`) | Điểm Sau Khắc Phục (`4257a54`) | Nhận xét của Thẩm phán Độc lập (`akit-judge`) |
|---|---:|---:|---:|---|
| **1. Correctness & Invariants** | 30 | 25 / 30 | **30 / 30** | Đảm bảo 100% bất biến `DEC-005..008`, `DEC-017`, `DEC-019`, `DEC-024..030`, đồng bộ `assignedClass` khi đổi mã lớp, chặn kéo ngược học viên khi mở lại lớp trong 7 ngày. |
| **2. Simplicity & Maintainability** | 25 | 24 / 25 | **25 / 25** | Phân rã sạch sẽ (`courses`, `classes/{crud,enrollment,lifecycle,query,access}`), 21/21 Backend services $\le 350$ LOC (`class-crud.service.ts` = 323 LOC), 16/16 Frontend pages $\le 250$ LOC, 0 `any`, 0 mã đặc tả nội bộ. |
| **3. Performance & Concurrency Safety** | 20 | 16 / 20 | **20 / 20** | Thứ tự khóa bi quan chuẩn mực (`"classes"` theo `id ASC` $\rightarrow$ `"users"` theo `id ASC`) kết hợp Partial Unique Index `idx_unique_student_active_enrollment`. |
| **4. Security & Multi-Tenant / RBAC Isolation** | 15 | 11 / 15 | **15 / 15** | Chặn `SUPERADMIN` thuần khỏi dữ liệu đào tạo, che dữ liệu học vụ với `[SUPERADMIN, TEACHER]` trên hồ sơ học viên, bảo vệ trạng thái tài khoản kiêm nhiệm `[STUDENT, TEACHER]`, cô lập tức thì giáo viên đã bàn giao (`403`). |
| **5. Migration & Rollback Safety** | 10 | 10 / 10 | **10 / 10** | Migration SQL bổ sung không gây downtime (`20261110120000_phase03_courses_and_classes/migration.sql`) với đầy đủ khóa ngoại, `ON DELETE RESTRICT / SET NULL / CASCADE` và chỉ mục B-Tree. |
| **TỔNG ĐIỂM** | **100** | **86 / 100** | **100 / 100** | **PHÁN QUYẾT CHÍNH THỨC: `VERDICT: APPROVE` (0 lỗi P0/P1/P2 tồn đọng)** |

---

## 4. Báo Cáo Xác Minh & Cổng Kỹ Thuật (Final Verification & Engineering Gates Report)

| Cổng kỹ thuật (Gate) | Lệnh kiểm chứng | Kết quả thực tế |
|---|---|---|
| **Typecheck (Backend + Frontend)** | `npm --prefix backend run typecheck` & `npm --prefix frontend run typecheck` | **PASS** (`0` errors) |
| **Lint (Backend OxLint + Frontend ESLint)** | `npm --prefix backend run lint` & `npm --prefix frontend run lint` | **PASS** (`0` warnings, `0` errors; `no-explicit-any: error`) |
| **Unit Test Suite (100% Pass)** | `npm --prefix backend test` | **PASS** (`22/22` suites, **`150/150` unit tests PASS**, `0` failed, `0` skipped) |
| **Real PostgreSQL 16 Integration Suite** | `npm --prefix backend run test:integration` | **PASS** (`1/1` suite, **`11/11` integration scenarios PASS** trên PostgreSQL 16 thật) |
| **Real PostgreSQL 16 E2E Suite** | `npm --prefix backend run test:e2e` | **PASS** (`6/6` suites, **`28/28` E2E scenarios PASS**, đối soát khớp `41/41` HTTP endpoints) |
| **Anti-God-File Guardrails (`check:loc`)** | `npm --prefix backend run check:loc` | **PASS** (`21/21` Backend services $\le 350$ LOC; `16/16` Frontend pages $\le 250$ LOC) |
| **Independent Review & Triad Debate** | `akit-debater` (`13e13d91`), `akit-critic` (`6e4955c7`), `akit-security` (`fab04aba`), `akit-judge` (`848e37d6`) | **PASS — `VERDICT: APPROVE` (`100 / 100` điểm)** |
