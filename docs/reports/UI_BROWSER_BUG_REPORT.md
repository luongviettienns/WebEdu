# Báo Cáo Lỗi Kiểm Thử Giao Diện Trình Duyệt (WebEdu UI Browser QA Bug Report)

> **Môi trường kiểm thử:** Dev Local (`http://localhost:3000` Frontend `next dev` · `http://localhost:3001` Backend `nest start --watch` · PostgreSQL `webedu` tại `localhost:5432`)
> **Nhánh & Commit kiểm thử:** `develop` @ `a5945b7`
> **Ngày thực hiện:** 2026-11-17
> **Chính sách:** Chỉ kiểm thử, ghi nhận chi tiết mọi lỗi phát hiện và đối chiếu đồng bộ đa tác nhân — không sửa mã nguồn sản phẩm trong quá trình test.

> [!NOTE]
> **Cập nhật trạng thái (19/11/2026):** Toàn bộ **30/30 lỗi** (`BUG-M1-01` $\rightarrow$ `BUG-M9-03`) ghi nhận trong báo cáo này đã được khắc phục triệt để và kiểm chứng hồi quy toàn phần trên nhánh `develop` tại hai commit `aa0f0bb` & `2f34c2c` (`check:loc 270/270`, Backend Unit `579/579` PASS, PG Integration `20/20` PASS, Backend HTTP E2E `75/75` PASS, Frontend Unit `44/44` PASS, `next build 29/29` routes PASS, Playwright `13/13` specs · `107` PASS / `3` skip desktop-only + Axe WCAG AA). Nội dung chi tiết dưới đây được giữ nguyên làm bằng chứng lịch sử kiểm thử.

---

## 1. Bảng Tổng Hợp Tiến Độ & Thống Kê Lỗi Theo Module

| Module | Tên phân hệ | Routes chính | Tổng Case (Module + Sync) | Pass | Fail | Blocked | Critical | High | Medium | Low | Trạng thái |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **M1** | Xác thực, Đăng ký, Phiên & Hồ sơ | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile` | 14 (+SYNC-03) | 13 | 2 | 0 | 0 | 1 | 1 | 1* | ✅ Đã chạy (3 bugs) |
| **M2** | Shell, Đa vai trò & Vận hành Superadmin | `/superadmin/settings` + Shell toàn cục | 11 (+SYNC-01,02,12) | 11 | 2 | 0 | 0 | 0 | 2 | 1* | ✅ Đã chạy (3 bugs · `SYNC-12` PASS ở M8) |
| **M3** | Giáo viên, Hồ sơ HV & Chờ xếp lớp | `/admin/teachers`, `/admin/students`, `/admin/students/pending` | 9 (+SYNC-02,03,04) | 10 | 2 | 0 | 0 | 0 | 3* | 0 | ✅ Đã chạy (3 bugs) |
| **M4** | Khóa học HSK, Lớp học & Ghi danh | `/admin/courses`, `/admin/classes`, `/admin/classes/[id]`, `/teacher/classes`, `/teacher/classes/[id]` | 12 (+SYNC-05,06,07,14) | 14 | 1 | 0 | 0 | 1 | 0 | 0 | ✅ Đã chạy (1 bug · `SYNC-14` ở M9) |
| **M5** | Lịch học, Buổi học & Điểm danh | `/admin/schedules`, `/teacher/schedules`, `/student/schedule`, `/admin/schedule-logs` + Tabs | 11 (+SYNC-08,09) | 10 | 3 | 0 | 0 | 0 | 3 | 0 | ✅ Đã chạy (3 bugs) |
| **M6** | Ngân hàng câu hỏi & Import Word/PDF | `/teacher/assessments` (4 views) | 10 *(+SYNC-10 ở M7)* | 3 | 7 | 0 | 1 | 2 | 5* | 0 | ✅ Đã chạy (8 bugs) |
| **M7** | Giao bài, Phòng thi & Nộp bài 1 lượt | `/student/assignments`, `/student/assignments/[id]` + Tabs | 10 (+SYNC-10,11) | 9 | 3 | 0 | 0 | 0 | 2 | 1 | ✅ Đã chạy (3 bugs) |
| **M8** | Chấm điểm, AI Gợi ý & Công bố 2 bước | `/teacher/assignments/[assignmentId]/grading`, `/student/assignments/[id]?mode=review` | 10 (+SYNC-12,13) | 9 | 3 | 0 | 0 | 1 | 2 | 0 | ✅ Đã chạy (3 bugs) |
| **M9** | Tiến độ, Tổng kết & Audit toàn cục 26 routes | `/admin/overview`, `/student/overview`, `/student/results` + Tab Tiến độ | 8 (+SYNC-14) | 7 | 2 | 0 | 0 | 1 | 1 | 1 | ✅ Đã chạy (3 bugs mới + tái xác nhận `BUG-M2-01`) |
| **Tổng** | **Toàn hệ thống (26/26 Routes)** | **Phases 1–8** | **95 + 14 Sync** *(111 lượt gate)* | **86** | **25** | **0** | **1** | **6** | **19** | **4** | **✅ Hoàn tất 9/9 Modules (30 bugs)** |

*\*Ghi chú:*
- *Trong `M1-14` (`PASS` responsive/tab/console) phát hiện thêm `1` lỗi Low ngữ nghĩa HTML (`BUG-M1-03`).*
- *Trong `M2-09` phát hiện `2` bug (`BUG-M2-01` & `BUG-M2-02`); `SYNC-12` đã được kiểm chứng `PASS` ở **Module M8**.*
- *Trong `M3-06` phát hiện thêm `1` lỗi `BUG-M3-03` (`403` console error khi `SUPERADMIN` mở `StudentDetailModal`).*
- *`M5-08`: Theo `attendance.policy.ts` (`DEC-032`), cửa sổ `T+2` áp dụng cho **sửa** điểm danh sau khi đã chấm (`hasExistingAttendance = true`); đã kiểm chứng trên `B19` rằng GV bị khóa sửa sau `T+2` (`403` + ẩn nút `Sửa điểm danh`).*
- *Trong `M6-09` phát hiện `2` bug (`BUG-M6-01` Critical chặn phát hành PDF có câu Nghe, và `BUG-M6-07` Medium trùng React key); `SYNC-10` kiểm chứng ở **Module M7**.*
- *Trong `M9-07` phát hiện `BUG-M9-01` (`DEC-038`) và `BUG-M9-03` (gọi lặp `/system-settings/config` gây `429`), đồng thời ghi nhận lặp lại `BUG-M2-01` (`FUNC-057`, không đếm trùng). Quy đổi theo 109 đầu mục duy nhất: **`73/95` Module Cases PASS (`22 FAIL`)**, **`11/14` Sync Scenarios PASS (`3 FAIL`: `SYNC-01`, `SYNC-06`, `SYNC-10`)**, `26/26` routes đã quét.*

---

## 2. Chi Tiết Các Lỗi Phát Hiện (Bug Log)

### Module M1 — Xác thực, Đăng ký, Phiên & Hồ sơ cá nhân

#### [BUG-M1-01] Nút `Đăng xuất` bị vô hiệu hóa vĩnh viễn sau khi đăng xuất rồi đăng nhập lại trên cùng tab SPA
- **Module / Case ID:** `M1` / `M1-09`
- **Severity:** `High`
- **Vai trò & Route URL:** `STUDENT` (`active.student@webedu.vn`) — `http://localhost:3000/student/overview`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Mở `http://localhost:3000/login` và đăng nhập với `active.student@webedu.vn` / `Password@123`.
  2. Chờ `/student/overview` tải xong; xác nhận `button[aria-label="Đăng xuất"]` đang bật (`disabled: false`).
  3. Bấm `button[aria-label="Đăng xuất"]` -> điều hướng SPA về `/login`.
  4. Trên chính tab đó (không nhấn `F5`), đăng nhập lại với `active.student@webedu.vn` / `Password@123`.
  5. Chờ `3+` giây sau khi `/student/overview` tải xong toàn bộ API (`200 OK`).
- **Kết quả mong đợi:** Nút `button[aria-label="Đăng xuất"]` phải ở trạng thái hoạt động (`disabled: false`) để người dùng có thể đăng xuất lại.
- **Kết quả thực tế:** Nút `button[aria-label="Đăng xuất"]` vẫn bị kẹt ở trạng thái `disabled: true` vĩnh viễn cho tới khi tải lại trang cứng (`F5`).
- **Bằng chứng kỹ thuật:**
  - Network: `POST /api/v1/auth/login => 200`, `GET /api/v1/auth/me => 200`, `GET /api/v1/profile/me => 200`.
  - DOM: `<button disabled type="button" title="Đăng xuất" aria-label="Đăng xuất" ...>` (`secondLoginDisabledAfter3s: true`).
  - Console errors: `0`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\bug_logout_disabled_relogin.png`

#### [BUG-M1-02] Tự động đăng xuất khi hết thời gian nhàn rỗi 60 phút chuyển hướng về `/login` nhưng thiếu `?reason=idle_timeout` nên không hiển thị banner thông báo
- **Module / Case ID:** `M1` / `M1-10`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `STUDENT` (`active.student@webedu.vn`) — `http://localhost:3000/student/overview` $\rightarrow$ `http://localhost:3000/login`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `active.student@webedu.vn` / `Password@123`, mở `/student/overview`.
  2. Lấy `userId` (`1ac33c68-6cfb-49b1-8038-20d5289e70cd`) và đặt `localStorage['webedu_last_activity_1ac33c68-6cfb-49b1-8038-20d5289e70cd'] = String(Date.now() - 60 * 60 * 1000)`.
  3. Tải lại trang (`/student/overview`) và đợi 3 giây để cơ chế auto-logout chạy.
- **Kết quả mong đợi:** Tự động đăng xuất và điều hướng về `http://localhost:3000/login?reason=idle_timeout`, hiển thị banner *"Phiên đăng nhập đã tự động kết thúc sau 60 phút không có hoạt động. Vui lòng đăng nhập lại."* (đã xác nhận banner hoạt động bình thường khi mở trực tiếp URL có `?reason=idle_timeout` ở `M1-03`). Ngoài ra, đặt `-59m57s` không reload không tự kích hoạt đăng xuất trong vòng 8 giây chờ.
- **Kết quả thực tế:** Chuỗi điều hướng kết thúc ở `http://localhost:3000/login` (bị mất query `?reason=idle_timeout`) và không có banner thông báo nào xuất hiện (`banners: []`).
- **Bằng chứng kỹ thuật:**
  - `navUrls`: `["http://localhost:3000/student/overview", "http://localhost:3000/student/overview", "http://localhost:3000/login"]`.
  - `finalUrl`: `"http://localhost:3000/login"`.
  - Console errors: `0`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\bug_m1_10_missing_idle_reason.png`

#### [BUG-M1-03] Các trang Auth công khai thiếu landmark `<main>` và trang `/login` chứa 2 thẻ `<h1>` trong DOM
- **Module / Case ID:** `M1` / `M1-14`
- **Severity:** `Low`
- **Vai trò & Route URL:** `Khách` — `/login`, `/register`, `/forgot-password`, `/reset-password`
- **Viewport:** `Desktop 1440×900` & `Mobile 375×812`
- **Các bước tái hiện:**
  1. Mở các route công khai (`/login`, `/register`, `/forgot-password`, `/reset-password`).
  2. Kiểm tra cây DOM / Accessibility landmarks (`document.querySelector('main')` và `document.querySelectorAll('h1')`).
- **Kết quả mong đợi:** Mỗi trang có đúng 1 landmark `<main>` và 1 heading cấp 1 `<h1>` duy nhất.
- **Kết quả thực tế:** Các trang Auth công khai không có thẻ `<main>`; riêng `/login` tồn tại 2 thẻ `<h1>` trong DOM (1 tiêu đề mobile nằm trong khối `lg:hidden` và 1 tiêu đề desktop trong khối `hidden lg:block`).
- **Bằng chứng kỹ thuật:** DOM audit ở `M1-14` trên Chromium (`1440×900` & `375×812`).

---

### Module M2 — Shell Điều Hướng, Đa Vai Trò & Vận Hành Superadmin

#### [BUG-M2-01] Lộ mã yêu cầu nội bộ `FUNC-057` và đánh số thứ tự mục trùng `"3."` trên `/superadmin/settings`
- **Module / Case ID:** `M2` / `M2-09`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `SUPERADMIN` (`superadmin@webedu.vn`) — `http://localhost:3000/superadmin/settings`
- **Viewport:** `Desktop 1440×900` & `Mobile 375×812`
- **Các bước tái hiện:**
  1. Đăng nhập `superadmin@webedu.vn` / `Password@123` và mở `/superadmin/settings`.
  2. Cuộn xuống các mục tiêu đề `h2` phần Cấu hình AI và Nhật ký hệ thống.
