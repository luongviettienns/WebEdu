# Kế Hoạch Kiểm Thử Trực Tiếp UI Trên Chromium (`playwright-cli`), Đồng Bộ Real-Time Đa Vai Trò, Ponytail Audit & Sẵn Sàng Deploy (`PRE_DEPLOY_QA_PLAN`)

> **Trạng thái:** Đã lên lịch tự động thực thi (`task-765`, đếm ngược 2 tiếng 30 phút)  
> **Nhánh mục tiêu:** `develop` (sau khi hoàn tất toàn bộ Phases 0 $\rightarrow$ 9)  
> **Công cụ chủ lực:** `playwright-cli` (trực tiếp trên Chromium thật, đa phiên cô lập), `ponytail-audit`, bộ cổng kiểm chứng GitHub Actions CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml))  
> **Quy tắc bất biến trong ca chạy:** **100% Read-Only đối với mã nguồn ứng dụng** — tuyệt đối không tự ý sửa code trong ca kiểm thử; mọi bug, lệch dữ liệu, độ trễ real-time hoặc rủi ro kiến trúc phải được ghi nhận đầy đủ bằng chứng vào duy nhất 1 tệp báo cáo: [`docs/reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md`](../reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md).

---

## 1. Kiến Trúc Môi Trường & Điều Phối Đa Phiên Trên Chromium (`playwright-cli`)

### 1.1. Khởi tạo Hạ tầng Kiểm thử Thật (Cô lập 100% với CSDL Phát triển)
1. **Build Production Artifacts trước khi mở trình duyệt:**
   - `backend`: `npm run prisma:generate` $\rightarrow$ `npx prisma migrate deploy` $\rightarrow$ `npm run build` (`backend/dist/main.js`).
   - `frontend`: `npm run build` (`frontend/.next` — 29 routes).
2. **Khởi chạy cụm QA Environment & Frontend Server:**
   - Chạy nền `node backend/test/scripts/qa-environment.mjs`:
     - Tự động dựng CSDL kiểm thử cô lập `webedu_test` (PostgreSQL 16), seed dữ liệu chuẩn và mở cổng API thật tại `http://localhost:3001/api/v1`.
     - Mở máy chủ bắt thư SMTP cục bộ (`127.0.0.1:4025`) và QA Inspector (`http://127.0.0.1:4026`) hỗ trợ:
       - `POST /reseed`: đặt lại toàn bộ dữ liệu mẫu sạch trước các kịch bản phá hủy.
       - `GET /latest-otp?email=<email>`: trích xuất mã OTP 6 chữ số thật từ email đăng ký / đổi email.
       - `GET /latest-token?email=<email>`: trích xuất token khôi phục mật khẩu 64 ký tự hex thật.
       - `POST /reset-rate-limits`: xóa bảng giới hạn tần suất sau khi đã test xong kịch bản khóa IP/OTP.
   - Chạy nền `npm run start -- --port 3005` trong `frontend/` (phục vụ giao diện tại `http://localhost:3005`).

### 1.2. Ma trận 6 Phiên Trình Duyệt Cô Lập Song Song (`playwright-cli -s=<session>`)
Mở và duy trì song song các phiên Chromium độc lập cookie/storage để kiểm chứng đồng bộ tức thì khi vai trò A thao tác $\rightarrow$ vai trò B/C nhìn thấy kết quả:

