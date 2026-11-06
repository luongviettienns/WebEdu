# Module 02 — Khóa HSK

**Tên kỹ thuật:** Course Catalog  
**Số yêu cầu:** 1  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Danh mục HSK1–HSK4 (3.0) và Giao tiếp cơ bản đã xác nhận.
- Số buổi mặc định của từng khóa Q4 đang Open; có thể dùng tổng số buổi nhập khi tạo lớp, không tự đoán số.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-014 — Danh mục khóa học HSK

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Cần xác nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 17`; Thực thể!4; Chức năng!4; Câu hỏi mở #23

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt cấp độ HSK1–HSK4 (HSK 3.0) và Giao tiếp cơ bản (#23). Thao tác tạo/sửa danh mục vẫn cần xác nhận.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin quản lý danh mục khóa học HSK để gán cho lớp và phân loại bài tập/bài kiểm tra.
2. Trường thông tin
- Danh sách khóa:
   + Mã khóa, Tên khóa, Cấp độ, Số buổi mặc định, Số lớp đang dùng, Trạng thái, Thao tác
- Form tạo/sửa:
   + Mã khóa: bắt buộc, duy nhất, vd “HSK1”
   + Tên khóa: bắt buộc, vd “HSK 1 – Sơ cấp”
   + Cấp độ: dropdown HSK1, HSK2, HSK3, HSK4 (chuẩn HSK 3.0) và Giao tiếp cơ bản (Câu hỏi mở #23)
   + Số buổi mặc định: số nguyên > 0, tùy chọn; dùng để gợi ý Tổng số buổi khi tạo lớp (FUNC-016)
   + Mô tả/Giáo trình: tùy chọn
   + Trạng thái: Đang sử dụng / Ngừng sử dụng
3. Rule hiển thị / Format
- Sắp xếp theo Cấp độ tăng dần
- Khóa đang gán cho lớp: không cho xóa, chỉ chuyển “Ngừng sử dụng”
- Khóa Ngừng sử dụng không xuất hiện trong dropdown khi tạo lớp mới
- Hệ thống khởi tạo sẵn các trường thông tin. Admin được phép cấu hình chỉnh sửa

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 17`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
