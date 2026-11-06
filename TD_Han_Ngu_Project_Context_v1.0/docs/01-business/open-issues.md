# Open Issues — quyết định cần chốt theo module

**Mục đích:** không chốt tất cả từ đầu. Khi bước vào module, chọn các issue cùng module, giải quyết *trước khi code phần phụ thuộc*; các module độc lập vẫn tiếp tục.

## Danh sách đang quản lý

| ID | Module | FUNC | Vấn đề | Khi nào giải quyết |
|---|---|---|---|---|
| AUTH-01 | Tài khoản & phân quyền | FUNC-001, FUNC-002, FUNC-003 | Email phụ huynh được lưu riêng với email đăng nhập học viên hay có thể dùng làm email đăng nhập? Hai anh/chị em dùng chung email phụ huynh đăng ký như thế nào? | BLOCKS auth registration |
| AUTH-02 | Tài khoản & phân quyền | FUNC-001, FUNC-003 | SĐT học viên còn bắt buộc/duy nhất và có dùng đăng nhập hay không, sau khi bỏ SĐT phụ huynh? | BLOCKS registration validation |
| AUTH-03 | Tài khoản & phân quyền | FUNC-002 | Nội dung cam kết/đồng ý của người giám hộ; dữ liệu cần lưu để chứng minh consent; chính sách bảo vệ trẻ em. | BLOCKS guardian flow |
| AUTH-04 | Tài khoản & phân quyền | FUNC-006, FUNC-007, FUNC-008, FUNC-078 | Phạm vi dữ liệu GV/HV, chỉnh sửa hồ sơ, quy trình xếp lớp/tài khoản GV, mức ưu tiên Dự kiến P1. | SCOPE at auth module |
| COURSE-01 | Khóa HSK | FUNC-014, FUNC-016 | Số buổi mặc định từng khóa HSK và quyền CRUD danh mục khóa. | DEFERRED course/class module |
| CLASS-01 | Lớp học | FUNC-022, FUNC-023 | Giáo viên mới có được xem điểm/lịch sử của học viên tại lớp cũ đến mức nào? | DEFERRED class module |
| CLASS-02 | Lớp học | FUNC-017, FUNC-079 | Quy tắc sửa khóa và đóng lớp khi đã có bài nộp/điểm; tác động đến history. | DEFERRED class module |
| SCHED-01 | Lịch & buổi học | FUNC-026, FUNC-027, FUNC-029, FUNC-030, FUNC-031 | Admin vs GV ai được sửa lịch; tình trạng hủy/sửa; giờ/múi giờ và trạng thái buổi khi nghỉ. | DEFERRED schedule module |
| ATT-01 | Điểm danh | FUNC-036, FUNC-037 | Ngưỡng nghỉ 30% tính cả vắng có phép? Mốc 2 ngày sửa điểm danh tính từ giờ nào, inclusive? | DEFERRED attendance module |
| ASSIGN-01 | Bài tập & ngân hàng đề | FUNC-040, FUNC-041, FUNC-042, FUNC-047, FUNC-048, FUNC-068 | Cung cấp đề thực tế Word/PDF, file quét, rubric bài viết, mẫu sắp xếp; định dạng import và review. | TBD-DEFERRED |
| ASSIGN-02 | Bài tập & ngân hàng đề | FUNC-053, FUNC-054 | Autosave offline và xung đột nhiều tab, hết giờ/tự nộp, dừng timer khi mất mạng có được chấp nhận không? | DEFERRED assignment module |
| ASSIGN-03 | Bài tập & ngân hàng đề | FUNC-054 | Giáo viên mở lại bài: giữ câu trả lời cũ, reset bản nháp hay tạo attempt mới? | DEFERRED assignment module |
| GRADE-01 | Chấm điểm & AI | FUNC-045, FUNC-046, FUNC-047, FUNC-056, FUNC-058 | Cách tính điểm, credit từng phần nhiều đáp án, thang điểm, precision/rounding, đáp án tương đương. | TBD-DEFERRED |
| GRADE-02 | Chấm điểm & AI | FUNC-059, FUNC-060, FUNC-061, FUNC-064 | Điểm không nộp, thay đổi sau publish, quyền tái publish và log/notifications. | DEFERRED grading module |
| EXAM-01 | Kiểm tra & tổng kết | FUNC-065, FUNC-068, FUNC-070 | Công thức điểm cuối, tỷ trọng Mini/Giữa/Cuối, nhiều bài, đạt/chưa đạt, điểm kỹ năng. | TBD-DEFERRED |
| ATT-02 | Kiểm tra & tổng kết | FUNC-069 | BTVN hoàn thành nghĩa là đã nộp hay đạt? Cách tính % chuyên cần và Có phép có cộng không? | DEFERRED attendance/results module |
| NOTIF-01 | Thông báo | FUNC-080 | Điều kiện gửi, nhận, lưu trữ, dedup và thông báo nhắc hạn; không tự thêm email/Zalo. | DEFERRED notification module |
| SYS-01 | Kiến trúc chung | — | Đã chốt Frontend: **Next.js (App Router) + Tailwind CSS**, Backend: **NestJS + Prisma ORM + PostgreSQL 16+** (`DEC-021`). Còn lại: hosting, backup production, target SLA. | RESOLVED (Core Stack) / DEFERRED (Hosting) |
| PROTO-01 | Prototype/UX | — | Đối chiếu màn hình đã được khách duyệt; 16 thành phần demo cần loại khỏi production theo ghi chú (xem tài liệu prototype). | DEFERRED before production UI |
| SCOPE-01 | Buổi học | — | Có làm tóm tắt buổi học không? Sheet Chức năng ghi Không; Thực thể ghi Trong phạm vi; không tự triển khai. | SCOPE before lesson summary |

