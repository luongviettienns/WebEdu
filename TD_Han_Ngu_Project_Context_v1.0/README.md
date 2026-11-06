# Bộ Project Context — TD Hán Ngữ / WebEdu

**Phiên bản:** 1.0 · **Ngày tổng hợp:** 06/11/2026 · **Trạng thái:** DRAFT có kiểm soát (không thay thế phê duyệt của khách hàng)

Bộ tài liệu được tạo từ `references/Final.xlsx`, các quyết định bổ sung ngày 06/11/2026 và thông tin công khai từ repository `luongviettienns/WebEdu` (`README.md`, `PROJECT_PROGRESS.md`).

## Thứ tự đọc bắt buộc

1. [`PROJECT_CONTEXT.md`](PROJECT_CONTEXT.md) — bối cảnh, phạm vi, quy tắc, thứ tự ưu tiên nguồn.
2. [`AGENTS.md`](AGENTS.md) — giao ước bắt buộc với AI Coding Agent.
3. [`docs/01-business/decision-log.md`](docs/01-business/decision-log.md) — quyết định mới nhất, bao gồm thay SĐT phụ huynh bằng email.
4. [`docs/01-business/open-issues.md`](docs/01-business/open-issues.md) — TBD có chủ sở hữu module, **không chặn các module khác**.
5. [`docs/02-requirements/function-catalog.md`](docs/02-requirements/function-catalog.md) và [`docs/02-requirements/modules/`](docs/02-requirements/modules/) — chi tiết 71 mã chức năng.
6. [`docs/03-technical/technical-baseline.md`](docs/03-technical/technical-baseline.md) — baseline kỹ thuật và những thứ chưa xác minh.
7. [`docs/04-delivery/module-roadmap.md`](docs/04-delivery/module-roadmap.md) — quy trình giao từng module cho agent.

## Thành phần

- `docs/01-business/`: scope, business rules, RBAC, thực thể và open issues.
- `docs/02-requirements/modules/`: 10 file module, giữ nguyên mã FUNC và mô tả nguồn.
- `docs/02-requirements/`: catalog, tổng hợp review prototype và UI-only elements.
- `docs/03-technical/`: kiến trúc ở mức định hướng, tiêu chí bảo mật/chất lượng, guideline API/DB (không ngụy tạo thiết kế đã chốt).
- `docs/04-delivery/`: lộ trình module, checklist DoR/DoD, traceability.
- `references/`: bản Excel gốc và chỉ mục source-of-truth.

## Quy tắc an toàn khi sử dụng

**Không được coi mô tả nguồn Excel cũ là quy tắc mới hơn decision log.** Trong tài liệu module, phần trích nội dung gốc chỉ nhằm truy vết; nếu có xung đột, áp dụng `decision-log.md` và `PROJECT_CONTEXT.md`. Chức năng `TBD` không được tự triển khai nghiệp vụ theo suy đoán.

Không có thay đổi nào được ghi trực tiếp lên repository GitHub qua gói này. Để sử dụng, copy nội dung thư mục vào repo hoặc giao cho coding agent đọc thư mục.

**Thống kê:** 9 sheet Excel, 71 mã chức năng / 10 nhóm module, 51 câu hỏi nghiệp vụ (5 đang ghi Open trong Excel).
