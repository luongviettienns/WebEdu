# Module 04 — Lịch & buổi học

**Tên kỹ thuật:** Schedule & Sessions  
**Số yêu cầu:** 7  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Không tự chuyển đã học khi quên điểm danh.
- Hủy không bù không tự thêm; học bù thay thế không đếm hai lần.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-026 — Khai báo lịch học định kỳ

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 25`; Câu hỏi mở #10; Chức năng!7

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần chốt số buổi thực tế dự kiến và múi giờ.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin thiết lập lịch học lặp lại hằng tuần của lớp.
2. Trường thông tin
- Ngày học trong tuần: checkbox T2, T3, T4, T5, T6, T7, CN; bắt buộc ≥ 1 ngày
- Giờ bắt đầu: time, bắt buộc
- Giờ kết thúc: time, bắt buộc
- Cho phép giờ học khác nhau theo từng ngày
3. Rule hiển thị / Format
- Preset chọn nhanh: “2-4-6” (T2, T4, T6), “3-5-CN” (T3, T5, CN)
- Giờ dạng HH:mm (24h), bước 15 phút; múi giờ GMT+7
- Hiển thị tóm tắt: “T2-T4-T6 · 18:00–19:30”
- Giờ kết thúc ≤ Giờ bắt đầu: lỗi “Giờ kết thúc phải sau giờ bắt đầu”
- Cảnh báo khi GV bị trùng giờ với lớp khác

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 25`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-027 — Tạo các buổi học theo lịch

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 26`; Suy ra từ lịch học + tiến độ Q5/Q10; Câu hỏi mở #26, #27

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt không tự chuyển Đã học khi GV quên điểm danh (#26), không tự thêm buổi khi hủy không bù (#27). Cần chốt: hủy không bù thì Tổng số buổi giữ nguyên hay giảm 1 (ảnh hưởng FUNC-071, FUNC-072).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Hệ thống tự sinh danh sách buổi học dự kiến từ Ngày bắt đầu + Lịch học định kỳ + Tổng số buổi; Admin có thể thêm buổi thủ công.
2. Trường thông tin
- Mỗi buổi học:
   + Số thứ tự buổi (Buổi 1, 2, …)
   + Ngày học, Giờ bắt đầu – Giờ kết thúc
   + Loại buổi: Thường / Học bù
   + Trạng thái: Dự kiến / Hôm nay / Chưa điểm danh / Đã học / Đã hủy
   + Ghi chú
- Nút “+ Thêm buổi” (phân quyền Admin)
3. Rule hiển thị / Format
- Sinh lần lượt theo các thứ trong lịch, bắt đầu từ ngày học đầu tiên ≥ Ngày bắt đầu, cho đến khi đủ Tổng số buổi
- Trạng thái Hôm nay / Chưa điểm danh do hệ thống tự tính từ ngày giờ buổi học:
   + Hôm nay: buổi chưa hủy, có Ngày học = ngày hiện tại và chưa được điểm danh
   + Chưa điểm danh: buổi chưa hủy, đã qua ngày học nhưng GV chưa lưu điểm danh (FUNC-034)
- Buổi chỉ chuyển Đã học khi GV lưu điểm danh; qua giờ kết thúc mà GV chưa điểm danh thì giữ trạng thái Chưa điểm danh, không tự chuyển Đã học (Câu hỏi mở #26)
- Buổi Đã hủy không tính vào số thứ tự và Tổng số buổi
- Hủy buổi mà không tạo buổi bù: hệ thống không tự thêm buổi vào cuối khóa (Câu hỏi mở #27); Admin tự tạo buổi bù (FUNC-031) hoặc “+ Thêm buổi” nếu cần
- Khi sửa Lịch học / Tổng số buổi: chỉ sinh lại các buổi Dự kiến

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 26`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-028 — Xem lịch buổi học

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin; Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 27`; Chức năng!7; Câu hỏi mở #5

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> #5 xác nhận calendar điểm danh; cách trình bày lịch học đề xuất.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép xem lịch các buổi học của lớp dạng calendar và danh sách.
2. Trường thông tin
- Chế độ xem: Tháng / Tuần / Danh sách
- Thông tin mỗi buổi: Buổi số, Mã lớp, Ngày, Giờ, Loại (Thường / Học bù), Trạng thái, Ghi chú/Lý do hủy
- Popup chi tiết buổi Đã học: thêm dòng “Điểm danh: x/y có mặt”
- Bộ lọc Lớp (GV, Admin), GV (Admin)
3. Rule hiển thị / Format
- Màu theo trạng thái (FUNC-027):
   + Dự kiến: xanh dương
   + Hôm nay: giữ màu xanh dương như Dự kiến, thêm viền đậm và nhãn “Hôm nay”
   + Chưa điểm danh: cam, kèm icon cảnh báo
   + Đã học: xanh lá
   + Đã hủy: xám, chữ gạch ngang
   + Học bù: nhãn “Bù”, kèm “Bù cho buổi dd/mm”
- Mặc định mở tháng hiện tại, highlight ngày hôm nay
- Click buổi: popup chi tiết; Admin có nút Sửa / Hủy buổi; GV có nút Điểm danh
- Dòng “Điểm danh: x/y có mặt”: x = số HV có mặt, y = tổng số HV trong danh sách điểm danh của buổi; chỉ hiển thị với buổi Đã học
- Phạm vi: HV – lớp đang học; GV – lớp phụ trách; Admin – tất cả lớp

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 27`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-029 — Cập nhật lịch khi thay đổi

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 28`; Câu hỏi mở #11

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Giáo viên tự sửa lịch hay chỉ Admin: sheet nghiêng về Admin.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin đổi ngày/giờ của một buổi học chưa diễn ra (Q11).
2. Trường thông tin
- Popup Sửa buổi:
   + Ngày học: date, bắt buộc
   + Giờ bắt đầu, Giờ kết thúc: bắt buộc
   + Lý do thay đổi: text, bắt buộc
   + Ghi chú: tùy chọn
3. Rule hiển thị / Format
- Chỉ sửa được buổi trạng thái Dự kiến; buổi Đã học / Đã hủy ẩn nút Sửa
- Không chọn được ngày trong quá khứ
- Lưu thành công: cập nhật calendar, tiến độ, ngày kết thúc dự kiến; ghi nhật ký (FUNC-032)
- Chỉ Admin thao tác; GV và HV chỉ xem
- Buổi đã đổi có nhãn “Đã đổi lịch”, hover xem ngày/giờ cũ

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 28`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-030 — Hủy buổi và lưu thông tin cũ

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 29`; Trao đổi bổ sung; BA đồng ý trong báo cáo đối chiếu – mục 06; Câu hỏi mở #27

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Hủy không tạo buổi bù: không tự thêm buổi cuối khóa (#27). Q11 dùng chữ “xóa buổi”, hệ thống làm theo hủy và giữ dữ liệu.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin hủy buổi học (nghỉ lễ, GV bận…) mà không xóa dữ liệu; buổi chuyển trạng thái Đã hủy.
2. Trường thông tin
- Popup Hủy buổi:
   + Lý do hủy: dropdown (Nghỉ lễ / GV bận / Khác + ô text), bắt buộc
   + Checkbox “Tạo buổi học bù ngay” → mở form FUNC-031
3. Rule hiển thị / Format
- Chỉ hủy được buổi Dự kiến
- Popup xác nhận: “Hủy Buổi [n] ngày dd/mm/yyyy?”
- Sau hủy: buổi vẫn hiển thị trên calendar màu xám, gạch ngang, nhãn “Đã hủy – [lý do]”
- Buổi Đã hủy: không tính vào số buổi đã học, không điểm danh, không tính nghỉ cho HV
- Đánh lại số thứ tự các buổi sau; cập nhật tiến độ và ngày kết thúc dự kiến (FUNC-071, FUNC-072)
- Không có thao tác xóa vĩnh viễn buổi học; ghi nhật ký (FUNC-032)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 29`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-031 — Tạo buổi học bù

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 30`; Câu hỏi mở #11; báo cáo đối chiếu – mục 06; Câu hỏi mở #28

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt buổi bù tính thay buổi bị hủy, Tổng số buổi giữ nguyên (#28).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin tạo buổi học bù gắn với một buổi đã hủy.
2. Trường thông tin
- Buổi bị hủy: dropdown, bắt buộc, chỉ buổi Đã hủy chưa có buổi bù
- Ngày học bù: date, bắt buộc
- Giờ bắt đầu, Giờ kết thúc: bắt buộc
- Ghi chú: tùy chọn
3. Rule hiển thị / Format
- Buổi bù hiển thị nhãn “Học bù” và “Bù cho Buổi [n] – dd/mm”
- Mỗi buổi hủy có tối đa 1 buổi bù
- Buổi bù được tính thay cho buổi bị hủy, Tổng số buổi giữ nguyên (Câu hỏi mở #28)
- Trùng ngày giờ với buổi khác của cùng lớp: lỗi “Trùng lịch với Buổi [n]”
- Buổi bù được điểm danh và tính tiến độ như buổi thường

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 30`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-032 — Nhật ký thay đổi lịch

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin; Superadmin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 31`; Người dùng xác nhận 23/10; BA đồng ý trong báo cáo đối chiếu

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Các trường lịch sử chi tiết là đề xuất triển khai.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Ghi lại và cho xem lịch sử mọi thay đổi lịch học: đổi lịch, hủy buổi, tạo buổi bù, thêm buổi, sửa lịch định kỳ.
2. Trường thông tin
- Thời gian thao tác
- Người thao tác
- Lớp, Buổi
- Hành động: Đổi lịch / Hủy buổi / Tạo buổi bù / Thêm buổi / Sửa lịch định kỳ
- Giá trị cũ, Giá trị mới
- Lý do
3. Rule hiển thị / Format
- Thời gian: dd/mm/yyyy HH:mm; mới nhất trên cùng
- Giá trị cũ → mới dạng “T2 18/11 18:00 → T4 20/11 18:00”
- Hiển thị tại:
   + Tab Lịch học của lớp, mục “Lịch sử thay đổi”
   + Trang nhật ký chung của Admin/Superadmin
- Lọc theo Lớp, Hành động, Khoảng thời gian
- Read-only, không ai được sửa/xóa

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 31`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
