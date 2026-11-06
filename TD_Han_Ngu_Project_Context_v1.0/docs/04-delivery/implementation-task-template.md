# Template giao một module cho Coding Agent

```markdown
# TASK — [Module] / [FUNC-xxx]

## Inputs
- PROJECT_CONTEXT.md
- AGENTS.md
- Decision Log + Open Issues
- docs/02-requirements/modules/[file].md
- Prototype đã duyệt / ảnh chụp hoặc link màn hình

## Scope
- Implement: [FUNC IDs]
- Not implement: [...]
- TBD deferred: [...] (nếu có, không được tự thay bằng default)

## Roles & Rules
- Actors và quyền đọc/sửa/xóa cụ thể
- Input/Output, validation, business invariants
- Negative cases, trạng thái/cạnh tranh

## Plan trước coding
1. Scan repo + test hiện tại
2. Đề xuất thay đổi schema/API/UI
3. Liệt kê các logic chưa chốt
4. Viết acceptance + test cases

## Deliverables
- Code + migration (nếu cần)
- Tests
- Tóm tắt file thay đổi & lệnh verify
- Các issue phát sinh/đề xuất, không tự nâng thành CONFIRMED
```

**Nguyên tắc:** giao task 1 module / nhóm FUNC liên quan; không yêu cầu AI viết cả 71 chức năng bằng một prompt.
