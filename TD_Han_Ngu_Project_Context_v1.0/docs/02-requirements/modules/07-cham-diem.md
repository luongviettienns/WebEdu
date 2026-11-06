# Module 07 — Chấm điểm & AI

**Tên kỹ thuật:** Grading & Publication  
**Số yêu cầu:** 9  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- FUNC-057 ngoài phạm vi Phase 1, không dùng AI chấm tự luận.
- Tự chấm khách quan theo đáp án; xác nhận → công bố; audit mọi sửa điểm.
- Scoring, partial credit, thang điểm, điểm không nộp đều phải chốt ở module.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-056 — Tự động chấm trắc nghiệm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Hệ thống; Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 52`; Chức năng!14; Câu hỏi mở #16, #40

**TBD-DEFERRED:** Chấm tự động theo đáp án (rule-based), không cần AI model. Điểm thang 100, rounding, đáp án tương đương chốt ở module chấm; chưa mặc định.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Chỉ cam kết tự chấm chắc chắn cho câu hỏi có quy tắc rõ ràng. Khách gọi là “AI chấm trắc nghiệm” (#40), hệ thống chấm theo đáp án, không cần model AI.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Hệ thống tự động chấm các dạng câu có đáp án xác định ngay khi HV nộp bài; câu tự luận do GV chấm (Câu hỏi mở #40).
2. Trường thông tin
- Áp dụng cho: Trắc nghiệm 1 đáp án, Trắc nghiệm nhiều đáp án, Điền từ (khớp đáp án), Sắp xếp câu, câu Nghe/Hình dạng chọn
- Kết quả: Đúng/Sai từng câu, Điểm từng câu, Tổng điểm sơ bộ
3. Rule hiển thị / Format
- Kết quả chỉ hiển thị cho GV; HV chưa thấy cho đến khi công bố (FUNC-060)
- Tổng điểm dạng “x/y”, 1 chữ số thập phân (đề xuất) 
- Chấm theo điểm thang 100
- Trạng thái chấm của bài (theo FUNC-054):
   + Đề chỉ có câu tự chấm: chuyển ngay “Đã chấm sơ bộ”
   + Đề có câu tự luận: giữ “Chờ chấm”, câu tự luận gắn nhãn “Chờ GV chấm” cho đến khi mọi câu có điểm

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 52`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-057 — AI chấm sơ bộ bài mở

- **Trạng thái phạm vi:** Ngoài phạm vi · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Loại bỏ
- **Vai trò ghi nhận:** Hệ thống; Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 53`; Người dùng chốt tích hợp AI ngày 24/10; Câu hỏi mở #40

**OUT-OF-SCOPE PHASE 1:** Không phát triển AI chấm bài mở (Q40).

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Câu hỏi mở #40: Phase 1 không dùng AI chấm bài mở. Trắc nghiệm chấm tự động (FUNC-056), GV chấm tự luận (FUNC-058).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Gửi đề, đáp án mẫu/rubric và câu trả lời của HV qua API model AI để đề xuất điểm + nhận xét cho câu tự luận/viết/dịch (và điền từ không khớp).
2. Trường thông tin
- Input gửi AI: Đề bài, Đáp án mẫu, Rubric, Điểm tối đa, Câu trả lời HV
- Output: Điểm AI đề xuất, Nhận xét AI, Trạng thái (Thành công / Lỗi)
3. Rule hiển thị / Format
- Điểm AI gắn nhãn “AI đề xuất”, chỉ GV thấy
- Điểm AI không vượt Điểm tối đa của câu
- Không gửi thông tin định danh HV (họ tên, SĐT, email) sang AI
- Lỗi/timeout: “AI chưa chấm được – vui lòng chấm thủ công”, không chặn GV
- Không tự công bố điểm AI khi GV chưa xác nhận
- Hãng/model, chi phí API, bật/tắt AI theo từng đề

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 53`; trạng thái review: Loại bỏ; **không coi như kiểm chứng backend**.

