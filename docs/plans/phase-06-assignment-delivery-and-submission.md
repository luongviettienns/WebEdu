# Phase 6 Sub-Plan — Module 06 (Phần 2): Giao bài, Làm bài, Autosave & Nộp bài 1 lượt

- **Nhánh:** `feature/phase-06-assignment-delivery-and-submission`
- **Phạm vi:** `FUNC-051..054` (Module 06 phần 2), Cleanup `#6`, `#14`
- **Quyết định nghiệp vụ đã chốt:** `DEC-034` (`ASSIGN-02a`, `ASSIGN-02b`), `DEC-035` (`ASSIGN-03`)

## Mục tiêu & Ràng buộc Kiến trúc
1. **Zero-Leak Question Sanitization:** Toàn bộ API học viên trước khi nộp xong tuyệt đối không trả về `correctOptionIds`, `acceptedAnswers`, `correctSentence`, `sampleAnswer`, `rubric`, `explanation`. Câu sắp xếp (`ORDERING`) xáo trộn `tokens` ổn định theo `(submissionId, questionId)` sao cho khác trật tự đáp án gốc nếu có nhiều token khác nhau.
2. **Chống nộp trùng tuyệt đối (Atomic Locking):**
   - `Submission` có Partial Unique Index ở PostgreSQL (`idx_unique_active_submission_per_student`) bảo đảm tại một thời điểm mỗi cặp `(classAssignmentId, studentId)` chỉ có tối đa 1 bản ghi với `status <> 'SUPERSEDED'`.
   - Giao dịch `autosave` và `submit` khóa dòng `Submission` bằng `SELECT ... FOR UPDATE`, chỉ chấp nhận khi `status === 'IN_PROGRESS'`.
3. **Timer, Tự nộp & Offline (`DEC-034`):**
   - Tạm dừng đếm ngược khi thoát trang hoặc mất mạng; server lưu `remainingSeconds` (khởi tạo từ `durationMinutes * 60` hoặc `null`), `elapsedSeconds` và `lastSyncedAt`.
   - Khi `remainingSeconds === 0` hoặc `now > dueAt` (mặc định hết giờ hoặc hết hạn), hệ thống cho phép tự nộp bản nháp hiện tại (`autoSubmitted = true`, `status = 'SUBMITTED_WAITING'`).
   - Client autosave ngay khi đổi đáp án (debounced), mỗi `30s` với tự luận, lưu fallback `localStorage` khi offline để đồng bộ khi `online` trở lại, và lắng nghe sự kiện `storage` giữa nhiều tab theo phiên bản lưu mới nhất.
4. **Mở lại bài nộp (`DEC-035`):**
   - Giáo viên phụ trách lớp hoặc Admin có thể mở lại bài cho học viên (`SUBMITTED_WAITING`, `AUTO_GRADED_PENDING_REVIEW`, `GRADED`, `RETURNED`), bắt buộc nhập lý do.
   - Bản nộp cũ chuyển thành `SUPERSEDED` (giữ nguyên đáp án & điểm cũ để tra cứu) + tạo ngay `Attempt #N+1` trạng thái `IN_PROGRESS` sao chép sẵn đáp án từ lượt trước + ghi `SubmissionReopenLog`.

## Phân rã Slices

### Slice 6.1 — Schema, Migration & Đếm số lớp đã giao
- Thêm enums `SubmissionStatus`, `GradingStatus`.
- Thêm models `ClassAssignment`, `Submission`, `SubmissionAnswer`, `SubmissionReopenLog`.
- Partial Unique Index `idx_unique_active_submission_per_student` + 4 `CHECK` constraints (`duration_minutes > 0`, `remaining_seconds >= 0`, `audio_play_count >= 0`, `attempt_number >= 1`).
- Cập nhật `AssessmentMapper` & `AssessmentCrudService` để trả đúng `assignedClassCount` thực tế.
- Tách `AssessmentMediaAccessService` export từ `AssessmentsModule` để `AssignmentsModule` stream tệp đính kèm hợp lệ qua ranh giới module sạch.

