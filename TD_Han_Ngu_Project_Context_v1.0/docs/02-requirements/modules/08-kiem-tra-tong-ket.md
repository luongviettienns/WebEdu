# Module 08 — Kiểm tra & tổng kết

**Tên kỹ thuật:** Exams & Final Results  
**Số yêu cầu:** 5  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Mini/Giữa/Cuối dùng form khác nhau, có thể nhiều bài mỗi loại.
- Công thức tổng kết, rubric, mẫu đề để sau theo quyết định 06/11; không tự gán tỷ trọng.
- FUNC-076 ngoài phạm vi Phase 1.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-065 — Quản lý bài kiểm tra (Mini-test / Giữa kỳ / Cuối kỳ)

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 61`; Phạm vi!6–7; Quy tắc BR-05; Câu hỏi mở #17, #19, #35

**TBD-DEFERRED:** Mẫu đề Mini/Giữa/Cuối và mọi công thức điểm sẽ chốt ở module; số bài tùy khóa. Không hardcode mẫu đề.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Số bài mỗi loại tùy khóa (#35). Tỉ trọng vào điểm tổng kết trung tâm hẹn chốt sau (#36). Mini-test có phải “kiểm tra đầu giờ” ở BR-05 không vẫn cần xác nhận.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV tạo, giao, chấm 3 loại bài kiểm tra tính vào điểm tổng kết: Mini-test, Giữa kỳ, Cuối kỳ (BR-05, Q17, Q19); đã gộp FUNC-066, FUNC-067.
- Mỗi loại dùng form đề riêng (FUNC-068).
2. Trường thông tin
- Như FUNC-039, với Loại đề = Mini-test / Giữa kỳ / Cuối kỳ
- Thời gian làm bài (phút)
- Thời gian mở bài, Hạn nộp (như FUNC-051)
- Buổi học gắn kèm: bắt buộc với Mini-test
3. Rule hiển thị / Format
- Nhãn loại bài trong danh sách của HV và GV: “Mini-test” / “Giữa kỳ” / “Cuối kỳ”
- Luồng giao – làm – chấm – công bố như FUNC-051 → FUNC-060
- Điểm cả 3 loại được tính vào điểm tổng kết (FUNC-070)
- Số bài Mini-test / Giữa kỳ / Cuối kỳ tùy từng khóa; hệ thống không giới hạn 1 bài mỗi loại (Câu hỏi mở #35)
- [Chờ chốt] cấu trúc từng form – chờ file mẫu từ trung tâm (Q18)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 61`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-068 — Hỗ trợ biểu mẫu đề khác nhau

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 62`; Câu hỏi mở #19

**TBD-DEFERRED:** Chưa có form/mẫu đề thật. Chốt ở module đề thi.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Chưa có file mẫu; trung tâm hẹn gửi sau (#39).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Hỗ trợ mỗi loại bài (BTVN, Mini-test, Giữa kỳ, Cuối kỳ) có 1 form đề riêng (Q19: không giống nhau, mỗi loại 1 form).
2. Trường thông tin
- Cấu hình template theo Loại đề:
   + Các phần (section), vd Nghe / Đọc / Viết
   + Số câu, Dạng câu cho phép trong từng phần
   + Điểm từng phần
   + Thời gian làm bài
3. Rule hiển thị / Format
- Chọn Loại đề khi tạo (FUNC-039) → áp dụng template tương ứng
- Đề hiển thị cho HV chia theo phần, có tiêu đề phần và điểm phần, vd “Phần 1 – Nghe (20 điểm)”
- [Chờ chốt] chi tiết từng form – chờ trung tâm gửi file mẫu (Q18)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 62`; trạng thái review: Không; **không coi như kiểm chứng backend**.

