# WebEdu Design System & Tokens (`DESIGN.md`)
**Sản phẩm:** Hệ thống Quản trị Học tập Trung tâm TD Hán Ngữ  
**Định hướng thị giác:** Thanh lịch Á Đông, Màu xanh lá trúc (Oriental Bamboo Green), Tối giản (Minimalism), Chuẩn mực hiển thị chữ Hán & Bính âm (Pinyin).

---

## 1. Bảng Màu Sắc (Color Palette)

| Tên Token | Mã Hex | Vai trò trong hệ thống |
|---|---|---|
| `--color-primary-50` | `#f0fdf4` | Nền sáng, hover badge, trạng thái nhẹ |
| `--color-primary-100` | `#dcfce7` | Tag thành công, highlight bài nộp đạt |
| `--color-primary-500` | `#22c55e` | Trạng thái tích cực, nút phụ |
| `--color-primary-600` | `#16a34a` | Màu thương hiệu chủ đạo (Bamboo Green), nút hành động chính |
| `--color-primary-700` | `#15803d` | Hover nút chính, text điểm nhấn |
| `--color-primary-900` | `#14532d` | Header đậm, text tiêu đề Á Đông |
| `--color-neutral-bg` | `#f8fafc` | Nền tổng thể trang web (Slate 50) |
| `--color-surface` | `#ffffff` | Nền card, modal, bảng dữ liệu |
| `--color-border` | `#e2e8f0` | Viền chia khối thanh mảnh |
| `--color-text-main` | `#0f172a` | Chữ chính (Slate 900) độ tương phản cao |
| `--color-text-muted` | `#64748b` | Chữ chú thích, timestamp, pinyin phụ |

---

## 2. Hệ Thống Typography (Font Hỗ Trợ Đa Ngôn Ngữ)
- **Tiếng Việt & Giao diện:** `Inter`, system-ui, sans-serif.
- **Chữ Hán (Giản thể HSK) & Pinyin:** `Noto Sans SC`, `"PingFang SC"`, `"Microsoft YaHei"`, sans-serif.
- **Quy tắc cỡ chữ chữ Hán:** Chữ Hán trong bài tập và tài liệu học tập không bao giờ hiển thị nhỏ hơn `18px` (`text-lg`) để đảm bảo các nét chữ (chấm, phẩy, mác, sổ) không bị nhòe trên màn hình di động.

---

## 3. Quy Tắc Loại Bỏ Yếu Tố Prototype Demo (Production Cleanup Rules)
Tuân thủ nghiêm ngặt tài liệu `prototype-review.md`:
1. **Tuyệt đối cấm** thanh công cụ "Prototype · Xem với vai trò" trên đầu trang (Cleanup #1).
2. **Tuyệt đối cấm** khối "Tài khoản demo" và dòng "Thử lỗi" ở màn đăng nhập/đăng ký (Cleanup #2, #3).
3. **Tuyệt đối cấm** gắn các nhãn mã chức năng `FUNC-xxx` hoặc ghi chú nội bộ `chờ chốt` lên UI người dùng (Cleanup #6, #7, #8).
4. **Tuyệt đối cấm** nút "Dùng file mẫu luyen-nghe-hsk1-bo3.docx" (Cleanup #5).
5. **Giáo viên điểm danh trực tiếp** trên lịch/buổi học, không làm menu điểm danh riêng 14 ngày (Cleanup #9).