- **Kết quả mong đợi:** Tiêu đề giao diện người dùng cuối sạch hoàn toàn mã tài liệu nội bộ (`FUNC-xxx`, vi phạm Prototype Cleanup #6–#8) và đánh số tuần tự `3.` rồi `4.`.
- **Kết quả thực tế:**
  1. Mục AI hiển thị `"3. Cấu hình AI Gợi ý Chấm Tự luận (FUNC-057)"` — lộ mã `FUNC-057`.
  2. Mục Nhật ký hệ thống phía dưới cũng đánh số `"3. Nhật ký hệ thống"`, bị trùng số `3.` với mục AI.
- **Bằng chứng kỹ thuật:**
  - DOM `h2` headings: `["1. Quản lý tài khoản Admin & Gán đa vai trò", "2. Cấu hình hệ thống", "3. Cấu hình AI Gợi ý Chấm Tự luận (FUNC-057)", "3. Nhật ký hệ thống"]`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\m2-09-func057-leak.png`

#### [BUG-M2-02] Đổi `Nhà cung cấp (Provider)` trong Cấu hình AI không tự cập nhật preset `Model AI` và `Base URL Endpoint` khi ô đang có giá trị cũ
- **Module / Case ID:** `M2` / `M2-09`
- **Severity:** `Low`
- **Vai trò & Route URL:** `SUPERADMIN` (`superadmin@webedu.vn`) — `http://localhost:3000/superadmin/settings`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Trên phần `AiGradingConfigSection` đang có sẵn cấu hình `CUSTOM` (`gpt-5.6-luna`, `https://modelapi.vn/v1`), hoặc chuyển sang `OPENAI` khi 2 ô đang trống để tự điền preset OpenAI.
  2. Đổi dropdown `Nhà cung cấp (Provider)` sang `GEMINI` (`Google Gemini (Native REST)`).
- **Kết quả mong đợi:** `Model AI` và `Base URL Endpoint` cập nhật theo preset của provider mới chọn (hoặc có cảnh báo/nút áp preset), tránh gửi nhầm URL OpenAI/Custom sang nhánh Gemini.
- **Kết quả thực tế:** Hai ô input giữ nguyên giá trị cũ (`gpt-5.6-luna` / `https://modelapi.vn/v1` hoặc `gpt-6-luna` / `https://api.openai.com/v1`), chỉ đổi placeholder trừ khi người dùng xóa trắng cả hai ô trước.
- **Bằng chứng kỹ thuật:** Quan sát DOM state của `#ai-cfg-provider`, `#ai-cfg-model`, `#ai-cfg-base-url` khi đổi provider trên `/superadmin/settings`.

#### [BUG-M2-03] Đồng bộ cấu hình thương hiệu đa tác nhân chưa nhất quán (`/login` hardcode tên trung tâm, SPA nav cũ & cache HTTP 300s)
- **Module / Case ID:** `M2` / `SYNC-01` (`M2-08`)
- **Severity:** `Medium`
- **Vai trò & Route URL:** `SUPERADMIN` (`/superadmin/settings`) $\rightarrow$ `STUDENT` (`/student/overview`, `/student/schedule`) & `Khách` (`/login`)
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Ở phiên `-s=m2a` (`superadmin@webedu.vn`), đổi `Tên trung tâm` thành `Trung Tâm TD Hán Ngữ QA` và upload `valid-logo.png`, bấm `Lưu cấu hình hệ thống` (`PUT /api/v1/system-settings/config => 200`).
  2. Ở phiên `-s=m2b` (đang đăng nhập sẵn `active.student@webedu.vn` tại `/student/overview`), chuyển SPA sang `/student/schedule`, rồi tải lại trang và kiểm tra thêm `/login`.
- **Kết quả mong đợi:** Tên trung tâm và logo mới đồng bộ nhất quán sang các người dùng khác và trang `/login` (đúng mô tả *"hiển thị trên thanh điều hướng cùng màn hình Đăng nhập"*).
- **Kết quả thực tế:**
  1. Khi chuyển route SPA trong `-s=m2b` (`/student/overview` $\rightarrow$ `/student/schedule`), Sidebar vẫn giữ tên & dấu triện cũ (`"Trung Tâm TD Hán Ngữ"` + `"汉"`) cho tới khi reload cứng.
  2. Endpoint `GET /api/v1/system-settings/config` trả header `Cache-Control: public, max-age=300, stale-while-revalidate=600` khiến trình duyệt khác có thể giữ dữ liệu cũ tối đa 300–900 giây sau khi Superadmin lưu.
  3. Trên `/login`, dù ảnh logo `<img alt="Trung Tâm TD Hán Ngữ QA" ...>` cập nhật, dòng tên thương hiệu lớn ở cột trái nghệ thuật vẫn hardcode `"TD Hán Ngữ"` và `<title>` vẫn là `"Trung Tâm TD Hán Ngữ — Hệ Thống Quản Trị Học Tập"`.
- **Bằng chứng kỹ thuật:** Kiểm chứng song song 2 phiên `-s=m2a` và `-s=m2b` + kiểm tra response headers của `GET /api/v1/system-settings/config`.

---

### Module M3 — Quản Lý Giáo Viên, Hồ Sơ Học Viên & Hàng Đợi Chờ Xếp Lớp

#### [BUG-M3-01] `BlockedTeacherDeactivationModal` hiển thị cứng `1 lớp` dù giáo viên đang phụ trách `2 lớp`
- **Module / Case ID:** `M3` / `M3-03`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `ADMIN` (`admin@webedu.vn`) — `http://localhost:3000/admin/teachers`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `admin@webedu.vn` / `Password@123`, mở `/admin/teachers`.
  2. Tại dòng `Trương Mỹ Lan (张美兰)` (`teacher.lan@webedu.vn`) đang có cột `Số lớp đang phụ trách = 2`, bấm nút `Vô hiệu hóa`.
- **Kết quả mong đợi:** Modal cảnh báo hiển thị đúng số lớp thực tế từ API (`2 lớp`: *"Giáo viên đang phụ trách 2 lớp. Vui lòng phân công giáo viên khác."*).
- **Kết quả thực tế:** API trả `409 Conflict` với `detail: "Giáo viên đang phụ trách 2 lớp. Vui lòng phân công giáo viên khác"`, nhưng UI modal lại hiển thị `"Giáo viên đang phụ trách 1 lớp. Vui lòng phân công giáo viên khác."`.
- **Bằng chứng kỹ thuật:**
  - HTTP `PATCH /api/v1/teachers/aac5cd35-4194-4db6-a3ee-a571c183e83e` $\rightarrow$ `409 Conflict` (`requestId: "faeb1ed0-52dc-4431-85d8-24c948a34744"`).
  - DOM `[role="dialog"]`: `"Không thể vô hiệu hóa giáo viên Giáo viên đang phụ trách 1 lớp. Vui lòng phân công giáo viên khác. Đã hiểu"`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\m3-03-blocked-teacher-lan.png`

#### [BUG-M3-02] `AssignInitialClassModal` chọn sẵn lớp đầu tiên (`HSK1-K26-01`) và không có validation bắt buộc chọn lớp
- **Module / Case ID:** `M3` / `M3-08`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `ADMIN` (`admin@webedu.vn`) — `http://localhost:3000/admin/students/pending`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `admin@webedu.vn`, mở `/admin/students/pending`.
  2. Bấm `Xếp lớp` trên một học viên chờ xếp lớp (ví dụ `qa.teen@webedu.vn` hoặc `qa.lock@webedu.vn`).
  3. Không thao tác chọn `#assign-class-select`, bấm thẳng nút `Xác nhận`.
- **Kết quả mong đợi:** `#assign-class-select` mặc định ở trạng thái rỗng (`-- Chọn lớp --`) và chặn submit/disable nút `Xác nhận` cho tới khi Admin chủ động chọn lớp, tránh bấm nhầm xếp học viên vào lớp đầu danh sách.
- **Kết quả thực tế:** `#assign-class-select` tự chọn sẵn tùy chọn đầu tiên (`HSK1-K26-01`, `selected: true`), nút `Xác nhận` bật sẵn (`disabled: false`), bấm vào lập tức ghi danh ngay vào `HSK1-K26-01`.
- **Bằng chứng kỹ thuật:**
  - DOM `#assign-class-select`: `[{"v":"HSK1-K26-01","selected":true},{"v":"HSK2-K26-01","selected":false}]`, nút `Xác nhận` `disabled: false`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\m3-08-assign-modal-default.png`

#### [BUG-M3-03] `SUPERADMIN` mở `StudentDetailModal` vẫn gọi API `/class-history` gây lỗi `403` console và hiển thị sai trạng thái/lớp
- **Module / Case ID:** `M3` / `M3-06`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `SUPERADMIN` (`superadmin@webedu.vn`) — `http://localhost:3000/admin/students`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `superadmin@webedu.vn` / `Password@123`, mở `/admin/students`.
  2. Bấm `Chi tiết & Sửa` trên học viên `active.student@webedu.vn` (đang có trạng thái `Đang hoạt động`).
- **Kết quả mong đợi:** Khi ẩn dữ liệu học vụ cho `SUPERADMIN` thuần, modal không gọi endpoint `/students/:id/class-history` của Admin/Student (tránh lỗi `403` trên Console) và hiển thị đúng phần trạng thái tài khoản mà không gây hiểu nhầm học viên đang hoạt động thành `Chưa được xếp lớp`.
- **Kết quả thực tế:** Modal vẫn bắn `GET /api/v1/students/1ac33c68-6cfb-49b1-8038-20d5289e70cd/class-history` nhận về `403 Forbidden` kèm `console.error`; đồng thời do `assignedClass` bị mask thành `null`, modal hiển thị `LỚP HỌC & LỊCH SỬ Chưa được xếp lớp` và dropdown `#stu-status` chỉ còn 2 lựa chọn `Chờ xếp lớp` / `Vô hiệu hóa` cho học viên đang `Đang hoạt động`.
- **Bằng chứng kỹ thuật:**
  - HTTP `GET /api/v1/students/1ac33c68-6cfb-49b1-8038-20d5289e70cd/class-history` $\rightarrow$ `403 Forbidden` (`detail: "Bạn không có quyền truy cập"`, `requestId: "803d4af8-f780-4724-b667-140273438082"`).
  - Console error: `Failed to load resource: the server responded with a status of 403 (Forbidden)`.

---

### Module M4 — Khóa Học HSK, Quản Lý Lớp Học & Vòng Đời Ghi Danh

#### [BUG-M4-01] Học viên đã bị rút khỏi lớp (`DROPPED`) vẫn thấy lớp cũ và toàn bộ buổi học trên `/student/schedule`
- **Module / Case ID:** `M4` / `SYNC-06`
- **Severity:** `High`
- **Vai trò & Route URL:** `STUDENT` (`qa.adult.new@webedu.vn`) — `http://localhost:3000/student/schedule`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Ở phiên Admin (`admin@webedu.vn`), thêm `qa.adult.new@webedu.vn` vào lớp `HSK2-K26-QA`, sau đó thao tác `Rút khỏi lớp` (`leftDate: 2026-11-17`, lý do `"Bảo lưu QA M4"` -> `200 OK`).
  2. Ở phiên Học viên (`qa.adult.new@webedu.vn`), mở `/student/overview` (hiển thị đúng `PendingClassNotice` — `"Bạn chưa được xếp lớp"`).
  3. Chuyển sang `http://localhost:3000/student/schedule`.
- **Kết quả mong đợi:** Sau khi bị rút lớp và trở về trạng thái `PENDING_CLASS`, `/student/schedule` không còn hiển thị lớp `HSK2-K26-QA` như lớp đang học (`activeClass`) và không hiển thị danh sách 24 buổi học sắp tới của lớp đã rút (nhất quán với `/student/overview` và đặc tả `DROPPED` không xem lịch lớp cũ).
- **Kết quả thực tế:** `/student/schedule` vẫn hiển thị `LỚP HỌC · GV: HSK2-K26-QA · Vương Quốc Tuấn`, `"Buổi học sắp tới: Buổi 1 · T4, 18/11 · 18:00–19:30"`, cùng đủ `24` buổi `Dự kiến`.
- **Bằng chứng kỹ thuật:**
  - `GET /api/v1/auth/me` trả `"status": "PENDING_CLASS"`.
  - `GET /api/v1/attendance/me` trả `200 OK` với `"classes": [{"classId":"caa327d6-33b2-4869-92e8-7f4bc464b0f7","classCode":"HSK2-K26-QA","enrollmentStatus":"DROPPED"}]` và vẫn gán `"activeClass"` bằng lớp đã `DROPPED` kèm `24` sessions.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\sync06_drop_student_schedule_bug.png`

---

### Module M5 — Lịch Học, Buổi Học & Điểm Danh

#### [BUG-M5-01] `ClassSessionsTab` không có bộ lọc theo trạng thái buổi học hoặc khoảng ngày dù bảng có nhiều buổi
- **Module / Case ID:** `M5` / `M5-02`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `ADMIN` (`admin@webedu.vn`) — `http://localhost:3000/admin/classes/22ddab59-49b5-429e-8cf4-5ed48e56a9ad` (Tab `Lịch học`)
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `admin@webedu.vn`, mở chi tiết lớp `HSK2-K26-01`, chọn tab `Lịch học` (`ClassSessionsTab`).
  2. Kiểm tra vùng điều khiển lọc dữ liệu phía trên bảng danh sách buổi học.
- **Kết quả mong đợi:** Có bộ lọc trạng thái (`SCHEDULED`, `COMPLETED`, `CANCELLED`...) và/hoặc khoảng ngày (`from` – `to`) khớp khả năng query của `GET /api/v1/classes/:id/sessions`.
- **Kết quả thực tế:** Không tồn tại bất kỳ thẻ `<select>` hay `<input>` lọc nào trong `ClassSessionsTab` (`selects: 0`, `inputs: 0`), luôn tải và hiển thị toàn bộ danh sách buổi học.
- **Bằng chứng kỹ thuật:** Kiểm tra DOM trong `ClassSessionsTab` (`ClassSessionsTab.tsx` gọi `listClassSessions(detail.id, undefined)` không truyền tham số lọc).

#### [BUG-M5-02] Trang `/admin/schedule-logs` khi `SUPERADMIN` truy cập vẫn gọi `GET /api/v1/classes` gây lỗi `403` console và rỗng bộ lọc lớp
- **Module / Case ID:** `M5` / `M5-11`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `SUPERADMIN` (`superadmin@webedu.vn`) — `http://localhost:3000/admin/schedule-logs`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `superadmin@webedu.vn` / `Password@123`.
  2. Mở trang `http://localhost:3000/admin/schedule-logs` (trang được cấp quyền trong `ALLOWED_ROLES` cho `SUPERADMIN`).
  3. Quan sát tab Network, Console và dropdown `"Tất cả lớp học"`.
- **Kết quả mong đợi:** Trang tải sạch với `0` lỗi HTTP `4xx` / `console.error`; bộ lọc lớp được ẩn với `SUPERADMIN` thuần hoặc sử dụng dữ liệu log cho phép thay vì gọi endpoint lớp bị cấm.
- **Kết quả thực tế:** `ScheduleChangeLogsView` gọi `GET http://localhost:3000/api/v1/classes?includeEnded=true&limit=100` nhận về **HTTP 403 Forbidden**, sinh `console.error` và khiến dropdown `"Tất cả lớp học"` bị rỗng hoàn toàn.
- **Bằng chứng kỹ thuật:**
  - HTTP `[403] GET http://localhost:3000/api/v1/classes?includeEnded=true&limit=100`.
  - Console: `[ERROR] Failed to load resource: the server responded with a status of 403 (Forbidden)`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\m5_11_superadmin_schedule_logs_403.png`

#### [BUG-M5-03] `ClassStudentsTable` hiển thị stale `0 buổi` sau khi Admin cập nhật điểm danh ở tab `Lịch học` cho tới khi tải lại trang (`F5`)
- **Module / Case ID:** `M5` / `M5-09`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `ADMIN` (`admin@webedu.vn`) — `http://localhost:3000/admin/classes/22ddab59-49b5-429e-8cf4-5ed48e56a9ad`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `admin@webedu.vn`, mở chi tiết lớp `HSK2-K26-01` (`/admin/classes/22ddab59-49b5-429e-8cf4-5ed48e56a9ad`).
  2. Chuyển sang tab `Lịch học`, điểm danh `B12..B20` cho `Đỗ Chuyên Cần Kém` (`qa.absent@webedu.vn`: 6 `Vắng`, 2 `Có phép`, 1 `Có mặt`) và bấm `Cập nhật điểm danh` (`200 OK`).
  3. Chuyển trực tiếp sang tab `Thông tin & Học viên` (không `F5`).
- **Kết quả mong đợi:** Cột `SỐ BUỔI NGHỈ` trong `ClassStudentsTable` cập nhật ngay thành `8 buổi` và hiển thị badge `Cảnh báo ≥ 30%` (tương tự `ClassAttendanceMatrixTab` ở tab `Điểm danh` đã cập nhật đúng ngay).
- **Kết quả thực tế:** `ClassStudentsTable` giữ nguyên dữ liệu cũ (`0 buổi` và không có badge cảnh báo) cho tới khi người dùng tải lại toàn trang (`F5`).
- **Bằng chứng kỹ thuật:**
  - DOM trước `F5`: `"Đỗ Chuyên Cần Kém ... 0 buổi ... Đang học"`.
  - DOM sau `F5`: `"Đỗ Chuyên Cần Kém ... 8 buổi\nCảnh báo ≥ 30% ... Đang học"`.
  - Screenshots: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\m5_09_students_table.png` (stale) và `m5_09_students_table_reloaded.png` (sau reload).

### Module M6 — Ngân hàng câu hỏi & Import Word/PDF

#### [BUG-M6-01] Câu `LISTENING` sau import PDF (`ImportReviewPane`) không render phương án để chọn đáp án đúng -> bấm `Lưu & xác nhận` bị lỗi `400` và chặn `Phát hành`
- **Module / Case ID:** `M6` / `M6-09`
- **Severity:** `Critical` *(Blocker)*
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Đăng nhập `teacher.lan@webedu.vn`, vào `/teacher/assessments` -> bấm `Tải đề Word/PDF`.
  2. Chọn file `Test/MINI_TEST_01 (2).pdf`, đặt tên `QA M6 - Import PDF Homework` (`BTVN`, `HSK 2`) -> tải lên (nhận diện `41` câu, `41` câu cần kiểm tra, gồm Q1..Q5 là `LISTENING`).
  3. Tại `ImportReviewPane` của đề `1d5c7ea1-e286-4012-91f0-45c9a84204be`, ở Câu 1 (`LISTENING`), gắn `valid-audio.mp3` rồi bấm `Lưu & xác nhận`.
- **Kết quả mong đợi:** `ImportReviewPane` hiển thị danh sách phương án `A/B/C` và radio chọn đáp án đúng cho câu `LISTENING` có options (tương tự `SINGLE_CHOICE`), sau khi chọn và bấm `Lưu & xác nhận` thì lưu thành công `200 OK` để có thể `Phát hành`.
- **Kết quả thực tế:** Parser PDF tạo `payload.options` (`a/b/c`) với `correctOptionIds: []`, nhưng UI `ImportReviewPane` của loại `LISTENING` không hiển thị các phương án hay radio chọn đáp án đúng; khi bấm `Lưu & xác nhận`, API trả **HTTP 400 Bad Request** với `detail: "correctOptionIds phải trỏ tới phương án hợp lệ"`, làm toàn bộ đề PDF có phần Nghe bị kẹt vĩnh viễn ở trạng thái `DRAFT`, không thể `Phát hành` qua UI.
- **Bằng chứng kỹ thuật:**
  - Assessment ID: `1d5c7ea1-e286-4012-91f0-45c9a84204be` (`status: DRAFT`, `41` câu).
  - HTTP `[400] PATCH http://localhost:3000/api/v1/assessments/1d5c7ea1-e286-4012-91f0-45c9a84204be/questions/314dbb8f-...` -> `correctOptionIds phải trỏ tới phương án hợp lệ`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M6-09-pdf-listening-400.png`

#### [BUG-M6-02] Chế độ `"Xem trước như HV"` rò rỉ đáp án đúng câu `ORDERING`, hướng dẫn soạn thảo giáo viên, dropdown media và không phát được `<audio>`
- **Module / Case ID:** `M6` / `M6-05`
- **Severity:** `High`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Mở xem đề `QA M6 - Giữa Kỳ 7 Dạng HSK2` (`4a69cffd-3cdc-49e2-ad4d-f96b6e8c41bb` gồm đủ 7 dạng câu).
  2. Bấm nút `Xem trước như HV` và cuộn qua tất cả câu 1..7.
- **Kết quả mong đợi:** Ẩn hoàn toàn đáp án đúng, hướng dẫn dành cho người soạn đề, control chọn/tải file của giáo viên; câu Nghe (`LISTENING`) phải render `<audio controls>` nghe thử được.
- **Kết quả thực tế:** Chế độ preview vẫn hiển thị hướng dẫn soạn thảo cho GV ở Q1/Q2/Q4/Q6 (`"Bấm ô tròn..."`, `"Mỗi dòng 1 từ/cụm từ, hoặc ngăn cách bằng dấu /..."`, `"Gắn file nghe tại đây..."`), Q4 `ORDERING` rò rỉ nguyên đáp án đúng `我\n姓\n王` trong `<textarea>`, Q6 `LISTENING` không render thẻ `<audio>` (`audios: []`) mà hiện dropdown `"Audio 1"`, và Q7 `IMAGE_BASED` hiện dropdown `"Ảnh 1"` / `"Chọn file đã tải"`.
- **Bằng chứng kỹ thuật:**
  - DOM preview text Q4: `"Mỗi dòng 1 từ/cụm từ, hoặc ngăn cách bằng dấu / ..."` + textarea value `"我\n姓\n王"`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M6-05-preview-Q4-Q7-leak.png`

#### [BUG-M6-03] Màn hình `Editor` và `ImportUploadPane` tràn ngang khỏi viewport mobile `375×812`
- **Module / Case ID:** `M6` / `M6-10`
- **Severity:** `High`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Mobile 375×812`
- **Các bước tái hiện:**
  1. Ở viewport `375×812`, mở `Sửa` một đề (`Editor`) hoặc bấm `Tải đề Word/PDF` (`ImportUploadPane`).
  2. Kiểm tra kích thước bounding box các `input`, `select`, `textarea`, vùng dropzone so với `innerWidth` `375px`.
- **Kết quả mong đợi:** Tất cả field nhập liệu và nút bấm co gọn vừa trong chiều rộng `375px`, không cắt ngang hay sinh thanh cuộn ngang.
- **Kết quả thực tế:** Container grid không có `min-w-0` khi select khóa HSK chứa option tên dài, đẩy các `input`, `select`, `textarea`, dropzone tràn tới `right: 460px` (`Editor`) và `464px` (`ImportUploadPane`), cắt mất chữ và nút bên phải màn hình. *(Riêng `ImportReviewPane` stack dọc sạch trên `375×812`).*
- **Bằng chứng kỹ thuật:**
  - `Editor` max element right edge: `460px > 375px`; `ImportUploadPane` max right edge: `464px > 375px`.
  - Screenshots: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\M6-10-editor-375x812.png`, `M6-10-upload-375x812.png`

#### [BUG-M6-04] Cột `THAO TÁC` trong bảng `AssessmentList` bị cắt bên phải ở `1366×768` (và tràn ở `1440×900`)
- **Module / Case ID:** `M6` / `M6-02`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Laptop 1366×768`, `Desktop 1440×900`
- **Các bước tái hiện:** Mở danh sách `/teacher/assessments` ở `1366×768` và `1440×900`.
- **Kết quả mong đợi:** Toàn bộ cột và nút thao tác (`Sửa`, `Duyệt`, `Giao bài`, `Nhân bản`, `Xóa`) hiển thị đầy đủ trong vùng nhìn, không bị cắt cụt.
- **Kết quả thực tế:** Bảng có chiều rộng `1174px` vượt quá container `1048px` (`1366×768`) và `1120px` (`1440×900`), làm cột `THAO TÁC` tràn ra ngoài khung bên phải: nút `Duyệt` bị cắt nửa, còn `Giao bài`, `Nhân bản`, `Xóa` bị khuất ngoài vùng nhìn.
- **Bằng chứng kỹ thuật:**
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\M6-02-list-1366x768.png`

#### [BUG-M6-05] Thứ tự nhãn phương án bị đảo (`A -> C -> B` / `B -> C -> A`) sau khi xóa một phương án rồi bấm `+ Thêm phương án`
- **Module / Case ID:** `M6` / `M6-04`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Trong khung soạn câu trắc nghiệm có 3 phương án `A`, `B`, `C`, xóa phương án không ở cuối (ví dụ xóa `B` hoặc `A`).
  2. Bấm `+ Thêm phương án`.
- **Kết quả mong đợi:** Các phương án còn lại giữ thứ tự chữ cái tuần tự `A, B, C...` (hoặc sinh nhãn kế tiếp `D` nếu giữ nguyên ID).
- **Kết quả thực tế:** Code chọn chữ cái trống đầu tiên (`b` hoặc `a`) và đẩy xuống cuối mảng, tạo danh sách hiển thị lệch thứ tự `A -> C -> B` (trên Q1 của `4a69cffd-...` ở cả Editor và Preview) hoặc `B -> C -> A`.
- **Bằng chứng kỹ thuật:**
  - Q1 payload của `4a69cffd-...`: `[{"id":"a","text":"Opt A"},{"id":"c","text":"Opt C"},{"id":"b","text":"Opt D"}]`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\M6-04-published-editor.png`

#### [BUG-M6-06] Bấm `"← Danh sách đề"` khi đang có thay đổi chưa lưu trong `ImportReviewPane` không hiện cảnh báo mất dữ liệu
- **Module / Case ID:** `M6` / `M6-08`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Mở `ImportReviewPane`, sửa nội dung câu 1 hoặc mô tả đề (UI đã hiển thị nhãn `"• Có thay đổi chưa lưu nháp"`), sau đó bấm ngay nút `"← Danh sách đề"`.
- **Kết quả mong đợi:** Hiện dialog/confirm cảnh báo chưa lưu thay đổi trước khi thoát khỏi màn hình duyệt/chỉnh sửa.
- **Kết quả thực tế:** Chuyển thẳng về màn hình danh sách đề và hủy bỏ toàn bộ nội dung vừa sửa mà không có bất kỳ hộp thoại xác nhận nào.

#### [BUG-M6-07] Lỗi console `Duplicate React key` (`a`, `b`, `c`) hàng loạt khi mở `ImportReviewPane` của đề PDF
- **Module / Case ID:** `M6` / `M6-09`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Import `MINI_TEST_01 (2).pdf` -> mở `Duyệt` đề `1d5c7ea1-e286-4012-91f0-45c9a84204be` -> quan sát Browser Console và Next.js Dev Overlay.
- **Kết quả mong đợi:** `0` lỗi React console khi render danh sách câu hỏi và đáp án.
- **Kết quả thực tế:** Console phát sinh **51–105 lỗi** `Encountered two children with the same key, 'a'` / `'b'` / `'c'` (hiển thị badge `15 Issues` trên Next.js overlay), do các option phương án dùng chung key chưa gắn prefix `questionId` hoặc render trùng key trong component.
- **Bằng chứng kỹ thuật:**
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M6-09-pdf-listening-400.png`

#### [BUG-M6-08] Tài khoản `TEACHER` khác (`teacher.idle`) vẫn thấy đề `PUBLISHED` của đồng nghiệp kèm nút `Sửa` / `Duyệt` trên UI
- **Module / Case ID:** `M6` / `M6-01`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.idle@webedu.vn`) — `http://localhost:3000/teacher/assessments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Đăng nhập `teacher.idle@webedu.vn` -> truy cập `/teacher/assessments`.
- **Kết quả mong đợi:** Giáo viên chỉ nhìn thấy đề do mình tạo (hoặc nếu xem đề chung đã phát hành thì chỉ hiển thị nút `Xem` / `Nhân bản`, ẩn nút `Sửa` / `Duyệt` bị `403`).
- **Kết quả thực tế:** Danh sách vẫn trả về 2 đề `PUBLISHED` của `Trương Mỹ Lan (张美兰)` (`GET /assessments/4a69cffd-...` trả `200`) và render nút `Sửa`, `Duyệt` trên dòng đó dù `PATCH`/`DELETE` phía backend chặn `403` (`"Chỉ người tạo hoặc Admin mới được sửa đề này"`).
- **Bằng chứng kỹ thuật:**
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\M6-01-teacher-idle-list.png`

