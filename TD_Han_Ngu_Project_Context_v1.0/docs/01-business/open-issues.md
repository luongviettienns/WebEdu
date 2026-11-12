# Open Issues — quyết định cần chốt theo module

**Mục đích:** không chốt tất cả từ đầu. Khi bước vào module, chọn các issue cùng module, giải quyết *trước khi code phần phụ thuộc*; các module độc lập vẫn tiếp tục.

## Danh sách đang quản lý

| ID | Module | FUNC | Vấn đề | Khi nào giải quyết |
|---|---|---|---|---|
| AUTH-01 | Tài khoản & phân quyền | FUNC-001, FUNC-002, FUNC-003 | Đã chốt (`DEC-023`): `User.email` là `UNIQUE` cho tài khoản HV; `StudentProfile.guardianEmail` lưu riêng và **không `UNIQUE`** để 2 anh/chị em dưới 16 tuổi dùng chung email phụ huynh. | RESOLVED (`DEC-023`) |
| AUTH-02 | Tài khoản & phân quyền | FUNC-001, FUNC-003 | Đã chốt (`DEC-023`): Cả `User.email` và `User.phone` đều bắt buộc và `UNIQUE` trên toàn hệ thống. Đăng nhập (`FUNC-003`) **chỉ dùng `email` làm tên đăng nhập**. | RESOLVED (`DEC-023`) |
| AUTH-03 | Tài khoản & phân quyền | FUNC-002 | Cơ chế `CONFIRMED` (`DEC-001`, `BR-07`): Nhập `guardianEmail` + tự khai checkbox xác nhận đồng ý + lưu vết bất biến trên server trong bảng `GuardianConsent` (`guardianEmail`, `consentVersion = 'v1.0'`, `consentTextSnapshot`, `consentedAt` `TIMESTAMPTZ(3)`, `ipAddress`, `userAgent`). Cơ chế gửi link xác thực chủ động tới email phụ huynh chưa được khách hàng yêu cầu/chốt nên giữ `UNCONFIRMED / DEFERRED` (không tự ý triển khai ngoài phạm vi). | RESOLVED (`DEC-001`, `Phase 2`) / Active Guardian Email Link: `DEFERRED` |
| AUTH-04 | Tài khoản & phân quyền | FUNC-006, FUNC-007, FUNC-008, FUNC-078 | Triển khai đầy đủ cả 4 chức năng Quản lý GV, Quản lý HV, Hàng đợi chờ xếp lớp và Hồ sơ cá nhân trong Phase 2. | RESOLVED (`Phase 2 Plan`) |
| COURSE-01 | Khóa HSK | FUNC-014, FUNC-016 | Đã chốt (`DEC-029`): Admin tự cấu hình linh hoạt số buổi mặc định (`defaultSessions`), mô tả và trạng thái (`Đang sử dụng` / `Ngừng sử dụng`) cho các khóa HSK1–HSK4 (3.0) và Giao tiếp cơ bản. | RESOLVED (`DEC-029`) |
| CLASS-01 | Lớp học | FUNC-022, FUNC-023 | Đã chốt (`DEC-024`, `DEC-025`): (1) Giáo viên lớp mới **không được xem lịch sử lớp cũ của học viên** (chỉ HV xem của mình, Admin xem tất cả); (2) Với lớp cũ của chính GV: nếu lớp đã kết thúc thì GV phụ trách có quyền xem, nếu GV bị thay giữa chừng thì GV cũ mất quyền xem. | RESOLVED (`DEC-024`, `DEC-025`) |
| CLASS-02 | Lớp học | FUNC-017, FUNC-079 | Đã chốt (`DEC-030`): Khi đóng/lưu trữ lớp (`FUNC-079`), chuyển trạng thái lớp sang `COMPLETED` / `ARCHIVED`, đưa lớp về chế độ chỉ đọc (`READ_ONLY`) và bảo toàn 100% dữ liệu lịch sử học tập. | RESOLVED (`DEC-030`) |
| SCHED-01 | Lịch & buổi học | FUNC-026, FUNC-027, FUNC-029, FUNC-030, FUNC-031 | Đã chốt (`DEC-031`): (1) Chỉ `Admin` được tạo/sửa lịch định kỳ, đổi lịch buổi, hủy buổi, tạo buổi bù; GV chỉ xem lịch và điểm danh (cùng Admin theo `DEC-026`); (2) Khi hủy buổi chưa tạo bù ngay: giữ nguyên `totalSessions`, buổi hủy chuyển `CANCELLED` (`sessionNumber = null`), đánh lại số thứ tự `1..N` cho các buổi hoạt động và chờ Admin tạo buổi bù hoặc thêm buổi. | RESOLVED (`DEC-031`) |
| ATT-01 | Điểm danh | FUNC-036, FUNC-037 | **Đã chốt một phần (`DEC-032`):** Cửa sổ GV sửa điểm danh (`ATT-01b`, `FUNC-037`) đến hết `23:59:59.999` (GMT+7) của ngày thứ 2 sau ngày học; Admin sửa bất kỳ lúc nào kèm Audit Log. **Chờ chốt với khách hàng (`ATT-01a`, `FUNC-036`):** Ngưỡng cảnh báo nghỉ 30% tính cả `Vắng có phép` hay chỉ `Vắng không phép`? Mẫu số tính trên `totalSessions` của lớp hay `Số buổi đã điểm danh` của học viên? (**Chặn thực thi Phase 4 cho đến khi chốt với khách**). | PARTIAL (`DEC-032`) / `ATT-01a` PENDING CLIENT CONFIRMATION |
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