| Mã phiên (`-s`) | Vai trò | Tài khoản / Mật khẩu | Viewport kiểm thử | Mục đích trọng tâm |
| :--- | :--- | :--- | :---: | :--- |
| `-s=sa` | `SUPERADMIN` thuần | `superadmin@webedu.vn` / `Password@123` | `1440×900` | Cấu hình thương hiệu, AI, nhân sự, audit log; xác minh ẩn chuông thông báo & chặn `403` dữ liệu học vụ |
| `-s=admin` | `ADMIN` thuần | `admin@webedu.vn` / `Password@123` | `1440×900` & `1366×768` | Vận hành khóa HSK, lớp, xếp/chuyển/rút HV, lịch học, điểm danh override, `/admin/overview`, chuông thông báo Admin |
| `-s=teacher` | `TEACHER` thuần | `teacher.lan@webedu.vn` / `Password@123` | `1440×900` & `1366×768` | Lớp phụ trách (`HSK1-K26-01`, `HSK2-K26-01`), lịch dạy, điểm danh $T+2$, ngân hàng đề, giao bài, chấm điểm 2 bước, tiến độ lớp |
| `-s=dual` | `ADMIN + TEACHER` | Tạo mới hoặc nâng quyền trong ca test | `1440×900` | Kiểm tra hợp nhất quyền cao nhất (`ADMIN`), nút chuyển ngữ cảnh `Đang xem: Quản lý Admin` $\leftrightarrow$ `Đang xem: Giáo viên` và ghi nhận `actingRole` |
| `-s=stuA` | `STUDENT` (Đang học) | `active.student@webedu.vn` / `Password@123` | `1440×900` | Học viên lớp `HSK2-K26-01`: tổng quan, lịch học, phòng thi real-time, Zero-Leak trước công bố, bảng điểm sau công bố, chuông thông báo |
| `-s=stuB` / `-s=mobile` | `STUDENT` (Mới / Mobile) | Học viên đăng ký mới (`<16` & $\ge 16$) | `375×812` (`--mobile`) | Kiểm thử toàn bộ luồng từ tự đăng ký $\rightarrow$ chờ xếp lớp $\rightarrow$ vào lớp $\rightarrow$ nộp bài $\rightarrow$ kiểm tra gom thông báo GV & bố cục Mobile `375px` |

### 1.3. Bộ Cổng Quan Sát Kỹ Thuật Bắt Buộc Ở Mọi Điểm Dừng
Tại mỗi trang và sau mỗi thao tác chính, thực thi bộ lệnh kiểm tra của `playwright-cli`:
- `playwright-cli -s=<role> snapshot --boxes`: kiểm tra cây 접근성 (ARIA roles, headings `<h1>`, labels), tọa độ `[box=x,y,w,h]` để phát hiện phần tử bị tràn, đè lên nhau hoặc cắt cụt.
- `playwright-cli -s=<role> console`: bắt buộc **0 `console.error`** và **0 uncaught `pageerror`**.
- `playwright-cli -s=<role> requests`: kiểm tra mọi request API trả mã hợp lệ, không có `500`, không rò rỉ `403` ngầm khi tải trang của `SUPERADMIN`, không có bão polling hay `429`.
- `playwright-cli -s=<role> eval "document.documentElement.scrollWidth - window.innerWidth"`: bắt buộc $\le 2\text{px}$ trên cả `1440×900`, `1366×768` và `375×812`.

---

## 2. Kịch Bản Kiểm Thử Chi Tiết Theo 7 Chặng Nghiệp Vụ (Phủ 100% 26 Routes & 10 Modules)

### Chặng 1: Public Auth, Prototype Cleanup 16/16, Đăng Ký `<16` / `>=16` & Hồ Sơ Cá Nhân (`Routes 1 → 6`)
1. **Route `/` & `/login`:**
   - Mở `http://localhost:3005/` $\rightarrow$ xác nhận redirect sạch về `/login`.
   - Kiểm tra thẩm mỹ Thư họa Á Đông: cột trái `AuthArtSide` (đại tự `學`, con dấu `.seal` đỏ chu sa, nền giấy dó `#F5F6F2`), hiệu ứng lá trúc rơi Canvas (`BambooLeavesBackground`) không chặn thao tác nhập liệu.
   - **Kiểm chứng Prototype Cleanup (`DEC-043`)**: quét toàn bộ DOM `/login` và `/register` đảm bảo **không còn** khối `"Đăng nhập nhanh (Dev)"`, `"Tài khoản demo"`, `"Thử lỗi"`, hay bất kỳ chuỗi `FUNC-xxx`, `DEC-xxx`, `SEC-RISK-xxx` nào.
2. **Route `/register` (Phân nhánh độ tuổi & OTP SMTP thật):**
   - Nhập ngày sinh $< 12$ tuổi $\rightarrow$ xác nhận form chặn ngay với thông báo học viên phải từ 12 tuổi trở lên.
   - Nhập ngày sinh $12\text{–}15$ tuổi (thiếu niên):
     - Xác nhận nhãn trường email tự động đổi thành `"Email cha mẹ / người giám hộ"` và xuất hiện hộp `RegisterGuardianConsentBox`.
     - Thử đăng ký khi chưa tích đồng ý cha mẹ $\rightarrow$ bị chặn.
     - Bấm `"Gửi mã"` $\rightarrow$ lấy OTP 6 số thật qua `GET http://127.0.0.1:4026/latest-otp?email=...` $\rightarrow$ hoàn tất đăng ký $\rightarrow$ chuyển về `/login?registered=1` hiện đúng banner xanh ngọc bích.
   - Nhập ngày sinh $\ge 16$ tuổi $\rightarrow$ hộp đồng ý cha mẹ tự ẩn, gửi OTP và đăng ký thành công.
