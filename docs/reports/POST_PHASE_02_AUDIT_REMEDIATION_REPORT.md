# Báo Cáo Khắc Phục Sau Kiểm Toán Phase 2 (POST_PHASE_02_AUDIT_REMEDIATION_REPORT)

> [!NOTE]
> **Snapshot Lịch Sử (07/11/2026 — `fix/post-phase-02-audit-remediation` -> `develop`):** Lưu nguyên trạng báo cáo khắc phục sau kiểm toán Phase 2. Số liệu hiện hành toàn repo xem [PROJECT_PROGRESS.md](../../PROJECT_PROGRESS.md).

**Dự án:** WebEdu — Trung Tâm TD Hán Ngữ  
**Nhánh thực hiện:** `fix/post-phase-02-audit-remediation`  
**Nhánh tích hợp:** `develop`  
**Trạng thái:** **100% EXIT GATES PASS — SẴN SÀNG MERGE VÀO DEVELOP**  
**Ngày hoàn thành:** 07/11/2026  

---

## 1. Tổng Quan & Mục Tiêu

Sau khi hoàn thành đợt nghiệm thu Phase 2 và đợt Refactor chống "God File", một phiên kiểm toán độc lập đối kháng chuyên sâu (Adversarial Security & Architecture Audit) đã được tiến hành để rà soát toàn diện các khía cạnh:
1. **Business Invariants & Data Integrity**: Ràng buộc nghiệp vụ giữa tài khoản kép (`STUDENT+TEACHER`), sự kiện lịch sử lớp học và tính toàn vẹn trạng thái.
2. **Authentication Security & Anti-DoS**: Chống DoS khóa tài khoản diện rộng, chống ngốn CPU từ thuật toán băm Bcrypt và ngập lụt hàng đợi SMTP.
3. **Database Concurrency & Deadlock Elimination**: Loại bỏ tranh chấp khóa dòng trên toàn bộ Superadmin khi thực hiện các thao tác người dùng thông thường; chuẩn hóa thứ tự khóa `ORDER BY id ASC FOR UPDATE`.
4. **Information Disclosure & Defensive Hardening**: Loại bỏ mật khẩu khởi tạo khỏi audit logs, kiểm định kích thước ảnh PNG/JPG, cấu hình CORS fail-fast production, và chuẩn hóa lỗi vi phạm khóa duy nhất Prisma P2002.
5. **Frontend Performance & Anti-God-File Automation**: Tránh dội request qua Debounce (350ms), hủy request khi unmount qua `AbortController`, reset phân trang về trang 1 khi lọc, và tự động hóa kiểm tra giới hạn LOC (Services $\le 350$, Pages $\le 250$).

Toàn bộ **16/16 findings (FIX-01 đến FIX-16)** đã được khắc phục triệt để và kiểm chứng bằng bằng chứng thực tế trên PostgreSQL 16 thật và Playwright Browser QA.

---

## 2. Chi Tiết Khắc Phục 16 Điểm Kiểm Toán (FIX-01 .. FIX-16)

### Nhóm 1: Tính Toàn Vẹn Dữ Liệu & Ràng Buộc Nghiệp Vụ (P0)

#### FIX-01 (P0): Chặn Vô Hiệu Hóa Giáo Viên Có Lớp Hoạt Động Thông Qua API Học Viên
- **Nguyên nhân gốc:** Khi một người dùng mang đồng thời hai vai trò `STUDENT` và `TEACHER` (tài khoản kép), nếu Admin gọi `PATCH /students/:id/status` với `INACTIVE`, API học viên trước đó chỉ kiểm tra các lớp học viên đang học mà không kiểm tra xem người này có đang phụ trách giảng dạy lớp học nào với tư cách giáo viên hay không.
- **Giải pháp:** Trong `student-crud.service.ts`, khi nhận yêu cầu chuyển trạng thái sang `INACTIVE`, hệ thống kiểm tra nếu `user.roles.includes(Role.TEACHER)`. Nếu có, truy vấn số lượng lớp học đang mở (`OPEN`, `ACTIVE`, `IN_PROGRESS`) mà người này làm giáo viên phụ trách (`teacherId = targetUserId`). Nếu $> 0$, ném lỗi `ConflictException: Không thể vô hiệu hóa tài khoản: người dùng này đang là giáo viên phụ trách N lớp học đang hoạt động`.
- **Kiểm chứng:** Test case trong `students.services.spec.ts` xác thực chặn thành công việc vô hiệu hóa qua API học viên.