### Slice 6.2 — Giao bài cho lớp & Danh sách bài được giao (`FUNC-051`, `FUNC-052`)
- `POST /api/v1/assessments/:assessmentId/assign`: chỉ cho đề `PUBLISHED`, gán đồng thời cho một hoặc nhiều lớp (`ADMIN` hoặc `TEACHER` phụ trách chính/đồng giảng dạy từng lớp; khóa `Assessment` rồi các `Class` theo thứ tự ID để chống deadlock; tính `effectiveDurationMinutes = assessment.durationMinutes`).
- `GET /api/v1/classes/:classId/assignments`: Giáo viên/Admin xem danh sách bài đã giao kèm thống kê nộp bài; Học viên chỉ xem danh sách lớp mình theo học (loại `DROPPED`).
- `GET /api/v1/assignments/:assignmentId/submissions`: Giáo viên/Admin xem chi tiết tiến độ từng học viên trong lớp (kể cả học viên chưa bắt đầu `NOT_STARTED`).
- `GET /api/v1/assignments/me`: Danh sách bài tập/đề kiểm tra trên toàn bộ các lớp hợp lệ của Học viên kèm trạng thái hiển thị chuẩn tiếng Việt.

### Slice 6.3 — Bắt đầu, Autosave, Nộp 1 lượt & Mở lại bài (`FUNC-053`, `FUNC-054`)
- `POST /api/v1/assignments/:assignmentId/submissions/start`: Khởi tạo/tải bản nháp active (`IN_PROGRESS`), trả về câu hỏi đã sanitize (Zero-Leak).
- `PATCH /api/v1/assignments/:assignmentId/submissions/autosave`: Lưu câu trả lời từng phần, đếm số lượt nghe audio (`audioPlayCount <= maxListens`), cập nhật `remainingSeconds` / `elapsedSeconds`, tự động chuyển sang nộp bài nếu quá giờ/hết hạn kèm trả trạng thái mới.
- `POST /api/v1/assignments/:assignmentId/submissions/submit`: Nộp bài chính thức 1 lượt (`SUBMITTED_WAITING`), khóa cứng bản nháp chống race condition (`409 Conflict` nếu đã nộp), từ chối nộp nếu hết hạn vượt grace nhỏ trừ chế độ `autoSubmitted`.
- `GET /api/v1/assignments/:assignmentId/submissions/me`: Xem bài đã nộp ở chế độ chỉ đọc (`Xem bài nộp`, Cleanup `#14`), giữ nguyên Zero-Leak trước khi giáo viên trả kết quả (`GRADED`/`RETURNED` ở Phase 7).
- `GET /api/v1/assignments/:assignmentId/media/:mediaId`: Stream file nghe/hình thuộc bài đã giao cho học viên hoặc giáo viên có quyền, kèm `X-Content-Type-Options: nosniff`.
- `POST /api/v1/submissions/:submissionId/reopen`: Giáo viên/Admin mở lại lượt làm bài kèm lý do, tạo `Attempt #N+1` sao chép đáp án cũ.

### Slice 6.4 — Giao diện Giáo viên/Admin & Học viên (`FUNC-051..054`, Cleanup `#6`, `#14`)
- **Giáo viên / Admin:** Nút `"Giao bài"` trong Ngân hàng đề (`PUBLISHED`), `AssignAssessmentModal`, tab `"Bài tập & Kiểm tra"` trong chi tiết lớp (`ClassDetailView`), `ClassAssignmentTrackerModal` xem danh sách nộp & mở lại lượt nộp cho học viên.
- **Học viên:** Mục menu `"Bài tập & Đề thi"` (`/student/assignments`), trang chi tiết làm bài tương tác (`/student/assignments/[id]`) hỗ trợ đủ 7 loại câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_BLANK`, `ORDERING`, `ESSAY`, `LISTENING`, `IMAGE_BASED`), đồng hồ tạm dừng khi offline/thoát trang, sidebar ô số 4 trạng thái, modal xác nhận nộp bài, trang `"Xem bài nộp"` chỉ đọc; thay thế placeholder Phase 6 trên `StudentOverviewCards` bằng dữ liệu thật.
- **Kiểm chứng:** `check-loc.js`, unit/integration/E2E backend (bao gồm cập nhật API inventory 82 endpoints và bài test race-condition 5 concurrent submits + Zero-Leak + Reopen), và Playwright E2E + Axe WCAG (Desktop + Mobile).
