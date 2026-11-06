# Development Roadmap — tách Phase 1 sản phẩm khỏi phase triển khai kỹ thuật

**Scope Phase 1** là phạm vi nghiệp vụ; **Build Step** bên dưới là thứ tự kỹ thuật nội bộ, không phải cam kết ngày bàn giao.

| Build Step | Module | Chức năng trọng tâm | Gate / phụ thuộc |
|---|---|---|---|
| 0 | Nền dự án | Repo, environment, lint/test, backend framework, prototype approved | Xác minh codebase hiện tại; stack chưa chốt |
| 1 | Auth & RBAC | FUNC-001–013, 078 (theo phần scope đã duyệt) | EMAIL guardian, account identifier, RBAC |
| 2 | Khóa & lớp | FUNC-014, 016–024, 077, 079 | 1 GV/lớp, 1 lớp đang học/HV, lịch sử enrollment |
| 3 | Lịch buổi | FUNC-026–032 | quy tắc hủy/bù và không auto Đã học |
| 4 | Điểm danh & tiến độ cơ bản | FUNC-034–037, 071–075 | 3 trạng thái, 30%, 2-day edit window |
| 5 | Ngân hàng đề & giao bài | FUNC-039–054 | file mẫu, format, các dạng câu, nộp lại/autosave |
| 6 | Chấm / công bố | FUNC-056, 058–064 | scoring TBD, grade audit, publish gate; **không FUNC-057** |
| 7 | Kiểm tra & tổng kết | FUNC-065, 068–070 | mẫu form, rubric/trọng số được chốt **đến module mới xử lý**; **không FUNC-076** |
| 8 | Thông báo in-app | FUNC-080 | quyền người nhận, sự kiện nguồn |
| 9 | Tích hợp / hardening | E2E, security, mobile, migration, backup, UAT | Tất cả module liên quan pass test |

## Chu kỳ triển khai từng module (Definition of Ready → Done)

1. **BA:** xác nhận phạm vi, actor, input, exception, business rule, nguồn, issues.
2. **UX:** prototype/flow được duyệt trước code UI chính thức.
3. **Tech design:** review schema, API, upload/security, migration, quyền backend.
4. **Acceptance:** viết test cases trước/sát khi code, tránh expected result dựa suy đoán.
5. **Implementation:** code theo nhánh feature nhỏ; review code; test tự động.
6. **UAT:** nghiệm thu theo FUNC + acceptance; ghi defects và decision change.

**TBD của grading/đề thi không chặn các build steps 0–4.** Nhưng cần giải quyết các TBD thuộc module trước khi code phần nghiệp vụ phụ thuộc.

## Git workflow tham khảo

`feature/<module>-<issue>` → commit có phạm vi → mở PR → CI (lint/typecheck/unit/e2e) → review → merge theo policy repo. Không tự rewrite lịch sử Git, tự push/merge hoặc deploy khi chưa được yêu cầu.
