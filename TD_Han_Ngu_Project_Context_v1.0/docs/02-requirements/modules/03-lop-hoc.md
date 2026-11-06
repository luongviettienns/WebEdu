# Module 03 — Lớp học

**Tên kỹ thuật:** Class Management  
**Số yêu cầu:** 9  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Một lớp chỉ có một giáo viên, một HV chỉ thuộc một lớp đang học.
- Không giới hạn 5 HV; lịch sử lớp phải giữ khi chuyển/rút/bảo lưu.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-016 — Tạo lớp học

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 18`; Chức năng!2, !4; Câu hỏi mở #10

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Quy tắc trùng mã lớp do kỹ thuật đề xuất.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin tạo lớp học mới với các thông tin trung tâm cần ghi nhận (Q10).
- Gồm cả gán khóa HSK và khai báo tổng số buổi cho lớp (đã gộp FUNC-015, FUNC-019).
2. Trường thông tin
- Mã lớp: text, bắt buộc, duy nhất, tối đa 20 ký tự, vd “HSK1-K01”
- Khóa HSK: dropdown, bắt buộc; 1 lớp – 1 khóa
- Giáo viên phụ trách: dropdown, bắt buộc, chỉ GV đang hoạt động (FUNC-018)
- Lịch học định kỳ: bắt buộc (FUNC-026)
   + Các thứ trong tuần
   + Giờ bắt đầu – Giờ kết thúc
- Ngày bắt đầu: date, bắt buộc
- Tổng số buổi: số nguyên > 0, bắt buộc
- Ngày kết thúc dự kiến: tự tính, read-only (FUNC-072)
- Danh sách học viên: tùy chọn khi tạo, có thể thêm sau (FUNC-020)
- Ghi chú: tùy chọn
3. Rule hiển thị / Format
- Ngày: dd/mm/yyyy; Giờ: HH:mm (24h)
- Mã lớp tự chuyển in hoa, không chứa khoảng trắng; trùng: lỗi “Mã lớp đã tồn tại”
- Khóa HSK:
   + Dropdown hiển thị “Mã khóa – Tên khóa”, chỉ khóa trạng thái Đang sử dụng (FUNC-014)
   + Chọn khóa → tự điền Tổng số buổi = số buổi mặc định của khóa (nếu có), Admin sửa được
- Tổng số buổi hiển thị “[n] buổi”; là căn cứ để sinh buổi học (FUNC-027), tính tiến độ (FUNC-071), ngày kết thúc (FUNC-072)
- Ngày kết thúc dự kiến tự cập nhật ngay khi đổi Ngày bắt đầu / Lịch học / Tổng số buổi
- Lưu thành công: sinh danh sách buổi học (FUNC-027), chuyển tới Chi tiết lớp, toast “Tạo lớp thành công”
- Trạng thái lớp tự xác định:
   + Sắp khai giảng: trước Ngày bắt đầu
   + Đang học: từ Ngày bắt đầu đến buổi cuối
   + Đã kết thúc: sau buổi cuối hoặc khi Admin kết thúc lớp (FUNC-079)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 18`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-017 — Chỉnh sửa thông tin lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 19`; Chức năng!2

**LƯU Ý:** Không thay đổi/hủy dữ liệu lịch sử khi lớp đã có điểm danh, nộp bài hoặc điểm. Mọi trạng thái, ràng buộc và migration cần test sau khi chốt.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Ràng buộc sau khi đã có điểm danh/bài kiểm tra cần thể hiện trong SRS.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin cập nhật thông tin lớp nhưng không làm mất dữ liệu lịch sử (điểm danh, bài làm, điểm).
2. Trường thông tin
- Các trường như FUNC-016: Mã lớp, Khóa HSK, GV, Lịch học, Ngày bắt đầu, Tổng số buổi, Ghi chú
3. Rule hiển thị / Format
- Lớp chưa có buổi Đã học: cho sửa tất cả trường
- Lớp đã có buổi Đã học / điểm danh / bài làm:
   + Ngày bắt đầu: read-only
   + Lịch học: chỉ áp dụng cho buổi Dự kiến trong tương lai, buổi Đã học giữ nguyên
   + Tổng số buổi: không được nhỏ hơn số buổi đã học, lỗi “Tổng số buổi không được nhỏ hơn số buổi đã học ([n])”
   + Khóa HSK: Read-only, chỉ Superadmin và Admin đổi được
   + Đổi GV: theo FUNC-018
- Đổi Khóa HSK không tự thay Tổng số buổi, chỉ hiển thị gợi ý “Số buổi mặc định của khóa: [n]”
- Thay đổi ảnh hưởng buổi tương lai: popup “Thay đổi sẽ cập nhật [n] buổi học sắp tới. Tiếp tục?”
- Mọi thay đổi ghi nhật ký: người sửa, thời gian, giá trị trước/sau
- Không xóa lớp đã có dữ liệu; Chỉ cho xóa lớp chưa có HV và chưa có buổi Đã học

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 19`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-018 — Phân công giáo viên

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 20`; Chức năng!3; Câu hỏi mở #24

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt 1 lớp 1 GV, không có trợ giảng (#24). Lưu lịch sử thay GV là đề xuất.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin gắn hoặc thay đổi Giáo viên phụ trách lớp.
2. Trường thông tin
- Giáo viên phụ trách: dropdown chọn 1 GV, bắt buộc
- Ngày áp dụng: date, mặc định ngày hiện tại (khi đổi GV)
- Lý do thay đổi: text, tùy chọn
3. Rule hiển thị / Format
- Dropdown hiển thị “Họ tên – SĐT”, có ô tìm kiếm, chỉ GV đang hoạt động; gồm cả Admin có vai trò GV (FUNC-009)
- Mỗi lớp có 1 GV phụ trách tại một thời điểm, không có trợ giảng (Câu hỏi mở #24)
- Sau khi đổi: GV mới thấy lớp ngay; GV cũ mất quyền thao tác lớp từ Ngày áp dụng
- Lịch sử phân công hiển thị ở tab Thông tin lớp:
   + GV, Từ ngày – Đến ngày, Người thay đổi, Lý do

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 20`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-020 — Thêm học viên vào lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 21`; Chức năng!5; Câu hỏi mở #9, #12, #25

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt 1 HV chỉ học 1 lớp tại một thời điểm (#25).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin thêm một hoặc nhiều HV đã có tài khoản vào danh sách lớp, kể cả lớp đang học giữa khóa (đã gộp FUNC-021, FUNC-025).
- Không giới hạn sĩ số lớp (Q9; BR-01 đã gạch bỏ).
2. Trường thông tin
- Popup “Thêm học viên”:
   + Ô tìm kiếm theo tên/SĐT/email
   + Danh sách kết quả: Checkbox, Họ tên, Ngày sinh, SĐT, Lớp hiện tại
   + Ngày vào lớp: date, bắt buộc, ≥ Ngày bắt đầu lớp; mặc định = Ngày bắt đầu lớp (lớp chưa học) hoặc ngày hiện tại (lớp đang học)
- Tab Học viên của lớp:
   + STT, Họ tên, SĐT, Ngày vào lớp, Số buổi nghỉ, Trạng thái (Đang học / Đã chuyển lớp / Đã nghỉ), Thao tác (Xem / Chuyển lớp – FUNC-022 / Rút khỏi lớp – FUNC-077)
3. Rule hiển thị / Format
- Chỉ tìm được HV có tài khoản Chờ xếp lớp / Đang hoạt động
- HV đã có trong lớp: dòng disable, nhãn “Đã trong lớp”
- Không validate/cảnh báo sĩ số; hiển thị “[n] học viên” (chỉ đếm HV Đang học) ở đầu tab và cột Sĩ số ở danh sách lớp
- Tab Học viên mặc định chỉ hiện HV Đang học; bật lọc “Hiện cả HV đã chuyển lớp / đã nghỉ” để xem các HV khác
- HV vào lớp đang học:
   + Các buổi trước Ngày vào lớp: không có bản ghi điểm danh, không tính vắng
   + Ma trận điểm danh hiển thị “—” (chưa vào lớp) ở các buổi đó
   + Tiến độ cá nhân tính theo tiến độ chung của lớp
   + Bài giao trước Ngày vào lớp: HV không được thấy
- Không thêm được HV vào lớp Đã kết thúc (FUNC-079)
- 1 HV chỉ học 1 lớp tại một thời điểm, hoàn thành lớp này mới được học lớp khác (Câu hỏi mở #25):
   + HV đang ở lớp Sắp khai giảng / Đang học khác: dòng disable, nhãn “Đang học lớp [Mã lớp]”
   + Gợi ý dùng Chuyển lớp (FUNC-022) nếu cần đổi lớp

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 21`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-022 — Chuyển học viên sang lớp khác

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 22`; Câu hỏi mở #12; BA phản hồi trong báo cáo đối chiếu

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Không nhân đôi điểm danh; dữ liệu gốc lớp cũ vẫn thuộc lớp cũ.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin chuyển HV từ lớp hiện tại sang lớp khác; giữ nguyên dữ liệu ở lớp cũ, lớp mới tính theo lịch mới (Q12).
2. Trường thông tin
- Popup Chuyển lớp:
   + Học viên: read-only
   + Lớp hiện tại: read-only
   + Lớp mới: dropdown, bắt buộc, không gồm lớp hiện tại, chỉ lớp Sắp khai giảng/Đang học
   + Ngày chuyển: date, bắt buộc, mặc định ngày hiện tại
   + Lý do: text, tùy chọn
3. Rule hiển thị / Format
- Popup xác nhận: “Chuyển [Tên HV] từ [Lớp cũ] sang [Lớp mới] từ ngày dd/mm/yyyy?”
- Lớp cũ:
   + Trạng thái HV → “Đã chuyển lớp”, ghi Ngày rời lớp
   + Giữ toàn bộ điểm danh, bài làm, điểm
   + HV không còn trong danh sách điểm danh các buổi sau Ngày chuyển, không nhận bài mới
- Lớp mới: HV tính từ buổi đầu tiên có ngày ≥ Ngày chuyển
- Không nhân đôi: 1 buổi chỉ có 1 bản ghi điểm danh/HV
- Bài tập lớp cũ chưa nộp: đóng khi hết deadlined đã được setting

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 22`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-023 — Xem lịch sử các lớp đã học

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Admin; Giáo viên được phân quyền
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 23`; BA phản hồi báo cáo đối chiếu – mục 07

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Giáo viên lớp mới xem dữ liệu cũ đến mức nào chưa được xác nhận.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép HV (và Admin, GV được phân quyền) xem lại các lớp HV đã học trước đây cùng dữ liệu điểm danh, điểm.
2. Trường thông tin
- Danh sách lớp đã học:
   + Mã lớp, Khóa HSK, GV, Từ ngày – Đến ngày, Số buổi đã học, Số buổi nghỉ, Trạng thái (Đã chuyển lớp / Đã nghỉ / Đã kết thúc)
- Chi tiết lớp cũ: Calendar điểm danh, Danh sách bài & điểm đã công bố
3. Rule hiển thị / Format
- Lớp vào lịch sử khi: HV chuyển lớp (FUNC-022), HV bị rút khỏi lớp (FUNC-077) hoặc lớp kết thúc (FUNC-079)
- Sắp xếp theo Đến ngày, mới nhất lên đầu
- Read-only với mọi vai trò; HV không làm bài mới ở lớp cũ
- HV chỉ thấy điểm đã công bố (FUNC-063)
- Admin xem lịch sử của mọi HV trong Hồ sơ HV (FUNC-007)
- GV lớp mới không được phép xem lịch sử lớp cũ

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 23`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-024 — Danh sách và chi tiết lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin; Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 24`; Chức năng!2–5; Vai trò!2,4

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Giáo viên được lọc lớp theo quyền.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép xem danh sách lớp và chi tiết từng lớp.
2. Trường thông tin
- Danh sách lớp:
   + Mã lớp, Khóa HSK, GV, Lịch học, Ngày bắt đầu, Ngày kết thúc dự kiến, Sĩ số, Tiến độ, Trạng thái
- Chi tiết lớp (tab):
   + Thông tin chung
   + Học viên
   + Lịch học
   + Điểm danh
   + Bài tập & kiểm tra
   + Tiến độ & kết quả
3. Rule hiển thị / Format
- Lịch học dạng rút gọn: “T2-T4-T6 · 18:00–19:30”
- Tiến độ: “12/30 buổi (40%)” + progress bar (FUNC-071)
- Tag trạng thái lớp: Sắp khai giảng (xanh dương), Đang học (xanh lá), Đã kết thúc (xám)
- Mặc định ẩn lớp Đã kết thúc; bật lọc “Hiện lớp đã kết thúc” để xem (FUNC-079)
- Bộ lọc: Trạng thái, Khóa HSK, GV (chỉ Admin); tìm theo Mã lớp
- GV: chỉ thấy lớp phụ trách, không có nút Tạo/Sửa lớp
- Phân trang 20 dòng/trang

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 24`; trạng thái review: Có – Đáp ứng; **không coi như kiểm chứng backend**.