### Module M7 — Giao bài, Phòng thi, Autosave & Nộp bài 1 lượt

#### [BUG-M7-01] Thông tin buổi học (`sessionId`) không hiển thị trên thẻ bài tập của học viên ở `/student/assignments`
- **Module / Case ID:** `M7` / `SYNC-10`
- **Severity:** `Low`
- **Vai trò & Route URL:** `STUDENT` (`active.student@webedu.vn`) — `http://localhost:3000/student/assignments`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Ở phiên GV (`teacher.lan@webedu.vn`), giao bài `QA M7 - BTVN HSK2` (`97ce6996-669b-4c49-8ed8-90b89e473cc2`) cho lớp `HSK2-K26-01` có chọn buổi học gắn kèm `Buổi 1 · 02/10/2026` (`sessionId: 6622fa6b-3285-44b2-b68a-1625456bb135`).
  2. Sang phiên HV `active.student@webedu.vn`, mở `/student/assignments`.
- **Kết quả mong đợi:** Thẻ bài BTVN hiển thị buổi học liên kết để học viên biết bài thuộc buổi nào.
- **Kết quả thực tế:** Thẻ bài chỉ hiển thị loại đề, mã lớp, hạn nộp GMT+7, thời lượng, số câu/điểm và tên lớp; hoàn toàn thiếu thông tin buổi học đã chọn khi giao (`StudentAssignmentListItemDto` không trả trường session).
- **Bằng chứng kỹ thuật:**
  - ClassAssignment ID: `97ce6996-669b-4c49-8ed8-90b89e473cc2` (`sessionId: 6622fa6b-3285-44b2-b68a-1625456bb135`).
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M7-01-student-no-session-info.png`

#### [BUG-M7-02] `ClassAssignmentTrackerModal` thiếu bộ lọc trạng thái nộp bài (`Chưa làm`, `Đang làm`, `Đã nộp`)
- **Module / Case ID:** `M7` / `M7-02`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/classes/22ddab59-49b5-429e-8cf4-5ed48e56a9ad`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Vào Chi tiết lớp `HSK2-K26-01` -> tab `Bài tập & Kiểm tra` -> bấm `Theo dõi nộp bài` trên bất kỳ bài tập nào.
- **Kết quả mong đợi:** Có nút hoặc dropdown lọc danh sách học viên theo trạng thái (`Chưa làm`, `Đang làm`, `Đã nộp`).
- **Kết quả thực tế:** Modal chỉ hiển thị 5 thẻ badge đếm tĩnh (`Tổng HV`, `Chưa làm`, `Đang làm`, `Chờ chấm`, `Đã chấm` dạng `<span>`), không có nút hay select lọc danh sách (`filterButtons=0`, `filterSelects=0`).
- **Bằng chứng kỹ thuật:**
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M7-02-tracker-no-filter.png`

#### [BUG-M7-03] Cờ `Đánh dấu xem lại` trên `StudentExamRunner` bị mất khi tải lại trang (`F5`)
- **Module / Case ID:** `M7` / `M7-07`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `STUDENT` (`active.student@webedu.vn`) — `http://localhost:3000/student/assignments/4c8942af-40c5-482b-9f53-b987b8e9d440`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Bắt đầu làm bài `QA M6 - Giữa Kỳ 7 Dạng HSK2`, chọn Câu 2 -> bấm `Đánh dấu xem lại` -> sửa Câu 3 -> bấm `Lưu nháp` (`PATCH /submissions/autosave` `200 OK`).
  2. Tải lại trang bằng `F5`.
