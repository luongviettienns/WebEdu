# Scope & Objectives — Phase 1

**Mục tiêu:** hỗ trợ trung tâm TD Hán Ngữ vận hành lớp học và học tập trực tuyến; dự kiến ban đầu khoảng 10 người dùng. Không mở rộng thành hệ thống tuyển sinh, CRM hoặc thanh toán.

## Phạm vi đã xác nhận trong Final.xlsx

| Hạng mục | Quyết định nguồn | Ghi chú |
|---|---|---|
| Quản lý lớp học | In | Bao gồm khóa/lớp/GV/HV/lịch/điểm danh |
| Bài tập / Mini-test trực tuyến | In | Giao, làm, nộp, chấm |
| Chấm điểm trên web | In | Rule-based với câu khách quan, GV chấm tự luận |
| Tuyển sinh | Out | Không tạo CRM/lead form |
| Trang khách tiềm năng / form tuyển sinh | Out | Không thuộc Phase 1 |
| Tài khoản phụ huynh riêng | Out | Email phụ huynh trong luồng đăng ký không biến thành role phụ huynh |
| Thu học phí online | Out | Không phát triển thanh toán |

**Out theo function list:** `FUNC-057` (AI chấm bài mở), `FUNC-076` (nhập điểm từ giấy).

**Các chức năng ghi `Dự kiến P1` không tự động thành cam kết**: `FUNC-006`, `FUNC-007`, `FUNC-008`, `FUNC-014`, `FUNC-042`, `FUNC-070`, `FUNC-078`. Cần xác định mức tối thiểu cần thiết theo từng module.

**Cảnh báo về nội bộ:** Các bản review prototype đã đánh dấu 'Đã sửa' không chứng minh chức năng production/code đã hoàn thành.

## Mốc quyết định

Thực hiện lần lượt module, đặc tả chi tiết và xin quyết định nếu còn vướng khi bắt đầu module đó; ngoại trừ điểm chặn logic/an toàn tích hợp thì không cần khóa toàn bộ dự án.