### FUNC-077 — Rút học viên khỏi lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 71`; Bổ sung khi review – Q12 chỉ hỏi chuyển lớp; Câu hỏi mở #50

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt HV bảo lưu: dữ liệu cũ ở lớp cũ, dữ liệu mới ở lớp mới (#50).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin ghi nhận HV nghỉ hẳn khỏi lớp (không chuyển sang lớp khác); giữ nguyên dữ liệu học tập đã có.
2. Trường thông tin
- Popup Rút khỏi lớp:
   + Học viên, Lớp: read-only
   + Ngày nghỉ: date, bắt buộc, mặc định ngày hiện tại
   + Lý do: dropdown (Nghỉ học / Bảo lưu / Khác + text), tùy chọn
3. Rule hiển thị / Format
- Popup xác nhận: “Rút [Tên HV] khỏi lớp [Mã lớp] từ ngày dd/mm/yyyy?”
- Trạng thái HV trong lớp → “Đã nghỉ” (xám), vẫn hiển thị ở tab Học viên khi bật lọc “Hiện cả HV đã nghỉ”
- Không còn trong danh sách điểm danh / nhận bài mới từ sau Ngày nghỉ
- Giữ toàn bộ điểm danh, bài làm, điểm; lớp chuyển vào Lịch sử lớp đã học của HV (FUNC-023)
- Không tính vào sĩ số hiện tại
- Tài khoản HV về status “Chờ xếp lớp”
- HV bảo lưu rồi quay lại học: dữ liệu cũ giữ ở lớp cũ (Lịch sử lớp đã học); Admin thêm HV vào lớp mới (FUNC-020), dữ liệu mới ghi nhận ở lớp mới (Câu hỏi mở #50)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 71`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-079 — Kết thúc / lưu trữ lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Low · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 73`; Bổ sung khi review – vòng đời lớp học; Câu hỏi mở #51

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt có trường hợp lớp dừng sớm (#51).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin chủ động kết thúc lớp (hết khóa hoặc dừng sớm) và lưu trữ để ẩn khỏi danh sách làm việc hằng ngày.
2. Trường thông tin
- Nút “Kết thúc lớp” ở Chi tiết lớp
- Popup:
   + Ngày kết thúc thực tế: date, bắt buộc, mặc định ngày buổi Đã học cuối cùng
   + Lý do: Hoàn thành khóa / Dừng sớm / Khác
- Bộ lọc “Hiện lớp đã kết thúc” ở Danh sách lớp
3. Rule hiển thị / Format
- Popup xác nhận: “Kết thúc lớp [Mã lớp]? Các buổi Dự kiến còn lại ([n] buổi) sẽ chuyển Đã hủy.”
- Sau khi kết thúc: trạng thái lớp “Đã kết thúc” (xám); lớp read-only (không điểm danh, không giao bài mới)
- GV và HV vẫn xem được dữ liệu lớp; với HV, lớp chuyển vào Lịch sử lớp đã học (FUNC-023)
- Danh sách lớp mặc định ẩn lớp Đã kết thúc
- Admin mở lại được lớp trong vòng 7 ngày

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 73`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
