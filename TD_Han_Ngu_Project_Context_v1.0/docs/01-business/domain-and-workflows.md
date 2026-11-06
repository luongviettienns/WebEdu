# Domain Map & Workflows

## Thực thể lõi (logical, không phải DB schema final)

`User` ↔ `Role`; `StudentProfile`; `TeacherProfile`; `GuardianContact/Consent` (cho học viên dưới 16); `Course`; `Class`; `Enrollment` (giữ lịch sử vào/ra lớp); `ClassSchedule`; `LessonSession`; `Attendance`; `QuestionBank/Question`; `Assessment/Assignment`; `Submission/Draft`; `Answer`; `Grade/Review/Publish`; `GradeAudit`; `Notification`.

**TBD:** ranh giới `Course / Class / Test template`, email guardian với nhiều anh chị em, chính sách lưu trữ file media/đề, điểm & chuẩn hóa, các bảng lịch sử. Không triển khai entity 'Tóm tắt buổi học' chỉ vì sheet Thực thể có tên này: sheet Chức năng đánh dấu không làm.

## Luồng A — Học viên đăng ký và vào lớp

1. Học viên (≥12 tuổi) tự đăng ký; nếu 12–15 tuổi thì phụ huynh/người giám hộ hỗ trợ đăng ký, dùng **email phụ huynh** và xác nhận đồng ý.
2. Hệ thống validate thông tin, tạo tài khoản trạng thái `Chờ xếp lớp`.
3. Học viên có thể đăng nhập, chỉ thấy trạng thái chưa có lớp.
4. Admin gán học viên vào lớp phù hợp; 1 HV chỉ có 1 lớp đang học cùng lúc.
5. Học viên xem lớp/lịch/bài của mình (qua RBAC backend).

**Open:** email parent vs student email login; 2 con cùng email parent; cách xác minh email/account activation và bước xếp lớp chi tiết.

## Luồng B — Tạo & vận hành lớp

Admin chọn khóa HSK, giáo viên, lịch định kỳ, start date, tổng buổi; hệ thống dựng lịch dự kiến. Nếu hủy buổi: giữ vết hủy; nếu học bù: liên kết thay buổi hủy, không đếm trùng. Không tự 'Đã học' nếu không có điểm danh. Chuyển/rút học viên không xóa lịch sử.

## Luồng C — Buổi học, điểm danh, chuyên cần

Giáo viên điểm danh theo 3 trạng thái; Admin có quyền sửa; tổng hợp theo lịch, cảnh báo nghỉ 30%. Điểm BTVN đóng góp chuyên cần, không vào điểm tổng kết. Chi tiết tính % và định nghĩa hoàn thành BTVN còn TBD đến module chuyên cần.

## Luồng D — Bài tập và kiểm tra

Giáo viên/admin theo quyền tạo hoặc upload đề → kiểm tra, sửa câu hỏi đã chuyển đổi → giao bài → học viên làm nháp/autosave → nộp chính thức → chấm khách quan → GV chấm tự luận/kiểm tra kết quả → GV xác nhận → GV công bố → học viên xem điểm & nhận xét. Giáo viên có thể mở lại bài trong trường hợp đặc biệt. Đề Word/PDF & rubric TBD khi tới module.

## Luồng E — Điểm tổng kết

Nguồn: bài Mini-test/Giữa kỳ/Cuối kỳ **đã công bố**. Không lấy BTVN vào điểm tổng kết. Trọng số, số bài, thang/kỹ năng, điều kiện Đạt: `TBD-DEFERRED` cho module kiểm tra & tổng kết.
