# Definition of Ready / Definition of Done

## Ready — trước khi coding agent nhận module

- [ ] Các FUNC của task đã có phạm vi In/Dự kiến/Out rõ ràng.
- [ ] Đối chiếu Decision Log; nhận diện nội dung Excel đã bị override.
- [ ] Không có `BLOCKS` chưa giải quyết ảnh hưởng phần task dự kiến code.
- [ ] UI prototype/flow được xác nhận cho màn user-facing.
- [ ] Actor, permissions, input, output, state transitions, error cases rõ.
- [ ] Acceptance criteria và sample test data đủ cho chức năng tương ứng.
- [ ] Đã đọc code hiện tại, không chỉ dựa vào roadmap.

## Done — sau khi coding agent thực hiện

- [ ] Logic đúng theo đặc tả, không có business rule tự phát minh.
- [ ] Có database migration/test dữ liệu lịch sử nếu cần.
- [ ] Auth, object-level RBAC, negative tests pass.
- [ ] Unit/integration/e2e theo phạm vi pass hoặc có báo cáo hạn chế rõ ràng.
- [ ] UX responsive/mobile và các state error/loading/empty đúng.
- [ ] Không leak PII, đáp án/điểm chưa công bố; không còn nút demo prototype.
- [ ] Changelog / Decision Log / Open Issues cập nhật nếu task phát hiện vấn đề.
- [ ] Cập nhật source mapping mã FUNC trong PR description.
- [ ] Người phụ trách xác nhận nghiệm thu; **không chỉ dựa vào agent nói 'đã xong'**.