- **Kết quả mong đợi:** Đáp án, lượt nghe audio, đồng hồ và cờ `Đánh dấu xem lại` đều được khôi phục sau reload.
- **Kết quả thực tế:** Đáp án, lượt nghe audio (`2/2` khóa) và đồng hồ đều giữ nguyên, nhưng cờ `Đánh dấu xem lại` ở Câu 2 chỉ lưu trong `useState({})` phía client nên bị mất hoàn toàn sau khi `F5` (`aria-label` quay về `"Câu 2 (Đã trả lời)"`).

### Module M8 — Chấm điểm, AI Gợi ý & Công bố điểm 2 bước

#### [BUG-M8-01] `PublishedQuestionReviewCard` và `GradingQuestionCard` không render `<audio>` và `<img>` cho câu `LISTENING` / `IMAGE_BASED` gắn `mediaId`
- **Module / Case ID:** `M8` / `M8-09` *(ảnh hưởng `M8-03`)*
- **Severity:** `High`
- **Vai trò & Route URL:** `STUDENT` (`active.student@webedu.vn`) — `http://localhost:3000/student/assignments/4c8942af-40c5-482b-9f53-b987b8e9d440?mode=review` & `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assignments/4c8942af-40c5-482b-9f53-b987b8e9d440/grading`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Công bố điểm bài `QA M6 - Giữa Kỳ 7 Dạng HSK2` (`4c8942af-...`) có Q6 `LISTENING` (`mediaId: fea0fede-...`) và Q7 `IMAGE_BASED` (`mediaId: 5b5bf4d2-...`).
  2. Mở `/student/assignments/4c8942af-40c5-482b-9f53-b987b8e9d440?mode=review` trên tài khoản `active.student@webedu.vn` (hoặc mở `SubmissionGradingModal` của GV).
  3. Quan sát Q6 (`LISTENING`) và Q7 (`IMAGE_BASED`).
