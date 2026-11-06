# Module 05 — Điểm danh

**Tên kỹ thuật:** Attendance  
**Số yêu cầu:** 4  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Trạng thái Có mặt/Vắng/Có phép, GV có cửa sổ sửa 2 ngày, Admin sửa bất kỳ lúc nào.
- Ngưỡng nghỉ 30% chưa có chi tiết mẫu số/bao gồm Có phép.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-034 — Điểm danh từng buổi

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 32`; Chức năng!8; Thực thể!7; Câu hỏi mở #29

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt 3 trạng thái: Có mặt / Vắng / Có phép (#29).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Giáo viên ghi nhận tình trạng tham gia của từng học viên trong mỗi buổi học.
2. Trường thông tin
- Header: Mã lớp, Buổi số, Ngày giờ
- Bảng điểm danh:
   + STT, Họ tên HV
   + Trạng thái: Có mặt / Vắng / Có phép (Câu hỏi mở #29); không có Đi muộn
   + Ghi chú: text, tùy chọn
- Nút “Tất cả có mặt”, “Lưu điểm danh”
3. Rule hiển thị / Format
- Mở từ calendar hoặc danh sách buổi; mặc định buổi hôm nay
- Danh sách HV = HV đang học lớp tại ngày của buổi (theo Ngày vào lớp / Ngày rời lớp)
- Trạng thái dạng radio/toggle; mặc định chưa chọn; nút Lưu chỉ enable khi tất cả HV đã có trạng thái
- Chỉ điểm danh buổi có ngày ≤ hôm nay; buổi tương lai và buổi Đã hủy: disable
- Lưu thành công: buổi chuyển Đã học, toast “Đã lưu điểm danh”
- Hiển thị “Cập nhật bởi [GV] lúc dd/mm/yyyy HH:mm”

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 32`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-035 — Xem điểm danh theo lịch

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 33`; Câu hỏi mở #5; Vai trò!5; Câu hỏi mở #29

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Thêm màu cho trạng thái Có phép (#29). GV xem lớp mình, Admin xem toàn bộ theo RBAC.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép HV xem lịch sử điểm danh của chính mình dạng calendar (Q5); GV xem lớp mình, Admin xem tất cả.
2. Trường thông tin
- Calendar tháng, mỗi ngày học hiển thị trạng thái điểm danh
- Tóm tắt: Số buổi đã học, Số buổi có mặt, Số buổi vắng
- Chọn lớp (khi HV có lớp cũ – FUNC-023)
- View GV/Admin: ma trận Học viên × Buổi
3. Rule hiển thị / Format
- Màu:
   + Có mặt: xanh lá
   + Vắng: đỏ
   + Có phép: vàng (đề xuất)
   + Buổi chưa diễn ra: viền xanh dương
   + Đã hủy: xám
- Click ngày: popup Buổi số, Giờ, Trạng thái, Ghi chú của GV
- Nút tháng trước / tháng sau; mặc định tháng hiện tại
- HV chỉ thấy dữ liệu của mình (FUNC-010)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 33`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-036 — Tổng hợp số buổi nghỉ

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 34`; Câu hỏi mở #5, #29, #30

**TBD MODULE:** Ngưỡng 30% là quyết định đã chốt; cách tính mẫu số, trạng thái Có phép và dấu so sánh cần chốt khi làm module Attendance.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt tách Vắng / Có phép (#29), cảnh báo ở 30% tổng số buổi (#30). Cần chốt: 30% tính cả buổi Có phép hay chỉ buổi Vắng.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Tự tính và hiển thị số buổi nghỉ của từng HV theo lớp (Q5).
2. Trường thông tin
- Số buổi vắng
- Số buổi có phép
- Số buổi có mặt
- Số buổi đã điểm danh (tính từ Ngày vào lớp)
- Tỷ lệ đi học (%)
3. Rule hiển thị / Format
- Chỉ tính buổi đã điểm danh; không tính buổi Đã hủy, buổi trước Ngày vào lớp / sau Ngày rời lớp
- Tỷ lệ đi học = Có mặt / Số buổi đã điểm danh × 100, làm tròn số nguyên, dạng “85%”; Tỷ lệ chuyên cần tính theo FUNC-069
- Vị trí hiển thị:
   + HV: trang Tình trạng học cá nhân
   + GV/Admin: cột “Số buổi nghỉ” trong tab Học viên của lớp
- Cảnh báo (highlight đỏ) khi số buổi nghỉ ≥ 30% Tổng số buổi của lớp (Câu hỏi mở #30)
- Tách riêng số buổi Vắng và Có phép (Câu hỏi mở #29)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 34`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-037 — Sửa điểm danh bị nhầm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 35`; Nhu cầu kiểm soát dữ liệu nghiệp vụ; Câu hỏi mở #31, #32

**TBD MODULE:** Khách hàng chốt GV sửa trong 2 ngày, Admin sửa bất kỳ lúc nào. Điểm bắt đầu tính 2 ngày phải xác nhận trước code.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt GV sửa trong 2 ngày, Admin sửa bất kỳ lúc nào (#31, #32).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép người được phân quyền sửa bản ghi điểm danh đã lưu khi bị nhầm.
2. Trường thông tin
- Các trường như FUNC-034
- Lý do sửa: text, bắt buộc khi thay đổi trạng thái đã lưu
3. Rule hiển thị / Format
- GV: sửa được buổi của lớp mình trong 2 ngày sau ngày học (Câu hỏi mở #31), vd buổi 10/11 sửa được đến hết 12/11 (cách tính đề xuất)
- Admin: sửa được bất kỳ lúc nào (Câu hỏi mở #32)
- Sau khi sửa: số buổi nghỉ và tỷ lệ chuyên cần cập nhật ngay
- Lưu lịch sử: người sửa, thời gian, trạng thái cũ → mới, lý do
- Ô đã chỉnh sửa có icon “đã sửa”, hover xem lịch sử

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 35`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