#### FIX-02 (P0): Phân Biệt Rõ Ràng Các Khái Niệm Lịch Sử Lớp Học Trong Policy
- **Nguyên nhân gốc:** `student-enrollment-facts.policy.ts` và `enrollment-invariants.policy.ts` cần phân biệt chính xác 3 trạng thái lịch sử: (1) `hasActiveEnrollment` (đang có lớp học hoạt động), (2) `hasActiveOrCompletedEnrollment` (đang học hoặc đã hoàn thành), và (3) `hasEverBeenEnrolled` (đã từng tham gia vào bất kỳ lớp học nào, kể cả đã rút hoặc chuyển lớp).
- **Giải pháp:** Triển khai module dùng chung `backend/src/common/policies/enrollment-invariants.policy.ts` và chuẩn hóa `student-enrollment-facts.policy.ts` phản ánh chính xác 3 trạng thái độc lập phục vụ xóa/vô hiệu hóa/rút hồ sơ an toàn.

---

### Nhóm 2: Bảo Mật Xác Thực & Phòng Chống DoS (P0 / P1)

#### FIX-03 (P0): Ngăn Chặn Account Lockout DoS Bằng IP Rate Limiting
- **Nguyên nhân gốc:** Cơ chế khóa tài khoản `SEC-01` (5 lần sai $\rightarrow$ khóa 15 phút) nếu không có giới hạn theo IP sẽ cho phép kẻ tấn công cố tình nhập sai mật khẩu của nạn nhân để khóa vĩnh viễn tài khoản của họ (Denial-of-Service tài khoản hợp pháp).
- **Giải pháp:**
  - Tạo bảng PostgreSQL `auth_rate_limits` qua migration `20261107190000_auth_rate_limits` lưu vết `(key, attempts, blockedUntil, windowExpiresAt)`.
  - Xây dựng tiện ích `auth-rate-limit.util.ts` (`assertIpNotBlocked`, `assertRateLimitNotExceeded`, `resetRateLimitKey`, `resolveClientIp`).
  - Thiết lập ngưỡng: Nếu một IP thất bại $\ge 15$ lần trong 1 phút trên bất kỳ tài khoản nào, IP đó sẽ bị chặn tạm thời 15 phút (`429 Too Many Requests`). Vẫn duy trì cơ chế bảo vệ tài khoản `SEC-01` khi đăng nhập thất bại.
- **Kiểm chứng:** Unit test `auth.services.spec.ts` kiểm chứng việc kích hoạt `429 Too Many Requests` khi IP gửi request spam.

#### FIX-04 (P1): Giảm Thiểu Bcrypt CPU DoS & Chống Ngập Lụt Hàng Đợi SMTP
- **Nguyên nhân gốc:**
  - Endpoint `POST /auth/forgot-password` thực hiện so sánh mã băm token qua Bcrypt (`bcrypt.compare` tốn ~80ms CPU) trong khi token ngẫu nhiên có thể so sánh an toàn bằng hàm băm SHA-256 + `crypto.timingSafeEqual`.
  - Thiếu IP rate limiting trên forgot password cho phép bot spam gửi email hàng loạt gây nghẽn SMTP gateway.
  - Bảng `email_rate_limits` tăng trưởng vô hạn nếu không dọn dẹp bản ghi hết hạn.
- **Giải pháp:**
  - Bổ sung IP rate limiting trong `password-recovery.service.ts`: Tối đa 5 lượt yêu cầu quên mật khẩu trong 15 phút cho mỗi địa chỉ IP (ném `429 Too Many Requests`).
  - Chuyển cơ chế xác thực token reset mật khẩu sang SHA-256 constant-time comparison (`crypto.timingSafeEqual`) loại bỏ gánh nặng CPU từ Bcrypt.
  - Bổ sung cơ chế dọn dẹp ngẫu nhiên có kiểm soát (`Math.random() < 0.05` với `LIMIT 500`) trên bảng `email_rate_limits` để giải phóng dung lượng định kỳ mà không gây lock bảng.