- **Kết quả mong đợi:** Hiển thị trình phát `<audio>` ở câu Nghe và thẻ `<img>` ở câu Hình ảnh để học viên và giáo viên nghe/xem lại đề khi chấm hoặc đối chiếu đáp án.
- **Kết quả thực tế:** DOM ghi nhận `audio: 0` và `img: 0` ở cả màn xem lại của học viên lẫn modal chấm điểm của giáo viên (`GET /published-result` trả `correctAnswer: null` trên Q6 `LISTENING` và `PublishedQuestionReviewCard` chỉ render ảnh theo từng phương án, bỏ qua `mediaId` cấp câu hỏi).
- **Bằng chứng kỹ thuật:**
  - `GET /api/v1/submissions/54d4b19e-0e5a-47bd-99ee-24abfb18fcff/grading-detail` trả `questionPayload.mediaId` hợp lệ nhưng không có `<audio>`/`<img>` render trong modal.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M8-09-missing-media-in-review.png`

#### [BUG-M8-02] Không có nút Batch AI `#btn-batch-ai-grade` trên giao diện `GradingTrackerHeader`
- **Module / Case ID:** `M8` / `M8-05`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assignments/074cd0f1-e97d-4d03-a4ad-f449fe08e421/grading`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Mở workspace chấm điểm của bài có câu Tự luận (`QA M6 - Cuối Kỳ HSK2`) khi `AI_GRADING_CONFIG.enabled = true`.
- **Kết quả mong đợi:** Có nút Batch AI (`#btn-batch-ai-grade`) cho phép xem trước danh sách đã khử PII và chạy gợi ý AI hàng loạt (hoặc có lý do/thay thế rõ ràng khớp luồng nghiệp vụ).
- **Kết quả thực tế:** Không tồn tại `#btn-batch-ai-grade` trên trang (`count === 0`); header chỉ hiển thị dòng hướng dẫn `"Duyệt từng câu tự luận trong chi tiết bài trước khi gửi AI, hoặc chấm tay"` dù backend vẫn tồn tại endpoint `POST /api/v1/assignments/:assignmentId/ai-grade`.

#### [BUG-M8-03] Nhập điểm âm (`-1`) trong `SubmissionGradingModal` hiển thị lỗi tiếng Anh thô `"Request validation failed"`
- **Module / Case ID:** `M8` / `M8-04`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assignments/97ce6996-669b-4c49-8ed8-90b89e473cc2/grading`
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:**
  1. Mở `SubmissionGradingModal` trên bài `QA M7 - BTVN HSK2` của `active.student@webedu.vn`.
  2. Nhập `-1` vào ô điểm câu Tự luận và bấm `Lưu điểm & Nhận xét` (`#btn-save-manual-grade`).
- **Kết quả mong đợi:** Hiển thị thông báo tiếng Việt nhất quán như khi nhập `> maxPoints` / `1.1` (`"Điểm câu ... phải nằm trong khoảng 0 đến ... và chia hết cho 0.25"`).
- **Kết quả thực tế:** DTO backend chặn trước bằng `400 Bad Request` (`detail: "Request validation failed"`), và UI banner hiển thị nguyên chuỗi tiếng Anh thô `"Request validation failed"` cho người dùng.
- **Bằng chứng kỹ thuật:**
  - HTTP `[400] PATCH /api/v1/submissions/fee180e1-fbcc-41ef-8640-2edfb6269c84/manual-grade` -> `invalidParams: ["answers.0.earnedPoints must not be less than 0"]`.
  - Screenshot: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M8-04-negative-score-raw-english-error.png`

### Module M9 — Tiến độ, Tổng kết & Kiểm toán toàn hệ thống 26/26 Routes

#### [BUG-M9-01] Rò rỉ mã đặc tả nội bộ `DEC-038` trên màn hình chấm điểm `/teacher/assignments/[assignmentId]/grading`
- **Module / Case ID:** `M9` / `M9-07`
- **Severity:** `Medium`
- **Vai trò & Route URL:** `TEACHER` (`teacher.lan@webedu.vn`) — `http://localhost:3000/teacher/assignments/4c8942af-40c5-482b-9f53-b987b8e9d440/grading`
- **Viewport:** `Desktop 1440×900` & `Mobile 375×812`
- **Các bước tái hiện:**
  1. Đăng nhập `teacher.lan@webedu.vn` và mở trang chấm điểm của một bài kiểm tra bất kỳ.
  2. Quan sát phần văn bản hướng dẫn đầu trang.
- **Kết quả mong đợi:** Văn bản giao diện cho người dùng cuối hoàn toàn sạch mã đặc tả kỹ thuật nội bộ (`DEC-xxx`, `FUNC-xxx`).
- **Kết quả thực tế:** Trang hiển thị trực tiếp chuỗi `"...nguyên, không tự gán 0 điểm (DEC-038). Duyệt từng câu tự luận trong chi tiết bài trước k..."`. *(Ngoài ra quét 26 routes cũng tái xác nhận `FUNC-057` đã ghi ở `BUG-M2-01` tại `/superadmin/settings`).*
- **Bằng chứng kỹ thuật:**
  - Screenshots: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\screenshots\BUG-M9-07-teacher-_teacher_assignments_4c8942af_40c5_482b_9f53_-1440.png` và `...-375.png`

#### [BUG-M9-02] Vi phạm WCAG 2.1 AA `label-content-name-mismatch` (`serious`) trên Topbar Avatar Link ở `9/9` trang nội bộ đã đăng nhập
- **Module / Case ID:** `M9` / `M9-08`
- **Severity:** `High` *(Axe-core `serious`)*
- **Vai trò & Route URL:** Mọi vai trò đã đăng nhập — toàn bộ `9/9` trang portal được quét Axe (`/superadmin/settings`, `/admin/overview`, `/admin/classes/[id]`, `/teacher/assessments`, `/teacher/assignments/[id]/grading`, `/student/overview`, `/student/schedule`, `/student/assignments/[id]`, `/student/results`)
- **Viewport:** `Desktop 1440×900`
- **Các bước tái hiện:** Đăng nhập bất kỳ tài khoản hợp lệ nào -> mở một trang trong PortalShell -> chạy `@axe-core/playwright` với tags `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']`.
- **Kết quả mong đợi:** `0` vi phạm WCAG AA mức `critical`/`serious` (chữ viết tắt avatar nên đặt `aria-hidden="true"` hoặc khớp accessible name).
- **Kết quả thực tế:** Axe báo `1` vi phạm `serious` (`label-content-name-mismatch`) trên `<a title="Hồ sơ cá nhân" aria-label="Hồ sơ cá nhân">` (`.border-[var(--red)]/25`) vì text chữ cái viết tắt hiển thị bên trong (`GH`, `TL`, `ĐT`) không có trong `aria-label="Hồ sơ cá nhân"`. *(Trang `/login` đạt `0` vi phạm).*
- **Bằng chứng kỹ thuật:**
  - Axe Report: `C:\Users\ASUS\.gemini\antigravity\brain\d622641e-d34e-42e6-b44a-2eef301843d5\scratch\m9_08_axe_report.json`
  - Screenshots: `BUG-M9-08-axe-_admin_overview.png`, `BUG-M9-08-axe-_superadmin_settings.png`, `BUG-M9-08-axe-_student_overview.png`, ...

#### [BUG-M9-03] API `GET /api/v1/system-settings/config` bị gọi lặp `2–3` lần mỗi lần mount trên các trang Admin/Superadmin dẫn tới lỗi `429 Too Many Requests` khi chuyển trang nhanh
- **Module / Case ID:** `M9` / `M9-07`
- **Severity:** `Low`
- **Vai trò & Route URL:** `ADMIN` (`/admin/*`), `SUPERADMIN` (`/superadmin/settings`)
- **Viewport:** `Desktop 1440×900` & `Mobile 375×812`
- **Các bước tái hiện:**
  1. Điều hướng liên tiếp qua các trang `/admin/*` và `/superadmin/settings` trong cùng phiên làm việc (hoặc mở DevTools Network khi tải `/admin/overview` hoặc `/superadmin/settings`).
- **Kết quả mong đợi:** Config thương hiệu chung chỉ được fetch `1` lần / cache dùng chung trong shell, không spam endpoint gây `429`.
- **Kết quả thực tế:** Khi tải đơn lẻ đã ghi nhận `GET /api/v1/system-settings/config` bắn lặp **2 lần/mount** ở `/admin/overview` và **3 lần/mount** ở `/superadmin/settings`; khi chuyển liên tiếp giữa các màn Admin/Superadmin xảy ra `429 (Too Many Requests)` trên Console.

---

## 3. Nhật Ký Độ Phủ Kiểm Thử (Coverage Ledger)

