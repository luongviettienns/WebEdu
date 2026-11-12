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
| DEC-023 | 06/11/2026 (cập nhật 12/11/2026) — người quản lý dự án | Chốt `User.email` và `User.phone` (10 chữ số, bắt đầu bằng `0`) đều **bắt buộc và `UNIQUE`** trên toàn hệ thống; **chỉ dùng `email` làm tên đăng nhập (`username`)** cho `FUNC-003`. Khi học viên $< 16$ tuổi tự đăng ký (`FUNC-001`, `FUNC-002`), form nhập **1 ô email là email phụ huynh** (`User.email` = email phụ huynh, đồng thời lưu vết bất biến vào `StudentProfile.guardianEmail` và `GuardianConsent.guardianEmail` không `UNIQUE`); khi học viên đủ $16$ tuổi trở lên, học viên có thể tự đổi sang email cá nhân tại `/profile` mà vẫn giữ nguyên lịch sử đồng ý phụ huynh. | AUTH-01, AUTH-02, FUNC-001, 002, 003, 006, 007, 078 | CONFIRMED |
| DEC-024 | 06/11/2026 — người quản lý dự án | **Quyền xem lịch sử lớp của học viên (`CLASS-01`, `FUNC-023`):** (1) Học viên: chỉ xem lịch sử lớp của chính mình; (2) Giáo viên hiện tại của lớp mới: **KHÔNG được xem lịch sử lớp cũ của học viên**; (3) Admin: xem lịch sử của tất cả học viên; (4) Superadmin: không mặc định được xem dữ liệu học tập. | CLASS-01, FUNC-010..013, FUNC-022, FUNC-023 | CONFIRMED |
| DEC-025 | 06/11/2026 — người quản lý dự án | **Quyền Giáo viên đối với lớp cũ của chính GV đó (`FUNC-011`, `FUNC-018`, `FUNC-024`, `FUNC-079`):** (Case 1) Lớp đã kết thúc (`COMPLETED`/`ARCHIVED`) mà GV đó phụ trách $\rightarrow$ **GV có quyền xem**; (Case 2) GV đang dạy nhưng bị thay bằng GV khác (`FUNC-018`) $\rightarrow$ **GV cũ KHÔNG có quyền xem**, chỉ GV mới có quyền. | FUNC-011, FUNC-018, FUNC-024, FUNC-079 | CONFIRMED |
| DEC-026 | 06/11/2026 — người quản lý dự án | **Mở rộng quyền vận hành học thuật của Admin:** Ngoài các quyền quản lý lớp/điểm đã có, **Admin có quyền thực hiện các chức năng `FUNC-034` (Điểm danh), `FUNC-040..052` (Tải đề, chuyển đổi, duyệt đề, biên tập 7 dạng câu hỏi, giao bài, xem danh sách bài giao), `FUNC-060` (Công bố điểm), `FUNC-062` (Theo dõi nộp bài), `FUNC-065, 068` (Quản lý kỳ kiểm tra & mẫu đề), `FUNC-080` (Thông báo)**. | Roles & Permissions, Module 05..10 | CONFIRMED |
| DEC-029 | 10/11/2026 — người quản lý dự án | **Cấu hình linh hoạt Danh mục Khóa học HSK (`COURSE-01`, `FUNC-014`):** Admin được phép tự cấu hình linh hoạt số buổi mặc định (`defaultSessions`), mô tả/giáo trình và trạng thái (`Đang sử dụng` / `Ngừng sử dụng`) cho các khóa HSK1–HSK4 (3.0) và Giao tiếp cơ bản. Khóa đã gán cho lớp không xóa vật lý mà chỉ chuyển `Ngừng sử dụng`. | COURSE-01, FUNC-014, FUNC-016 | CONFIRMED |
| DEC-030 | 10/11/2026 — người quản lý dự án | **Quy tắc đóng/lưu trữ lớp và bảo toàn lịch sử (`CLASS-02`, `FUNC-017`, `FUNC-079`):** Khi kết thúc hoặc lưu trữ lớp (`FUNC-079`), hệ thống chuyển trạng thái lớp sang `COMPLETED` / `ARCHIVED`, khóa lớp ở chế độ chỉ đọc (`READ_ONLY`) và bảo toàn 100% dữ liệu lịch sử học tập (điểm danh, bài làm, điểm số, lịch sử ghi danh). | CLASS-02, FUNC-017, FUNC-023, FUNC-079 | CONFIRMED |
| DEC-031 | 11/11/2026 — người quản lý dự án | **Quyền thay đổi lịch học & quy tắc tổng số buổi khi hủy (`SCHED-01`, `FUNC-026..031`):** (1) Chỉ `Admin` được khai báo/sửa lịch định kỳ (`FUNC-026`), thêm buổi thủ công (`FUNC-027`), đổi lịch buổi (`FUNC-029`), hủy buổi (`FUNC-030`) và tạo buổi học bù (`FUNC-031`); Giáo viên và Học viên chỉ xem lịch (`FUNC-028`), Giáo viên (lớp phụ trách) và Admin (`DEC-026`) thực hiện điểm danh (`FUNC-034`). (2) Khi hủy buổi mà chưa tạo buổi bù ngay (`FUNC-027`, `FUNC-030`, `DEC-009`), giữ nguyên Tổng số buổi mục tiêu của lớp (`totalSessions`); buổi bị hủy chuyển trạng thái `CANCELLED` (không đánh số thứ tự `sessionNumber = null`), các buổi hoạt động được đánh lại số thứ tự liên tục `1..N`, hệ thống không tự sinh thêm buổi ở cuối khóa mà chờ Admin tạo buổi bù (`FUNC-031`) hoặc thêm buổi. | SCHED-01, FUNC-026..031 | CONFIRMED |
| DEC-032 | 11/11/2026 — người quản lý dự án | **Mốc khóa sổ 2 ngày sửa điểm danh của Giáo viên (`ATT-01b`, `FUNC-037`, `DEC-010`):** Giáo viên phụ trách lớp được sửa điểm danh từ ngày diễn ra buổi học cho đến **hết `23:59:59.999` (múi giờ `Asia/Ho_Chi_Minh`, GMT+7) của ngày thứ 2 sau ngày học** (VD: buổi học ngày `10/11` sửa được đến hết `23:59:59` ngày `12/11`). Sau mốc này, chỉ `Admin` được sửa điểm danh bất kỳ lúc nào kèm bắt buộc nhập lý do vào `AttendanceAuditLog`. Riêng công thức cảnh báo nghỉ 30% (`ATT-01a`, `FUNC-036`) tiếp tục giữ `TBD` chờ chốt với khách hàng trước khi thực thi. | ATT-01, FUNC-036, FUNC-037 | CONFIRMED (`ATT-01b`) / `TBD` (`ATT-01a` chờ chốt với khách) |