3. **Chốt chặn bảo mật Đăng nhập, Quên mật khẩu (`/forgot-password`, `/reset-password`):**
   - Nhập sai mật khẩu 5 lần liên tiếp trên tài khoản `lockout.desktop@webedu.vn` $\rightarrow$ lần thứ 5/6 bị khóa tạm 15 phút kèm thông báo rõ ràng.
   - Trên `/forgot-password`: yêu cầu đặt lại mật khẩu cho email không tồn tại và email tồn tại (`reset.desktop@webedu.vn`) $\rightarrow$ cả hai trả cùng thông báo chống dò tài khoản; lấy token thật từ `/latest-token` $\rightarrow$ mở `/reset-password?token=...` $\rightarrow$ đặt mật khẩu mới $\rightarrow$ đăng nhập lại thành công và xác nhận token không thể tái sử dụng lần 2.
4. **Route `/profile` (Bảo vệ học viên `<16` tuổi & Đổi Email OTP):**
   - Đăng nhập bằng tài khoản học viên $<16$ tuổi (`pending.desktop@webedu.vn`): xác nhận giao diện hiển thị trạng thái `Chờ xếp lớp`, trường Ngày sinh bị khóa, trường Email bị khóa tự sửa kèm hướng dẫn liên hệ phụ huynh/Admin, nhưng vẫn cho phép cập nhật Họ tên & SĐT không cần OTP.
   - Đăng nhập bằng học viên $\ge 16$ tuổi (`active.student@webedu.vn`): đổi sang email mới $\rightarrow$ bắt buộc bấm gửi mã OTP về email mới + nhập mật khẩu hiện tại $\rightarrow$ đổi thành công và xoay vòng phiên đăng nhập.

---

### Chặng 2: Superadmin, Cấu Hình Thương Hiệu Real-Time, AI Multi-Provider & Cô Lập RBAC (`Route 20 + Toàn bộ Portal`)
1. **Cô lập vai trò `SUPERADMIN` thuần (`-s=sa`):**
   - Đăng nhập `superadmin@webedu.vn` $\rightarrow$ tự động vào `/superadmin/settings`.
   - Kiểm tra `PortalTopbar`: **không có nút chuông thông báo** (`[data-testid="notification-bell-button"]` = `0`).
   - Kiểm tra Sidebar: chỉ hiện các mục thuộc thẩm quyền (`Quản lý học viên`, `Quản lý giáo viên`, `Nhật ký đổi lịch`, `Cấu hình hệ thống`), **ẩn hoàn toàn** `/admin/overview`, `/admin/courses`, `/admin/classes`, `/admin/schedules`, `/admin/students/pending`.
   - Kiểm tra Network khi duyệt khắp các trang của Superadmin: **0 request nào trả lỗi `403` ngầm**.
   - Điều hướng cưỡng bức trên thanh địa chỉ tới `/admin/overview`, `/admin/students/pending`, `/student/results`, `/teacher/assessments` $\rightarrow$ hiển thị đúng `AccessDeniedState` (`403 — Giới hạn quyền truy cập`).
2. **Đồng bộ Thương hiệu Tức thì (`BrandConfigSection`):**
   - Trên `-s=sa`, đổi Tên trung tâm thành `"TD Hán Ngữ · Cơ Sở Kiểm Thử"` và tải lên logo hợp lệ $\rightarrow$ bấm Lưu.
   - Trên phiên `-s=admin`, `-s=teacher`, `-s=stuA`: chuyển trang SPA hoặc reload $\rightarrow$ xác nhận `PortalTopbar` và `SidebarBrand` cập nhật ngay tên & logo mới (nhờ `Cache-Control: no-store`), không gặp lỗi `429`.
3. **Cấu hình AI Chấm Tự Luận (`AiGradingConfigSection`):**
   - Chuyển đổi qua lại giữa `OPENAI`, `GEMINI`, `CUSTOM` $\rightarrow$ xác nhận `#ai-cfg-base-url` và `#ai-cfg-model` tự điền đúng preset chuẩn.
   - Lưu API Key $\rightarrow$ F5 reload trang $\rightarrow$ kiểm tra Network response của `/api/v1/system-settings/ai-grading` chỉ trả cờ `hasApiKey: true` / masked key, tuyệt đối không trả raw key.
