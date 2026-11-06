# Module 06 — Bài tập & ngân hàng đề

**Tên kỹ thuật:** Assignments & Question Bank  
**Số yêu cầu:** 16  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Mẫu đề Word/PDF, rubric chi tiết, upload và xử lý layout đề xử lý khi tới module.
- Nhiều dạng câu đã xác nhận; không tự hứa convert đề 100%.
- Đồng bộ autosave và thời gian bài cần đặc tả trước khi code.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-039 — Tạo/chỉnh sửa/xóa bài tập và bài kiểm tra

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 36`; Chức năng!13; Câu hỏi mở #15

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Sheet chức năng ghi CRUD và tạo thủ công; UI chi tiết chốt ở prototype.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV (và Admin) tạo, xem, sửa, xóa bộ đề: BTVN, Mini-test, Giữa kỳ, Cuối kỳ; quản lý trạng thái Nháp / Đã phát hành.
2. Trường thông tin
- Danh sách đề:
   + Tên đề, Loại đề, Khóa HSK, Số câu, Tổng điểm, Người tạo, Ngày cập nhật, Trạng thái, Số lớp đã giao, Thao tác
- Form thông tin đề:
   + Tên đề: bắt buộc, tối đa 200 ký tự
   + Loại đề: BTVN / Mini-test / Giữa kỳ / Cuối kỳ, bắt buộc
   + Khóa HSK: bắt buộc
   + Thời gian làm bài (phút): tùy chọn 
   + Mô tả / hướng dẫn: tùy chọn
   + Cách tạo: Upload file (FUNC-040) / Tạo thủ công (FUNC-043)
   + Danh sách câu hỏi
3. Rule hiển thị / Format
- Trạng thái: Nháp (xám) → Đã phát hành (xanh lá); chỉ đề Đã phát hành mới giao được
- Tổng điểm = tổng điểm các câu, tự tính
- Đề đã có HV làm bài: không cho xóa, khóa sửa câu hỏi; Có button “Nhân bản đề” để tạo bản mới
- Xóa đề Nháp: popup xác nhận
- Lọc theo Loại, Khóa HSK, Trạng thái; tìm theo Tên đề

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 36`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-040 — Tải đề Word/PDF

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 37`; Chức năng!13; Câu hỏi mở #15, #46

**TBD-DEFERRED:** Định dạng/khả năng xử lý file `.doc`, `.docx`, `.pdf`, PDF scan, giới hạn upload, import mẫu đề chỉ chốt khi đến module ngân hàng đề; không cam kết tự động nhận diện hoàn hảo.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Trung tâm đồng ý dùng .docx/.pdf, chọn định dạng tối ưu (#46). Cần báo trung tâm không nhận .doc cũ và PDF scan.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV upload file đề soạn sẵn dạng Word/PDF để hệ thống chuyển thành câu hỏi (Q15).
2. Trường thông tin
- Vùng upload: kéo-thả hoặc nút “Chọn file”
- Thông tin file: Tên file, Dung lượng, Trạng thái xử lý
- File audio / hình ảnh đính kèm riêng (nếu không nhúng trong file đề)
3. Rule hiển thị / Format
- Định dạng chấp nhận: .docx (khuyến nghị) và .pdf có lớp chữ; không hỗ trợ .doc cũ và PDF scan (Câu hỏi mở #46: trung tâm dùng định dạng tối ưu cho hệ thống)
- Dung lượng tối đa: 20MB
- Sai định dạng / quá dung lượng: “Chỉ hỗ trợ file .docx, .pdf tối đa 20MB”
- Trạng thái xử lý: Đang tải lên (%) → Đang phân tích → Hoàn tất / Lỗi
- Lưu file gốc để GV tải lại / đối chiếu
- Hoàn tất: chuyển sang màn Kiểm tra đề (FUNC-042)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 37`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-041 — Chuyển đề thành câu hỏi tương tác

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 38`; Trao đổi 23/10; báo cáo đối chiếu mục C

**TBD-DEFERRED:** Pipeline chuyển đổi đề chưa có file mẫu thực tế; ưu tiên duyệt lại đề trước khi công bố; không cam kết nhận dạng tự động 100%.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Không cam kết trích xuất chính xác 100%; chất lượng phụ thuộc mẫu đề thực tế.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Hệ thống đọc file Word/PDF, nhận diện câu hỏi, phương án, đáp án, dạng câu và tạo bản nháp câu hỏi tương tác.
2. Trường thông tin
- Mỗi câu được nhận diện:
   + STT câu
   + Dạng câu (7 dạng ở Q13)
   + Nội dung câu hỏi
   + Phương án (A, B, C, D…)
   + Đáp án đúng
   + Hình ảnh / audio đi kèm
   + Điểm (mặc định)
   + Cờ “Cần kiểm tra”
3. Rule hiển thị / Format
- Kết quả luôn ở trạng thái Nháp, không tự giao cho HV
- Câu không nhận diện được dạng/đáp án: gắn cờ “Cần kiểm tra” (màu cam)
- Giữ nguyên chữ Hán, pinyin, dấu thanh
- Tóm tắt sau xử lý: “Nhận diện [n] câu; [m] câu cần kiểm tra”
- Điểm mặc định mỗi câu: 1
- Không cam kết chính xác 100%; chất lượng phụ thuộc mẫu đề thực tế

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 38`; trạng thái review: Có – Đáp ứng; **không coi như kiểm chứng backend**.