### FUNC-069 — Theo dõi điểm bài tập về nhà

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 63`; Câu hỏi mở #17, #44

**CONFIRMED:** BTVN đóng góp chuyên cần và không tính điểm tổng kết. **TBD MODULE:** định nghĩa hoàn thành, công thức tỷ lệ, Có phép.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã có công thức chuyên cần = buổi đi học + BTVN hoàn thành (#44). Cần chốt: “hoàn thành” là đã nộp hay phải đạt điểm tối thiểu; buổi Có phép có tính là đi học không; hiển thị số hay %.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Ghi nhận kết quả BTVN để đánh giá chuyên cần; không tính vào điểm tổng kết (Q17).
2. Trường thông tin
- Số BTVN được giao
- Số BTVN đã nộp
- Tỷ lệ nộp (%)
- Điểm trung bình BTVN (tham khảo)
- Tỷ lệ chuyên cần (%)
3. Rule hiển thị / Format
- Tỷ lệ nộp = Đã nộp / Được giao × 100, làm tròn số nguyên, dạng “90%”
- Chuyên cần = Số buổi có mặt + Số BTVN đã hoàn thành (Câu hỏi mở #44)
- Tỷ lệ chuyên cần = (Số buổi có mặt + Số BTVN đã hoàn thành) / (Số buổi đã điểm danh + Số BTVN được giao) × 100, làm tròn số nguyên (cách quy đổi % là đề xuất)
- Hiển thị trong mục “Chuyên cần” cùng số buổi nghỉ (FUNC-036)
- Kèm ghi chú “Không tính vào điểm tổng kết”
- Phạm vi: HV – của mình; GV – lớp mình; Admin – tất cả

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 63`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-070 — Tính điểm tổng kết từ các bài kiểm tra

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Cần xác nhận
- **Vai trò ghi nhận:** Giáo viên; Admin; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 64`; Câu hỏi mở #17, #36, #42

**TBD-DEFERRED:** Không tự tính ra điểm tổng kết hoặc hiển thị 'Đạt/Chưa đạt' theo công thức tự nghĩ. Chốt khi đến module tổng kết.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Công thức, tỉ trọng, điều kiện Đạt và thang điểm theo kỹ năng: trung tâm hẹn chốt sau (#36). Có nhiều bài Giữa kỳ/Cuối kỳ (#35) thì cần cách lấy điểm trung bình.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Tổng hợp điểm Mini-test, Giữa kỳ, Cuối kỳ thành điểm tổng kết khóa theo công thức trung tâm phê duyệt (Q17).
2. Trường thông tin
- Điểm TB Mini-test
- Điểm Giữa kỳ
- Điểm Cuối kỳ
- Điểm tổng kết
- Kết quả: Đạt / Chưa đạt – [Chờ chốt điều kiện đạt]
3. Rule hiển thị / Format
- Công thức: [Chờ chốt – Câu hỏi mở #36]
- Nguồn điểm: bài làm online (FUNC-065); chỉ dùng điểm đã công bố; không dùng điểm BTVN; không có điểm nhập thủ công (Câu hỏi mở #42)
- Thiếu điểm thành phần: hiển thị “Chưa đủ dữ liệu”
- Làm tròn 1 chữ số thập phân (đề xuất)
- Tự tính lại khi điểm thành phần được sửa (FUNC-061)
- Phạm vi: HV – của mình; GV – lớp mình; Admin – tất cả

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 64`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-076 — Nhập điểm kiểm tra thủ công

- **Trạng thái phạm vi:** Ngoài phạm vi · **Ưu tiên:** Low · **Trạng thái nghiệp vụ trong Excel:** Loại bỏ
- **Vai trò ghi nhận:** Giáo viên; Học viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 70`; Câu hỏi mở #2; Chức năng!12; Câu hỏi mở #42

**OUT-OF-SCOPE PHASE 1:** Không có điểm kiểm tra trên giấy để nhập thủ công (Q42).

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Trung tâm không có bài kiểm tra làm trên giấy (#42) → không làm chức năng này ở Phase 1.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV nhập tay điểm các bài kiểm tra không làm trên web (làm trên giấy, thi trực tiếp) để tính vào kết quả học tập (Q2; sheet Chức năng “Nhập / xem kết quả kiểm tra”).
2. Trường thông tin
- Tạo đầu điểm:
   + Lớp: dropdown, bắt buộc, chỉ lớp phụ trách
   + Tên bài kiểm tra: bắt buộc
   + Loại: Mini-test / Giữa kỳ / Cuối kỳ, bắt buộc
   + Ngày kiểm tra: date, bắt buộc
   + Buổi học liên quan: tùy chọn
   + Điểm tối đa: số > 0, mặc định 10
- Bảng nhập điểm:
   + STT, Họ tên HV
   + Điểm: số, 0 ≤ điểm ≤ Điểm tối đa
   + Trạng thái: Có thi / Vắng thi
   + Nhận xét: tùy chọn
- Nút “Lưu nháp”, “Công bố điểm”
3. Rule hiển thị / Format
- Danh sách HV = HV đang học lớp tại Ngày kiểm tra
- Điểm nhập bước 0.25; ngoài khoảng: lỗi “Điểm phải từ 0 đến [điểm tối đa]”
- Vắng thi: ô điểm disable, hiển thị “Vắng”
- Danh sách bài của HV (FUNC-052): hiển thị chung với bài online, nhãn “Offline”, không có nút Làm bài, chỉ có Xem kết quả sau khi công bố
- HV chỉ thấy điểm sau khi GV công bố (cùng rule FUNC-060, FUNC-063)
- Điểm được tính vào điểm tổng kết (FUNC-070); sửa điểm sau công bố theo FUNC-061
- Cho phép import điểm từ file Excel theo mẫu

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 70`; trạng thái review: Loại bỏ; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
