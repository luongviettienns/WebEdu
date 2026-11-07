# WebEdu Design System & Tokens (`DESIGN.md`)
**Sản phẩm:** Hệ thống Quản trị Học tập Trung tâm TD Hán Ngữ  
**Định hướng thị giác:** Thư họa Á Đông (Oriental Calligraphy & Paper-Ink Aesthetic), Nền giấy dó sáng, Chữ mực tàu, Điểm nhấn son triện đỏ 朱砂, Tối giản, Chuẩn mực hiển thị chữ Hán & Bính âm (Pinyin).

---

## 1. Bảng Màu Sắc Chuẩn Xác Theo Prototype (`prototype/TD Hán Ngữ (Copy).html`)

| Tên Token | Biến CSS | Mã Hex | Vai trò trong hệ thống |
|---|---|---|---|
| **Giấy dó sáng** | `--paper` | `#F5F6F2` | Nền tổng thể toàn bộ trang web (thay thế slate-50) |
| **Mặt phẳng chính** | `--surface` | `#FFFFFF` | Nền Card, Modal, Drawer, Table |
| **Mặt phẳng phụ** | `--surface-2` | `#F0F1EB` | Nền nút chọn phụ, segment control, hover nhẹ |
| **Màu hover** | `--hover` | `#EBEDE6` | Nền khi hover trên hàng bảng và menu |
| **Đường viền mỏng** | `--line` | `#E2E4DC` | Viền chia khối thanh nhã 1px |
| **Đường viền phân cách** | `--line-2` | `#CDD1C6` | Viền đậm hơn cho tab và phân nhóm |
| **Mực tàu đậm** | `--ink` | `#1C2320` | Chữ chính (WCAG AA tương phản 13.8:1 trên giấy dó) |
| **Mực tàu trung tính** | `--ink-2` | `#4A524C` | Nhãn form, icon thanh mảnh, menu phụ |
| **Mực tàu nhạt** | `--ink-3` | `#7A817B` | Chú thích, timestamp, pinyin phụ |
| **Son triện đỏ (朱砂)** | `--red` | `#B5322A` | Màu thương hiệu chủ đạo, con dấu `.seal`, active marker |
| **Son triện đậm** | `--red-ink` | `#9C2A23` | Chữ trên nền hồng son nhẹ |
| **Hồng son nhẹ** | `--red-soft` | `#F8E8E5` | Nền menu item đang chọn (active nav pill) |
| **Ngọc bích (Jade)** | `--jade` | `#2B7760` | Trạng thái tích cực, Đang học, Đã điểm danh |
| **Ngọc bích nhẹ** | `--jade-soft` | `#E3F1EA` | Nền badge ngọc bích |
| **Xanh chàm (Indigo)**| `--blue` | `#31578A` | Trạng thái thông tin, focus-visible ring |
| **Xanh chàm nhẹ** | `--blue-soft` | `#E6EDF6` | Nền badge thông tin |
| **Hổ phách (Amber)** | `--amber` | `#9A6410` | Cảnh báo, Chờ xếp lớp, Hôm nay |
| **Hổ phách nhẹ** | `--amber-soft` | `#FAEFD9` | Nền badge hổ phách |

---

## 2. Hệ Thống Typography (Font Hỗ Trợ Đa Ngôn Ngữ)
- **Tiếng Việt & Giao diện:** `Be Vietnam Pro` (qua `next/font/google`, `display: swap`).
- **Chữ Hán (Hànzì / Pinyin):** Stack font có chân thư pháp cổ điển bản địa: `"Noto Serif SC", "Source Han Serif SC", "Songti SC", "STSong", "SimSun", serif`.
- **Quy tắc hiển thị chữ Hán:** Chữ Hán trong bài tập và tài liệu học tập có class `.han` không bao giờ hiển thị nhỏ hơn `18px` (`text-lg`) để đảm bảo các nét chữ (chấm, phẩy, mác, sổ) không bị nhòe trên màn hình di động.
- **Số liệu & Thống kê:** Bắt buộc áp dụng `font-variant-numeric: tabular-nums` (class `.num`) cho toàn bộ bảng điểm, số điện thoại, ngày sinh và metrics.

---

## 3. Thành Phần Bản Sắc Thị Giác (Brand Signature Visual Elements)
- **Con dấu son triện (`.seal`):** Khối vuông bo góc 5px màu đỏ `--red`, viền kép lõm, chữ `[TD]` thư pháp vàng nhạt.
- **Họa tiết hồi văn Á Đông (`.fret`):** Dải hoa văn SVG lặp thanh lịch ở chân Sidebar.
- **Đại tự chữ Hán `學` & Trích dẫn Luận Ngữ:** Điểm nhấn mỹ thuật ở cột trái màn hình đăng nhập.

---

## 4. Quy Tắc Loại Bỏ Yếu Tố Prototype Demo (16 Hạng Mục Excel Final)
1. **Tuyệt đối cấm** thanh công cụ "Prototype · Xem với vai trò" trên đầu trang (Cleanup #1).
2. **Tuyệt đối cấm** khối "Tài khoản demo" và dòng "Thử lỗi" ở màn đăng nhập/đăng ký (Cleanup #2, #3).
3. **Tuyệt đối cấm** gắn các nhãn mã chức năng `FUNC-xxx` hoặc ghi chú nội bộ `chờ chốt` lên UI người dùng (Cleanup #6, #7, #8).
4. **Tuyệt đối cấm** nút "Dùng file mẫu luyen-nghe-hsk1-bo3.docx" (Cleanup #5).
5. **Giáo viên điểm danh trực tiếp** trên lịch/buổi học, không làm menu điểm danh riêng 14 ngày (Cleanup #9).
6. **Bảo toàn 6 thành phần nghiệp vụ:** Cột Đồng ý cha mẹ (#12), Tag Admin cạnh tên GV (#16), Trạng thái Hôm nay / Chưa điểm danh (#10), Điểm danh x/y (#11), Thao tác Xem bài nộp (#14), Cập nhật thương hiệu thời gian thực.
