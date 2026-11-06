# Roles & Permissions — Ma trận mức nguyên tắc

**Vai trò:** Student / Teacher / Admin / Superadmin. Không tạo role phụ huynh riêng.

| Resource / Thao tác | Học viên | Giáo viên | Admin | Superadmin | Căn cứ / ghi chú |
|---|---|---|---|---|---|
| Đăng ký tài khoản học viên | Tự đăng ký | — | — | — | FUNC-001 / Q8 |
| Xem hồ sơ HV | Chính mình | Trong lớp được giao (phạm vi field TBD) | Toàn bộ để vận hành | Quản trị hệ thống | FUNC-010, 011, 012 |
| Xem danh sách/chi tiết lớp | Lớp đang học | Lớp được phân công | Tất cả | Tất cả | FUNC-024 |
| Tạo/sửa lớp, đổi lịch | — | TBD | Có | TBD/giám sát | FUNC-016,017,029 |
| Phân công giáo viên | — | — | Có | TBD | FUNC-018 |
| Xếp/chuyển/rút HV khỏi lớp | — | — | Có | TBD | FUNC-020,022,077 |
| Điểm danh buổi học | — | Lớp được giao | Có / sửa bất kỳ lúc nào | TBD | FUNC-034,037; Q31–32 |
| Xem bài được giao / nộp bài | Bài của mình | Giao/chấm lớp mình | Xem/quản lý theo quyền TBD | TBD | FUNC-051–054,058 |
| Chấm tự luận / sửa điểm | — | Lớp được giao | Được sửa điểm | TBD | FUNC-058,061; Q34 |
| Xác nhận/công bố điểm | Xem sau publish | Lớp mình | TBD | TBD | FUNC-059–060 |
| Xem tiến độ/điểm | Chính mình | Lớp mình | Tất cả lớp | TBD | FUNC-063,071–075 |
| Quản lý tài khoản GV/Admin | — | — | TBD | Superadmin vận hành hệ thống | FUNC-006,013 |
| Cấu hình tên trung tâm/logo | — | — | TBD | Có | FUNC-013/Q22 |

## Bất biến bảo mật

- Mọi API object-level: kiểm tra `authenticated user → role → relation to class/student/assignment → action`, không ủy quyền dựa vào ID do frontend tự gửi.
- Cách gộp đa vai trò phải nhất quán giữa backend/frontend; `FUNC-009` ghi quyền cao nhất.
- Không dùng frontend hide/show để thay authorization server-side.
- Cấm lộ điểm/đáp án chưa publish qua bất cứ endpoint học viên nào.
- Các ô `TBD` không phải ngầm cho phép; **mặc định từ chối quyền chưa xác nhận**.
