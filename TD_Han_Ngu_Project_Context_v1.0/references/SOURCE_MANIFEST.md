# Source Manifest — nguyên trạng từ nguồn

- `Final.xlsx`: 9 sheets, SHA-256 `026da17073c9d74d3dbb38ca0b88de50f6c631b2f5cec8262c3704682e744007`.
- Điểm kiểm tra trên nguồn: 71 chức năng trong `Function List ` (dòng 4–74), 51 câu hỏi trong `Câu hỏi mở` (dòng 2–52).
- Phiên bản context: 06/11/2026; một số quy tắc **mới hơn Excel** và được ghi tại `decision-log.md`.

## Sheet inventory

| Sheet | Kích thước nội dung đã đọc | Vai trò |
|---|---|---|
| Phạm vi | 9 dòng × 3 cột | Scope |
| Chức năng | 14 dòng × 4 cột | High-level decisions |
| Vai trò | 6 dòng × 3 cột | Actors/RBAC |
| Quy tắc | 16 dòng × 4 cột | Business rules (có nội dung lỗi thời) |
| Thực thể | 11 dòng × 2 cột | Domain inventory |
| Câu hỏi mở | 52 dòng × 5 cột | Questions & answers |
| Function List | 74 dòng × 10 cột | Functional requirements |
| Review Prototype theo Function | 74 dòng × 10 cột | Prototype review |
| Chức năng thừa trong Prototype | 17 dòng × 6 cột | Demo-only UI / cleanup |

## Links/nguồn bổ sung

- GitHub repo: https://github.com/luongviettienns/WebEdu
- README: https://github.com/luongviettienns/WebEdu/blob/main/README.md
- Progress: https://github.com/luongviettienns/WebEdu/blob/main/PROJECT_PROGRESS.md

## Quy tắc phân giải xung đột

Decision Log mới nhất > đặc tả có override > câu trả lời Closed có hiệu lực > Function List Excel > Review prototype > AI suggestion. Khi thông tin cũ mâu thuẫn, không sửa/sai lệch nguồn gốc; tạo bản quyết định mới có thể truy vết.
