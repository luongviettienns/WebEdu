# Roles & Permissions — Ma trận mức nguyên tắc

**Vai trò:** Student / Teacher / Admin / Superadmin. Không tạo role phụ huynh riêng.

| Resource / Thao tác | Học viên | Giáo viên | Admin | Superadmin | Căn cứ / ghi chú |
|---|---|---|---|---|---|
| Đăng ký tài khoản học viên | Tự đăng ký | — | — | — | FUNC-001 / Q8 |
| Xem hồ sơ HV | Chính mình | Trong lớp được giao (phạm vi field TBD) | Toàn bộ để vận hành | Quản trị hệ thống | FUNC-010, 011, 012 |
| Xem danh sách/chi tiết lớp | Lớp đang học | Lớp đang được phân công + Lớp đã kết thúc mà mình phụ trách (`DEC-025`; nếu bị thay GV thì mất quyền xem) | Tất cả | Không mặc định xem dữ liệu học tập | FUNC-011, 018, 024, 079; `DEC-025` |
| Xem lịch sử lớp của học viên | Lịch sử lớp của chính mình | **Không** được xem lịch sử lớp cũ của học viên (`DEC-024`) | Xem lịch sử của tất cả học viên | Không mặc định được xem dữ liệu học tập | FUNC-010..013, 023; `DEC-024` |
| Tạo/sửa lớp, đổi lịch | — | TBD | Có | TBD/giám sát | FUNC-016,017,029 |
| Phân công giáo viên | — | — | Có | TBD | FUNC-018 |
| Xếp/chuyển/rút HV khỏi lớp | — | — | Có | TBD | FUNC-020,022,077 |
| Điểm danh buổi học | — | Lớp được giao | Có (`FUNC-034`, sửa bất kỳ lúc nào `FUNC-037`) | — | FUNC-034,037; `DEC-026` |
| Ngân hàng đề, tải/chuyển đổi/duyệt đề, giao bài (`FUNC-040..052`) | Xem bài được giao / nộp bài (`FUNC-052..054`) | Tạo đề, duyệt đề, giao bài lớp mình | **Có đầy đủ quyền `FUNC-040..052`** (`DEC-026`) | — | FUNC-040–054; `DEC-026` |
| Chấm tự luận / sửa điểm / theo dõi nộp bài | — | Lớp được giao | Có (`FUNC-058, 061, 062`) | — | FUNC-058,061,062; `DEC-026` |
| Xác nhận/công bố điểm | Xem sau publish | Lớp mình | **Có quyền công bố điểm (`FUNC-060`)** (`DEC-026`) | — | FUNC-059–060; `DEC-026` |
| Quản lý kỳ kiểm tra & biểu mẫu đề (`FUNC-065, 068`) | — | Lớp mình | **Có (`FUNC-065, 068`)** (`DEC-026`) | — | FUNC-065, 068; `DEC-026` |
| Xem tiến độ/điểm | Chính mình | Lớp mình | Tất cả lớp | Không mặc định xem dữ liệu học tập | FUNC-063,071–075 |
| Thông báo trong hệ thống (`FUNC-080`) | Có | Có | **Có (`FUNC-080`)** (`DEC-026`) | Có | FUNC-080; `DEC-026` |
| Quản lý tài khoản GV/Admin | — | — | TBD | Superadmin vận hành hệ thống | FUNC-006,013 |
| Cấu hình tên trung tâm/logo | — | — | TBD | Có | FUNC-013/Q22 |

## Bất biến bảo mật

- Mọi API object-level: kiểm tra `authenticated user → role → relation to class/student/assignment → action`, không ủy quyền dựa vào ID do frontend tự gửi.
- Cách gộp đa vai trò phải nhất quán giữa backend/frontend; `FUNC-009` ghi quyền cao nhất.
- Không dùng frontend hide/show để thay authorization server-side.
- Cấm lộ điểm/đáp án chưa publish qua bất cứ endpoint học viên nào.
- Các ô `TBD` không phải ngầm cho phép; **mặc định từ chối quyền chưa xác nhận**.