4. **Quản lý Tài khoản Hệ thống & Nhật ký Kiểm toán (`SystemUsersSection`, `AuditLogsSection`):**
   - Thử khóa hoặc gỡ quyền `SUPERADMIN` của chính mình / Superadmin cuối cùng $\rightarrow$ bị chặn `409` (`SEC-07`, `SEC-08`).
   - Tìm kiếm, lọc theo vai trò, trạng thái và mã hành động (`action`) trên bảng `AuditLogsSection`, xác nhận dữ liệu nhạy cảm (`password`, `initialPassword`, `apiKey`) đã được redact sạch.

---

### Chặng 3: Khóa Học HSK (Công Thức Động), Giáo Viên, Lớp Học & Vòng Đời Ghi Danh (`Routes 9, 10, 12 → 17`)
1. **Route `/admin/courses` (`-s=admin`):**
   - Kiểm tra bảng khóa học hiển thị cột `Công thức Tổng kết` (ví dụ `20/30/50% · Đạt ≥ 5.0`).
   - Mở modal sửa khóa `HSK2`: nhập tỷ trọng `30% / 30% / 50%` $\rightarrow$ huy hiệu `[data-testid="course-weights-sum"]` báo `110% / 100%` và chặn lưu; sửa thành `30% / 20% / 50%`, điểm Đạt `5.5` $\rightarrow$ lưu thành công.
2. **Route `/admin/teachers` (`-s=admin`):**
   - Tạo giáo viên mới (trạng thái luôn là `ACTIVE`, không bao giờ là `PENDING_CLASS`).
   - Thử khóa tài khoản `teacher.lan@webedu.vn` (đang dạy lớp active) $\rightarrow$ bật `BlockedTeacherDeactivationModal` hiển thị đúng số lớp đang phụ trách và chặn khóa.
3. **Route `/admin/classes` & `/admin/classes/[id]`:**
   - Mở modal tạo lớp mới: xác nhận không tự chọn sẵn giáo viên đầu tiên; chọn khóa HSK1, giáo viên `Trương Mỹ Lan`, lịch `T2-T4-T6 18:00-19:30` $\rightarrow$ xác nhận `preview-schedule` hiển thị ngày kết thúc dự kiến & cảnh báo nếu trùng ca dạy.
   - Thử đổi giáo viên phụ trách lớp với ngày hiệu lực trong tương lai $\rightarrow$ bị chặn theo quy chuẩn hiệu lực tức thì.
4. **Route `/admin/students/pending`, `/admin/students` & Ghi danh / Chuyển / Rút / Đóng lớp:**
   - Tại `/admin/students/pending`: kiểm tra học viên vừa đăng ký ở Chặng 1 xuất hiện trong danh sách; bấm `"Xếp lớp"` (`AssignInitialClassModal`) $\rightarrow$ gán vào lớp `HSK2-K26-01` $\rightarrow$ học viên chuyển sang `ACTIVE`, số đếm badge `Chờ xếp lớp` trên Sidebar Admin giảm ngay `1` đơn vị.
   - Tại `/admin/classes/[id]`:
     - Kiểm tra `ClassSummary` hiển thị tiến độ `X / Y buổi (Z%)`, `còn N buổi` và `Buổi tiếp theo`.
     - Thực hiện **Chuyển lớp** (`TransferStudentClassModal`) và **Rút học viên** (`DropStudentClassModal`) (chặn ngày tương lai) $\rightarrow$ kiểm tra lịch sử ghi danh lưu đủ trạng thái `TRANSFERRED` / `DROPPED`.
     - Thực hiện **Kết thúc lớp** (`CompleteClassModal` — cảnh báo rõ số buổi `SCHEDULED` còn lại) $\rightarrow$ lớp chuyển sang `COMPLETED` (`READ_ONLY`), sau đó thực hiện **Mở lại lớp** (`reopen`) trong hạn 7 ngày.

---

