# AGENTS.md — Hợp đồng làm việc cho AI Coding Agent (TD Hán Ngữ)

> **Đọc `PROJECT_CONTEXT.md` trước bất cứ thay đổi code nào.** Đây là dự án WebEdu / TD Hán Ngữ, không được lấy logic từ dự án Kanban khác làm mặc định.

## 1. Bắt đầu một task

1. Xác định `FUNC-xxx` và module đang thực hiện từ `docs/02-requirements/function-catalog.md`.
2. Đọc `docs/01-business/decision-log.md`, `docs/01-business/open-issues.md`, module spec tương ứng, `business-rules.md`, `roles-permissions.md`.
3. Đọc codebase hiện tại và test thực tế; **không suy luận repo đã có module từ file roadmap**.
4. Lập kế hoạch với danh sách file sẽ sửa, migration, tác động quyền, kiểm thử, phụ thuộc.
5. Xác minh mọi `TBD/CONFLICT` thuộc module: nếu chặn logic cốt lõi, **dừng phần đó** và đưa câu hỏi cụ thể; các mục độc lập vẫn có thể tiếp tục.
6. Chỉ implement phần đã có đủ đầu vào và được chấp thuận về UX/logic.

## 2. Nguồn tài liệu

- Quyết định mới nhất > Decision Log > business/module specs > Excel nguồn > prototype > đề xuất agent.
- Văn bản từ Excel trong module đặt dưới heading **Nội dung Excel tham chiếu**; các đoạn này có thể chứa điều kiện cũ. Không áp dụng nguyên văn khi mâu thuẫn override.
- `FUNC-001` và `FUNC-002`: **email phụ huynh, KHÔNG SĐT phụ huynh**. Không tự quy định email login khi có 2 anh/chị em; ghi TBD.
- Công thức điểm, score đa lựa chọn, rubric và mẫu đề: **chưa chốt**; không dựng scoring cố định hoặc generator kỳ vọng 100% chính xác.

## 3. Quy tắc triển khai

- Thay đổi nhỏ theo module/feature; không viết lại kiến trúc tràn lan khi không được yêu cầu.
- Tách tầng validate DTO/input, business service, persistence; tránh business rules trong component React hoặc controller.
- Mọi hành động liên quan người dùng/lớp/học viên/bài làm phải kiểm tra quyền ở backend, chống IDOR/BOLA.
- Mọi dữ liệu lịch sử (điểm, bài nộp, chuyển lớp, đổi lịch) lưu có thể đối soát; tránh hard-delete bừa bãi.
- Với tính đúng đắn số buổi và điểm, sử dụng transaction/constraints phù hợp nếu có thay đổi liên bảng.
- File upload: xác minh loại file, dung lượng, xử lý lỗi; không tin vào MIME/filename người dùng cung cấp.
- Không đưa tài khoản demo, nút 'xem như vai trò', text debug 'FUNC-xxx' hay ghi chú nội bộ vào UI production.
- UX mobile, accessibility cơ bản, giao diện tối giản; thiết kế xanh lá là định hướng chứ không tự đặt brand color rồi coi đã duyệt.

## 4. Điều kiện bàn giao một feature

- Liệt kê mã FUNC, quyết định áp dụng và các `TBD` còn tồn tại.
- Cập nhật tài liệu module/decision log nếu có quyết định mới được người phụ trách xác nhận.
- Có test positive, negative, authorization (các vai trò), concurrency nếu có cạnh tranh (submit, chuyển lớp, đổi lịch).
- `lint`, `typecheck`, `unit/integration/e2e` tương ứng pass; nếu chưa có công cụ, nêu rõ giới hạn.
- Không chứa secret, token thật, file nội bộ không được phép commit; không tự push/merge/deploy nếu task không yêu cầu.
- Không báo 'Hoàn tất' nếu chỉ mock/prototype, chưa tích hợp backend hoặc chưa chạy test.

## 5. Trạng thái dùng trong công việc

- `CONFIRMED`: khách/người quản lý dự án đã chốt.
- `PROPOSED`: đề xuất cần duyệt, không mặc nhiên implement.
- `TBD`: chưa chốt, có thể chặn phần module liên quan.
- `TBD-DEFERRED`: chủ ý xử lý ở module sau, **không chặn các module độc lập**.
- `CONFLICT`: hai nguồn nói khác nhau, cần ưu tiên nguồn mới hoặc làm rõ.
- `OUT-OF-SCOPE`: không triển khai trong Phase 1.

## 6. Mẫu báo cáo kết thúc task

```text
Module / FUNC: ...
Đã implement: ...
Code & DB migrations: ...
Tests chạy: ...
Vấn đề chưa chốt (TBD): ...
Nghiệp vụ / bảo mật / regression cần lưu ý: ...
```