### Module M1 (14 Module Cases + 1 Sync Case)
- `M1-01`: **PASS** — `/` $\rightarrow$ `/login`; truy cập portal khi chưa đăng nhập bị `proxy.ts` chặn về `/login` (307) không lóe UI.
- `M1-02`: **PASS** — Giao diện giấy dó, hiệu ứng lá trúc canvas, `prefers-reduced-motion: reduce`, ẩn/hiện mật khẩu, 4 nút `Đăng nhập nhanh (Dev)` hoạt động đúng.
- `M1-03`: **PASS** — Validation email/mật khẩu, giữ lại email khi sai mật khẩu (`401`), cookie `HttpOnly` (~1 giờ vs ~7 ngày với `rememberMe`), 3 banner `?registered=1`, `?reset=1`, `?reason=idle_timeout`.
- `M1-04`: **PASS** — Sai mật khẩu 5 lần (`qa.lock@webedu.vn`), lần 6 & 7 (kể cả nhập đúng mật khẩu) trả `403` khóa 15 phút.
- `M1-05`: **PASS** — Chặn bỏ trống, tuổi `<12`, SĐT sai chuẩn, email sai, OTP khác 6 số, mật khẩu `<8` ký tự, xác nhận mật khẩu lệch, OTP sai (`400`).
- `M1-06`: **PASS** — Đăng ký HV `12–15 tuổi` (`qa.teen@webedu.vn`), đổi nhãn sang Email phụ huynh, bắt buộc tick cam kết, cooldown OTP 60s, OTP inspector `4026`, tạo thành công (`201`).
- `M1-07`: **PASS** — Đăng ký HV `>=16 tuổi` (`qa.adult@webedu.vn` — `Trần Minh Lan (兰)`), ẩn hộp đồng ý, trùng email/SĐT (`409`) không mất form, tạo thành công (`201`).
- `SYNC-03`: **PASS** — Admin thấy ngay `qa.teen@webedu.vn` (`Đã xác nhận`) và `qa.adult@webedu.vn` (`Không áp dụng`) tại `/admin/students/pending` cùng badge Sidebar (`4`) khi điều hướng/tải lại.
- `M1-08`: **PASS** — `/forgot-password` & `/reset-password`: cooldown `60s`, nhập token thủ công hoặc qua URL `?token=`, đổi mật khẩu mới, token cũ bị vô hiệu (`400`), đăng nhập mật khẩu mới thành công.
- `M1-09`: **FAIL** — Back sau logout & đồng bộ logout đa tab `PASS`, nhưng đăng nhập lại trên cùng tab SPA làm nút `Đăng xuất` kẹt `disabled` (`BUG-M1-01`).
- `M1-10`: **FAIL** — Modal cảnh báo phút 55 + gia hạn `PASS`, nhưng tự đăng xuất phút 60 mất `?reason=idle_timeout` (`BUG-M1-02`).
- `M1-11`: **PASS** — HV `<16` (`pending.student@webedu.vn`) khóa ngày sinh & tự đổi email, sửa `fullName` không cần OTP thành công và đã khôi phục tên cũ.
- `M1-12`: **PASS** — HV `>=16` đổi email (`qa.adult@webedu.vn` $\rightarrow$ `qa.adult.new@webedu.vn`): sửa ô email reset trạng thái OTP, yêu cầu mật khẩu hiện tại + OTP 6 số, giữ phiên sau đổi email.
- `M1-13`: **PASS** — `ProfileAccountMetadata` hiển thị đúng vai trò/trạng thái; `ChangePasswordSection` chặn sai MK cũ, `<8` ký tự, xác nhận lệch; đổi lại MK `Password@123` & đăng nhập thành công.
- `M1-14`: **PASS** *(kèm `BUG-M1-03`)* — `scrollWidth === innerWidth` trên `1440×900` và `375×812`, keyboard Tab, `0` console/hydration errors.

### Module M2 (11 Module Cases + 3 Sync Cases)
- `M2-01`: **PASS** — 4 vai trò đơn (`STUDENT`, `TEACHER`, `ADMIN`, `SUPERADMIN`) hiển thị đúng menu theo `nav-links.ts`, tiêu đề Topbar tiếng Việt chuẩn và badge `Chờ xếp lớp` (`4`) trên `ADMIN`.
- `M2-02`: **PASS** — Tài khoản đa vai trò `admin.teacher@webedu.vn` chuyển góc nhìn `ADMIN ↔ TEACHER` hoạt động mượt trên cả Desktop Sidebar và Mobile Drawer.
- `M2-03`: **PASS** — Pure `SUPERADMIN` ẩn mục học vụ/vận hành lớp và chặn sạch 8 routes hạn chế (`403 AccessDeniedState`).
- `M2-04`: **PASS** — `ADMIN`, `TEACHER`, `STUDENT` bị chặn `403 AccessDeniedState` khi vào `/superadmin/settings`.
- `M2-05`: **PASS** — `SystemUsersSection`: tìm kiếm tên/email/SĐT, lọc vai trò, lọc trạng thái, trạng thái rỗng `0 tài khoản`, phân trang footer.
- `M2-06`: **PASS** — `CreateSystemUserModal`: validate rỗng, trùng email `409`, tạo thành công `teacher.idle@webedu.vn` (`TEACHER`) và `qa.syncuser@webedu.vn` (`ADMIN + TEACHER`).
- `M2-07`: **PASS** — `EditUserRolesModal`: khóa tự hạ quyền/vô hiệu hóa chính `superadmin@webedu.vn`.
- `M2-08`: **PASS** — `BrandConfigSection`: chặn tên trống, chặn `fake-image.png`/`empty.png`/`oversize-2_5mb.png`/`legacy.doc`, lưu `valid-logo.png` & khôi phục sạch.
- `M2-09`: **FAIL** — SSRF URL bị chặn `400`, Test AI `200`, key masked an toàn; nhưng phát hiện lộ `FUNC-057` + trùng mục `3.` (`BUG-M2-01`) và preset provider không tự đổi khi field có giá trị (`BUG-M2-02`).
- `M2-10`: **PASS** — `AuditLogsSection`: lọc theo `action`, refresh, múi giờ GMT+7, phân trang `Trang 1 / 2`.
- `M2-11`: **PASS** — `MobileNavDrawer` focus trap (`0` leak qua 15 Tab), `Escape` đóng drawer, không tràn ngang trên `1440×900` & `375×812`, `0` console/hydration errors.
- `SYNC-01`: **FAIL** — Đồng bộ cấu hình thương hiệu giữa `SUPERADMIN` và người dùng khác bị lỗi cache `300s`, stale SPA nav, và `/login` hardcode tên `"TD Hán Ngữ"` (`BUG-M2-03`).
- `SYNC-02`: **PASS** — Gỡ role `ADMIN` của `qa.syncuser` ở phiên A lập tức thu hồi phiên ở phiên B (`401` -> `/login`), đăng nhập lại thấy menu `TEACHER` và bị chặn `403` ở `/admin/*`; khóa `INACTIVE` chặn tức thì (`403`).
- `SYNC-12`: **BLOCKED** — Chưa có dữ liệu bài tập/bài nộp ở M2 để mở màn chấm AI phía GV; chuyển kiểm chứng trực tiếp ở **Module M8**.

### Module M3 (9 Module Cases + 3 Sync Cases)
- `M3-01`: **PASS** — `/admin/teachers` tìm kiếm, lọc trạng thái, phân trang, badge `Admin` bên cạnh `Trần Minh Quản (Admin kiêm GV)`.
- `M3-02`: **PASS** — `TeacherFormModal`: chế độ `view`, validation `create` (`409` trùng email), tạo `qa.teacher2@webedu.vn`, chỉnh sửa `edit`.
- `M3-03`: **FAIL** — Vô hiệu hóa `qa.teacher2` & toggle `teacher.idle` (`ACTIVE`) thành công; nhưng `BlockedTeacherDeactivationModal` khi chặn `teacher.lan` hiển thị sai số lớp (`1 lớp` thay vì `2 lớp`, `BUG-M3-01`).
- `M3-04`: **PASS** — `/admin/students` tìm kiếm, `#student-class-filter`, lọc trạng thái, đếm tổng, phân trang, link `/admin/students/pending`.
- `M3-05`: **PASS** — `StudentDetailModal`: đồng ý cha mẹ (`Đã xác nhận`/`Không áp dụng`), sửa `internalNotes`, đổi trạng thái `INACTIVE` và khôi phục `qa.adult.new` về `PENDING_CLASS`.
- `SYNC-02` *(Student)*: **PASS** — Khi `ADMIN` đổi `qa.adult.new` sang `INACTIVE`, phiên `-s=m3b` lập tức nhận `403`/`401` khi reload và bị đẩy về `/login`.
- `M3-06`: **PASS** *(kèm `BUG-M3-03`)* — `SUPERADMIN` thuần bị ẩn lọc lớp, link pending, `assignedClass`/`currentClassId`/`internalNotes`; phát hiện thêm modal vẫn gọi `/class-history` gây `403` (`BUG-M3-03`).
- `M3-07`: **PASS** — `/admin/students/pending` hiển thị đúng hàng chờ và khớp badge Sidebar (`4`), chặn `SUPERADMIN`/`TEACHER`/`STUDENT` (`403`).
- `SYNC-03`: **PASS** — Xác nhận phân quyền và số lượng hàng chờ khớp theo thời điểm truy cập.
- `M3-08`: **FAIL** — `AssignInitialClassModal` tự chọn sẵn `HSK1-K26-01` không có option rỗng / không chặn submit khi chưa chủ động chọn (`BUG-M3-02`).
- `SYNC-04`: **PASS** — Xếp lớp `qa.teen@webedu.vn` vào `HSK1-K26-01` ở phiên A cập nhật đồng bộ ngay sang phiên B (`/student/overview`, `/student/schedule`, `/student/results`).
- `M3-09`: **PASS** — `1440×900` & `375×812` không tràn ngang, empty state chuẩn, giả lập API `500` hiển thị alert rõ và phục hồi khi hết lỗi, `0` console/hydration errors ở luồng chuẩn.

### Module M4 (12 Module Cases + 3 Sync Cases)
- `M4-01`: **PASS** — `/admin/courses` tìm kiếm mã/tên, lọc cấp độ & trạng thái, empty state + nút `Xóa bộ lọc`.
- `M4-02`: **PASS** — `CourseFormModal` & `CourseGradingWeightsFields`: chặn regex sai/trùng mã (`409`), số buổi biên, tổng tỷ trọng `!= 100%`, điểm đạt ngoài `0..10`; tạo & sửa tỷ trọng thành công.
- `M4-03`: **PASS** — Ngừng sử dụng (`ConfirmDialog`) ẩn khóa khỏi dropdown tạo lớp mới và kích hoạt lại bình thường.
- `M4-04`: **PASS** — `/admin/classes`: tìm kiếm, lọc khóa/trạng thái, toggle `Hiện lớp đã kết thúc` thấy `HSK3-K26-OLD`, cột tiến độ `X/Y buổi (Z%)`.
- `M4-05`: **PASS** — `ClassFormModal` (Create): không chọn sẵn GV, tìm `TeacherPicker`, chặn `endTime <= startTime`, preview `expectedEndDate` live, tạo `HSK2-K26-QA` hiện `scheduleConflictWarning`.
- `M4-06`: **PASS** — `isCourseLocked` trên `HSK2-K26-01`; đổi GV `teacher.lan -> teacher.idle` (chặn ngày tương lai), ghi `ClassTeacherHistory`; `isStartDateLocked` đã xác minh bổ sung ở M5 (`PASS`).
- `SYNC-05`: **PASS** — Sau đổi GV, `teacher.lan` mất quyền `403` ở `/teacher/classes/[id]` & biến mất khỏi `/teacher/classes`; `teacher.idle` thấy lớp ngay.
- `M4-07`: **PASS** — Thêm `qa.adult.new` vào `HSK2-K26-QA` thành công; `AddStudentsToClassModal` lọc bỏ `active.student` đang học lớp khác (`DEC-007`).
- `M4-08`: **PASS** — Chuyển `qa.teen` từ `HSK1-K26-01` sang `HSK2-K26-01` (chặn ngày tương lai), `HSK1-K26-01` giữ lịch sử `TRANSFERRED`.
- `M4-09`: **PASS** — Rút `qa.adult.new` khỏi `HSK2-K26-QA` (chặn ngày tương lai), giữ lịch sử `DROPPED`.
- `SYNC-06`: **FAIL** — Luồng chuyển lớp (`qa.teen`) đồng bộ tốt sang `/student/overview`, `/student/schedule`, `/student/results`; nhưng luồng rút lớp (`qa.adult.new` `DROPPED`) vẫn trả lớp & 24 buổi trên `/student/schedule` (`BUG-M4-01`).
- `M4-10`: **PASS** — Kết thúc lớp `HSK2-K26-QA` (`24 buổi` tự hủy), chế độ chỉ đọc, mở lại trong 7 ngày khôi phục `qa.lock` & 24 buổi; `HSK3-K26-OLD` quá 7 ngày ẩn nút mở lại.
- `SYNC-07`: **PASS** — Phiên GV `teacher.idle` đồng bộ chính xác trạng thái `Đã kết thúc` / `Đã hủy` rồi khôi phục `Đang học` / `Dự kiến`.
- `M4-11`: **PASS** — `teacher.lan` chỉ thấy `HSK1-K26-01` & `HSK2-K26-01`, ẩn toàn bộ nút quản trị lớp.
- `M4-12`: **PASS** — Chặn RBAC `STUDENT` & `SUPERADMIN`, điều hướng 5 tab bằng bàn phím (`ArrowRight`/`ArrowLeft`/`Home`/`End`), responsive `1440×900` & `375×812` `0` overflow & `0` console/hydration error.