### Chặng 4: Lịch Học, Đổi/Hủy/Bù Buổi & Điểm Danh Ma Trận / T+2 (`Routes 8, 11, 18, 19`)
1. **Route `/admin/schedules`, `/admin/schedule-logs` & `/teacher/schedules`:**
   - Kiểm tra 3 chế độ hiển thị `Tháng`, `Tuần`, `Danh sách` và bộ lọc Lớp / Giáo viên / Trạng thái buổi học.
   - Admin chọn một buổi học `SCHEDULED` của lớp `HSK2-K26-01`:
     - Thực hiện **Đổi lịch** (`RESCHEDULE` kèm lý do) $\rightarrow$ kiểm tra giờ/ngày mới cập nhật ngay trên lịch của Admin (`-s=admin`), Giáo viên (`-s=teacher`) và Học viên (`-s=stuA`).
     - Thực hiện **Hủy buổi** (`CANCEL`) $\rightarrow$ **Tạo buổi học bù** (`ADD_MAKEUP`) $\rightarrow$ xác nhận hệ thống tự động đánh lại số thứ tự buổi học (`sessionNumber`), cập nhật `expectedEndDate` của lớp và ghi đầy đủ lịch sử vào `/admin/schedule-logs`.
2. **Điểm danh Buổi học (`SessionAttendanceModal` & Tab `Điểm danh`):**
   - Giáo viên (`-s=teacher`) mở modal điểm danh buổi học hôm nay:
     - Thử lưu khi mới tích 1/2 học viên $\rightarrow$ hệ thống chặn, yêu cầu điểm danh đủ 100% học viên thuộc lớp.
     - Đánh dấu đầy đủ (`Có mặt`, `Vắng không phép`, `Vắng có phép`) $\rightarrow$ Lưu $\rightarrow$ buổi học chuyển sang `COMPLETED`, bảng ma trận điểm danh (`ClassAttendanceMatrixTab`) và cột `Số buổi nghỉ` ở tab Học viên tự động cập nhật ngay không cần F5.
     - Sửa lại trạng thái điểm danh đã lưu (trong hạn $T+2$ `GMT+7`) $\rightarrow$ bắt buộc nhập lý do sửa $\rightarrow$ lưu thành công và hiện chỉ báo `"Đã sửa"` trên ma trận.
     - Kiểm tra buổi học đã qua $> 2$ ngày (`GMT+7`): Giáo viên bị khóa quyền sửa (`403`), trong khi Admin (`-s=admin`) sửa override thành công kèm lý do.
     - Kiểm tra cảnh báo chuyên cần: khi học viên nghỉ $\ge 30\%$ tổng số buổi của lớp, huy hiệu cảnh báo đỏ xuất hiện trên cả giao diện Giáo viên, Admin và `/student/schedule` của Học viên.

---

