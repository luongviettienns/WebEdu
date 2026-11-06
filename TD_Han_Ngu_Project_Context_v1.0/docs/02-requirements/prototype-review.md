# Prototype Review & Production Cleanup

**Nguồn:** `Review Prototype theo Function ` đối chiếu ngày 04/11/2026 và `Chức năng thừa trong Prototype`. Review này là UI/prototype, không chứng minh đã có code backend hoặc test e2e.

## Kết quả review theo mã FUNC

| FUNC | Tên | Trạng thái đối chiếu | Trích ghi chú round 2 |
|---|---|---|---|
| FUNC-001 | Học viên tự đăng ký | Đã sửa |  |
| FUNC-002 | Đồng ý của cha mẹ khi đăng ký | Đã sửa |  |
| FUNC-003 | Đăng nhập hệ thống | Đã sửa |  |
| FUNC-004 | Đăng xuất | Đã sửa |  |
| FUNC-005 | Khôi phục mật khẩu | Đã sửa |  |
| FUNC-006 | Quản lý tài khoản giáo viên | Đã sửa |  |
| FUNC-007 | Quản lý thông tin học viên | Đã sửa |  |
| FUNC-008 | Liên kết tài khoản với hồ sơ và lớp | Đã sửa |  |
| FUNC-009 | Một người dùng nhiều vai trò | Đã sửa |  |
| FUNC-010 | Học viên chỉ xem dữ liệu của mình | Đã sửa |  |
| FUNC-011 | Giáo viên chỉ truy cập lớp được phân công | Đã sửa |  |
| FUNC-012 | Admin xem được tất cả lớp | Đã sửa |  |
| FUNC-013 | Superadmin vận hành hệ thống | Đã sửa |  |
| FUNC-014 | Danh mục khóa học HSK | Đã sửa |  |
| FUNC-016 | Tạo lớp học | Đã sửa |  |
| FUNC-017 | Chỉnh sửa thông tin lớp | Đã sửa |  |
| FUNC-018 | Phân công giáo viên | Đã sửa |  |
| FUNC-020 | Thêm học viên vào lớp | Đã sửa |  |
| FUNC-022 | Chuyển học viên sang lớp khác | Đã sửa |  |
| FUNC-023 | Xem lịch sử các lớp đã học | Đã sửa |  |
| FUNC-024 | Danh sách và chi tiết lớp | Đáp ứng |  |
| FUNC-026 | Khai báo lịch học định kỳ | Đã sửa |  |
| FUNC-027 | Tạo các buổi học theo lịch | Đã sửa |  |
| FUNC-028 | Xem lịch buổi học | Đã sửa |  |
| FUNC-029 | Cập nhật lịch khi thay đổi | Đã sửa |  |
| FUNC-030 | Hủy buổi và lưu thông tin cũ | Đã sửa |  |
| FUNC-031 | Tạo buổi học bù | Đã sửa |  |
| FUNC-032 | Nhật ký thay đổi lịch | Đã sửa |  |
| FUNC-034 | Điểm danh từng buổi | Đã sửa |  |
| FUNC-035 | Xem điểm danh theo lịch | Đã sửa |  |
| FUNC-036 | Tổng hợp số buổi nghỉ | Chờ chốt |  |
| FUNC-037 | Sửa điểm danh bị nhầm | Đã sửa |  |
| FUNC-039 | Tạo/chỉnh sửa/xóa bài tập và bài kiểm tra | Đã sửa |  |
| FUNC-040 | Tải đề Word/PDF | Đã sửa |  |
| FUNC-041 | Chuyển đề thành câu hỏi tương tác | Đáp ứng |  |
| FUNC-042 | Giáo viên kiểm tra đề sau chuyển đổi | Đã sửa |  |
| FUNC-043 | Biên tập câu hỏi thủ công | Đã sửa một phần |  |
| FUNC-044 | Câu hỏi trắc nghiệm 1 đáp án | Đã sửa |  |
| FUNC-045 | Câu hỏi trắc nghiệm nhiều đáp án | Đã sửa |  |
| FUNC-046 | Điền từ / trả lời ngắn | Đã sửa một phần |  |
| FUNC-047 | Sắp xếp từ thành câu | Chờ chốt |  |
| FUNC-048 | Bài viết / dịch câu / tự luận | Chờ chốt |  |
| FUNC-049 | Bài nghe kèm audio | Đã sửa một phần |  |
| FUNC-050 | Câu hỏi kèm hình ảnh | Đã sửa một phần |  |
| FUNC-051 | Giao bài tập cho lớp | Đã sửa |  |
| FUNC-052 | Danh sách bài được giao | Đã sửa |  |
| FUNC-053 | Lưu bài đang làm | Đã sửa |  |
| FUNC-054 | Chỉ cho nộp bài một lượt | Đã sửa |  |
| FUNC-056 | Tự động chấm trắc nghiệm | Đã sửa |  |
| FUNC-057 | AI chấm sơ bộ bài mở | Chờ chốt |  |
| FUNC-058 | Giáo viên kiểm tra kết quả chấm | Đã sửa |  |
| FUNC-059 | Giáo viên xác nhận điểm | Đã sửa |  |
| FUNC-060 | Công bố điểm sau duyệt | Đã sửa |  |
| FUNC-061 | Giáo viên chỉnh sửa điểm | Chờ chốt |  |
| FUNC-062 | Theo dõi học viên đã nộp/chưa nộp | Đã sửa |  |
| FUNC-063 | Xem kết quả bài đã công bố | Đáp ứng |  |
| FUNC-064 | Lưu lịch sử chỉnh sửa điểm | Đã sửa |  |
| FUNC-065 | Quản lý bài kiểm tra (Mini-test / Giữa kỳ / Cuối kỳ) | Đáp ứng |  |
| FUNC-068 | Hỗ trợ biểu mẫu đề khác nhau | Chờ chốt |  |
| FUNC-069 | Theo dõi điểm bài tập về nhà | Đã sửa |  |
| FUNC-070 | Tính điểm tổng kết từ các bài kiểm tra | Chờ chốt |  |
| FUNC-071 | Theo dõi tiến độ buổi học | Đáp ứng |  |
| FUNC-072 | Dự kiến ngày kết thúc lớp | Đã sửa |  |
| FUNC-073 | Hiển thị tình trạng học cá nhân | Đã sửa |  |
| FUNC-074 | Giáo viên theo dõi lớp phụ trách | Đã sửa |  |
| FUNC-075 | Quản lý xem tổng quan các lớp | Đã sửa |  |
| FUNC-076 | Nhập điểm kiểm tra thủ công | Đã sửa |  |
| FUNC-077 | Rút học viên khỏi lớp | Đã sửa |  |
| FUNC-078 | Hồ sơ cá nhân & đổi mật khẩu | Đã sửa |  |
| FUNC-079 | Kết thúc / lưu trữ lớp | Đã sửa |  |
| FUNC-080 | Thông báo trong hệ thống | Đã sửa |  |

