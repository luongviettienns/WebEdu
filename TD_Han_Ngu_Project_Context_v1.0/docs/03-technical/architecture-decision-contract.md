# Bản Hiến Chương Kiến Trúc & Quy Chuẩn Công Nghệ (Synthesized Decision Contract)

**Dự án:** WebEdu — Hệ thống Quản trị Trung tâm TD Hán Ngữ  
**Phiên bản:** 1.0 · **Ngày phê chuẩn:** 2026-11-06  
**Cơ chế thẩm định:** AKit Lightweight Triad Debate (`akit-debater` vs `akit-critic` vs `akit-judge`)  
**Trạng thái:** Technical Baseline & Architectural Guardrails (Tuân thủ `PROJECT_CONTEXT.md` và `decision-log.md`)

---

## 1. Kiến Trúc Cốt Lõi (Core Architectural Foundation)

1. **Mô hình Kiến trúc:** **Modular Monolith** trên nền **NestJS (Backend)** + **PostgreSQL 16+ (Database)** + **React / Next.js (Frontend Web Client)**.
2. **Quản trị CSDL (Database & ORM Governance):**
   - Sử dụng **Prisma ORM** kết hợp kỷ luật Migration thép (`prisma migrate dev --create-only` và `prisma migrate deploy`).
   - **CẤM TUYỆT ĐỐI `prisma db push`** trên mọi môi trường để bảo vệ các **PostgreSQL Partial Unique Indexes** và custom SQL constraints.
3. **Múi giờ chuẩn (Canonical Timezone):**
   - Database và Server lưu trữ/xử lý ở chuẩn `UTC` (`TIMESTAMPTZ`).
   - Toàn bộ quy tắc tính mốc hạn chót nghiệp vụ (như cửa sổ 2 ngày sửa điểm danh) và hiển thị lịch học bắt buộc neo cứng theo múi giờ pháp lý Việt Nam **`Asia/Ho_Chi_Minh` (GMT+7)**.
4. **Phân quyền đa tầng (Defense-in-Depth Authorization):**
   - Mọi API đọc/ghi tài nguyên phải kiểm tra: `Authenticated User -> Effective/Contextual Role -> Ownership/Class Relationship -> Action`.
   - Tuyệt đối không dùng việc ẩn nút ở Frontend thay cho kiểm tra quyền ở Backend (chống IDOR / BOLA).

---

## 2. Năm (5) Quy Tắc Kỹ Thuật Bất Biến Từ Triad Debate

### Bất biến 1: Cưỡng chế 1 Học viên = Tối đa 1 Lớp đang hoạt động (`DEC-007`, `BR-10`)
- Do Prisma DSL không hỗ trợ cú pháp Partial Unique Index trực tiếp trong `schema.prisma`, bắt buộc tạo thông qua file SQL migration được kiểm soát phiên bản:
  ```sql
  CREATE UNIQUE INDEX "idx_unique_student_active_enrollment"
  ON "enrollments" ("student_id")
  WHERE "status" = 'ACTIVE';
  ```
- Chuyển lớp (`FUNC-022`) hoặc rút lớp (`FUNC-077`) phải thực thi trong `prisma.$transaction`: cập nhật bản ghi cũ sang `TRANSFERRED` / `DROPPED` / `COMPLETED` trước khi tạo bản ghi `ACTIVE` mới, bảo toàn 100% lịch sử lớp cũ.

### Bất biến 2: Định danh Tài khoản & Email Phụ huynh cho Học viên dưới 16 tuổi (`DEC-001`, `AUTH-01`)
- Áp dụng quyết định `DEC-001`: Sử dụng **Email phụ huynh thay thế SĐT phụ huynh** cho học viên dưới 16 tuổi.
- Để không khóa cứng trường hợp 2 anh/chị em học chung trung tâm và dùng chung một email phụ huynh (`AUTH-01`):
  - Tách trường định danh tài khoản (`username` / mã học viên là `UNIQUE`) khỏi trường `parent_email` (`NULLABLE`, **không đặt UNIQUE**).
  - Trước khi code chi tiết `AuthModule`, xác nhận chốt cuối cùng cho `AUTH-01`, `AUTH-02`, `AUTH-03` trong sub-plan Phase 1.

### Bất biến 3: Cửa sổ Sửa Điểm Danh của Giáo viên (`DEC-010`, `BR-13`, `ATT-01`)
- Không dùng phép trừ giờ cơ học (`diffHours > 48`) gây sai lệch với ca học sáng/tối và lệch múi giờ UTC.
- Chuẩn hóa công thức tính hạn sửa điểm danh của Giáo viên theo múi giờ `Asia/Ho_Chi_Minh` (ví dụ: hết `23:59:59.999` của ngày thứ 2 sau ngày học theo đề xuất tại `FUNC-037`, chốt mốc chính xác khi vào sub-plan Attendance).

### Bất biến 4: Ngữ cảnh Đa Vai Trò & Kiểm toán Đặc Quyền (`DEC-020`, `BR-08`, `BR-17`)
- Tài khoản đa vai trò (ví dụ Admin kiêm Giáo viên) có quyền hiệu lực theo vai trò cao nhất (`FUNC-009`), nhưng mọi thao tác sử dụng đặc quyền Admin (sửa điểm danh quá hạn 2 ngày, sửa điểm sau công bố) **bắt buộc phải ghi nhận vào bảng Audit Log** (`actor_id`, `acting_role`, `old_value`, `new_value`, `reason`, `created_at`).

### Bất biến 5: Hàng rào Cách ly Điểm Chưa Công Bố (`DEC-012`, `DEC-013`, `BR-16`, `BR-18`)
- Quy trình chấm và công bố tách làm 2 bước riêng biệt: **Xác nhận điểm (`TEACHER_CONFIRMED`) $\rightarrow$ Công bố điểm (`PUBLISHED`)**.
- **Zero-Leak Rule:** Mọi endpoint phục vụ Học viên (chi tiết bài làm, danh sách bài tập, bảng tổng hợp tiến độ, tính điểm trung bình) bắt buộc lọc `status = 'PUBLISHED'`.
- Sự kiện thông báo điểm cho Học viên (`FUNC-080`) chỉ được kích hoạt khi chuyển sang trạng thái `PUBLISHED`.
- Bài tập về nhà (`HOMEWORK`) chỉ phục vụ theo dõi chuyên cần, tuyệt đối không cộng vào công thức điểm tổng kết (`DEC-014`).

---

## 3. Sáu (6) Cổng Chất Lượng Bắt Buộc Trước Khi Hoàn Thành Mỗi Sub-Plan
1. **Strict Type Safety:** `tsc --noEmit` pass 100%, cấm `any` / `as any` / `@ts-ignore`.
2. **Lint & Boundary Check:** `npm run lint` pass 100%, không import chéo nội bộ module khác.
3. **Unit & Integration Tests (TDD):** 100% test cases pass (`0 failed`, cấm `.skip`).
4. **Multi-tenant & Object-level Authorization Tests:** Có bài test chứng minh Học viên A không đọc/sửa được dữ liệu Học viên B, Giáo viên lớp X không can thiệp được lớp Y.
5. **Prototype Cleanup Check:** Loại bỏ hoàn toàn 16 thành phần chỉ dùng để demo trong `prototype-review.md` khi lên giao diện thật.
6. **Independent Code Review:** Thực hiện review độc lập qua `akit-critic` và `akit-security` trước khi đóng Phase.