### Chặng 5: Ngân Hàng Đề 7 Dạng HSK, Import Word/PDF & Phòng Thi Real-Time (`Routes 21, 22, 23`)
1. **Route `/teacher/assessments` (`-s=teacher`):**
   - Tạo đề mới: kiểm tra khi chọn từng loại đề (`HOMEWORK`, `MINI_TEST`, `MIDTERM`, `FINAL`), ô `durationMinutes` tự điền đúng `null`/`15`/`45`/`60` phút kèm hộp gợi ý cấu trúc HSK `[data-testid="assessment-type-preset-hint"]`.
   - Kiểm tra trình biên tập 7 dạng câu hỏi (`SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `TRUE_FALSE`, `FILL_IN_BLANK`, `MATCHING`, `ORDERING`, `ESSAY`), tải lên file âm thanh `.mp3` và ảnh `.png` (kiểm tra tính năng tự động ghép `mediaId` cho cả câu Nghe và câu Hình ảnh).
   - Kiểm tra luồng **Import Word/PDF** với `frontend/e2e/fixtures/sample-questions.docx`:
     - Khung đối chiếu đề gốc song song (`OriginalPaperPreview`), kiểm tra bóc tách đáp án không trùng key, duyệt câu hỏi `needsReview`.
     - Mở chế độ **Xem thử (Preview)**: xác nhận các từ trong câu Sắp xếp (`ORDERING`) đã được xáo trộn khác thứ tự đáp án gốc.
   - Xuất bản đề (`PUBLISHED`) và giao bài (`Assign`) cho lớp `HSK2-K26-01`.
2. **Route `/student/assignments` & `/student/assignments/[id]` (`-s=stuA` & `-s=stuB`):**
   - Học viên kiểm tra danh sách bài tập (tab `Tất cả`, `Cần làm`, `Đã nộp`), bấm `"Làm bài"` vào phòng thi `StudentExamRunner`:
     - Kiểm tra đồng hồ đếm ngược real-time; thử thu nhỏ/chuyển tab rồi quay lại để xác nhận đồng hồ tính theo wall-clock thực tế.
     - Đánh dấu cờ câu hỏi (`Flag`), chọn/nhập đáp án, bấm `Lưu nháp` $\rightarrow$ F5 tải lại trang $\rightarrow$ xác nhận cả đáp án lẫn cờ đánh dấu câu hỏi đều được khôi phục nguyên vẹn.
     - Mở tab thứ 2 cùng làm bài $\rightarrow$ xác nhận cơ chế đồng bộ nháp đa tab hoạt động mượt, không ghi đè mất câu vừa sửa.
     - Kiểm tra phát file nghe `<audio>` và giới hạn số lượt nghe (`audioPlayCount`).
     - Bấm `"Nộp bài"` chính thức $\rightarrow$ thử nộp lại lần 2 bị chặn.
   - Giáo viên (`-s=teacher`) thực hiện **Mở lại lượt nộp** (`reopen` kèm hạn mới `dueAtOverride`) cho học viên $\rightarrow$ Học viên thấy trạng thái `"Lần làm 2"`, vào làm lại với đáp án cũ được giữ sẵn và nháp lượt 1 đã được dọn sạch.

---

### Chặng 6: Chấm Điểm Rule-Based / AI Zero-PII, Công Bố 2 Bước Zero-Leak & Báo Cáo Tiến Độ (`Routes 7, 24, 25, 26`)
1. **Route `/teacher/assignments/[assignmentId]/grading` (`-s=teacher`):**
   - Kiểm tra chấm tự động các câu trắc nghiệm/điền từ/nối/sắp xếp.
   - Bấm gọi **Gợi ý AI** (đơn lẻ và hàng loạt `#btn-batch-ai-grade`) cho câu tự luận (`ESSAY`); giáo viên chấm điểm tự luận (kiểm tra bước điểm `0.25`, từ chối điểm âm hoặc vượt điểm tối đa của câu) và nhập nhận xét.
   - **Kiểm chứng Cổng Zero-Leak ở Bước 1 (`GRADED`)**:
     - Giáo viên bấm `"Xác nhận điểm"` (`#btn-confirm-all-grades`) $\rightarrow$ bài nộp chuyển sang tab `Đã xác nhận` (`GRADED`).
     - Chuyển ngay sang phiên Học viên (`-s=stuA`):
       - Tại `/student/assignments/[id]`: chỉ hiện thông báo `"Bài đã nộp — Đang chờ giáo viên chấm và công bố điểm"`, **không lộ điểm số, nhận xét hay giải thích đáp án**.
       - Tại `/student/results` và `/student/overview`: bài kiểm tra đang `GRADED` **chưa xuất hiện** trong bảng kết quả đã công bố và **chưa cộng vào điểm trung bình thành phần / điểm tổng kết**.
       - Tại chuông thông báo `NotificationBellPopover`: **0 thông báo công bố điểm**.
   - **Kiểm chứng Bước 2 (`RETURNED` — Công bố điểm)**:
     - Giáo viên bấm `"Công bố điểm"` (`#btn-publish-confirmed-grades`) $\rightarrow$ chuyển sang `RETURNED`.
     - Phiên Học viên (`-s=stuA`) mở `/student/assignments/[id]?mode=review`: hiển thị đầy đủ `Điểm tổng kết`, điểm từng câu, nhận xét giáo viên, giải thích đáp án, trình phát `<audio>` và ảnh `<img>` hoạt động bình thường.
   - **Chỉnh sửa điểm sau công bố & Chốt 0 điểm quá hạn:**
     - Giáo viên mở bài đã công bố $\rightarrow$ bấm `#btn-open-adjust-grade` $\rightarrow$ sửa điểm kèm lý do bắt buộc $\rightarrow$ kiểm tra panel lịch sử sửa điểm `[data-testid="grade-audit-log-panel"]` và huy hiệu `"Đã cập nhật dd/mm/yyyy"` phía học viên.
     - Chuyển sang tab `"Quá hạn chưa nộp"` $\rightarrow$ bấm `"Ghi 0 điểm"` tường minh cho học viên quá hạn.

---

### Chặng 7: Kiểm Chứng Chuyên Sâu Real-Time Sync, Chuông Thông Báo 14 Sự Kiện & Đối Chiếu Khớp Số Liệu 4 Chiều
1. **Kiểm chứng độ trễ & tính chính xác của 14 sự kiện `NotificationType` trên `NotificationBellPopover`:**
   - Theo dõi trực tiếp trên các phiên `-s=admin`, `-s=teacher`, `-s=stuA`, `-s=stuB` cho toàn bộ 14 loại thông báo:
     - `NEW_STUDENT_PENDING_CLASS` (Admin nhận khi HV tự đăng ký).
     - `STUDENT_ENROLLED`, `STUDENT_TRANSFERRED`, `STUDENT_DROPPED` (HV nhận khi Admin xếp/chuyển/rút lớp).
     - `TEACHER_ASSIGNED_CLASS` (GV nhận khi được phân công lớp mới hoặc nhận bàn giao lớp).
     - `SESSION_RESCHEDULED`, `SESSION_CANCELLED`, `SESSION_MAKEUP_ADDED` (HV đang `ACTIVE` và GV nhận; xác nhận HV đã `DROPPED` không nhận).
     - `ASSIGNMENT_ASSIGNED`, `ASSIGNMENT_DUE_SOON` (kể cả bài mở lại có `dueAtOverride` mới trong cửa sổ 24h), `SUBMISSION_REOPENED` (HV nhận).
     - `SUBMISSION_PENDING_GRADING` (khi cả `stuA` và `stuB` cùng nộp bài cho 1 đề, GV nhận **đúng 1 thông báo cộng dồn** `"2 bài nộp đang chờ chấm"`, không bị nhân bản thành 2 dòng).
     - `GRADE_PUBLISHED` và `GRADE_UPDATED` (HV chỉ nhận sau khi bài ở trạng thái `RETURNED`).
   - Kiểm tra đầy đủ hành vi UI của Popover:
     - Mở Popover trên cả Desktop (`1440×900`) và Mobile (`375×812` — hộp thoại căn lề `fixed inset-x-3` không tràn ngang).
     - Chuyển tab `Tất cả` $\leftrightarrow$ `Chưa đọc`, bấm `"Tải thêm"` khi có $>20$ thông báo, bấm vào từng thông báo (tự đóng Popover, giảm badge chưa đọc `1` đơn vị, điều hướng đúng URL đích an toàn), bấm `"Đánh dấu tất cả đã đọc"` (badge biến mất ngay).
   - **Kiểm tra hiệu năng Polling & Bảo toàn Idle Timeout 60 phút:**
     - Quan sát tab Network của `playwright-cli requests`: xác nhận polling nền chỉ gọi `GET /api/v1/notifications/unread-count` mỗi `60s` khi `document.visibilityState === 'visible'`, throttle `10s` khi focus liên tục, không tạo bão request.
     - Xác nhận `GET /api/v1/notifications/unread-count` có `@SkipActivityTouch()` không làm mới `lastActivityAt` trên DB và tự động ngắt polling khi `IdleTimeoutWarningModal` hiển thị ở phút 55.
2. **Đối chiếu khớp dữ liệu 100% giữa 4 màn hình của 3 vai trò (`Cross-Role Data Parity`):**
   - Đặt cạnh nhau số liệu của lớp `HSK2-K26-01` và học viên `Phạm Gia Huy` trên:
     1. `/student/overview` (Học viên — tổng quan)
     2. `/student/results` (Học viên — bảng điểm chi tiết)
     3. `/teacher/classes/[id]` (Giáo viên — Tab `Thông tin & Học viên` + Tab `Tiến độ & Kết quả` `[data-testid="class-progress-table"]`)
     4. `/admin/overview` (Admin — 4 thẻ KPI, bảng tổng hợp lớp `[data-testid="admin-overview-classes-table"]`, lịch hôm nay & 5 ngày tới) và `/admin/classes/[id]`
   - Đối chiếu từng chỉ số: `Số buổi hoàn thành / Tổng số buổi (%)`, `Số buổi còn lại & Ngày kết thúc dự kiến`, `Tỷ lệ chuyên cần (%)`, `Số buổi nghỉ`, `Tỷ lệ nộp BTVN & Điểm TB BTVN`, `Điểm TB Mini-test / Giữa kỳ / Cuối kỳ`, `Điểm tổng kết` (tính theo công thức trọng số khóa học, tách biệt hoàn toàn BTVN) và nhãn `Đạt` / `Chưa đạt` / `Chưa đủ dữ liệu` / `Cần chú ý`.

---

## 3. Kế Hoạch Thực Thi `ponytail-audit` & Kiểm Chứng GitHub Actions CI

### 3.1. Ponytail Audit Toàn Bộ Repository (`.agents/skills/ponytail-audit/SKILL.md`)
Đánh giá toàn bộ mã nguồn `backend/` và `frontend/` dưới góc nhìn vận hành thực tế (giả định tải: nhiều lớp học và phòng thi hoạt động đồng thời, học viên autosave định kỳ, giáo viên chấm/gọi AI batch, các tab mở nhận thông báo polling):
1. **Bug:** lệch múi giờ `UTC` vs `Asia/Ho_Chi_Minh`, làm tròn điểm số, điều kiện biên rỗng/0/phần tử cuối, bất đồng bộ kiểu dữ liệu giữa API và UI.
2. **Risk:** lỗ hổng phân quyền (IDOR/BOLA), leo thang đặc quyền đa vai trò, lộ thông tin qua thông báo/log, mất dữ liệu khi lỗi mạng hoặc giao dịch dở dang.
3. **Scale & Real-Time Performance:** race condition khi check-then-write, truy vấn $N+1$, bộ nhớ tăng không giới hạn (cache/map/timer trong tiến trình Node.js), chi phí query của cơ chế polling 60s + quét hạn 24h khi số lượng học viên tăng.
4. **Missing Test:** nhánh logic rủi ro cao chưa có test bảo vệ.
5. **Speed & Lean:** đường nóng chậm, mã chết, helper trùng lặp hoặc độ phức tạp không cần thiết.

### 3.2. Chạy Kiểm Chứng Tương Đương 1-1 Với GitHub CI (`.github/workflows/ci.yml`)
Chạy tuần tự và ghi nhận kết quả thực tế của toàn bộ pipeline CI:
1. `node scripts/check-loc.js` (kiểm tra giới hạn LOC trên toàn bộ 7 danh mục tệp).
2. `backend`: `npm run prisma:generate` $\rightarrow$ `npx prisma migrate deploy` $\rightarrow$ `npm run typecheck` $\rightarrow$ `npm run lint` (`oxlint`) $\rightarrow$ `npm run build` $\rightarrow$ `npm run test:cov` ($\ge 85\%$ lines, $\ge 80\%$ branches) $\rightarrow$ `npm run test:integration` $\rightarrow$ `npm run test:e2e`.
3. `frontend`: `npm run typecheck` $\rightarrow$ `npm run lint` (`eslint`) $\rightarrow$ `npm run test:unit` $\rightarrow$ `npm run build` $\rightarrow$ `npm run test:e2e` (Desktop + Mobile Chromium + `@axe-core/playwright` WCAG 2.1 AA).

---

## 4. Cấu Trúc Tệp Báo Cáo Đầu Ra Duy Nhất (`docs/reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md`)

Toàn bộ kết quả của phiên chạy theo lịch sẽ được xuất bản vào [`docs/reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md`](../reports/PRE_DEPLOY_QA_AND_PONYTAIL_AUDIT_REPORT.md) gồm 5 phần chuẩn:
1. **Tóm tắt Điều hành & Kết luận Sẵn sàng Deploy (`Executive Verdict`)**: Tổng số route/luồng đã test trên Chromium, tổng số bug theo mức độ (`Critical`, `High`, `Medium`, `Low`), trạng thái CI Gates.
2. **Bảng Kiểm Kê Kết Quả Trực Tiếp Trên 26 Routes & 7 Chặng Nghiệp Vụ**: Trạng thái `PASS` / `FAIL` kèm độ trễ đo được của các tác vụ real-time và kết quả đối chiếu dữ liệu 4 chiều giữa các vai trò.
3. **Danh Mục Chi Tiết Các Bug Phát Hiện Trên UI / Real-Time (Nếu có)**: Đánh số `BUG-QA-01..N`, ghi rõ Mức độ, Route/Vai trò, Bước tái hiện chính xác, Kỳ vọng vs Thực tế, Log Console/Network/Ảnh chụp màn hình và Phương án sửa triệt để đề xuất cho giai đoạn fix sau.
4. **Báo Cáo `ponytail-audit` Toàn Repo**: Trình bày đúng cấu trúc chuẩn (`What this repo does` & tải giả định $\rightarrow$ các phát hiện đánh số xuyên suốt theo 3 nhóm `Must fix`, `Should fix`, `Nice to have` với đủ 4 mục `What this is / Problem / Fix / If we skip it` $\rightarrow$ `Verdict`, `Lean`, `Not checked`).
5. **Bảng Kết Quả Thực Thi Pipeline GitHub CI & Checklist Hạ Tầng Trước Khi Deploy/Release Sang `main`**.
