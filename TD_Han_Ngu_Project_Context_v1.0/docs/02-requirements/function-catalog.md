# Function Catalog — 71 yêu cầu từ Final.xlsx

Theo cột `Function List ` trong Excel. Mã không liên tiếp do các mục đã gộp/loại bỏ; **không sinh lại mã**.

> **Ghi chú đồng bộ (13/11/2026):** Cột `Trạng thái Excel` giữ nguyên theo nguồn `Final.xlsx`. Cột `Trạng thái triển khai (13/11/2026)` phản ánh đối soát thực tế trên nhánh `develop` (Modules 01–05) và nhánh `feature/phase-05-question-bank-and-import` (Module 06 P1 — chưa merge `develop`, còn backlog `#7`).

| Mã | Module | Chức năng | Phase | Ưu tiên | Trạng thái Excel | Trạng thái triển khai (13/11/2026) |
|---|---|---|---|---|---|---|
| [FUNC-001](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Học viên tự đăng ký | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2) |
| [FUNC-002](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Đồng ý của cha mẹ khi đăng ký | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2; 1 ô email + checkbox `DEC-023`, active link `DEFERRED`) |
| [FUNC-003](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Đăng nhập hệ thống | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2) |
| [FUNC-004](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Đăng xuất | Phase 1 | High | Đề xuất | Một phần `develop` (logout thủ công OK; `useIdleTimeout` 60p chưa mount `TD-07`) |
| [FUNC-005](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Khôi phục mật khẩu | Phase 1 | Medium | Đã ghi nhận | `develop` (Phase 2; SMTP relay production chờ `SYS-01`) |
| [FUNC-006](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Quản lý tài khoản giáo viên | Dự kiến P1 | High | Cần xác nhận | `develop` (Phase 2) |
| [FUNC-007](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Quản lý thông tin học viên | Dự kiến P1 | High | Cần xác nhận | Một phần `develop` (`StudentDetailModal` & `PATCH` OK; `getStudentById` chặn `TEACHER` `403` theo default-deny `#6`) |
| [FUNC-008](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Liên kết tài khoản với hồ sơ và lớp | Dự kiến P1 | High | Cần xác nhận | `develop` (Phase 2–3) |
| [FUNC-009](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Một người dùng nhiều vai trò | Phase 1 | Medium | Đã ghi nhận | Một phần `develop` (RBAC BE OK; menu/guard đa role chưa đủ `TD-09`) |
| [FUNC-010](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Học viên chỉ xem dữ liệu của mình | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2–4) |
| [FUNC-011](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Giáo viên chỉ truy cập lớp được phân công | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2–4) |
| [FUNC-012](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Admin xem được tất cả lớp | Phase 1 | High | Đã ghi nhận | `develop` (Phase 2–4) |
| [FUNC-013](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Superadmin vận hành hệ thống | Phase 1 | Medium | Đã ghi nhận | Một phần `develop` (thiếu lọc role/status/action & `Làm mới` `TD-10`) |
| [FUNC-014](modules/02-khoa-hsk.md) | Khóa HSK | Danh mục khóa học HSK | Dự kiến P1 | Medium | Cần xác nhận | `develop` (Phase 3) |
| [FUNC-016](modules/03-lop-hoc.md) | Lớp học | Tạo lớp học | Phase 1 | High | Đã ghi nhận | `develop` (Phase 3) |
| [FUNC-017](modules/03-lop-hoc.md) | Lớp học | Chỉnh sửa thông tin lớp | Phase 1 | High | Đã ghi nhận | Một phần `develop` (`startDate` chưa khóa khi có buổi hoàn thành, thiếu xác nhận đổi lịch, chưa có `DELETE` `#6`) |
| [FUNC-018](modules/03-lop-hoc.md) | Lớp học | Phân công giáo viên | Phase 1 | High | Đã ghi nhận | `develop` (Phase 3) |
| [FUNC-020](modules/03-lop-hoc.md) | Lớp học | Thêm học viên vào lớp | Phase 1 | High | Đã ghi nhận | Một phần `develop` (BE & modal OK; `ClassStudentsTable` thiếu cột `Số buổi nghỉ` `TD-10`) |
| [FUNC-022](modules/03-lop-hoc.md) | Lớp học | Chuyển học viên sang lớp khác | Phase 1 | Medium | Đã ghi nhận | `develop` (Phase 3) |
| [FUNC-023](modules/03-lop-hoc.md) | Lớp học | Xem lịch sử các lớp đã học | Phase 1 | Medium | Đã ghi nhận | `develop` (Phase 3) |
| [FUNC-024](modules/03-lop-hoc.md) | Lớp học | Danh sách và chi tiết lớp | Phase 1 | High | Đã ghi nhận | Một phần `develop` (`/admin/classes` thiếu cột tiến độ `TD-08`) |
| [FUNC-026](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Khai báo lịch học định kỳ | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-027](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Tạo các buổi học theo lịch | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-028](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Xem lịch buổi học | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-029](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Cập nhật lịch khi thay đổi | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-030](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Hủy buổi và lưu thông tin cũ | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-031](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Tạo buổi học bù | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-032](modules/04-lich-buoi-hoc.md) | Lịch & buổi học | Nhật ký thay đổi lịch | Phase 1 | Medium | Đã ghi nhận | `develop` (Phase 4) |
| [FUNC-034](modules/05-diem-danh.md) | Điểm danh | Điểm danh từng buổi | Phase 1 | High | Đã ghi nhận | Một phần `develop` (BE 3 trạng thái OK; `SessionAttendanceModal` chưa khóa nút Lưu khi thiếu học viên `TD-10`) |
| [FUNC-035](modules/05-diem-danh.md) | Điểm danh | Xem điểm danh theo lịch | Phase 1 | High | Đã ghi nhận | `develop` (Phase 4 — `ClassAttendanceMatrixTab` & `StudentAttendanceView` `#6`) |
| [FUNC-036](modules/05-diem-danh.md) | Điểm danh | Tổng hợp số buổi nghỉ | Phase 1 | High | Đã ghi nhận | Một phần `develop` (thiếu cột `Số buổi nghỉ` & `/student/overview` hardcode `TD-08`) |
| [FUNC-037](modules/05-diem-danh.md) | Điểm danh | Sửa điểm danh bị nhầm | Phase 1 | Medium | Đã ghi nhận | Một phần `develop` (BE khóa sổ `T+2` & audit log OK; `ClassAttendanceMatrixTab` thiếu icon/tooltip `"đã sửa"` `TD-10`) |
| [FUNC-039](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Tạo/chỉnh sửa/xóa bài tập và bài kiểm tra | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (chưa merge `develop`; còn `QB-BUG-01`/`QB-UI-01`) |
| [FUNC-040](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Tải đề Word/PDF | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (chưa merge `develop`; còn `QB-SEC-01` magic bytes `.docx`) |
| [FUNC-041](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Chuyển đề thành câu hỏi tương tác | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần: heuristic mới tự nhận diện `SINGLE_CHOICE` + `needsReview`; `ASSIGN-01` chờ file mẫu) |
| [FUNC-042](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Giáo viên kiểm tra đề sau chuyển đổi | Dự kiến P1 | High | Đề xuất | Nhánh Phase 5 (một phần: thiếu `Xuống`/sửa `points`/`Lưu nháp` `QB-UI-01`, clear `needsReview` `QB-BUG-01`) |
| [FUNC-043](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Biên tập câu hỏi thủ công | Phase 1 | Medium | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-UI-01`) |
| [FUNC-044](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Câu hỏi trắc nghiệm 1 đáp án | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-BUG-01` ID option sau xóa) |
| [FUNC-045](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Câu hỏi trắc nghiệm nhiều đáp án | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-BUG-01` ID option sau xóa) |
| [FUNC-046](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Điền từ / trả lời ngắn | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-BUG-01`/`QB-UI-01`: chưa kiểm `pinyinSensitive`; preview ẩn ô nhập) |
| [FUNC-047](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Sắp xếp từ thành câu | Phase 1 | Medium | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-UI-01`: `AssessmentEditor` thiếu xóa câu/reorder/sửa điểm/`Phát hành`) |
| [FUNC-048](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Bài viết / dịch câu / tự luận | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-UI-01`: `AssessmentEditor` thiếu xóa/sửa trực tiếp; preview ẩn ô tự luận) |
| [FUNC-049](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Bài nghe kèm audio | Phase 1 | High | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-UI-01`: `AssessmentEditor` thiếu xóa câu/reorder/sửa điểm/`Phát hành`) |
| [FUNC-050](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Câu hỏi kèm hình ảnh | Phase 1 | Medium | Đã ghi nhận | Nhánh Phase 5 (một phần `QB-BUG-01`; `QuestionMedia` chưa ghi DB) |
| [FUNC-051](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Giao bài tập cho lớp | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 6) |
| [FUNC-052](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Danh sách bài được giao | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 6) |
| [FUNC-053](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Lưu bài đang làm | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 6) |
| [FUNC-054](modules/06-bai-tap-ngan-hang-de.md) | Bài tập & ngân hàng đề | Chỉ cho nộp bài một lượt | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 6) |
| [FUNC-056](modules/07-cham-diem.md) | Chấm điểm & AI | Tự động chấm trắc nghiệm | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-057](modules/07-cham-diem.md) | Chấm điểm & AI | AI chấm sơ bộ bài mở | Ngoài phạm vi | Medium | Loại bỏ | Loại khỏi phạm vi Phase 1 (`07-cham-diem.md`) |
| [FUNC-058](modules/07-cham-diem.md) | Chấm điểm & AI | Giáo viên kiểm tra kết quả chấm | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-059](modules/07-cham-diem.md) | Chấm điểm & AI | Giáo viên xác nhận điểm | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-060](modules/07-cham-diem.md) | Chấm điểm & AI | Công bố điểm sau duyệt | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-061](modules/07-cham-diem.md) | Chấm điểm & AI | Giáo viên chỉnh sửa điểm | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-062](modules/07-cham-diem.md) | Chấm điểm & AI | Theo dõi học viên đã nộp/chưa nộp | Phase 1 | High | Đề xuất | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-063](modules/07-cham-diem.md) | Chấm điểm & AI | Xem kết quả bài đã công bố | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-064](modules/07-cham-diem.md) | Chấm điểm & AI | Lưu lịch sử chỉnh sửa điểm | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 7) |
| [FUNC-065](modules/08-kiem-tra-tong-ket.md) | Kiểm tra & tổng kết | Quản lý bài kiểm tra (Mini-test / Giữa kỳ / Cuối kỳ) | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8) |
| [FUNC-068](modules/08-kiem-tra-tong-ket.md) | Kiểm tra & tổng kết | Hỗ trợ biểu mẫu đề khác nhau | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8) |
| [FUNC-069](modules/08-kiem-tra-tong-ket.md) | Kiểm tra & tổng kết | Theo dõi điểm bài tập về nhà | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8) |
| [FUNC-070](modules/08-kiem-tra-tong-ket.md) | Kiểm tra & tổng kết | Tính điểm tổng kết từ các bài kiểm tra | Dự kiến P1 | Medium | Cần xác nhận | Chưa triển khai (Kế hoạch Phase 8) |
| [FUNC-071](modules/09-theo-doi-tien-do.md) | Theo dõi tiến độ | Theo dõi tiến độ buổi học | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |
| [FUNC-072](modules/09-theo-doi-tien-do.md) | Theo dõi tiến độ | Dự kiến ngày kết thúc lớp | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |
| [FUNC-073](modules/09-theo-doi-tien-do.md) | Theo dõi tiến độ | Hiển thị tình trạng học cá nhân | Phase 1 | High | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |
| [FUNC-074](modules/09-theo-doi-tien-do.md) | Theo dõi tiến độ | Giáo viên theo dõi lớp phụ trách | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |
| [FUNC-075](modules/09-theo-doi-tien-do.md) | Theo dõi tiến độ | Quản lý xem tổng quan các lớp | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |
| [FUNC-076](modules/08-kiem-tra-tong-ket.md) | Kiểm tra & tổng kết | Nhập điểm kiểm tra thủ công | Ngoài phạm vi | Low | Loại bỏ | Loại khỏi phạm vi Phase 1 (`08-kiem-tra-tong-ket.md`) |
| [FUNC-077](modules/03-lop-hoc.md) | Lớp học | Rút học viên khỏi lớp | Phase 1 | Medium | Đã ghi nhận | `develop` (Phase 3) |
| [FUNC-078](modules/01-tai-khoan-phan-quyen.md) | Tài khoản & phân quyền | Hồ sơ cá nhân & đổi mật khẩu | Dự kiến P1 | Medium | Đề xuất | Một phần `develop` (thiếu khóa `<16` đổi email & OTP đổi email `TD-10`) |
| [FUNC-079](modules/03-lop-hoc.md) | Lớp học | Kết thúc / lưu trữ lớp | Phase 1 | Low | Đã ghi nhận | Một phần `develop` (`completeClass` giữ `SCHEDULED` thay vì `CANCELLED` `TD-10`) |
| [FUNC-080](modules/10-thong-bao.md) | Thông báo | Thông báo trong hệ thống | Phase 1 | Medium | Đã ghi nhận | Chưa triển khai (Kế hoạch Phase 8–9) |

## Tổng hợp theo module

| Module | Số chức năng |
|---|---:|
| Tài khoản & phân quyền | 14 |
| Khóa HSK | 1 |
| Lớp học | 9 |
| Lịch & buổi học | 7 |
| Điểm danh | 4 |
| Bài tập & ngân hàng đề | 16 |
| Chấm điểm & AI | 9 |
| Kiểm tra & tổng kết | 5 |
| Theo dõi tiến độ | 5 |
| Thông báo | 1 |

## Phân loại từ Excel

- `Phase 1`: 62 chức năng được đưa vào danh sách giai đoạn 1.
- `Dự kiến P1`: 7 chức năng cần xác nhận mức triển khai.
- `Ngoài phạm vi`: 2 chức năng không triển khai ở Phase 1 (`FUNC-057`, `FUNC-076`).
- `High/Medium/Low` là ưu tiên nguồn, **không** tương đương trạng thái đã code.
