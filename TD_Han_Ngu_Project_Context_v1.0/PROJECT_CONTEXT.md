# PROJECT_CONTEXT — TD Hán Ngữ / WebEdu

**Updated:** 2026-11-06 | **Spec status:** Controlled draft / living documentation | **Primary language:** Vietnamese

## 1. Danh tính dự án

- **Tên sản phẩm/nghiệp vụ:** Hệ thống quản lý lớp học và học tập cho trung tâm TD Hán Ngữ.
- **Repository làm việc được người dùng cung cấp trước đó:** https://github.com/luongviettienns/WebEdu (nhánh mặc định `main`, public tại thời điểm kiểm tra).
- **Mô hình sản phẩm:** web nội bộ và portal học viên/giáo viên, **không** phải website tuyển sinh/marketing trong Phase 1.
- **Quy mô ban đầu được khách hàng nêu:** khoảng **10 người sử dụng**; chưa xác nhận mức đồng thời, dự báo tăng trưởng, SLA hoặc ngân sách.
- **Mô hình triển khai dự án:** 1 người trực tiếp phụ trách BA/PM/implementation, AI Coding Agent hỗ trợ; ưu tiên duyệt prototype trước khi code chức năng chính thức.
- **Hình ảnh thương hiệu dự kiến:** xanh lá, tối giản, gợi liên hệ văn hóa Trung Quốc. Đây là định hướng thiết kế đang nghiên cứu, **không phải** brand guideline/mã màu đã chốt.

## 2. Mục tiêu nghiệp vụ Phase 1

Tạo nền tảng phục vụ quản lý khóa HSK, lớp, giáo viên/học viên, lịch học, điểm danh, bài tập & kiểm tra trực tuyến, chấm/công bố điểm, tiến độ học và thông báo trong web. Dữ liệu từng học viên/lớp phải được phân tách theo quyền từ backend.

### Trong phạm vi (theo Final.xlsx)

1. Tài khoản & RBAC; học viên tự đăng ký, chờ xếp lớp.
2. Khóa HSK1–HSK4 theo HSK 3.0 và Giao tiếp cơ bản; cấu hình khóa/lớp.
3. Lớp học: tạo/sửa/phân công 1 giáo viên, thêm/chuyển/rút học viên, lịch sử lớp.
4. Lịch học/đổi/hủy/bù, điểm danh, theo dõi buổi học và ngày kết thúc.
5. Bài tập về nhà và bài kiểm tra làm trên web; ngân hàng đề Word/PDF và tạo/chỉnh sửa câu hỏi.
6. Các dạng câu: một/nhiều đáp án, điền từ, sắp xếp câu, tự luận, audio, ảnh.
7. Chấm câu có đáp án xác định bằng thuật toán; giáo viên chấm tự luận; xác nhận điểm và công bố ở hai bước riêng.
8. Mini-test, giữa kỳ, cuối kỳ; chuyên cần, tiến độ và thông báo trong ứng dụng.

### Ngoài phạm vi Phase 1

- Tuyển sinh, landing page khách tiềm năng, form lead/đăng ký tuyển sinh.
- Tài khoản phụ huynh riêng; phụ huynh tiếp tục trao đổi qua Zalo, riêng việc hỗ trợ đăng ký cho con dưới 16 tuổi là một **luồng** của học viên.
- Thu học phí online.
- AI/LLM chấm tự luận (`FUNC-057`), nhập điểm bài làm trên giấy (`FUNC-076`).
- Email/Zalo notification marketing/integration (khác với email phục vụ đăng ký/khôi phục tài khoản); thông báo nghiệp vụ ở Phase 1 là in-app.
- Các tính năng chỉ dùng để demo prototype được liệt kê trong tài liệu review.

## 3. Vai trò và quyền nền tảng

