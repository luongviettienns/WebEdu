# Module 09 — Theo dõi tiến độ

**Tên kỹ thuật:** Learning Progress  
**Số yêu cầu:** 5  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- HV chỉ của mình; GV chỉ lớp được giao; Admin xem tất cả lớp.
- Tiến độ buổi/điểm danh liên kết lịch hủy/bù và học viên chuyển lớp.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-071 — Theo dõi tiến độ buổi học

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 65`; Câu hỏi mở #5, #11; Chức năng!11; Câu hỏi mở #27, #28

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt buổi bù tính vào Đã học thay buổi hủy (#28), hủy không bù thì không tự thêm buổi (#27). Còn chờ chốt Tổng số buổi khi hủy không bù (xem FUNC-027).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Hiển thị số buổi đã học trên tổng số buổi, số buổi còn lại và buổi tiếp theo của lớp (Q5).
- Hệ thống tự đếm và cập nhật ngay khi lịch thay đổi (Q11); đã gộp FUNC-033.
2. Trường thông tin
- Số buổi đã học
- Tổng số buổi
- Số buổi còn lại
- % hoàn thành
- Buổi tiếp theo (ngày, giờ)
- Số buổi nghỉ (chỉ ở view của HV)
3. Rule hiển thị / Format
- Đã học = số buổi trạng thái Đã học (gồm buổi bù); không tính buổi Đã hủy
- Còn lại = Tổng số buổi − Đã học
- % = Đã học / Tổng số buổi × 100, làm tròn số nguyên
- Hiển thị “12/30 buổi (40%)” + progress bar
- Buổi tiếp theo = buổi Dự kiến gần nhất tính từ hiện tại, dạng “Thứ 4, 20/11/2026 · 18:00”
- Tự cập nhật khi Admin sửa/hủy/thêm buổi, không cần thao tác tay
- Hết buổi: hiển thị “Lớp đã hoàn thành”, lớp chuyển Đã kết thúc
- Hiển thị tại: Danh sách lớp, Chi tiết lớp, trang HV
- Cách tính cho HV vào giữa khóa (FUNC-020)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 65`; trạng thái review: Có – Đáp ứng; **không coi như kiểm chứng backend**.

### FUNC-072 — Dự kiến ngày kết thúc lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 66`; Câu hỏi mở #5, #10

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Có nên cho Admin override end date tính toán cần mô tả trong SRS.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Tính ngày kết thúc dự kiến của lớp từ Ngày bắt đầu + Lịch học + Tổng số buổi; tự cập nhật khi lịch thay đổi (Q5, Q10).
2. Trường thông tin
- Ngày kết thúc dự kiến: read-only
- Ngày kết thúc ban đầu
3. Rule hiển thị / Format
- = Ngày của buổi cuối cùng (Dự kiến / Đã học) trong danh sách buổi học
- Định dạng dd/mm/yyyy
- Khác ngày ban đầu: hiển thị kèm “(lùi x ngày do đổi lịch)”
- Cập nhật ngay khi sửa/hủy/thêm buổi hoặc sửa Lịch học, Tổng số buổi
- Admin được phép ghi đè (override) ngày kết thúc

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 66`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-073 — Hiển thị tình trạng học cá nhân

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 67`; Vai trò!5–6; Câu hỏi mở #5

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Chỉ dữ liệu của chính học viên.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Trang tổng quan của HV: xem lớp đang học, lịch, điểm danh, tiến độ, bài cần làm và kết quả đã công bố.
2. Trường thông tin
- Khối Lớp đang học: Mã lớp, Khóa HSK, GV, Lịch học
- Khối Tiến độ: x/y buổi, Ngày kết thúc dự kiến, Buổi tiếp theo
- Khối Chuyên cần: Số buổi nghỉ, Tỷ lệ chuyên cần, Tỷ lệ nộp BTVN
- Khối Bài cần làm: Số bài chưa làm, bài gần hạn
- Khối Kết quả gần đây: các điểm đã công bố
3. Rule hiển thị / Format
- Là trang mặc định sau khi HV đăng nhập
- Chỉ dữ liệu của chính HV (FUNC-010)
- Format số liệu theo FUNC-036, FUNC-069, FUNC-071, FUNC-072
- Click từng khối → mở màn chi tiết tương ứng
- Chưa được xếp lớp: empty state “Bạn chưa được xếp lớp. Vui lòng liên hệ trung tâm”

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 67`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-074 — Giáo viên theo dõi lớp phụ trách

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 68`; Vai trò!2; Chức năng!11–12

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Quyền xem lịch sử lớp cũ của học viên cần quyết định.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV xem tiến độ và kết quả học tập của các HV thuộc lớp mình phụ trách.
2. Trường thông tin
- Chọn lớp (dropdown lớp phụ trách)
- Tóm tắt lớp: Tiến độ, Buổi tiếp theo, Sĩ số
- Bảng HV:
   + Họ tên, Số buổi nghỉ, Tỷ lệ chuyên cần, Tỷ lệ nộp BTVN
   + Điểm TB Mini-test, Điểm GK, Điểm CK, Điểm tổng kết
3. Rule hiển thị / Format
- Chỉ lớp GV phụ trách (FUNC-011)
- Sắp xếp theo từng cột; mặc định theo Họ tên A–Z
- Ô điểm chưa có: “—”
- Highlight HV vắng nhiều hoặc nộp BTVN thấp
- Click HV → chi tiết HV trong lớp (điểm danh, bài làm)
- GV không được phép xem lịch sử lớp cũ của HV, Admin được phép xem (FUNC-023)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 68`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-075 — Quản lý xem tổng quan các lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 69`; Vai trò!4; Câu hỏi mở #7, #44

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Tỷ lệ chuyên cần TB của lớp tính theo FUNC-069. Mức dashboard/phân tích nâng cao chưa được yêu cầu.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin theo dõi tổng quan tất cả lớp: lịch học, điểm danh, tiến độ.
2. Trường thông tin
- Thẻ số liệu:
   + Số lớp đang học
   + Tổng HV đang học
   + Số tài khoản chờ xếp lớp
   + Số buổi học hôm nay
- Bảng lớp: Mã lớp, GV, Khóa HSK, Tiến độ, Buổi tiếp theo, Sĩ số, Tỷ lệ chuyên cần TB của lớp, Trạng thái
- Lịch hôm nay / tuần này của các lớp
3. Rule hiển thị / Format
- Là trang mặc định sau khi Admin đăng nhập
- Lọc theo GV, Khóa HSK, Trạng thái lớp
- Click thẻ “Chờ xếp lớp” → màn FUNC-008; click lớp → Chi tiết lớp
- Format tiến độ theo FUNC-071, chuyên cần theo FUNC-069
- Không có biểu đồ/phân tích nâng cao ở Phase 1

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 69`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