### FUNC-042 — Giáo viên kiểm tra đề sau chuyển đổi

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đề xuất
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 39`; Kiểm soát chất lượng import Word/PDF

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đề nghị bắt buộc duyệt đề vì nguy cơ nhận diện sai.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV rà soát, chỉnh sửa kết quả chuyển đổi đề trước khi phát hành/giao cho HV.
2. Trường thông tin
- Bố cục 2 cột:
   + Trái: preview file gốc
   + Phải: danh sách câu đã nhận diện
- Mỗi câu: Dạng câu, Nội dung, Phương án, Đáp án đúng, Media, Điểm, Thao tác (Sửa / Xóa / Thêm câu / Đổi thứ tự)
- Nút “Lưu nháp”, “Xem trước như HV”, “Phát hành”
3. Rule hiển thị / Format
- Câu “Cần kiểm tra” được đánh dấu nổi bật; có bộ lọc “Chỉ hiện câu cần kiểm tra”
- Nút Phát hành chỉ enable khi:
   + Không còn câu “Cần kiểm tra”
   + Mọi câu tự chấm đã có đáp án đúng
   + Câu tự luận đã có đáp án mẫu / rubric (FUNC-048)
- Bắt buộc duyệt trước khi giao

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 39`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-043 — Biên tập câu hỏi thủ công

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 40`; Chức năng!13 (tạo manual + import)

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Câu hỏi mở #15 nghiêng về upload đề soạn sẵn; cần tránh đầu tư UI soạn đề quá phức tạp.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV tạo mới hoặc sửa câu hỏi, đáp án trực tiếp trên web (khi file import lỗi hoặc cần bổ sung).
2. Trường thông tin
- Dạng câu: dropdown 7 dạng, bắt buộc
- Nội dung câu hỏi: rich text, hỗ trợ chữ Hán/pinyin, bắt buộc
- Media: hình ảnh/audio, tùy chọn (bắt buộc với dạng Nghe)
- Phương án / Đáp án: theo từng dạng (FUNC-044 → FUNC-050)
- Điểm: số > 0, bắt buộc
- Giải thích đáp án: tùy chọn
3. Rule hiển thị / Format
- Form thay đổi trường theo Dạng câu đã chọn
- Kéo-thả để đổi thứ tự câu; STT tự đánh lại
- Tự lưu nháp khi đang soạn
- Câu thuộc đề đã có bài làm HV: khóa sửa
- Giữ UI soạn đề ở mức cơ bản (Q15 nghiêng về upload đề soạn sẵn)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 40`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-044 — Câu hỏi trắc nghiệm 1 đáp án

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 41`; Câu hỏi mở #13; #16

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cấu hình điểm mỗi câu trong SRS.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu chọn 1 phương án đúng; hệ thống tự chấm.
2. Trường thông tin
- Phía GV:
   + Nội dung câu hỏi
   + Phương án: tối thiểu 2, tối đa 4
   + Đáp án đúng: chọn 1
   + Điểm
- Phía HV: nội dung câu + danh sách phương án dạng radio
3. Rule hiển thị / Format
- Phương án đánh nhãn A, B, C, D…
- HV chỉ chọn được 1, đổi được trước khi nộp
- Chấm: đúng → full điểm; sai / bỏ trống → 0
- Sau công bố: đáp án HV chọn hiển thị xanh (đúng) / đỏ (sai); đáp án đúng hiển thị nếu GV cho công bố đáp án

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 41`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-045 — Câu hỏi trắc nghiệm nhiều đáp án

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 42`; Câu hỏi mở #13; #16; Câu hỏi mở #47

**TBD-DEFERRED:** Q47 chỉ xác nhận chọn thiếu đáp án không được **điểm tối đa**. Chưa chốt 0 điểm hay điểm từng phần: không code rule nào cho đến khi xác nhận.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Câu hỏi mở #47: chọn đúng một phần không được điểm tối đa. Cần chốt lại: trường hợp này 0 điểm hay được điểm một phần theo công thức.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu chọn nhiều phương án đúng; hệ thống so khớp với tập đáp án đúng để chấm.
2. Trường thông tin
- Phía GV:
   + Nội dung câu hỏi, Phương án
   + Đáp án đúng: chọn ≥ 2
   + Điểm
   + Cách chấm: Điểm từng phần 
- Phía HV: danh sách phương án dạng checkbox
3. Rule hiển thị / Format
- Hiển thị hướng dẫn “Chọn tất cả đáp án đúng”
- Phương án đánh nhãn A, B, C, D…
- Chỉ chọn đúng và đủ mới được điểm tối đa; chọn đúng một phần không được điểm tối đa (Câu hỏi mở #47)
- Chấm mặc định: thiếu/thừa → 0
- Nếu dùng điểm từng phần: Điểm = Điểm câu × (số đúng đã chọn − số sai đã chọn) / tổng số đáp án đúng, tối thiểu 0

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 42`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-046 — Điền từ / trả lời ngắn

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 43`; Câu hỏi mở #13; #16

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Tự chấm theo đáp án khớp, không dùng AI (#40); nhiều cách viết đúng cần thử mẫu.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu HV nhập từ / cụm từ / câu ngắn vào ô trống; hệ thống so khớp với danh sách đáp án chấp nhận.
2. Trường thông tin
- Phía GV:
   + Nội dung câu, vị trí ô trống đánh dấu bằng ___
   + Đáp án chấp nhận: nhiều giá trị cho mỗi ô
   + Điểm
   + Tùy chọn phân biệt dấu thanh pinyin (Có/Không)
- Phía HV: ô input nằm ngay tại vị trí trống
3. Rule hiển thị / Format
- Hỗ trợ nhập chữ Hán (bộ gõ IME) và pinyin
- Chấm tự động: khớp 1 trong các đáp án chấp nhận; bỏ khoảng trắng đầu/cuối; chuẩn hóa dấu câu full-width / half-width
- Không khớp: chuyển “Chờ GV kiểm tra” (FUNC-057)
- Câu nhiều ô: điểm chia đều theo số ô

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 43`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-047 — Sắp xếp từ thành câu

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 44`; Câu hỏi mở #13

**TBD-DEFERRED:** Mẫu đề câu sắp xếp sẽ bổ sung tại module đề, chưa chốt các đáp án tương đương.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần mẫu để xác định có nhiều đáp án hợp lệ; trung tâm hẹn gửi sau (#37).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu HV sắp xếp các từ / nhóm từ thành câu tiếng Trung đúng.
2. Trường thông tin
- Phía GV:
   + Câu đúng
   + Các mảnh từ: tự tách từ câu đúng hoặc nhập thủ công
   + Đáp án chấp nhận khác (khi có nhiều thứ tự hợp lệ)
   + Điểm
- Phía HV: ngân hàng từ (đã xáo trộn) + vùng ghép câu
3. Rule hiển thị / Format
- Thứ tự từ hiển thị xáo trộn ngẫu nhiên, không trùng thứ tự đúng
- Kéo-thả hoặc chạm để đưa từ vào vùng câu; chạm lại để trả về; hỗ trợ mobile
- Chấm: khớp 1 trong các đáp án chấp nhận → full điểm; khác → 0
- [Chờ chốt] cần file mẫu để xác định các trường hợp nhiều đáp án hợp lệ

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 44`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-048 — Bài viết / dịch câu / tự luận

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 45`; Câu hỏi mở #13; #16; quyết định tích hợp AI 24/10; Câu hỏi mở #40

**TBD-DEFERRED:** Rubric, điểm theo kỹ năng và đề mẫu để sau; Phase 1 GV chấm tự luận, không dùng AI.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Phase 1 GV chấm tự luận, không dùng AI (#40). Tiêu chí chấm và bài mẫu trung tâm hẹn gửi sau (#38).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu HV viết câu / dịch câu / tự luận bằng chữ Hán hoặc văn bản tự do; GV chấm và xác nhận điểm; Phase 1 không dùng AI chấm (Câu hỏi mở #40).
2. Trường thông tin
- Phía GV:
   + Đề bài
   + Đáp án mẫu
   + Rubric / tiêu chí chấm
   + Điểm tối đa
   + Giới hạn ký tự: tùy chọn
- Phía HV: textarea + bộ đếm ký tự
3. Rule hiển thị / Format
- Hỗ trợ chữ Hán, pinyin, tiếng Việt
- Bộ đếm dạng “120/300 ký tự”; vượt giới hạn: chặn nhập thêm
- Không tự chốt điểm: Chờ chấm → GV chấm/xác nhận (FUNC-058, FUNC-059)
- [Chờ chốt] cần rubric và ví dụ bài đạt / chưa đạt từ trung tâm

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 45`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-049 — Bài nghe kèm audio

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 46`; Câu hỏi mở #13

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Tài liệu mẫu audio và định dạng file cần BA cung cấp.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu kèm file audio tiếng Trung để HV nghe và trả lời (hình thức trả lời: trắc nghiệm, điền từ…).
2. Trường thông tin
- Phía GV:
   + File audio: bắt buộc
   + Số lần nghe tối đa: tùy chọn
   + Câu hỏi con (1 audio dùng cho nhiều câu)
- Phía HV: trình phát audio (Play/Pause, thanh thời gian, thời lượng) + câu hỏi
3. Rule hiển thị / Format
- Định dạng: .mp3, .m4a, .wav; dung lượng tối đa 20 MB
- Thời lượng hiển thị mm:ss
- Có giới hạn lượt nghe: hiển thị “Còn [n] lượt nghe”; hết lượt → disable Play
- Lỗi tải audio: “Không tải được audio, vui lòng thử lại”
- Tâm tít cung cấp tài liệu mẫu audio

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 46`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-050 — Câu hỏi kèm hình ảnh

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 47`; Câu hỏi mở #13

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần kiểm thử hình ảnh được trích từ PDF/Word.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Dạng câu hiển thị hình ảnh làm ngữ liệu hoặc làm phương án để HV chọn/nhập đáp án.
2. Trường thông tin
- Phía GV:
   + Ảnh câu hỏi hoặc Ảnh cho từng phương án
   + Chú thích ảnh: tùy chọn
   + Đáp án đúng, Điểm
- Phía HV: ảnh + phương án / ô nhập
3. Rule hiển thị / Format
- Định dạng .jpg, .png; dung lượng tối đa 5 MB 
- Ảnh co giãn theo màn hình, click để phóng to
- Phương án là ảnh: lưới 2 cột (mobile) / 4 cột (desktop), nhãn A, B, C, D
- Ảnh trích từ Word/PDF phải hiển thị ở bước Kiểm tra đề (FUNC-042) để GV xác nhận đúng câu

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 47`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-051 — Giao bài tập cho lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 48`; Chức năng!10; Vai trò!2

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Giao riêng từng học viên/chọn hạn nộp chưa được ghi nhận.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép GV giao đề đã phát hành cho lớp mình phụ trách.
2. Trường thông tin
- Đề: dropdown, bắt buộc, chỉ đề Đã phát hành
- Lớp: chọn 1 hoặc nhiều lớp phụ trách, bắt buộc
- Thời gian mở bài: datetime, mặc định = ngay khi giao
- Hạn nộp: datetime 
- Buổi học liên quan: tùy chọn (gắn BTVN với buổi)
- Công bố đáp án khi công bố điểm: Có / Không
3. Rule hiển thị / Format
- Ngày giờ: dd/mm/yyyy HH:mm
- Hạn nộp phải sau Thời gian mở bài
- Giao cho cả lớp: mọi HV đang học lớp tại thời điểm giao đều nhận bài; giao riêng từng HV: ngoài phạm vi Phase 1
- Không giao được cho lớp Đã kết thúc (FUNC-079)
- Sau khi giao: bài hiển thị trong danh sách của HV (FUNC-052) từ Thời gian mở bài
- Thông báo cho HV khi có bài mới: theo FUNC-080

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 48`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-052 — Danh sách bài được giao

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 49`; Vai trò!6; Chức năng!10

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Thiết kế trạng thái chưa làm/đang làm/đã nộp theo SRS.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép HV xem danh sách bài tập / bài kiểm tra của lớp mình và tình trạng làm bài.
2. Trường thông tin
- Tên bài
- Loại: BTVN / Mini-test / Giữa kỳ / Cuối kỳ
- Ngày giao, Hạn nộp
- Trạng thái
- Điểm (khi đã công bố)
- Thao tác: Làm bài / Tiếp tục làm / Xem bài nộp / Xem kết quả
3. Rule hiển thị / Format
- Tag trạng thái:
   + Chưa làm: xám
   + Đang làm: vàng
   + Đã nộp – chờ chấm: xanh dương
   + Đã có điểm: xanh lá
   + Quá hạn: đỏ (nếu có hạn nộp)
- Thao tác “Xem bài nộp”: chỉ hiện với bài Đã nộp – chờ chấm; mở màn “Bài đã nộp, đang chờ giáo viên chấm” (chỉ xem, không sửa bài)
- Điểm dạng “8/10” chỉ khi đã công bố; chưa công bố: “Chờ công bố”
- Tab/lọc theo Loại và Trạng thái; sắp xếp: Chưa làm & gần hạn lên đầu
- Chưa có bài: “Chưa có bài được giao”

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 49`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-053 — Lưu bài đang làm

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 50`; Người dùng xác nhận câu 25 ngày 23/10

**TBD MODULE:** Tạm dừng timer offline, xung đột 2 tab, đồng bộ và chính sách timeout là nghiệp vụ nhạy cảm. Không tự áp dụng ý tưởng trong Excel nếu chưa duyệt.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần định nghĩa kỹ thuật lưu cục bộ/tự đồng bộ khi kết nối trở lại.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Tự động lưu câu trả lời nháp khi HV đang làm bài; mất mạng / thoát trang vẫn tiếp tục được.
2. Trường thông tin
- Câu trả lời từng câu
- Thời điểm lưu cuối
- Trạng thái kết nối / đồng bộ
- Vị trí câu đang làm
3. Rule hiển thị / Format
- Tự lưu mỗi khi HV trả lời/đổi đáp án; câu tự luận lưu mỗi 30 giây (đề xuất)
- Chỉ báo trạng thái:
   + “An toàn – Đã lưu lúc HH:mm:ss”
   + “Đang lưu…”
   + “Mất kết nối – câu trả lời được lưu tạm trên thiết bị”
- Có mạng lại: tự đồng bộ lên server
- Mở lại bài: khôi phục câu trả lời và vị trí câu đang làm
- Nếu bài có giới hạn thời gian: thời gian sẽ dừng lại, khi nào HV truy cập lại thì tiếp tục tính giờ

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 50`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-054 — Chỉ cho nộp bài một lượt

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 51`; Câu hỏi mở #14; yêu cầu lưu nháp câu 25; Câu hỏi mở #48

**TBD MODULE:** Một lượt nộp chính thức + GV được mở lại đã chốt; cách reset/giữ attempt, auto submit khi offline TBD.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt GV được cho HV nộp lại (#48). Cần mô tả: mở lại giữ bài làm cũ hay làm lại từ đầu.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Mỗi HV chỉ có 1 lượt nộp chính thức cho mỗi bài (Q14); trước khi nộp vẫn tiếp tục bản nháp.
- Khi nộp, hệ thống lưu đầy đủ bài làm phục vụ chấm và tra cứu (đã gộp FUNC-055).
2. Trường thông tin
- Nút “Nộp bài”
- Popup xác nhận:
   + Số câu đã trả lời / tổng số câu
   + Danh sách câu chưa trả lời
- Dữ liệu bài nộp được lưu:
   + Học viên, Bài/đề, Lớp
   + Thời gian bắt đầu, Thời gian nộp, Thời lượng làm bài
   + Câu trả lời từng câu
   + Kết quả chấm từng câu (Đúng/Sai, Điểm), Trạng thái chấm
3. Rule hiển thị / Format
- Popup: “Bạn đã trả lời x/y câu. Sau khi nộp sẽ không thể sửa. Xác nhận nộp?” (Nộp bài / Quay lại)
- Câu chưa trả lời: highlight, có link nhảy tới câu
- Sau khi nộp: bài read-only, ẩn nút Làm bài, trạng thái “Đã nộp”
- Thời gian dd/mm/yyyy HH:mm; Thời lượng “x phút y giây”
- Trạng thái chấm: Chờ chấm → Đã chấm sơ bộ → GV đã xác nhận → Đã công bố
- Nội dung bài nộp không bị sửa sau khi nộp; chỉnh điểm lưu riêng (FUNC-061, FUNC-064)
- Chặn nộp trùng (double click, mở 2 tab)
- Hết hạn nộp hệ thống tự nộp bản nháp
- GV được mở lại lượt nộp cho từng HV trong trường hợp đặc biệt, vd mất mạng khi đang làm (Câu hỏi mở #48)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 51`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