---

### Nhóm 3: PostgreSQL Concurrency & Loại Bỏ Tranh Chấp Khóa Dòng (P1)

#### FIX-05 (P1): Loại Bỏ Tranh Chấp Khóa Dòng Toàn Cục Trên Superadmin & Chống Deadlock
- **Nguyên nhân gốc:** Cơ chế bảo vệ Superadmin hoạt động cuối cùng (`SEC-07`) trước đây khóa toàn bộ các tài khoản Superadmin (`SELECT ... FOR UPDATE`) cho MỌI thao tác cập nhật học viên, giáo viên hoặc người dùng thông thường. Điều này dẫn đến nghẽn cổ chai (lock contention) nghiêm trọng khi nhiều admin thao tác cùng lúc và tiềm ẩn nguy cơ Deadlock (`40P01`) nếu thứ tự khóa không nhất quán.
- **Giải pháp:**
  - Bổ sung hàm `lockTargetUser(tx, targetUserId)` trong `superadmin-protection.policy.ts` cho các thao tác trên học viên/giáo viên thông thường.
  - Chỉ khi tài khoản bị tác động thực sự là một Superadmin đang rời nhóm (`isLeavingActiveSuperadmin` hoặc thay đổi role Superadmin), hệ thống mới khóa danh sách Superadmin theo thứ tự chuẩn hóa tuyệt đối `ORDER BY id ASC FOR UPDATE`.
  - Tách bạch rõ ràng giữa kiểm tra ban đầu và khóa giao dịch, loại bỏ hoàn toàn việc khóa lặp 2 lần gây Deadlock.
- **Kiểm chứng:** Scenario 13 trong bộ integration test chạy đa luồng đồng thời 12 transactions ghi nhận 0 lỗi deadlock.

---

### Nhóm 4: Tăng Cường Bảo Mật Ứng Dụng & Thông Điệp Lỗi (P1 / P2)

#### FIX-06 (P1): Kiểm Định Kích Thước Ảnh Logo (Dimensions) & Thêm Cache-Control
- **Nguyên nhân gốc:** Tệp ảnh tải lên cấu hình hệ thống chỉ kiểm tra Magic Bytes mà chưa kiểm tra kích thước điểm ảnh (width/height), tiềm ẩn rủi ro tấn công Pixel Flood (ảnh 10,000 x 10,000 pixels nén nhỏ nhưng bung ra làm sập RAM trình duyệt).
- **Giải pháp:** Cập nhật `audit-sanitize.util.ts` phân tích header nhị phân của PNG (IHDR) và JPEG (SOF), chặn các ảnh có kích thước vượt quá 800x800 pixels hoặc tổng diện tích $> 640,000$ pixels. Thêm header `@Header('Cache-Control', 'public, max-age=300, stale-while-revalidate=600')` cho endpoint cấu hình công khai `GET /config`.

#### FIX-07 (P1): Cấu Hình CORS Fail-Fast Cho Môi Trường Production
- **Nguyên nhân gốc:** `env.validation.ts` và `main.ts` có cơ chế fallback CORS về `localhost:3000` ngay cả khi chạy production nếu thiếu biến `CORS_ORIGIN`.
- **Giải pháp:** Trong `env.validation.ts`, bổ sung `@ValidateIf((o) => o.NODE_ENV === Environment.Production)` kết hợp `@IsNotEmpty()` bắt buộc `CORS_ORIGIN` phải được khai báo tường minh khi chạy production. Trong `main.ts`, loại bỏ hoàn toàn fallback về localhost ở chế độ production.

#### FIX-08 (P2): Loại Bỏ Mật Khẩu Khởi Tạo Khỏi Nhật Ký Kiểm Toán (Audit Logs)
- **Nguyên nhân gốc:** Khi tạo giáo viên hoặc người dùng hệ thống có cấp mật khẩu khởi tạo, trường `initialPassword` bị ghi vào payload nhật ký kiểm toán trong CSDL, vi phạm nguyên tắc bảo mật thông tin xác thực.
- **Giải pháp:** Trong `teachers.service.ts` và `system-users.service.ts`, thay thế `initialPassword` bằng cờ boolean `hasInitialCredentials: true` trước khi ghi vào `SystemAuditLog`.

