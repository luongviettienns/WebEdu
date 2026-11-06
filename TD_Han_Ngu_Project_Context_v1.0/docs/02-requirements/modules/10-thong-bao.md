# Module 10 — Thông báo

**Tên kỹ thuật:** In-App Notifications  
**Số yêu cầu:** 1  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Chỉ thông báo in-app Phase 1.
- Chỉ thông báo theo quyền, không leak dữ liệu qua badge/link/notification payload.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-080 — Thông báo trong hệ thống

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên; Giáo viên; Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 74`; Bổ sung khi review; Câu hỏi mở #43

**CONFIRMED:** In-app notifications. Không tự phát triển Zalo/email thông báo nghiệp vụ; email reset password là luồng khác.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt cần thông báo trong web (#43); email/Zalo ngoài phạm vi.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Thông báo cho user khi có sự kiện liên quan, để HV/GV không phải tự vào kiểm tra.
2. Trường thông tin
- Icon chuông trên header + badge số thông báo chưa đọc
- Mỗi thông báo: Nội dung, Thời gian, Trạng thái Đã đọc/Chưa đọc, Link tới màn liên quan
- Sự kiện gửi thông báo:
   + HV: có bài mới được giao, bài sắp hết hạn, điểm đã công bố, buổi học bị đổi/hủy, được xếp lớp
   + GV: được phân công lớp, buổi học bị đổi/hủy, có bài nộp chờ chấm
   + Admin: có tài khoản HV mới chờ xếp lớp
3. Rule hiển thị / Format
- Thông báo chưa đọc in đậm, nền nhạt
- Thời gian dạng tương đối “5 phút trước”, quá 7 ngày hiển thị dd/mm/yyyy
- Click thông báo: đánh dấu đã đọc và mở màn liên quan; có nút “Đánh dấu tất cả đã đọc”
- Chỉ thông báo trong web (in-app); email/Zalo ngoài phạm vi

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 74`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
