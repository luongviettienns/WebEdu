# Business Rules — chuẩn hóa từ nguồn và quyết định mới

| Rule | Nội dung áp dụng | Mã chức năng | Trạng thái |
|---|---|---|---|
| BR-01-REV | Không giới hạn cứng sĩ số 5 học viên; số lượng tùy lớp. | FUNC-016, 020 | CONFIRMED (thay BR-01 gốc) |
| BR-02 | Quy tắc thu theo khóa / theo buổi tạm gác, không build payment. | — | DEFERRED/OUT-OF-SCOPE |
| BR-03 | GV chỉ truy cập lớp được phân công. | FUNC-011, 024 | CONFIRMED |
| BR-04 | Học viên tối thiểu 12 tuổi. | FUNC-001 | CONFIRMED |
| BR-05 | Các bài Mini-test / giữa kỳ / cuối kỳ thuộc quy trình kiểm tra. | FUNC-065, 068 | CONFIRMED nguyên tắc |
| BR-06 | HV chỉ được xem dữ liệu của chính mình. | FUNC-010, 063, 073 | CONFIRMED |
| BR-07-REV | Dưới 16 tuổi: phụ huynh/người giám hộ đăng ký thay, xác nhận đồng ý và sử dụng **email phụ huynh** (không SĐT phụ huynh). | FUNC-001, 002 | CONFIRMED; cơ chế email nhiều con TBD |
| BR-08 | Tâm tít có cả vai trò Admin và GV. | FUNC-009 | CONFIRMED |
| BR-09 | 1 lớp: 1 giáo viên phụ trách. | FUNC-018 | CONFIRMED |
| BR-10 | 1 HV học tối đa 1 lớp đang hoạt động cùng lúc; giữ lịch sử các lớp cũ. | FUNC-020, 022 | CONFIRMED |
| BR-11 | Buổi học không tự 'Đã học' khi chưa điểm danh; lịch hủy/bù bảo toàn lịch sử. | FUNC-027, 030, 031 | CONFIRMED |
| BR-12 | Điểm danh có 3 trạng thái: Có mặt/Vắng/Có phép. | FUNC-034 | CONFIRMED |
| BR-13 | GV sửa điểm danh giới hạn 2 ngày; Admin không giới hạn. | FUNC-037 | CONFIRMED, mốc thời gian TBD |
| BR-14 | Nộp bài chính thức 1 lần; GV có cơ chế cho nộp lại đặc biệt. | FUNC-054 | CONFIRMED, reset/reopen TBD |
| BR-15 | Chấm tự động câu có đáp án xác định; GV chấm tự luận. | FUNC-056, 058 | CONFIRMED |
| BR-16 | GV xác nhận điểm rồi mới công bố; chỉ sau công bố học viên được xem kết quả. | FUNC-059, 060 | CONFIRMED |
| BR-17 | Audit mọi lần sửa điểm; Admin có quyền sửa điểm. | FUNC-061, 064 | CONFIRMED |
| BR-18 | BTVN không vào tổng kết; mini-test/giữa kỳ/cuối kỳ là nguồn điểm tổng kết. | FUNC-069, 070 | CONFIRMED (công thức TBD) |

**Không tự mặc định:** thang điểm 100, làm tròn 1 chữ số, điểm từng câu 0.25, credit từng phần, tỷ lệ chuyên cần, tự nộp hết hạn khi offline, dừng timer khi mất kết nối. Một số xuất hiện trong Function List như đề xuất hoặc yêu cầu mô tả nhưng chưa có phê duyệt độc lập; xác nhận khi làm module.