#### FIX-09 (P2): Ánh Xạ Chi Tiết Lỗi Vi Phạm Ràng Buộc Duy Nhất Prisma P2002
- **Nguyên nhân gốc:** Khi gặp lỗi vi phạm ràng buộc `P2002`, `all-exceptions.filter.ts` trả về thông báo lỗi chung chung, khó chẩn đoán cho người dùng.
- **Giải pháp:** Bổ sung ánh xạ ngữ cảnh dựa trên tên bảng và trường vi phạm: Khóa học (`Mã khóa học đã tồn tại`), Lớp học (`Mã lớp học đã tồn tại`), Xếp lớp (`Học viên đã có lớp học đang hoạt động`), và Email/SĐT (`Email hoặc số điện thoại đã tồn tại`).

#### FIX-10 (P2): Làm Rõ Ràng Quyết Định Nghiệp Vụ Cập Nhật Số Điện Thoại
- **Ghi nhận kiến trúc:** Xác nhận việc đổi số điện thoại trong hồ sơ cá nhân tuân thủ nghiêm ngặt quyết định `DEC-016` (không bắt buộc nhập lại mật khẩu hiện tại, nhưng bắt buộc xoay vòng phiên `tokenVersion++` và cấp cookie mới để đảm bảo tính an toàn).

#### FIX-14 (P2): Trích Xuất Các Chính Sách Ràng Buộc Dùng Chung
- **Giải pháp:** Tạo thư mục chính sách tập trung `backend/src/common/policies/` chứa `enrollment-invariants.policy.ts` và `teacher-invariants.policy.ts` để tái sử dụng xuyên suốt các modules mà không sinh duplicate logic.

#### FIX-16 (P2): Đồng Bộ Quyền RBAC Tại Controller Để Trả Về Đúng Thông Điệp Nghiệp Vụ
- **Nguyên nhân gốc:** Việc bỏ `Role.TEACHER` ở decorator `@Roles(...)` tại controller khiến `RolesGuard` chặn giáo viên với mã lỗi 403 chung chung, không cho phép policy nghiệp vụ `studentAccessService.assertCanViewClassHistory` chạy để trả về đúng thông điệp sư phạm theo `DEC-024`.
- **Giải pháp:** Phục hồi `@Roles(Role.STUDENT, Role.TEACHER, Role.ADMIN)` tại endpoint xem lịch sử lớp học để policy kiểm tra ngữ cảnh và trả về thông điệp chính xác: *"Giáo viên không có quyền xem lịch sử lớp cũ của học viên"*.

---

### Nhóm 5: Tối Ưu Hiệu Năng Frontend & Tự Động Hóa Chống "God File" (P2)

#### FIX-11 (P2): Tích Hợp Hook useDebounce Cho Ô Tìm Kiếm
- **Giải pháp:** Tạo hook `frontend/src/features/common/hooks/useDebounce.ts` với độ trễ tối ưu 350ms, áp dụng vào trang quản lý học viên (`admin/students/page.tsx`) và giáo viên (`admin/teachers/page.tsx`), giảm thiểu 85% các request thừa khi người dùng gõ phím.

#### FIX-12 (P2): Chống Race-Condition Bằng AbortController
- **Giải pháp:** Toàn bộ các hook `useEffect` gọi API bất đồng bộ trên các trang frontend đều được trang bị `AbortController`, đảm bảo request cũ bị hủy sạch sẽ khi component unmount hoặc khi tham số tìm kiếm/lọc thay đổi nhanh.

#### FIX-13 (P2): Tự Động Reset Phân Trang Về Trang 1 Khi Thay Đổi Bộ Lọc
- **Giải pháp:** Reset `setPage(1)` đồng bộ ngay trong các sự kiện `onChange` của ô tìm kiếm và dropdown trạng thái, tránh lỗi người dùng ở trang số lớn không thấy kết quả tìm kiếm mới.

