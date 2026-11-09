# Kịch Bản Kiểm Thử Toàn Diện Hệ Thống WebEdu (Comprehensive Test Scenarios)

> **Dự án:** Hệ thống Quản trị Lớp học & Học tập Trực tuyến — Trung Tâm TD Hán Ngữ  
> **Mã tài liệu:** `docs/TEST_SCENARIOS_COMPREHENSIVE.md`  
> **Phạm vi:** Toàn bộ 12 màn hình giao diện, 8 luồng nghiệp vụ E2E, 4 cấp phân quyền (RBAC), các bất biến bảo mật & công thái học UI/UX.  
> **Phiên bản:** v1.0 — Chuẩn hóa theo 6 Cổng Kỹ thuật AKit & Hiến chương Kiến trúc.

---

## 📌 Mục Lục

1. [Tổng Quan Hệ Thống & Ma Trận Phân Quyền (RBAC Matrix)](#1-tổng-quan-hệ-thống--ma-trận-phân-quyền-rbac-matrix)
2. [Môi Trường Kiểm Thử & Dữ Liệu Mẫu (Seed Accounts)](#2-môi-trường-kiểm-thử--dữ-liệu-mẫu-seed-accounts)
3. [Luồng 1: Đăng Ký Tài Khoản Học Viên Mới (Student Registration)](#3-luồng-1-đăng-ký-tài-khoản-học-viên-mới-student-registration)
4. [Luồng 2: Xác Thực, Đăng Nhập & Bảo Mật Khóa Tài Khoản (Authentication & Lockout)](#4-luồng-2-xác-thực-đăng-nhập--bảo-mật-khóa-tài-khoản-authentication--lockout)
5. [Luồng 3: Quên Mật Khẩu & Đặt Lại Mật Khẩu An Toàn (Password Recovery)](#5-luồng-3-quên-mật-khẩu--đặt-lại-mật-khẩu-an-toàn-password-recovery)
6. [Luồng 4: Phân Quyền Đa Cấp & Chống Xuyên Quyền (RBAC & Multi-tenant Security)](#6-luồng-4-phân-quyền-đa-cấp--chống-xuyên-quyền-rbac--multi-tenant-security)
7. [Luồng 5: Quản Lý Hồ Sơ Cá Nhân & Đổi Thông Tin (Profile Management)](#7-luồng-5-quản-lý-hồ-sơ-cá-nhân--đổi-thông-tin-profile-management)
8. [Luồng 6: Quản Trị Đào Tạo — Học Viên & Hàng Đợi Xếp Lớp (Admin Student Management)](#8-luồng-6-quản-trị-đào-tạo--học-viên--hàng-đợi-xếp-lớp-admin-student-management)
9. [Luồng 7: Quản Trị Đội Ngũ Giáo Viên & Bất Biến Nghiệp Vụ (Teacher Management & Invariants)](#9-luồng-7-quản-trị-đội-ngũ-giáo-viên--bất-biến-nghiệp-vụ-teacher-management--invariants)
10. [Luồng 8: Quản Trị Cấp Cao Superadmin — Thương Hiệu & Nhân Sự (Superadmin Operations)](#10-luồng-8-quản-trị-cấp-cao-superadmin--thương-hiệu--nhân-sự-superadmin-operations)
11. [Kiểm Thử Phi Chức Năng: UI/UX, Đa Thiết Bị, Chữ Hán & Trợ Năng (Non-Functional QA)](#11-kiểm-thử-phi-chức-năng-uiux-đa-thiết-bị-chữ-hán--trợ-năng-non-functional-qa)
12. [Quy Trình Chạy Kiểm Thử Tự Động & Hướng Dẫn Thực Thi](#12-quy-trình-chạy-kiểm-thử-tự-động--hướng-dẫn-thực-thi)

---

## 1. Tổng Quan Hệ Thống & Ma Trận Phân Quyền (RBAC Matrix)

Hệ thống WebEdu áp dụng mô hình phân quyền dựa trên vai trò nghiêm ngặt cấp Server-side:

| Route / Màn hình | Public / Guest | STUDENT | TEACHER | ADMIN | SUPERADMIN |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `/login`, `/register`, `/forgot-password`, `/reset-password` | ✅ Có quyền | ✅ (Tự điều hướng) | ✅ (Tự điều hướng) | ✅ (Tự điều hướng) | ✅ (Tự điều hướng) |
| `/student/overview` (Không gian học viên) | ❌ Chặn (Login) | ✅ Có quyền | ❌ Chặn 403 | ❌ Chặn 403 | ❌ Chặn 403 |
| `/teacher/classes` (Lớp phụ trách) | ❌ Chặn (Login) | ❌ Chặn 403 | ✅ Có quyền | ❌ Chặn 403 | ❌ Chặn 403 |
| `/admin/students` (Danh sách học viên) | ❌ Chặn (Login) | ❌ Chặn 403 | ❌ Chặn 403 | ✅ Có quyền | ✅ (Khóa notes) |
| `/admin/students/pending` (Hàng đợi xếp lớp) | ❌ Chặn (Login) | ❌ Chặn 403 | ❌ Chặn 403 | ✅ Có quyền | ❌ Chặn 403 |
| `/admin/teachers` (Quản lý giáo viên) | ❌ Chặn (Login) | ❌ Chặn 403 | ❌ Chặn 403 | ✅ Có quyền | ✅ Có quyền |
| `/superadmin/settings` (Cấu hình & Nhân sự) | ❌ Chặn (Login) | ❌ Chặn 403 | ❌ Chặn 403 | ❌ Chặn 403 | ✅ Có quyền |
| `/profile` (Thông tin cá nhân & Đổi mật khẩu) | ❌ Chặn (Login) | ✅ (Khóa DOB) | ✅ Có quyền | ✅ Có quyền | ✅ Có quyền |

---

## 2. Môi Trường Kiểm Thử & Dữ Liệu Mẫu (Seed Accounts)

Khởi tạo dữ liệu chuẩn bằng lệnh:
```bash
npm run seed
```

Tất cả các tài khoản mặc định đều có mật khẩu: **`Password@123`**

| Vai Trò | Email Đăng Nhập | Số Điện Thoại | Mô Tả Trạng Thái Mẫu |
| :--- | :--- | :--- | :--- |
| **Superadmin** | `superadmin@webedu.vn` | `0909000001` | Quản trị cấp cao, toàn quyền hệ thống |
| **Admin** | `admin@webedu.vn` | `0909000003` | Quản trị đào tạo, xếp lớp, quản lý GV & HV |
| **Giảng viên** | `teacher.lan@webedu.vn` | `0909000004` | Giảng viên Trương Mỹ Lan, đang phụ trách 2 lớp active |
| **Học viên đang học** | `active.student@webedu.vn` | `0909000007` | Phạm Gia Huy, đang học lớp HSK2 |
| **Học viên chờ lớp** | `pending.student@webedu.vn` | `0909100001` | Lê Minh Châu, 14 tuổi, có phụ huynh xác nhận đồng ý |

---

## 3. Luồng 1: Đăng Ký Tài Khoản Học Viên Mới (Student Registration)

URL kiểm thử: `http://localhost:3000/register`

| Mã Case | Tên Kịch Bản | Dữ Liệu Đầu Vào | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **REG-01** | Đăng ký thành công học viên trưởng thành ($\ge 16$ tuổi) | Họ tên: `Trần Văn An`<br>DOB: `15/06/2004` (22t)<br>SĐT: `0911223344`<br>Email: `an.tran@gmail.com`<br>Pass: `Password@123` | Điền form đầy đủ, bấm **Đăng ký** | - Khối phụ huynh **không xuất hiện**.<br>- Chuyển hướng sang `/login?registered=1`.<br>- Banner màu ngọc bích thông báo đăng ký thành công. |
| **REG-02** | Đăng ký học viên vị thành niên ($12 \le \text{tuổi} < 16$) | Họ tên: `Lê Bảo Ngọc`<br>DOB: `15/06/2012` (14t)<br>SĐT: `0912345678`<br>Email: `ngoc.le@gmail.com`<br>Phụ huynh: `me.ngoc@gmail.com`<br>Pass: `Password@123` | 1. Nhập ngày sinh 14 tuổi.<br>2. Nhập email phụ huynh và tích chọn checkbox đồng ý.<br>3. Bấm **Đăng ký**. | - Ngay khi chọn ngày sinh 14 tuổi, khối phụ huynh **tự động kích hoạt hiển thị**.<br>- Đăng ký thành công, tạo bản ghi `GuardianConsent` trong CSDL.<br>- Học viên mang trạng thái `PENDING_CLASS`. |
| **REG-03** | Điểm biên đúng 16 tuổi hôm nay | DOB: Đúng ngày hiện tại cách đây 16 năm (`2010-11-09`) | Nhập ngày sinh | Hệ thống tính đúng 16 tuổi theo múi giờ `Asia/Ho_Chi_Minh`, **không bắt buộc** phụ huynh. |
| **REG-04** | Điểm biên 16 tuổi thiếu 1 ngày | DOB: Ngày mai cách đây 16 năm (`2010-11-10`) | Nhập ngày sinh | Hệ thống tính 15 tuổi, **bắt buộc** hiện khối phụ huynh. |
| **REG-05** | Chặn đăng ký trẻ em dưới 12 tuổi | DOB: `15/06/2016` (10 tuổi) | Chọn ngày sinh 10 tuổi | - Cảnh báo đỏ: *"Học viên phải từ 12 tuổi trở lên"*.<br>- Nút Đăng ký chuyển trạng thái **disabled**.<br>- Nếu cố gọi API trực tiếp trả về `HTTP 400 Bad Request`. |
| **REG-06** | Ngày sinh không hợp lệ | DOB: Ngày tương lai hoặc cách đây 120 năm | Nhập ngày sinh | Báo lỗi định dạng ngày sinh không hợp lệ. |
| **REG-07** | Đăng ký trùng Email đã có | Email: `active.student@webedu.vn` | Điền thông tin, bấm Đăng ký | - Trả về lỗi `HTTP 409 Conflict`.<br>- Thông báo: *"Email này đã được sử dụng"*, **không xóa** các trường đã điền. |
| **REG-08** | Đăng ký trùng Số điện thoại | SĐT: `0909000007` | Điền thông tin, bấm Đăng ký | Báo lỗi SĐT đã được sử dụng trong hệ thống. |
| **REG-09** | Học viên < 16 tuổi nhưng không điền email PH hoặc không tích đồng ý | DOB: 14 tuổi, bỏ trống email PH hoặc bỏ check | Bấm Đăng ký | Báo lỗi validation đỏ tại trường phụ huynh tương ứng. |
| **REG-10** | Email phụ huynh trùng email học viên | Email HV: `a@test.com`<br>Email PH: `a@test.com` | Bấm Đăng ký | Báo lỗi: Email phụ huynh không được trùng với email học viên. |
| **REG-11** | Mật khẩu xác nhận không khớp | Pass: `Password@123`<br>Confirm: `Password@456` | Bấm Đăng ký | Báo lỗi: *"Mật khẩu xác nhận không khớp"*. |
| **REG-12** | Mật khẩu không đủ 8 ký tự | Pass: `Abc@12` (6 ký tự) | Bấm Đăng ký | Báo lỗi: Mật khẩu tối thiểu 8 ký tự. |
| **REG-13** | Chống bấm đúp (Anti-Double Submit) | Điền form hợp lệ | Click liên tục 3 lần vào nút Đăng ký | Nút chuyển sang *"Đang đăng ký..."* và disabled, chỉ gửi **duy nhất 1 request**. |

---

## 4. Luồng 2: Xác Thực, Đăng Nhập & Bảo Mật Khóa Tài Khoản (Authentication & Lockout)

URL kiểm thử: `http://localhost:3000/login`

| Mã Case | Tên Kịch Bản | Dữ Liệu Đầu Vào | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **AUTH-01** | Đăng nhập thành công Học viên | `active.student@webedu.vn` / `Password@123` | Bấm Đăng nhập | Đăng nhập thành công, tự động chuyển hướng vào `/student/overview`. |
| **AUTH-02** | Đăng nhập thành công Giáo viên | `teacher.lan@webedu.vn` / `Password@123` | Bấm Đăng nhập | Tự động chuyển hướng vào `/teacher/classes`. |
| **AUTH-03** | Đăng nhập thành công Admin | `admin@webedu.vn` / `Password@123` | Bấm Đăng nhập | Tự động chuyển hướng vào `/admin/students`. |
| **AUTH-04** | Đăng nhập thành công Superadmin | `superadmin@webedu.vn` / `Password@123` | Bấm Đăng nhập | Tự động chuyển hướng vào `/superadmin/settings`. |
| **AUTH-05** | Tích chọn "Ghi nhớ đăng nhập" | Tích ô `#remember-me` | Đăng nhập | Cookie `accessToken` có thời hạn 30 ngày (persistent). Khi không tích, cookie là session cookie. |
| **AUTH-06** | Nhập sai mật khẩu lần 1 đến 4 | Gõ `WrongPass@123` lần 1-4 | Bấm Đăng nhập | Báo lỗi đồng nhất: *"Tên đăng nhập hoặc mật khẩu không đúng"*. |
| **AUTH-07** | Khóa tài khoản tạm thời 15 phút (Brute-force Lockout) | Gõ sai mật khẩu **lần thứ 5** | Bấm Đăng nhập lần 5 | Hệ thống trả về `HTTP 403/429`, hiển thị thông báo khóa tạm tài khoản 15 phút. |
| **AUTH-08** | Cố đăng nhập khi tài khoản đang bị khóa | Nhập đúng mật khẩu `Password@123` ở lần 6 (trong thời gian khóa) | Bấm Đăng nhập | **Vẫn bị từ chối**, thông báo tài khoản đang bị khóa tạm thời. |
| **AUTH-09** | Tự động mở khóa sau 15 phút | Sau 15 phút (hoặc giả lập thời gian) | Nhập đúng mật khẩu | Đăng nhập thành công, bộ đếm lỗi reset về 0. |
| **AUTH-10** | Đăng nhập tài khoản bị vô hiệu hóa | Tài khoản có status `DISABLED` | Nhập đúng mật khẩu | Báo lỗi: *"Tài khoản của bạn đã bị vô hiệu hóa. Vui lòng liên hệ trung tâm"*. |
| **AUTH-11** | Nút Ẩn/Hiện mật khẩu | Nhập mật khẩu | Click icon con mắt | Input chuyển đổi giữa `type="password"` và `type="text"` mượt mà. |
| **AUTH-12** | Đăng xuất người dùng | Bất kỳ tài khoản đang đăng nhập | Bấm nút **Đăng xuất** | Xóa sạch cookie HttpOnly, chuyển hướng về `/login`. Bấm nút Back của trình duyệt không thể quay lại trang bảo mật. |
| **AUTH-13** | Đăng xuất đồng thời trên nhiều Tab (Multi-Tab Invalidation) | Mở 2 Tab: Tab 1 và Tab 2 cùng đăng nhập | Bấm Đăng xuất ở Tab 1 $\rightarrow$ Sang Tab 2 bấm F5 | Tab 2 lập tức bị đá về `/login` do `tokenVersion` đã bị tăng trên database. |

---

## 5. Luồng 3: Quên Mật Khẩu & Đặt Lại Mật Khẩu An Toàn (Password Recovery)

URL kiểm thử: `http://localhost:3000/forgot-password` và `http://localhost:3000/reset-password`

| Mã Case | Tên Kịch Bản | Dữ Liệu Đầu Vào | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **PWD-01** | Gửi yêu cầu với Email tồn tại | `active.student@webedu.vn` | Nhập email, bấm **Gửi yêu cầu** | - Thông báo thành công: *"Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn..."*.<br>- Token được tạo trong bảng `password_reset_tokens`. |
| **PWD-02** | Gửi yêu cầu với Email KHÔNG tồn tại | `khongtontai@gmail.com` | Nhập email, bấm **Gửi yêu cầu** | **Hiển thị thông báo giống hệt PWD-01** (chống kẻ tấn công dò quét email người dùng). |
| **PWD-03** | Cơ chế chống Spam (Cooldown 60 giây) | Ngay sau khi bấm gửi | Quan sát nút gửi | Nút chuyển thành `Gửi lại sau 60s` (disabled) và đếm ngược từng giây. |
| **PWD-04** | Đặt lại mật khẩu thành công | URL có `?token=VALID_TOKEN`<br>Mật khẩu mới: `NewPassword@123` | Điền mật khẩu mới + xác nhận, bấm **Lưu mật khẩu** | Đặt lại thành công, tự động điều hướng về `/login?reset=1`. Dùng mật khẩu mới đăng nhập thành công. |
| **PWD-05** | Token hết hạn (quá 15 phút) | Token sinh ra quá 15 phút trước | Nhập mật khẩu mới, bấm Lưu | Báo lỗi: *"Mã khôi phục đã hết hạn. Vui lòng gửi lại yêu cầu"*. |
| **PWD-06** | Dùng lại Token đã sử dụng | Dùng lại token của Case PWD-04 | Bấm Lưu mật khẩu | Báo lỗi: Token không hợp lệ hoặc đã qua sử dụng. |
| **PWD-07** | Mật khẩu mới trùng mật khẩu cũ | Nhập lại đúng `Password@123` | Bấm Lưu mật khẩu | Báo lỗi: Mật khẩu mới không được trùng với mật khẩu gần nhất. |
| **PWD-08** | Truy cập `/reset-password` không có token | Truy cập URL không có tham số `?token=` | Mở trang | Hiển thị ô nhập mã token thủ công, không bị crash trang. |

---

## 6. Luồng 4: Phân Quyền Đa Cấp & Chống Xuyên Quyền (RBAC & Multi-tenant Security)

| Mã Case | Tên Kịch Bản | Phiên Đăng Nhập | URL Thử Nghiệm | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **SEC-01** | Khách chưa đăng nhập vào Portal | Chưa đăng nhập (`Guest`) | Gõ `/student/overview`, `/admin/students`, `/profile` | Tự động chuyển hướng (`HTTP 307`) về `/login`. |
| **SEC-02** | Học viên cố vào trang Quản trị Admin | `STUDENT` | Gõ `/admin/students` hoặc `/admin/teachers` | Chặn bằng màn hình **`403 Bạn không có quyền truy cập`** (`AccessDeniedState`). Không rò rỉ dữ liệu bảng. |
| **SEC-03** | Học viên cố vào trang Superadmin | `STUDENT` | Gõ `/superadmin/settings` | Chặn bằng màn hình **`403 Access Denied`**. |
| **SEC-04** | Giáo viên cố vào trang Admin | `TEACHER` | Gõ `/admin/students` hoặc `/admin/students/pending` | Chặn bằng màn hình **`403 Access Denied`**. |
| **SEC-05** | Giáo viên cố vào trang Superadmin | `TEACHER` | Gõ `/superadmin/settings` | Chặn bằng màn hình **`403 Access Denied`**. |
| **SEC-06** | Admin cố vào trang Superadmin | `ADMIN` | Gõ `/superadmin/settings` | Chặn bằng màn hình **`403 Access Denied`**. |
| **SEC-07** | Superadmin thuần vào Hàng đợi xếp lớp | `SUPERADMIN` (không có role Admin) | Gõ `/admin/students/pending` | Chặn bằng màn hình **`403 Access Denied`** (theo hiến chương: Superadmin không can thiệp nghiệp vụ đào tạo). |
| **SEC-08** | Chống tấn công IDOR / Đọc chéo dữ liệu | Học viên A (`studentA`) | Gọi API đọc thông tin cá nhân của Học viên B qua ID | Server trả về `HTTP 403 Forbidden` hoặc `404 Not Found`. Không xem được dữ liệu của B. |

---

## 7. Luồng 5: Quản Lý Hồ Sơ Cá Nhân & Đổi Thông Tin (Profile Management)

URL kiểm thử: `http://localhost:3000/profile`

| Mã Case | Tên Kịch Bản | Vai Trò | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **PRO-01** | Xem thông tin hồ sơ | Mọi vai trò | Truy cập `/profile` | Hiển thị đúng Họ tên, SĐT, Email, Vai trò, Ngày sinh. |
| **PRO-02** | Khóa trường Ngày sinh đối với Học viên | `STUDENT` | Thử click sửa ô Ngày sinh | Ô Ngày sinh ở trạng thái `disabled / read-only`, học viên **không thể sửa**. |
| **PRO-03** | Cập nhật Họ tên & SĐT | Mọi vai trò | Sửa họ tên, bấm **Lưu thông tin cá nhân** | Lưu thành công, thông báo xanh ngọc bích, tên trên Topbar cập nhật ngay. |
| **PRO-04** | Đổi Email có xác thực mật khẩu | Mọi vai trò | Nhập email mới $\rightarrow$ Ô *"Mật khẩu hiện tại"* hiện ra $\rightarrow$ Nhập mật khẩu đúng $\rightarrow$ Lưu | - Đổi email thành công.<br>- Xoay vòng phiên đăng nhập (`tokenVersion` tăng). |
| **PRO-05** | Đổi Email nhập sai mật khẩu | Mọi vai trò | Nhập email mới + mật khẩu sai | Báo lỗi: Mật khẩu hiện tại không đúng, không lưu email. |
| **PRO-06** | Đổi Mật khẩu thành công | Mọi vai trò | Nhập mật khẩu hiện tại đúng + mật khẩu mới hợp lệ | Đổi mật khẩu thành công. Các thiết bị/tab khác tự động đăng xuất. |
| **PRO-07** | Đổi Mật khẩu sai mật khẩu hiện tại | Mọi vai trò | Nhập mật khẩu hiện tại sai | Báo lỗi: Mật khẩu hiện tại không chính xác. |

---

## 8. Luồng 6: Quản Trị Đào Tạo — Học Viên & Hàng Đợi Xếp Lớp (Admin Student Management)

URL kiểm thử: `http://localhost:3000/admin/students` và `http://localhost:3000/admin/students/pending`

| Mã Case | Tên Kịch Bản | Dữ Liệu Đầu Vào | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **STU-01** | Tìm kiếm học viên | Gõ `Phạm Gia Huy` hoặc `0909000007` | Nhập vào ô tìm kiếm | Bảng lọc tức thời đúng học viên, hiển thị mượt mà. |
| **STU-02** | Lọc theo trạng thái | Chọn `Chờ xếp lớp` | Đổi dropdown lọc trạng thái | Bảng chỉ hiển thị các học viên có status `PENDING_CLASS`. |
| **STU-03** | Xem và sửa hồ sơ chi tiết | Bấm **Xem / Sửa** trên 1 dòng | Modal `StudentDetailModal` mở ra | Hiển thị đầy đủ thông tin, tính toán số tuổi chính xác. |
| **STU-04** | Bất biến khóa Ngày sinh học viên có phụ huynh | Học viên `pending.student@webedu.vn` (14t có phụ huynh) | Bấm **Xem / Sửa** | Trường Ngày sinh bị **khóa cứng (disabled)** kèm dòng giải thích: *"Đã khóa do có xác nhận đồng ý của cha mẹ"*. |
| **STU-05** | Phân quyền Ghi chú nội bộ (`internalNotes`) | Superadmin thuần đăng nhập | Mở xem chi tiết học viên | Trường `Ghi chú nội bộ` bị ẩn/khóa đối với Superadmin thuần (chỉ Admin mới xem/sửa). |
| **STU-06** | Tiếp nhận Hàng đợi xếp lớp ban đầu | Học viên vừa đăng ký mới | Truy cập `/admin/students/pending` | - Thấy học viên mới trong hàng đợi.<br>- Học viên 14 tuổi hiện nhãn **`Đã xác nhận`** (màu ngọc bích).<br>- Học viên $\ge 16$ tuổi hiện nhãn **`Không áp dụng`**. |
| **STU-07** | Phân công xếp lớp ban đầu | Bấm nút **Xếp lớp** trên hàng đợi | Modal mở ra $\rightarrow$ Chọn lớp `HSK2-K26-01` $\rightarrow$ Bấm **Xác nhận xếp lớp** | - Xếp lớp thành công.<br>- Học viên biến mất khỏi hàng đợi `pending`.<br>- Chuyển sang trạng thái `ACTIVE` trong danh sách học viên chính. |

---

## 9. Luồng 7: Quản Trị Đội Ngũ Giáo Viên & Bất Biến Nghiệp Vụ (Teacher Management & Invariants)

URL kiểm thử: `http://localhost:3000/admin/teachers`

| Mã Case | Tên Kịch Bản | Dữ Liệu Đầu Vào | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- | :--- |
| **TEA-01** | Tạo tài khoản Giáo viên mới | Tên: `Nguyễn Thu Hằng (阮秋恒)`<br>SĐT: `0988776655`<br>Email: `hang.nguyen@webedu.vn`<br>Pass: `Password@123` | Bấm **+ Tạo tài khoản giáo viên** $\rightarrow$ Điền form $\rightarrow$ Bấm Lưu | Tạo GV thành công, hiển thị trong danh sách kèm chữ Hán. |
| **TEA-02** | Chặn tạo Giáo viên trùng Email/SĐT | Email hoặc SĐT đã tồn tại | Điền form $\rightarrow$ Bấm Lưu | Báo lỗi `HTTP 409 Conflict`: Email hoặc SĐT đã được sử dụng. |
| **TEA-03** | Bất biến nghiệp vụ: Chặn vô hiệu hóa GV đang có lớp hoạt động | GV `Trương Mỹ Lan` (`activeClassesCount = 2`) | Bấm nút **Vô hiệu hóa** | - **Chặn đứng thao tác**.<br>- Modal cảnh báo hiện ra: *"Không thể vô hiệu hóa giáo viên đang phụ trách lớp học hoạt động"*. |
| **TEA-04** | Vô hiệu hóa GV có 0 lớp active | GV không có lớp nào đang hoạt động | Bấm **Vô hiệu hóa** | Cho phép chuyển trạng thái sang `DISABLED`. |
| **TEA-05** | Hiển thị nhãn kiêm nhiệm Admin | GV được phân thêm quyền Admin | Xem danh sách | Hiển thị huy hiệu nhãn `Admin` màu xanh chàm bên cạnh tên giáo viên. |

---

## 10. Luồng 8: Quản Trị Cấp Cao Superadmin — Thương Hiệu & Nhân Sự (Superadmin Operations)

URL kiểm thử: `http://localhost:3000/superadmin/settings` (Chỉ dành cho `superadmin@webedu.vn`)

| Mã Case | Tên Kịch Bản | Thao Tác Kiểm Thử | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- |
| **SUP-01** | Đổi Tên Trung Tâm đồng bộ thời gian thực | Đổi tên thành: `Trung Tâm Hán Ngữ TD - Cơ Sở 1` $\rightarrow$ Bấm **Lưu cấu hình hệ thống** | - Lưu thành công.<br>- Ngay lập tức Topbar và Sidebar đổi sang tên mới.<br>- Mở tab Học viên/Giáo viên F5 thấy tên mới lập tức. |
| **SUP-02** | Tải lên Logo trung tâm mới | Chọn tệp ảnh PNG/JPG $< 2$MB $\rightarrow$ Bấm Lưu | Logo hiển thị tại Topbar và màn hình đăng nhập thay cho con dấu mặc định. |
| **SUP-03** | Xóa Logo trung tâm | Bấm nút **Xóa logo hiện tại** $\rightarrow$ Bấm Lưu | Hệ thống tự động phục hồi về con dấu son triện đỏ `TD` chuẩn thư họa. |
| **SUP-04** | Chặn tải file logo quá 2MB hoặc sai định dạng | Chọn file `.pdf` hoặc ảnh dung lượng 5MB | Báo lỗi validation: File vượt quá kích thước cho phép hoặc sai định dạng. |
| **SUP-05** | Tạo tài khoản quản trị mới | Bấm **+ Tạo tài khoản quản trị** $\rightarrow$ Điền thông tin, tích chọn vai trò `ADMIN` | Tạo thành công nhân sự đào tạo mới. |
| **SUP-06** | Phân đa vai trò cho người dùng | Bấm **Phân quyền / Trạng thái** $\rightarrow$ Tích cả `TEACHER` và `ADMIN` $\rightarrow$ Lưu | Tài khoản trở thành nhân sự kiêm nhiệm, có quyền truy cập cả 2 không gian. |
| **SUP-07** | Chính sách bảo vệ Superadmin: Chặn tự tước quyền | Superadmin đang đăng nhập thử gỡ bỏ quyền `SUPERADMIN` của chính mình | Checkbox `SUPERADMIN` bị **khóa cứng (disabled)** kèm thông báo: *"Không thể tự gỡ quyền Superadmin của chính mình"*. |
| **SUP-08** | Chính sách bảo vệ Superadmin: Chặn tự khóa chính mình | Superadmin đang đăng nhập thử đổi trạng thái bản thân thành `Vô hiệu hóa` | Dropdown trạng thái bị **disabled**, không cho phép tự khóa tài khoản. |
| **SUP-09** | Nhật ký kiểm toán hệ thống (Audit Logs) | Sau khi thực hiện đổi tên, đổi quyền, khóa tài khoản | Xem bảng Nhật ký kiểm toán: Hiển thị đầy đủ hành động, IP, thời gian GMT+7, chi tiết thay đổi (Read-only). |

---

## 11. Kiểm Thử Phi Chức Năng: UI/UX, Đa Thiết Bị, Chữ Hán & Trợ Năng (Non-Functional QA)

| Mã Case | Khía Cạnh | Tiêu Chí Kiểm Tra | Kết Quả Mong Đợi (Pass Criteria) |
| :--- | :--- | :--- | :--- |
| **UX-01** | **Form Ergonomics** (Công thái học Form) | Kiểm tra trang Đăng ký `/register` và Đăng nhập `/login` trên màn hình laptop 1366×768 và 1440×900 | Toàn bộ form và nút Submit hiển thị **trọn vẹn trong màn hình đầu tiên (Above the fold)**, người dùng **không cần cuộn chuột**. |
| **UX-02** | **Modal Viewport Safety** | Mở Modal trên màn hình có chiều cao thấp (700px) hoặc khi trình duyệt Zoom 125% – 150% | Modal có `max-h-[90vh] overflow-y-auto`, các nút **Lưu** và **Hủy** không bao giờ bị tràn mất khỏi màn hình. |
| **UX-03** | **Responsive Viewports** (Chống tràn ngang) | Kiểm tra 4 mốc: Mobile (375×812), Tablet (768×1024), Small Laptop (1024×768), Desktop (1440×900) | `scrollWidth <= innerWidth` trên 100% trang, không xuất hiện thanh cuộn ngang (horizontal scrollbar). |
| **UX-04** | **Typography Chữ Hán & Pinyin** | Kiểm tra chữ Hán đại tự `學`, các thẻ Hanzi eyebrow (`学员管理`, `待分班`,...), trích dẫn Luận Ngữ | - Font chữ Hán hiển thị nét thư pháp Noto Serif SC/SimSun sắc sảo.<br>- Đại tự `學` hiển thị chuẩn màu **Xanh ngọc bích (`--jade: #2B7760`)**.<br>- Dấu thanh điệu Pinyin không bị vỡ hoặc lỗi font. |
| **A11Y-01** | **Khả năng tiếp cận WCAG AA** | Quét tự động bằng `@axe-core/playwright` trên toàn bộ 12 trang | **0 lỗi mức `serious` hoặc `critical`**. Độ tương phản màu chữ đạt chuẩn $\ge 4.5:1$. |
| **A11Y-02** | **Điều hướng bàn phím (Keyboard Navigation)** | Bấm phím `Tab` và `Shift + Tab` di chuyển qua các input, nút, menu | Vòng sáng focus `:focus-visible` màu xanh chàm (`--blue: #31578A`) hiển thị rõ ràng trên mọi thành phần. |
| **REL-01** | **Không lỗi ẩn (Zero Console Error)** | Mở F12 Console trong suốt quá trình thao tác tất cả các luồng | **0 lỗi `console.error`**, không có hydration warning, không có uncaught exception. |

---

## 12. Quy Trình Chạy Kiểm Thử Tự Động & Hướng Dẫn Thực Thi

Dự án đã tích hợp sẵn 2 công cụ kiểm thử tự động tiện lợi:

### 1. Chạy Demo Trực Quan Trên Màn Hình (Visual Live Test)
Script này sẽ tự động khởi chạy Chromium thật, tự điền form với tốc độ chậm (`slowMo: 600ms`) để bạn quan sát trực tiếp hành trình người dùng:
```powershell
node scripts/live-browser-test.mjs
```
*Tự động thực thi: Học viên vị thành niên đăng ký $\rightarrow$ Học viên đăng nhập $\rightarrow$ Thử truy cập trái phép bị chặn 403 $\rightarrow$ Admin tiếp nhận xếp lớp $\rightarrow$ Admin thử khóa GV bị chặn $\rightarrow$ Superadmin đổi tên trung tâm $\rightarrow$ Học viên thấy tên mới tức thời.*

### 2. Chạy Trọn Gói Bộ Test Tự Động Playwright E2E (Desktop + Mobile)
```powershell
npm run test:frontend
```
*Chạy kiểm tra tự động toàn diện 14 kịch bản E2E trên cả 2 thiết bị Desktop Chromium (1440×900) và Mobile Chromium (375×812).*

### 3. Chạy Kiểm Tra Toàn Bộ Cổng Kỹ Thuật (Typecheck + Lint + Backend Unit)
```powershell
# Kiểm tra TypeScript Frontend & Backend
npm run typecheck:frontend
npm run typecheck:backend

# Kiểm tra Linter Oxlint & ESLint
npm run lint:frontend
npm run lint:backend

# Chạy 117 bài test Unit & Integration Backend
npm run test:backend
```