### FUNC-058 — Giáo viên kiểm tra kết quả chấm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 54`; Câu hỏi mở #16; chốt workflow AI 24/10; Câu hỏi mở #40

**TBD-DEFERRED:** GV chấm tự luận đã chốt; bước .25 và thang điểm chưa chốt.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Không có điểm AI ở Phase 1 (#40); GV chấm câu tự luận.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV xem bài làm, điểm tự chấm; chấm câu tự luận, sửa điểm và bổ sung nhận xét.
2. Trường thông tin
- Danh sách bài nộp của 1 đề trong lớp: Học viên, Thời gian nộp, Điểm sơ bộ, Trạng thái chấm, Thao tác “Chấm”
- Màn chấm từng bài, mỗi câu gồm:
   + Câu hỏi, Câu trả lời của HV
   + Đáp án đúng / đáp án mẫu
   + Điểm hệ thống (câu tự chấm)
   + Điểm GV (input), Nhận xét GV
- Nhận xét chung cho cả bài
3. Rule hiển thị / Format
- Điểm GV mặc định = điểm hệ thống; câu tự luận để trống chờ GV chấm; GV sửa được, bước 0.25
- Câu GV sửa khác điểm hệ thống: nhãn “GV đã chỉnh”
- Câu chưa có điểm: highlight
- Nút “Bài trước” / “Bài sau” để chuyển nhanh giữa HV
- Tổng điểm tự tính lại khi sửa điểm câu

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 54`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-059 — Giáo viên xác nhận điểm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 55`; Câu hỏi mở #16; chốt workflow AI 24/10; Câu hỏi mở #41

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt tách 2 bước Xác nhận điểm → Công bố điểm (#41).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV chốt kết quả chấm sau khi rà soát.
2. Trường thông tin
- Nút “Xác nhận điểm” (từng bài)
- Nút “Xác nhận tất cả” (các bài đã chấm đủ)
3. Rule hiển thị / Format
- Chỉ enable khi mọi câu trong bài đã có điểm
- Sau xác nhận: trạng thái “GV đã xác nhận”; HV vẫn chưa thấy cho đến khi công bố (FUNC-060)
- Sau xác nhận vẫn sửa được theo FUNC-061
- Trạng thái chấm hiển thị tag: Chờ chấm (xám), Đã chấm sơ bộ (vàng), GV đã xác nhận (xanh dương), Đã công bố (xanh lá)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 55`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-060 — Công bố điểm sau duyệt

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 56`; Câu hỏi mở #16, #33, #41

**CONFIRMED:** HV chỉ xem sau xác nhận **và** công bố. **TBD:** quy tắc cho 0 điểm khi không nộp cần xác nhận trong module grading.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt 2 bước riêng (#41) và nội dung công bố: điểm, nhận xét, đáp án câu trắc nghiệm (#33).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV chủ động công bố kết quả cho HV; chỉ sau khi công bố HV mới thấy điểm (Q16).
2. Trường thông tin
- Nút “Công bố điểm”
- Phạm vi: Từng HV / Tất cả bài đã xác nhận
- Nội dung công bố (Câu hỏi mở #33): Điểm, Nhận xét của GV, Đáp án đúng của câu trắc nghiệm / câu tự chấm; câu tự luận GV ghi chú trong Nhận xét
3. Rule hiển thị / Format
- Chỉ công bố được bài trạng thái “GV đã xác nhận”
- Popup xác nhận: “Công bố điểm cho [n] học viên?”
- Sau công bố: trạng thái “Đã công bố”, ghi thời điểm công bố; HV thấy kết quả ngay (FUNC-063)
- HV không nộp bài sẽ bị ghi 0 điểm khi công bố

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 56`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-061 — Giáo viên chỉnh sửa điểm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 57`; Người dùng xác nhận câu 29 ngày 23/10; Câu hỏi mở #34, #49

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt Admin được sửa điểm (#34), lưu lịch sử mỗi lần sửa (#49).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV phụ trách lớp và Admin sửa điểm sau khi đã xác nhận hoặc đã công bố (Câu hỏi mở #34).
2. Trường thông tin
- Điểm mới từng câu
- Nhận xét
- Lý do chỉnh sửa (bắt buộc phải có lý do)
3. Rule hiển thị / Format
- GV phụ trách lớp và Admin được sửa (Câu hỏi mở #34)
- Sửa bài đã công bố: HV thấy điểm mới ngay; hiển thị nhãn “Đã cập nhật dd/mm/yyyy”
- Điểm tổng kết liên quan tự tính lại (FUNC-070)
- Mọi lần sửa ghi lịch sử (FUNC-064, Câu hỏi mở #49)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 57`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-062 — Theo dõi học viên đã nộp/chưa nộp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đề xuất
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 58`; Suy ra từ theo dõi bài tập và quyền giáo viên

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đây là hành vi thiết yếu, xác nhận qua prototype.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV theo dõi tình trạng làm bài và kết quả của từng HV trong lớp cho mỗi bài đã giao.
2. Trường thông tin
- Tóm tắt: Đã nộp x/y, Đang làm, Chưa làm, Đã chấm, Đã công bố
- Bảng HV:
   + Họ tên, Trạng thái làm bài, Thời gian nộp, Điểm, Trạng thái chấm, Thao tác (Chấm / Xem)
3. Rule hiển thị / Format
- Tag trạng thái theo quy ước màu FUNC-052
- Nộp sau hạn (nếu có hạn): nhãn “Nộp muộn”
- Lọc theo trạng thái; sắp xếp theo tên / thời gian nộp / điểm
- Chỉ lớp GV phụ trách
- View ma trận Học viên × Bài tập cho cả lớp

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 58`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-063 — Xem kết quả bài đã công bố

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 59`; Câu hỏi mở #16; Vai trò!5–6; Câu hỏi mở #33

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đáp án đúng hiển thị với câu trắc nghiệm; câu tự luận xem ghi chú GV (#33).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép HV xem điểm và chi tiết bài làm của chính mình đã được GV công bố.
2. Trường thông tin
- Tổng điểm, Thời gian nộp, Ngày công bố, Nhận xét chung của GV
- Từng câu:
   + Câu hỏi, Câu trả lời của HV
   + Đúng/Sai, Điểm
   + Đáp án đúng: với câu trắc nghiệm / câu tự chấm; câu tự luận xem ghi chú của GV (Câu hỏi mở #33)
   + Nhận xét của GV
3. Rule hiển thị / Format
- Chỉ hiển thị khi trạng thái Đã công bố; chưa công bố: “Bài đã nộp, đang chờ giáo viên chấm”
- Tổng điểm dạng “8.5/10”
- Câu đúng: icon ✓ xanh lá; câu sai: icon ✗ đỏ
- Chỉ dữ liệu của chính HV (FUNC-010)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 59`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-064 — Lưu lịch sử chỉnh sửa điểm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 60`; Trao đổi 23/10 (câu 29 chỉ chốt quyền sửa); Câu hỏi mở #49

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt lưu lịch sử mỗi lần sửa điểm (#49).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Lưu vết mọi lần GV/Admin thay đổi điểm sau khi đã xác nhận, phục vụ đối soát (Câu hỏi mở #49).
2. Trường thông tin
- Thời gian sửa
- Người sửa
- Học viên, Bài, Câu
- Điểm cũ, Điểm mới
- Lý do
3. Rule hiển thị / Format
- Thời gian dd/mm/yyyy HH:mm; mới nhất trên cùng
- Xem tại màn chấm bài (icon “Lịch sử”) và trang nhật ký của Admin
- Điểm cũ → mới dạng “6.0 → 7.5”
- Read-only; HV không thấy lịch sử này

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 60`; trạng thái review: Không; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
