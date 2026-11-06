# Security, Privacy & Quality Constraints

## Security baseline (đề xuất kỹ thuật, không phải chứng nhận compliance)

- **Authentication:** mật khẩu hash mạnh, reset link/token một lần, hạn sử dụng, xử lý enumerate, rate-limit và brute-force; `FUNC-003` mô tả khóa 15 phút sau 5 lần sai, cần bảo vệ API không chỉ UI.
- **Authorization:** kiểm tra RBAC + relationship cấp object; đặc biệt Student/Teacher/Admin; kiểm tra quyền ở mọi endpoint và media URL.
- **Young learners:** trường guardian email/consent là dữ liệu cá nhân; xác nhận nội dung đồng ý, retention, quyền xem/sửa, cách yêu cầu gỡ dữ liệu; không tự kết luận đáp ứng pháp luật.
- **Files:** chỉ nhận định dạng cho phép; giới hạn dung lượng, scan file, ngăn path traversal/executable, file conversion sandbox; chặn XSS từ nội dung Word/PDF; kiểm tra quyền tải file audio/hình.
- **Privacy by default:** không để response trả nguyên đề/đáp án/điểm chưa công bố; log không chứa secret/token.
- **Audit:** sửa điểm, điểm danh, chuyển lớp, lịch; actor, timestamp, old/new, reason nếu cần.
- **Runtime:** secrets ở env, CORS/cookie/security headers phù hợp, hạn chế quyền DB, backup & restore test.

## Quality baseline

- UI hiện đại, nhất quán, responsive mobile; ưu tiên tốc độ tải và khả năng dùng trên trình duyệt thường gặp.
- SEO áp dụng cho **trang public thực sự**; Phase 1 không làm website marketing/tuyển sinh, không công khai dữ liệu học viên để SEO.
- Khả năng bảo trì: code theo module, DTO/validators, swagger/API docs, test automated, logging, migration rõ.
- Performance: cần chốt mục tiêu p95 latency/LCP/concurrent users/file size lúc technical design; **không tự hứa SLA**.
- Reliability: autosave, submission idempotency, phục hồi sau mất mạng, job/scheduler chính xác (nếu được duyệt cụ thể).

## Kiểm thử bắt buộc đặc biệt

- IDOR đối với `/students/:id`, `/classes/:id`, `/submissions/:id`, `/grades/:id` (ví dụ; không phải API contract).
- Student thấy điểm trước công bố qua API hoặc devtools.
- Race condition ở xếp lớp, nộp 2 tab, hủy/bù buổi, sửa điểm.
- Upload độc hại, media sai MIME, file lớn hơn giới hạn (giới hạn cụ thể TBD).