### Module M5 (11 Module Cases + 2 Sync Cases)
- `M5-01`: **PASS** — `/admin/schedules`: 3 chế độ `Tháng`/`Tuần`/`Danh sách`, `‹`/`›`/`Hôm nay`, lọc Lớp/GV, đủ 5 màu chú giải, biên `> 93 ngày` (`400`).
- `M5-02`: **FAIL** — Thêm buổi thủ công (`MakeupAndManualSessionModal`) đánh số & cập nhật `expectedEndDate` chuẩn; nhưng `ClassSessionsTab` thiếu điều khiển lọc trạng thái/khoảng ngày (`BUG-M5-01`).
- `M5-03`: **PASS** — Đổi lịch Session 24 (`RescheduleSessionModal`), chặn lý do toàn khoảng trắng & `endTime <= startTime`, lưu `previousScheduleText`.
- `M5-04`: **PASS** — Hủy Session 23 không kèm bù (`Buổi đã hủy`, không tự sinh bù) rồi `+ Tạo buổi học bù` (`Học bù · Bù cho buổi 23/11`), tổng buổi active giữ `24` (`DEC-009`).
- `M5-05`: **PASS** — `/admin/schedule-logs` ghi đủ `GENERATE`, `ADD_MANUAL`, `RESCHEDULE`, `CANCEL`, `ADD_MAKEUP`, lọc & phân trang `Trang 1/6`.
- `M5-06`: **PASS** — `/teacher/schedules` chỉ hiện lớp của `teacher.lan`, ẩn lọc GV và ẩn nút Hủy/Đổi lịch/Tạo buổi bù.
- `M5-07`: **PASS** — GV điểm danh buổi 20 (`2026-11-16`), khóa Lưu khi chưa đủ 100% roster, chuyển buổi sang `Đã học`, sửa lại trong T+2 thành công.
- `M5-08`: **PASS** — Chấm lần đầu buổi quá khứ `B19` hợp lệ theo `DEC-032`; sau khi đã chấm, GV bị chặn sửa lại `B19` (`403` + ẩn `Sửa điểm danh`); Admin Override `B19` sau T+2 yêu cầu `reason` và lưu thành công.
- `M5-09`: **FAIL** — Ma trận `ClassAttendanceMatrixTab` hiển thị đúng marker `"Đã sửa"` trên `B19` và badge `Nghỉ 33.3% ≥ 30%` cho `qa.absent@webedu.vn`; nhưng `ClassStudentsTable` giữ stale `0 buổi` sau khi lưu điểm danh cho tới khi `F5` (`BUG-M5-03`).
- `M5-10`: **PASS** — `/student/schedule`: `qa.absent` hiển thị banner `[data-testid="student-30pct-warning"]` (`8/24 buổi`, `33.3% ≥ ngưỡng 30%`, `11%` chuyên cần), `active.student` `100%`, `qa.teen` `#student-class-select`, `pending.student` màn chờ xếp lớp, không lộ dữ liệu bạn khác.
- `SYNC-08`: **PASS** — Đổi/Hủy/Bù buổi ở Admin đồng bộ ngay sang `/teacher/schedules` và `/student/schedule`.
- `SYNC-09`: **PASS** — Lưu & sửa điểm danh ở GV/Admin đồng bộ ngay sang ma trận điểm danh và `/student/schedule` của học viên.
- `M5-11`: **FAIL** — Chặn RBAC `SUPERADMIN`/`ADMIN` đúng trên các trang lịch, responsive `1440×900` & `375×812` `0` overflow; nhưng `/admin/schedule-logs` khi `SUPERADMIN` mở bị lỗi `403` `GET /api/v1/classes` (`BUG-M5-02`).

### Module M6 (10 Module Cases; `SYNC-10` nối sang M7)
- `M6-01`: **FAIL** — `active.student` & `superadmin` bị chặn `403 AccessDeniedState`; `teacher.idle` bị chặn `404` với `DRAFT` và `403` khi `PATCH`/`DELETE` đề của `teacher.lan`; nhưng UI vẫn liệt kê đề `PUBLISHED` của đồng nghiệp kèm nút `Sửa`/`Duyệt` (`BUG-M6-08`).
- `M6-02`: **FAIL** — Lọc `Loại đề`, `Khóa HSK`, tìm kiếm tên đề, empty state `"Chưa có đề nào"`, trạng thái Nháp/Đã phát hành hoạt động đúng; nhưng bảng tràn container `1174px` vs `1048px` ở `1366×768` làm cắt cột `THAO TÁC` (`BUG-M6-04`).
- `M6-03`: **PASS** — Preset `HOMEWORK` (`""`), `MINI_TEST` (`15`), `MIDTERM` (`45`), `FINAL` (`60`) tự điền đúng cùng `assessment-type-preset-hint`; chặn thiếu tên, thiếu khóa, thời gian `-5` và `12.5`.
- `M6-04`: **FAIL** — Tạo đủ 7 loại câu hỏi trên `4a69cffd-...`, upload file hợp lệ & chặn file sai/quá dung lượng (`400`); nhưng xóa phương án không ở cuối rồi `+ Thêm phương án` làm lệch thứ tự nhãn thành `A -> C -> B` (`BUG-M6-05`).
- `M6-05`: **FAIL** — Chặn điểm `0`/`-1`/`1001`, sửa/đổi thứ tự `Lên`/`Xuống` (`200`), xóa câu thành công; nhưng `"Xem trước như HV"` rò rỉ đáp án Q4 `ORDERING`, hướng dẫn GV, dropdown media và thiếu `<audio>` (`BUG-M6-02`).
- `M6-06`: **PASS** — `Phát hành` khóa form (`Chỉ xem`), ẩn nút xóa trên UI, `DELETE` API trả `409 Conflict`, `Nhân bản` tạo bản nháp mới (`201`), xóa bản nháp qua modal xác nhận (`200`), upload media lỗi báo message tiếng Việt rõ ràng.
- `M6-07`: **PASS** — `WordTemplateGuideModal`, tải `/templates/mau-de-import.docx` (`200`), pre-validation chặn `legacy.doc`, `empty.png`, `oversize-5_5mb.png` và file đính kèm sai đuôi ngay trên client với `0` API request.
- `M6-08`: **FAIL** — Import `sample-questions.docx` -> `QA M6 - Import Word Mini-Test` (`df42a805-...`, `3` câu, `1` câu vàng); `ImportReviewPane` 2 cột, `Tải file gốc` (`200`), nhảy/lọc câu vàng, lưu Q3 & `Phát hành` (`PUBLISHED`) thành công; nhưng thoát `"← Danh sách đề"` khi chưa lưu không cảnh báo (`BUG-M6-06`), và import `MINI_TEST` để `durationMinutes: null`.
- `M6-09`: **FAIL** — Import `Test/MINI_TEST_01 (2).pdf` -> `1d5c7ea1-...` (`41` câu cần kiểm tra, iframe PDF preview & Q6 `ESSAY` `200` OK); nhưng câu `LISTENING` không render options/radio nên `Lưu & xác nhận` bị `400` chặn `Phát hành` (`BUG-M6-01`), và console phát sinh 51–105 lỗi `Duplicate React key` (`BUG-M6-07`).
- `M6-10`: **FAIL** — `0` cảnh báo hydration ở cả 4 views và `ImportReviewPane` stack dọc chuẩn ở `375×812`; nhưng `Editor` (`460px`) & `ImportUploadPane` (`464px`) tràn ngang khỏi màn hình mobile `375×812` (`BUG-M6-03`).

### Module M7 (10 Module Cases + 2 Sync Cases)
- `M7-01`: **PASS** — `AssignAssessmentModal` ẩn đề `DRAFT`, chặn hạn nộp quá khứ (`"Hạn nộp bài phải nằm ở tương lai."`), giao đủ 4 loại đề `PUBLISHED` (`HOMEWORK` gắn `sessionId`, `MINI_TEST`, `MIDTERM`, `FINAL`) cho `HSK2-K26-01`.
- `SYNC-10`: **FAIL** — Publish `QA M7 - BTVN HSK2` hiện ngay trong `AssignAssessmentModal`; giao bài xong HV thấy ngay 4 bài trên `/student/assignments` cùng hạn nộp GMT+7, nhưng thiếu thông tin buổi học gắn kèm (`BUG-M7-01`).
- `M7-02`: **FAIL** — `ClassAssignmentsTab` khớp giữa `/teacher/classes/[id]` & `/admin/classes/[id]`, `ClassAssignmentTrackerModal` đếm đúng `Chưa làm`/`Đang làm`/`Chờ chấm`; nhưng thiếu điều khiển lọc danh sách theo trạng thái (`BUG-M7-02`).
- `M7-03`: **PASS** — 3 tab `/student/assignments` (`Tất cả`, `Cần làm`, `Đã nộp`) lọc đúng; test bài quá hạn hiện badge `Quá hạn`, nút khóa `Đã quá hạn`, và `POST /submissions/start` bị chặn `400` (`Đã quá hạn nộp bài`).
- `M7-04`: **PASS** — `TEACHER`, `ADMIN`, `SUPERADMIN` bị chặn `403 AccessDeniedState` ở `/student/assignments`; `qa.lock` (lớp khác) & `qa.adult.new` (`DROPPED` / `PENDING_CLASS`) bị chặn `403` không lộ bài khi truy cập URL trực tiếp.
- `M7-05`: **PASS** — `POST /submissions/start` `200 OK` Zero-Leak (`0` key đáp án đúng), đồng hồ đếm ngược, bảng câu hỏi, `Đánh dấu xem lại`, `Câu trước`/`Câu tiếp`.
- `M7-06`: **PASS** — Hoàn thành đủ 7 dạng câu hỏi trên UI HV; `ORDERING` mảnh ban đầu xáo trộn (`["姓","我","王"]`), `LISTENING` có `controlsList="nodownload"` và khóa phát sau `maxListens=2`, `IMAGE_BASED` tải ảnh `naturalWidth > 0`.
- `M7-07`: **FAIL** — `F5` giữ nguyên đáp án, `maxListens=2`, đồng hồ wall-clock; Offline lưu cục bộ và tự đồng bộ `200 OK` khi có mạng lại; nhưng cờ `Đánh dấu xem lại` bị mất khi `F5` (`BUG-M7-03`).
- `M7-08`: **PASS** — `SubmitConfirmModal` xác nhận `7/7`, chuyển `StudentSubmittedView` (`Đã nộp - Chờ chấm`, Zero-Leak), chặn làm lại.
- `M7-09`: **PASS** — `ReopenSubmissionForm` chặn thiếu lý do, mở lại lượt 2 thành công (`200`), tab cũ Attempt #1 bấm `Nộp bài` bị chặn `409 Conflict` không ghi đè Attempt #2, HV nộp Attempt #2 thành công.
- `SYNC-11`: **PASS** — `SUBMITTED` cập nhật ngay trên Tracker GV (`Chờ chấm: 1`) -> Mở lại cập nhật ngay `Lần làm 2` và giữ nguyên đáp án lượt 1 phía HV.
- `M7-10`: **PASS** — `scrollWidth === innerWidth` (`0` overflow), `0` console error, `0` hydration warning trên cả `1440×900` & `375×812`.