## 16 hạng mục thừa / chỉ phục vụ prototype

| # | Vị trí | Hạng mục | Khuyến nghị gốc |
|---|---|---|---|
| 1 | Thanh trên cùng – mọi màn hình | Thanh “Prototype · Xem với vai trò” | Chỉ dùng để demo; bỏ khi phát triển. |
| 2 | Đăng nhập | Khối “Tài khoản demo” | Chỉ dùng để demo; bỏ khi phát triển. |
| 3 | Đăng nhập; Đăng ký | Dòng gợi ý “Thử lỗi” | Chỉ dùng để demo; bỏ khi phát triển. |
| 4 | Học viên – Tổng quan | Checkbox “Xem như tài khoản Chờ xếp lớp” | Chỉ dùng để demo; bỏ khi phát triển. |
| 5 | Tải đề Word/PDF | Nút “Dùng file mẫu luyen-nghe-hsk1-bo3.docx” | Chỉ dùng để demo; bỏ khi phát triển. |
| 6 | Tiêu đề màn hình, khối, popup – mọi màn hình | Nhãn mã chức năng “FUNC-xxx” | Bỏ khi phát triển. |
| 7 | Danh mục khóa HSK; Popup Thêm học viên | Nhãn mã chức năng đã xóa khỏi DSCN | Đổi FUNC-015 thành FUNC-016; đổi FUNC-025 thành FUNC-020. |
| 8 | Chấm bài; Danh sách HV của lớp; Tab Tiến độ & kết quả; Kết quả học tập; Danh mục khóa HSK; Tải đề; Điểm danh; Cấu hình hệ thống | Ghi chú nội bộ “chờ chốt” hiển thị trên giao diện | Bỏ khỏi giao diện; chuyển sang sheet Câu hỏi mở. |
| 9 | Giáo viên – menu Điểm danh | Màn Điểm danh riêng với danh sách “Buổi gần đây (14 ngày)” | Bỏ: không làm menu Điểm danh riêng; GV điểm danh từ calendar / danh sách buổi (FUNC-034). |
| 10 | Lịch học; Danh sách buổi; Điểm danh | Trạng thái buổi “Chưa điểm danh” và “Hôm nay” | Giữ: đã bổ sung trạng thái Hôm nay / Chưa điểm danh vào mô tả FUNC-027, FUNC-028. |
| 11 | Popup chi tiết buổi học | Dòng “Điểm danh: x/y có mặt” | Giữ: đã bổ sung dòng “Điểm danh: x/y có mặt” vào mô tả FUNC-028. |
| 12 | Admin – Tài khoản chờ xếp lớp | Cột “Đồng ý cha mẹ” | Giữ: đã bổ sung cột “Đồng ý cha mẹ” (Đã xác nhận / Không áp dụng) vào mô tả FUNC-008; bỏ giá trị “Thiếu”, chặn trường hợp này tại FUNC-007. |
| 13 | Admin – Hồ sơ học viên | Trường “Đăng ký lúc” | Bỏ: không hiển thị trường “Đăng ký lúc” trong Hồ sơ học viên. |
| 14 | Học viên – Bài tập & kiểm tra | Nút “Xem bài nộp” | Giữ: đã bổ sung thao tác “Xem bài nộp” vào mô tả FUNC-052. |
| 15 | Superadmin – Cấu hình hệ thống | Trường “Múi giờ” | Bỏ: không hiển thị trường “Múi giờ” trong Cấu hình hệ thống. |
| 16 | Admin – Danh sách giáo viên | Tag “Admin” cạnh tên GV | Giữ: đã bổ sung tag “Admin” vào mô tả FUNC-006. |

**Chú ý:** không mặc định xóa một thành phần chỉ vì tài liệu đánh dấu *thừa* nếu trong code đã có chức năng thực tế được khách duyệt; cần đánh giá phạm vi tại thời điểm triển khai. Chỉ rõ sự khác nhau giữa demo-only controls và thành phần UX thật.
