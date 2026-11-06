# Acceptance Criteria & Test Framework

**Chưa phải bộ test case chính thức cho 71 chức năng.** Dưới đây là cấu trúc để sinh test đúng theo từng module sau khi giải quyết TBD tương ứng.

## Checklist bắt buộc cho mỗi FUNC

- [ ] `Given / When / Then` cho luồng thành công với input/output cụ thể.
- [ ] Input validation: thiếu/giá trị sai/duplicate/giới hạn/trạng thái không hợp lệ.
- [ ] RBAC: Student của người khác, Teacher ngoài lớp, Admin, Superadmin; kiểm tra backend (IDOR/BOLA).
- [ ] State transitions: chuyển trạng thái hợp lệ; chặn thao tác ở trạng thái không cho phép.
- [ ] Concurrency: 2 tab, double click, retry, transaction, idempotency ở các thao tác tài nguyên chung.
- [ ] Audit: lớp, lịch, điểm, công bố, account nếu liên quan.
- [ ] Dữ liệu lịch sử: chuyển lớp, hủy buổi, học bù, đổi điểm không làm mất lịch sử.
- [ ] Responsive/mobile/accessibility cho UI.
- [ ] Retry/offline/file edge cases cho chức năng được chọn, **không tự tạo rule chưa chốt**.
- [ ] Test bảo mật upload, visibility của điểm chưa publish, token/session ở luồng auth.

## Ví dụ tiêu chí có đủ căn cứ

| ID | Given | When | Then | FUNC |
|---|---|---|---|---|
| AC-CLASS-01 | Lớp có hơn 5 học viên và đủ điều kiện thêm | Admin thêm 1 học viên hợp lệ | Không chặn vì giới hạn '5 HV' | FUNC-020 |
| AC-CLASS-02 | HV đang học lớp A | Admin cố gán đồng thời lớp B đang hoạt động | Hệ thống không cho tạo 2 enrollment đang học; cần luồng chuyển lớp | FUNC-020/022 |
| AC-SCHED-01 | Buổi đã hết giờ nhưng GV chưa điểm danh | Hệ thống chạy job cập nhật trạng thái | Không tự chuyển thành 'Đã học' | FUNC-027 |
| AC-GRADE-01 | Điểm vừa được GV xác nhận nhưng chưa công bố | HV gọi API xem kết quả | Không thể lấy điểm/đáp án chưa publish | FUNC-059/060 |
| AC-GRADE-02 | Điểm đã công bố | Admin sửa điểm | Hệ thống lưu ai sửa, lúc nào, trước/sau | FUNC-061/064 |
| AC-AUTH-01 | HV 13 tuổi | Mở form đăng ký | Luồng yêu cầu phụ huynh/consent, dùng **email phụ huynh**, không bắt SĐT phụ huynh | FUNC-001/002 |

**Không tự viết expected score** cho multi-select, rubric, tổng kết, chuyên cần % trước khi chốt vấn đề liên quan.