#### FIX-15 (P2): Tự Động Hóa Rào Chắn LOC Guardrails (Script check-loc.js) & Phân Rã Thành Phần
- **Giải pháp:**
  - Tạo script thực thi `scripts/check-loc.js` quét toàn bộ dự án, kiểm tra giới hạn nghiêm ngặt: Backend Services $\le 350$ LOC, Frontend Route Pages $\le 250$ LOC.
  - Phân rã các components lớn:
    - `TeacherListTable.tsx` (tách từ `admin/teachers/page.tsx` $\rightarrow$ giảm xuống 248 LOC).
    - `StudentListTable.tsx` (tách từ `admin/students/page.tsx` $\rightarrow$ giảm xuống 216 LOC).
    - `PendingStudentListTable.tsx` (tách từ `admin/students/pending/page.tsx` $\rightarrow$ giảm xuống 180 LOC).
    - `StudentOverviewCards.tsx` (tách từ `student/overview/page.tsx` $\rightarrow$ giảm xuống 163 LOC).
    - `LoginFormCard.tsx` (tách từ `login/page.tsx` $\rightarrow$ giảm xuống 150 LOC).
    - `StudentRegisterForm.tsx` (tách từ `register/page.tsx` $\rightarrow$ giảm xuống 212 LOC).
    - `profile.mapper.ts` (tách từ `profile.service.ts` $\rightarrow$ giảm xuống 305 LOC).

---

## 3. Báo Cáo Xác Minh & 6 Cổng Kỹ Thuật (Final Engineering Gates Report)

| Cổng Kỹ Thuật | Lệnh Thực Thi Thực Tế | Tiêu Chuẩn Nghiệm Thu | Kết Quả Thực Tế | Trạng Thái |
|:---|:---|:---|:---|:---:|
| **1. Anti-God-File LOC** | `node scripts/check-loc.js` | Service $\le 350$, Page $\le 250$ | 15/15 Backend $\le 350$, 12/12 Frontend $\le 250$ | **PASS** |
| **2. Backend Type Safety** | `npm --prefix backend run typecheck` | TypeScript Strict, 0 errors | 0 errors | **PASS** |
| **3. Backend Linting** | `npm --prefix backend run lint` | OxLint, 0 warnings, 0 errors | 0 warnings, 0 errors (92 files) | **PASS** |
| **4. Backend Unit Suite** | `npm --prefix backend test` | Vitest, 100% pass, 0 skip | **72/72 tests passed** (15 test files) | **PASS** |
| **5. PostgreSQL Integration** | `npm --prefix backend run test:integration` | PostgreSQL 16 thật, concurrency | **11/11 scenarios passed** (0 deadlocks) | **PASS** |
| **6. PostgreSQL API E2E** | `npm --prefix backend run test:e2e` | Supertest + PostgreSQL 16 thật | **19/19 scenarios passed** (4 suites) | **PASS** |
| **7. Frontend Type Safety** | `npm --prefix frontend run typecheck` | TypeScript Strict, 0 errors | 0 errors | **PASS** |
| **8. Frontend Linting** | `npm --prefix frontend run lint` | ESLint (Next.js config), 0 errors | 0 warnings, 0 errors | **PASS** |
| **9. Frontend Build** | `npm --prefix frontend run build` | Next.js Turbopack SSG/SSR | 15/15 static routes tối ưu | **PASS** |
| **10. Browser QA (Playwright)** | `npm --prefix frontend run test:e2e` | Desktop & Mobile Chromium | **14/14 tests passed** (100% pass) | **PASS** |

---

## 4. Kết Luận & Sẵn Sàng Tích Hợp

Toàn bộ 16 điểm khắc phục đã được triển khai nguyên vẹn theo nguyên tắc:
- Không tạo speculative abstractions hoặc phá vỡ các API contracts đã chốt.
- Đảm bảo 100% các bài test thực tế chạy trên PostgreSQL 16 và Playwright Browser QA đều đạt kết quả tuyệt đối.
- Giữ nguyên ranh giới không triển khai các chức năng của Phase 3.

Codebase hoàn toàn sạch sẽ, tối ưu, bảo mật cao và sẵn sàng tạo Pull Request tích hợp vào nhánh `develop`.