### Module M8 (10 Module Cases + 2 Sync Cases)
- `M8-01`: **PASS** — `active.student`, `superadmin`, `teacher.idle` (`403` `GET /grading-tracker`) bị chặn bởi `AccessDeniedState`; `teacher.lan` & `admin` truy cập và chấm điểm bình thường.
- `M8-02`: **PASS** — `GradingTrackerHeader` đếm chính xác cả 5 trạng thái (`ALL`, `NEEDS_GRADING`, `CONFIRMED`, `PUBLISHED`, `OVERDUE_NOT_SUBMITTED`), 5 tab lọc đúng trên `HOMEWORK` & `MIDTERM`.
- `M8-03`: **PASS** — Chấm tự động `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `FILL_BLANK`, `ORDERING`, `IMAGE_BASED` (`6đ` Midterm), điều hướng `← Bài trước` / `Bài sau →` trên `MINI_TEST` hoạt động đúng (`input step="0.25"`).
- `M8-04`: **FAIL** — Chặn `> maxPoints` & `1.1` (bước `0.25`), dirty guard khóa `#btn-confirm-submission-grade` khi chưa lưu; nhưng nhập `-1` hiển thị lỗi tiếng Anh thô `"Request validation failed"` (`BUG-M8-03`).
- `M8-05`: **FAIL** — AI Gợi ý On-Demand (`CUSTOM / gpt-5.6-luna`) hoạt động tốt `200 OK` + áp dụng gợi ý `4/5` và chặn gửi PII gốc `400` sau khung duyệt Zero-PII; nhưng thiếu nút Batch AI `#btn-batch-ai-grade` trên `GradingTrackerHeader` (`BUG-M8-02`).
- `SYNC-12`: **PASS** — Superadmin tắt `AI_GRADING_CONFIG.enabled` tại `/superadmin/settings` (`200`) -> Teacher bấm gợi ý AI báo lỗi rõ `400` không sập modal; Superadmin bật lại (`200`) -> Teacher gọi AI thành công `200 OK`.
- `M8-06`: **PASS** — Sau Bước 1 `GRADED`, kiểm tra đủ 4 trang phía HV Zero-Leak 100%; sau Bước 2 `RETURNED` (`#btn-publish-confirmed-grades`), `qa.absent` quá hạn không tự bị chuyển thành 0 điểm.
- `SYNC-13`: **PASS** — Sau `RETURNED` và sau điều chỉnh điểm `9 -> 9.5`, phiên `active.student` đồng bộ ngay điểm & nhãn `"Đã cập nhật 17/11/2026"` trên cả 4 trang.
- `M8-07`: **PASS** — Ghi `0 điểm` quá hạn đơn lẻ (`HOMEWORK`, `qa.absent`, `1` HV) -> `GRADED` -> Publish `RETURNED`; và hàng loạt (`MIDTERM`, `qa.teen` & `qa.absent`, `2` HV) qua dialog xác nhận `200 OK`. Đã công bố đủ 4 bài HSK2 sang `RETURNED`.
- `M8-08`: **PASS** — `AdjustGradeDialog` chặn thiếu lý do, cập nhật `9 -> 9.5` với `"Cộng điểm trình bày chữ Hán"` (`200`), `GradeAuditLogList` lưu dấu vết `4 -> 4.5 đ` GMT+7 và đồng bộ badge `"Đã cập nhật 17/11/2026"`.
- `M8-09`: **FAIL** — `/student/assignments/[id]?mode=review` hiển thị đúng điểm tổng (`10/11`), giờ công bố, đáp án/giải thích 7 câu; nhưng không render `<audio>`/`<img>` theo `questionPayload.mediaId` cho Q6 `LISTENING` và Q7 `IMAGE_BASED` (`BUG-M8-01`).
- `M8-10`: **PASS** — `1440×900` & `375×812` trên grading page, `SubmissionGradingModal`, `AdjustGradeDialog`, `?mode=review`: `0` overflow, `0` console error, `0` hydration warning.

### Module M9 (8 Module Cases + 1 Sync Case + Audit 26/26 Routes & Axe WCAG AA)
- `M9-01`: **PASS** — `/admin/overview`: 4 KPI (`Lớp đang học: 2`, `Học viên đang học: 4`, `Chờ xếp lớp: 2` bấm mở `/admin/students/pending`, `Buổi học hôm nay: 1`), đủ bộ lọc `#overview-filter-*` & `Xóa lọc`, bật `includeEnded` hiện `HSK3-K26-OLD`, click lớp `HSK2-K26-01` mở chi tiết lớp, cột buổi hôm nay (`18:00–19:30`) & 5 ngày tới GMT+7 (`5 buổi`) chính xác.
- `M9-02`: **PASS** — `superadmin` thuần, `teacher.lan`, `active.student` đều bị ẩn link sidebar & chặn `403 AccessDeniedState` trên `/admin/overview`; `admin@webedu.vn` đăng nhập mặc định vẫn chuyển về `/admin/students`.
- `M9-03`: **PASS** — `ClassProgressResultsTab` ở cả Admin & Teacher khớp nhau: hiển thị công thức `20/30/50% · Đạt ≥ 5.0`, tách riêng `Nộp BTVN`/`TB tham khảo`, `qa.absent` hiện đủ badge `Cần chú ý`, `Nghỉ ≥ 30%`, `BTVN < 60%`, `active.student` `Đạt (9.5)`, `qa.teen` `Chưa đạt (1.7)`; sort cả `8/8` cột hoạt động; cột Họ tên `sticky left-0` không vỡ/đè chữ khi cuộn ngang ở `375×812`.
- `M9-04`: **PASS** — `/student/overview`: dữ liệu sống `/progress/me` (`9/24 buổi hoàn thành`, `còn 15 buổi · dự kiến kết thúc 26/11/2026`, `Tỷ lệ nộp BTVN 100%`, `TB 9.0`, `Kết quả gần đây` `4` bài `RETURNED` kèm link `?mode=review`); `pending.student` hiện `PendingClassNotice`; `admin` hiện `AdminAccessNotice`.
- `M9-05`: **PASS** — `/student/results`: `active.student` (`10.0 / 9.1 / 9.5 -> Tổng kết 9.5 Đạt`), `qa.teen` (`3.3 / 0.0 / 2.0 -> Tổng kết 1.7 Chưa đạt`), tách riêng thẻ Chuyên cần & BTVN, bảng `published-results-table` đủ 4 bài `RETURNED`.
- `SYNC-14`: **PASS** — Admin đổi khóa `HSK2` từ `20/30/50%` (`≥ 5.0`) -> `10/30/60%` (`≥ 9.5`): cả GV (`ClassProgressResultsTab`) và HV (`active.student` `9.4 Chưa đạt`, `qa.teen` `1.5 Chưa đạt`) tự tính lại chính xác; khôi phục về `20/30/50%` (`≥ 5.0`) đồng bộ trở lại `9.5 Đạt` & `1.7 Chưa đạt`.
- `M9-06`: **PASS** — `qa.teen` chọn `#student-results-class-select` (3 lớp) & `Lịch sử các lớp`: `HSK2-K26-01` (`Đang học`) có link `?mode=review`, 2 lớp `TRANSFERRED` khóa link review; `qa.adult.new` hiện `Tạm nghỉ / Rút lớp` không có link review; `pending.student` hiện `PendingClassNotice`.
- `M9-07`: **FAIL** — Quét toàn cục `26/26` routes ở cả `1440×900` và `375×812` ghi nhận `0` tràn ngang, `0` React hydration warning, `0` `pageerror`, `0` HTTP 5xx; nhưng phát hiện rò rỉ `DEC-038` trên trang grading (`BUG-M9-01`), lặp `FUNC-057` (`BUG-M2-01`) ở `/superadmin/settings`, và gọi lặp `/system-settings/config` gây `429` khi chuyển trang nhanh (`BUG-M9-03`).
- `M9-08`: **FAIL** — Axe-core WCAG 2.0/2.1 AA: `/login` đạt `0` vi phạm, nhưng `9/9` trang portal đã đăng nhập đều báo `1` vi phạm `serious` (`label-content-name-mismatch`) trên liên kết avatar Topbar (`BUG-M9-02`).

---

## 4. Ma Trận Quét Toàn Cục `26/26` Routes (`M9-07`) & Kiểm Toán Axe-core WCAG AA (`M9-08`)

> Tất cả `26/26` routes `page.tsx` đều đạt **`0` tràn ngang** (`scrollWidth === clientWidth` tại cả `1440×900` và `375×812`), **`0` React hydration warning**, **`0` `pageerror`**, và **`0` HTTP 5xx**.

| # | Vai trò kiểm tra | Route | Overflow (`1440` / `375`) | Hydration / Error / 5xx | Prototype Leakage | Axe WCAG AA (`M9-08`) |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | Public | `/` ($\rightarrow$ `/login`) | OK / OK | `0 / 0 / 0` | Sạch | — |
| 2 | Public | `/login` | OK / OK | `0 / 0 / 0` | Sạch | `0` vi phạm (**PASS**) |
| 3 | Public | `/register` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 4 | Public | `/forgot-password` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 5 | Public | `/reset-password?token=qa-token` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 6 | Student | `/profile` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 7 | Student | `/student/overview` | OK / OK | `0 / 0 / 0` | Sạch | `1` serious (`BUG-M9-02`) |
| 8 | Student | `/student/schedule` | OK / OK | `0 / 0 / 0` | Sạch | `1` serious (`BUG-M9-02`) |
| 9 | Student | `/student/assignments` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 10 | Student | `/student/assignments/4c8942af-...` *(+ `?mode=review`)* | OK / OK | `0 / 0 / 0` | Sạch | `1` serious (`BUG-M9-02`) |
| 11 | Student | `/student/results` | OK / OK | `0 / 0 / 0` | Sạch | `1` serious (`BUG-M9-02`) |
| 12 | Teacher | `/teacher/classes` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 13 | Teacher | `/teacher/classes/22ddab59-...` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 14 | Teacher | `/teacher/schedules` | OK / OK | `0 / 0 / 0` | Sạch | — |
| 15 | Teacher | `/teacher/assessments` | OK / OK | `0 / 0 / 0` | Sạch | `1` serious (`BUG-M9-02`) |
| 16 | Teacher | `/teacher/assignments/4c8942af-.../grading` | OK / OK | `0 / 0 / 0` | **FAIL (`DEC-038`)** | `1` serious (`BUG-M9-02`) |
| 17 | Admin | `/admin/overview` | OK / OK | `0 / 0 / 0` *(1×429 khi quét nhanh)* | Sạch | `1` serious (`BUG-M9-02`) |
| 18 | Admin | `/admin/students` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 19 | Admin | `/admin/students/pending` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 20 | Admin | `/admin/teachers` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 21 | Admin | `/admin/courses` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 22 | Admin | `/admin/classes` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 23 | Admin | `/admin/classes/22ddab59-...` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | `1` serious (`BUG-M9-02`) |
| 24 | Admin | `/admin/schedules` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 25 | Admin | `/admin/schedule-logs` | OK / OK | `0 / 0 / 0` *(2×429/vp khi quét nhanh)* | Sạch | — |
| 26 | Superadmin | `/superadmin/settings` | OK / OK | `0 / 0 / 0` *(3×429/vp khi quét nhanh)* | **FAIL (`FUNC-057`)** | `1` serious (`BUG-M9-02`) |