## Câu hỏi có trạng thái OPEN trong sheet gốc

| Q# | Câu hỏi | Câu trả lời đang có |
|---|---|---|
| 4 | Khóa HSK1 có bao nhiêu buổi? | Để sau |
| 36 | [FUNC-070] Điểm tổng kết tính thế nào: tỉ trọng Mini-test / Giữa kỳ / Cuối kỳ là bao nhiêu? Bao nhiêu điểm thì Đạt? | cái này để sau được không? thang điểm chia kĩ năng sau nhé |
| 37 | [FUNC-047] Xin file mẫu dạng bài Sắp xếp từ thành câu, để xác định trường hợp có nhiều đáp án đúng. | update sau |
| 38 | [FUNC-048] Xin tiêu chí chấm bài viết / dịch / tự luận, kèm vài bài mẫu đạt và chưa đạt. | update |
| 39 | [FUNC-065, FUNC-068] Xin file mẫu đề Mini-test, Giữa kỳ, Cuối kỳ (tiếp nối Q18). | update sau |

## Lưu ý: một số Q đã Closed nhưng vẫn có chi tiết TBD

- **Q21** đã chốt phụ huynh đăng ký thay, nhưng cách nhận dạng email đã bị cập nhật bởi quyết định mới; không dùng quy tắc SĐT cũ.
- **Q47** đã Closed với nội dung “không được điểm tối đa”; **không đồng nghĩa** chọn thiếu đáp án = 0 điểm.
- **Q44** đã mô tả cách cộng chuyên cần; cách tính tỉ lệ, tình trạng “Có phép” và thế nào là hoàn thành BTVN chưa rõ.
- **Q46** nói dùng `.doc` hoặc PDF; quy trình kỹ thuật nhận `.docx`/PDF và xử lý `.doc` cũ chưa thống nhất.
- **Q18** đồng ý gửi file mẫu nhưng mẫu chưa được đính kèm trong nguồn đã kiểm tra.

## Hướng dẫn cập nhật

Khi chốt từng vấn đề: chuyển sang `CONFIRMED` trong Decision Log và chỉnh module spec, ACL/API/test tương ứng. Không xóa issue cũ; thêm cột đã giải quyết/mã quyết định nếu cần.
