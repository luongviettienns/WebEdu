# API & Data Design Guidelines — dùng khi thiết kế từng module

**Chưa có API contract và ERD đã chốt**. Không nên sinh Swagger schema hoặc Prisma schema 'chính thức' chỉ từ danh sách FUNC mà chưa xác minh codebase và nghiệp vụ module.

## Đối tượng dữ liệu tối thiểu để thiết kế

| Domain | Đối tượng gợi ý | Bất biến |
|---|---|---|
| Account | User, Role, StudentProfile, TeacherProfile, GuardianConsent | HV data isolation; guardian contact email |
| Course | Course, Class, EnrollmentHistory | 1 GV/lớp; 1 enrollment hoạt động/HV |
| Schedule | RecurringSchedule, Session, SessionChangeLog | Hủy-bù giữ lịch sử, không tăng trùng tổng |
| Attendance | AttendanceRecord, AttendanceAudit | 3 trạng thái, quyền sửa theo vai trò |
| Assessment | Question, Assessment, MediaAsset, Assignment | Nội dung đề và file cần kiểm tra/duyệt |
| Submission | Draft, Attempt, Answer | Idempotent submit; nộp lại có workflow |
| Grading | Grade, GradeReview, Publication, GradeAudit | Never expose un-published results |
| Notification | Notification, Recipient, ReadState | Recipient-specific permissions |

## API conventions đề xuất, cần đối chiếu repo

- Dùng prefix `/api/v1` **nếu** đúng theo kế hoạch NestJS repo.
- HTTP status & error codes rõ ràng, không leak lỗi nội bộ/PII trong thông báo.
- Validate DTO server-side; status transition bảo vệ ở service/domain layer.
- Query theo user/role/class trong backend; pagination/filter/sort khi cần.
- Với tất cả API có ID tài nguyên, test cả request dùng ID của người khác.
- Tránh hard-delete các bảng lịch sử; sử dụng soft-delete/archival có quy tắc ở module tương ứng.
- Thao tác đa bước (chuyển lớp, submit, điểm danh, hủy-bù, publish) phải có transaction/idempotency theo rủi ro.
- Nếu cập nhật điểm sau publish, audit trail và thông báo cập nhật phải được chốt.

## Trước khi tạo migration

1. Đối chiếu field & cardinality với nghiệp vụ đã chốt.
2. Liệt kê unique/index/foreign keys và lý do.
3. Thiết kế giữ lịch sử enrollment/session/grading.
4. Xác nhận privacy/retention cho phụ huynh và dữ liệu người học.
5. Có kế hoạch rollback và test migration.