## Các quyết định khác biệt giữa nguồn cũ và quyết định mới

- `Final.xlsx > Quy tắc BR-01` nói 'tối đa 5' nhưng Function List/Q9 nói **không giới hạn** → áp dụng không giới hạn.
- `Final.xlsx > Câu hỏi #21` và `FUNC-001/002` nhắc SĐT phụ huynh → **đã được thay bằng email phụ huynh** ngày 06/11/2026.
- `Final.xlsx > Thực thể` liệt kê 'Tóm tắt buổi học' trong phạm vi nhưng sheet `Chức năng` đánh dấu **Không** → chưa tự triển khai tóm tắt buổi học (nếu muốn thêm, mở change request).
- `FUNC-003` có điều hướng theo 'vai trò dùng gần nhất' trong khi `FUNC-009` ghi quyền role cao nhất → ưu tiên RBAC role cao nhất, UI đổi role vẫn cần xác định rõ.
- `FUNC-008` có ghi chú '> không cần' về quy trình duyệt; không được loại bỏ khả năng **Admin xếp lớp** nếu workflow đã chốt. Mức duyệt/phê duyệt bổ sung là TBD.

## Nguyên tắc sửa decision log

Không tự đánh dấu `CONFIRMED` cho đề xuất của AI. Mỗi lần chốt: ghi ngày, người xác nhận, mã FUNC, thay đổi điều kiện test và ảnh hưởng migration/API/UI.

## Ghi nhận đánh đổi kỹ thuật & bảo mật (Engineering Trade-offs)

- **TRD-001 (12/11/2026) — `POST /auth/send-verification-code` trả `409 Conflict` khi email đã tồn tại (`FUNC-001`):**
  - *Bối cảnh:* Endpoint gửi OTP đăng ký kiểm tra trùng `User.email` và trả về `409` kèm thông báo tiếng Việt cụ thể ("Email này đã được đăng ký...") để học viên nhận ra ngay mình đã có tài khoản và chuyển sang đăng nhập/quên mật khẩu thay vì chờ OTP không bao giờ tới.
  - *Đánh đổi:* Cho phép phân biệt email đã đăng ký tại bước gửi OTP (account enumeration có kiểm soát).
  - *Biện pháp giảm thiểu đã triển khai:* Áp dụng rate limit đa tầng cả theo email (cooldown 60s + 5 lần/giờ) lẫn theo IP (`15` yêu cầu / `15 phút` qua `auth_rate_limits` và `resolveClientIp`) để ngăn rà quét email hàng loạt hoặc đốt quota Resend. Trong khi đó `POST /auth/forgot-password` giữ nguyên phản hồi chung (`200 OK`) kèm sàn thời gian tối thiểu để không lộ trạng thái tài khoản.
- **TRD-002 (12/11/2026) — Mô hình `GuardianConsent.studentProfileId @unique` & tính bất biến lịch sử giám hộ (`FUNC-001`, `DEC-023`):**
  - *Thiết kế:* Mỗi học viên đăng ký dưới 16 tuổi có đúng 1 bản ghi `guardian_consents` gắn với lần đăng ký ban đầu (`student_profile_id @unique`), và trigger PostgreSQL `trg_guardian_consents_immutable` chặn mọi `UPDATE`/`DELETE` lên bảng này. Khi học viên đủ 16 tuổi và tự cập nhật email cá nhân (`ProfileService.updateMyProfile`), chỉ `users.email` thay đổi; `guardian_consents` và `student_profiles.guardian_email` giữ nguyên lịch sử gốc từ lúc phụ huynh đồng ý.
  - *Dữ liệu vật hóa (materialized read-model caches):* Ba cặp cột `student_profiles.current_class_id`/`assigned_class` (đồng bộ với `enrollments` `ACTIVE`), `classes.teacher_id` (đồng bộ với `class_teacher_assignments` mở `assigned_to IS NULL`), và `teacher_profiles.active_classes_count` (tính lại tự động bởi trigger PostgreSQL `trg_classes_sync_teacher_active_count`) được giữ để tối ưu truy vấn danh sách và bảo vệ bằng DB constraints/triggers + transaction nguyên tử.
