# Decision Log — lịch sử và mức độ hiệu lực

Các mục dưới đây là **quyết định hoặc quy tắc đã ghi nhận**, được phân biệt với đề xuất kỹ thuật. Ghi thêm ngày/người chốt khi có thay đổi mới.

| ID | Ngày/nguồn | Quyết định | Ảnh hưởng | Trạng thái |
|---|---|---|---|---|
| DEC-001 | 06/11/2026 — người quản lý dự án | **Email phụ huynh thay SĐT phụ huynh** trong đăng ký cho học viên dưới 16 tuổi. | FUNC-001, 002, 007, 008 và UI/auth | CONFIRMED, override Excel |
| DEC-002 | 06/11/2026 — người quản lý dự án | Công thức, trọng số điểm tổng kết để đến module Điểm/Tổng kết mới chốt. | FUNC-065, 069, 070 | TBD-DEFERRED |
| DEC-003 | 06/11/2026 — người quản lý dự án | Chi tiết scoring, rubric, điểm từng kỹ năng xử lý khi đến module Chấm điểm/Đề. | FUNC-045–048, 056–061 | TBD-DEFERRED |
| DEC-004 | 06/11/2026 — người quản lý dự án | Mẫu đề Word/PDF và hình thức đề cụ thể xử lý khi đến module Ngân hàng đề/Kiểm tra. | FUNC-040–042, 047, 048, 065, 068 | TBD-DEFERRED |
| DEC-005 | Q9, Function List FUNC-020 | Không giới hạn tối đa 5 học viên/lớp (BR-01 trong sheet Quy tắc lỗi thời). | Lớp học | CONFIRMED |
| DEC-006 | Q24 | Mỗi lớp có đúng một GV phụ trách, không có trợ giảng. | FUNC-018 | CONFIRMED |
| DEC-007 | Q25 | Học viên chỉ đang học một lớp tại một thời điểm. | FUNC-020, 022 | CONFIRMED |
| DEC-008 | Q12, Q50 | Chuyển/rút lớp không xóa lịch sử lớp cũ; dữ liệu mới thuộc lớp mới. | FUNC-022, 023, 077 | CONFIRMED |
| DEC-009 | Q26–28 | Không tự 'Đã học' khi quên điểm danh; hủy không bù không tự tạo; buổi bù thay buổi hủy. | FUNC-027, 030, 031 | CONFIRMED |
| DEC-010 | Q29–32 | Điểm danh 3 trạng thái; cảnh báo 30%; GV có cửa sổ sửa 2 ngày; Admin sửa bất kỳ lúc nào. | FUNC-034–037 | CONFIRMED ở mức nguyên tắc; công thức/cửa sổ TBD |
| DEC-011 | Q14, Q48 | Một lần nộp chính thức mặc định; GV có thể cho nộp lại trường hợp đặc biệt. | FUNC-053, 054 | CONFIRMED; chính sách mở lại TBD |
| DEC-012 | Q16, Q40–41 | Chấm tự động theo đáp án rõ ràng; tự luận GV chấm; GV xác nhận điểm rồi **công bố** bằng thao tác riêng. | FUNC-056–060 | CONFIRMED |
| DEC-013 | Q33–34, Q49 | Sau công bố HV thấy điểm/nhận xét/đáp án khách quan; Admin được sửa điểm và phải lưu log. | FUNC-060–064 | CONFIRMED |
| DEC-014 | Q17, Q44 | BTVN phục vụ chuyên cần, không tính điểm tổng kết; tổng kết từ Mini/Giữa/Cuối. | FUNC-069, 070 | CONFIRMED ở mức nguyên tắc |
| DEC-015 | Q43 | Có thông báo trong web; không phát triển gửi Zalo/email thông báo nghiệp vụ ở Phase 1. | FUNC-080 | CONFIRMED |
| DEC-016 | Q45 | Khôi phục mật khẩu qua email (không OTP SĐT). | FUNC-005 | CONFIRMED |
| DEC-017 | Q23 | Danh mục HSK1–HSK4 (HSK 3.0), giao tiếp cơ bản. | FUNC-014 | CONFIRMED |
| DEC-018 | Q42 | Không có kiểm tra giấy phải nhập điểm thủ công. | FUNC-076 | OUT-OF-SCOPE |
| DEC-019 | Q51 | Lớp có thể dừng trước khi đủ số buổi dự kiến. | FUNC-079 | CONFIRMED |
| DEC-020 | FUNC-009 | Người có nhiều vai trò áp dụng quyền theo vai trò cao hơn. | Auth/RBAC | Theo đặc tả nguồn; cần test invariant |
| DEC-021 | 06/11/2026 — người quản lý dự án | Chốt Frontend stack sử dụng **Next.js (App Router) + Tailwind CSS**; Backend **NestJS + Prisma ORM + PostgreSQL 16+**. | SYS-01, Toàn bộ UI/API | CONFIRMED |
| DEC-022 | 06/11/2026 — người quản lý dự án | Áp dụng **Git Flow chuyên nghiệp** (`main`, `develop`, `feature/*`, `bugfix/*`, Conventional Commits). | Quy trình Git & CI | CONFIRMED |

## Các quyết định khác biệt giữa nguồn cũ và quyết định mới

- `Final.xlsx > Quy tắc BR-01` nói 'tối đa 5' nhưng Function List/Q9 nói **không giới hạn** → áp dụng không giới hạn.
- `Final.xlsx > Câu hỏi #21` và `FUNC-001/002` nhắc SĐT phụ huynh → **đã được thay bằng email phụ huynh** ngày 06/11/2026.
- `Final.xlsx > Thực thể` liệt kê 'Tóm tắt buổi học' trong phạm vi nhưng sheet `Chức năng` đánh dấu **Không** → chưa tự triển khai tóm tắt buổi học (nếu muốn thêm, mở change request).
- `FUNC-003` có điều hướng theo 'vai trò dùng gần nhất' trong khi `FUNC-009` ghi quyền role cao nhất → ưu tiên RBAC role cao nhất, UI đổi role vẫn cần xác định rõ.
- `FUNC-008` có ghi chú '> không cần' về quy trình duyệt; không được loại bỏ khả năng **Admin xếp lớp** nếu workflow đã chốt. Mức duyệt/phê duyệt bổ sung là TBD.

## Nguyên tắc sửa decision log

Không tự đánh dấu `CONFIRMED` cho đề xuất của AI. Mỗi lần chốt: ghi ngày, người xác nhận, mã FUNC, thay đổi điều kiện test và ảnh hưởng migration/API/UI.