- **Học viên:** xem hồ sơ, lớp và dữ liệu học tập của **chính mình**; làm/nộp bài được giao; xem điểm sau công bố.
- **Giáo viên:** chỉ truy cập lớp được phân công; làm việc với bài tập/điểm danh/chấm và công bố theo quyền chi tiết từng chức năng.
- **Admin:** xem mọi lớp; vận hành nghiệp vụ; được sửa điểm và sửa điểm danh theo quyết định của khách hàng.
- **Superadmin:** vận hành hệ thống, quản lý Admin và cấu hình cơ bản tên trung tâm/logo theo nguồn.
- **Tài khoản nhiều vai trò:** theo `FUNC-009`, quyền hiệu lực **dựa trên vai trò cao hơn**, ví dụ Admin đồng thời là GV → quyền Admin; cần kiểm tra chính sách áp dụng đối với endpoint nhạy cảm trước khi triển khai.

Ma trận CRUD đầy đủ **chưa được khách hàng ký duyệt**; xem `docs/01-business/roles-permissions.md`.

## 4. Quy tắc được xác nhận đáng chú ý

- Lớp **không giới hạn cứng 5 học viên**. Sheet `Quy tắc` BR-01 còn ghi câu cũ; đã bị thay thế bởi `Chức năng!B6` và Câu hỏi mở #9.
- Lớp có **1 giáo viên phụ trách, không có trợ giảng** (Q24); 1 học viên **chỉ đang học 1 lớp tại một thời điểm** (Q25).
- Học viên tuổi tối thiểu 12; dưới 16 tuổi có luồng phụ huynh đăng ký thay và xác nhận đồng ý (BR-04, BR-07, Q21), nhưng **email phụ huynh thay SĐT phụ huynh** theo quyết định mới 06/11/2026.
- Học viên chuyển lớp: dữ liệu lịch sử lớp cũ giữ nguyên, học lớp mới theo lịch mới (Q12, Q50).
- Không tự chuyển buổi thành 'Đã học' chỉ vì hết giờ nếu GV chưa điểm danh (Q26).
- Hủy không bù: không tự phát sinh buổi khác ở cuối khóa (Q27). Buổi bù được tính thay cho buổi hủy, không cộng trùng tổng buổi (Q28).
- Điểm danh: Có mặt / Vắng / Có phép (Q29); cảnh báo vắng khi chạm 30% tổng buổi theo quyết định Q30 nhưng mẫu số và 'Có phép' cần chốt khi làm attendance.
- GV được sửa điểm danh trong vòng 2 ngày, Admin không giới hạn thời điểm (Q31–32); cần chốt mốc tính chính xác.
- Mỗi bài thông thường có một lần nộp chính thức, GV có thể mở lại khi cần (Q14, Q48); tái nộp giữ dữ liệu hay làm mới là TBD trong module.
- Phần tự chấm là **rule-based**, không cần AI; tự luận do GV chấm; HV chỉ thấy điểm sau GV **xác nhận rồi công bố** (Q16, Q40, Q41).
- Admin được sửa điểm, phải có audit log chỉnh sửa (Q34, Q49).
- BTVN dùng cho chuyên cần, không vào điểm tổng kết; điểm tổng kết lấy Mini-test / giữa kỳ / cuối kỳ, nhưng **công thức, trọng số và rubric để sau** (Q17, Q36, Q44).

## 5. Quyết định quan trọng mới nhất (override Excel)

1. **06/11/2026 — EMAIL PHỤ HUYNH:** Luồng học viên dưới 16 tuổi sử dụng email phụ huynh **thay số điện thoại phụ huynh**. Các dòng nguồn cũ trong `FUNC-001/002`, prototype và câu trả lời Q21 nhắc 'SĐT cha mẹ' đều là lịch sử đã bị thay đổi. Chưa tự quyết định email người giám hộ có đồng thời là email đăng nhập hay không, và cách dùng chung cho nhiều con.
2. **06/11/2026 — DEFER BY MODULE:** Công thức tính điểm, scoring chi tiết, rubric và mẫu đề Word/PDF được ghi `TBD-DEFERRED`, xử lý **khi bắt đầu module liên quan**, không chặn lập trình module không phụ thuộc.
3. **06/11/2026 — NO INVENTED RULES:** AI chỉ code theo quyết định đã chốt; đề xuất kỹ thuật và dữ liệu prototype không có nghĩa là khách đã duyệt nghiệp vụ.

Xem đầy đủ `docs/01-business/decision-log.md` và `docs/01-business/open-issues.md`.

## 6. Thứ tự ưu tiên nguồn (source of truth)

1. Quyết định trực tiếp mới nhất do người phụ trách dự án/khách hàng xác nhận và ghi rõ ngày.
2. `docs/01-business/decision-log.md` sau khi cập nhật từ các quyết định đã xác nhận.
3. Đặc tả module `docs/02-requirements/modules/*.md` phần **Áp dụng / Override** và `docs/01-business/business-rules.md`.
4. Nội dung `references/Final.xlsx` (đặc biệt Function List + Câu hỏi mở Closed) để truy vết; không lấy quy tắc đã bị thay thế.
5. Review prototype (tham khảo UI, **không phải** kiểm chứng production/code/backend).
6. Gợi ý kỹ thuật, code do AI sinh ra (thấp nhất; không thể thay business decision).

**Nếu hai nguồn cùng cấp mâu thuẫn:** đánh dấu `CONFLICT/TBD`, yêu cầu chốt khi đến module; không im lặng tự chọn.

## 7. Trạng thái kỹ thuật và repo

- README của repo khai báo **backend NestJS** và **frontend Web Client** tách nhau; không có cơ sở xác minh frontend framework, ORM hay database đã triển khai từ các tài liệu này.
- `PROJECT_PROGRESS.md` trong repo ghi Phase 0 thiết lập repo, và khung backend/frontend là các bước dự kiến. Đây là **nội dung file tiến độ**, không thay thế lệnh kiểm tra code/branch hiện tại.
- Stack chính xác, schema DB, API routes, kiến trúc deploy và chính sách tích hợp cần được kiểm tra/chốt trước coding module tương ứng.
- Không tự áp dụng stack từ **dự án QuanLyCongViec** sang WebEdu; đó là dự án khác.

## 8. Quy trình cộng tác BA/PM và Agent

`Final.xlsx → Decision Log / Open Issues → Prototype duyệt → Functional Spec của module → Thiết kế kỹ thuật module → Test cases / Acceptance → Code → Kiểm thử quyền / negative cases → Review / Merge`.

Không trộn 'Phase 1 phạm vi sản phẩm' với 'phase kỹ thuật của repo'; xem `docs/04-delivery/module-roadmap.md`.

## 9. Ngưỡng hoàn tất / nguyên tắc bất biến

- Mọi API đọc/sửa tài nguyên lớp, bài, điểm phải kiểm soát quyền **server-side** (không chỉ ẩn nút frontend).
- Không mất/chuyển sai lịch sử khi chuyển lớp/hủy-bù buổi/sửa điểm.
- Một bài không thể nộp chính thức hai lần do double click hoặc nhiều tab nếu chưa được mở lại có kiểm soát.
- Điểm chưa công bố không lọt sang dữ liệu học viên qua API.
- Chức năng `Ngoài phạm vi` không được tự bổ sung.
- **Không coi tỷ lệ score, thang điểm, nội dung đề chưa chốt là default sản phẩm.**

## 10. Tham chiếu nhanh

- `AGENTS.md` — cách AI vận hành trong codebase.
- `docs/01-business/open-issues.md` — module/blockers.
- `docs/02-requirements/function-catalog.md` — tất cả FUNC.
- `docs/03-technical/technical-baseline.md` — baseline kỹ thuật.
- `docs/04-delivery/module-roadmap.md` — ưu tiên triển khai.
