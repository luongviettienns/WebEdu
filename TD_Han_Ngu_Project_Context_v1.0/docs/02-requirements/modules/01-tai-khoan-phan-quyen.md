# Module 01 — Tài khoản & phân quyền

**Tên kỹ thuật:** Identity & Access  
**Số yêu cầu:** 14  
**Nguồn:** Final.xlsx > `Function List `; quyết định mới tại `docs/01-business/decision-log.md` có độ ưu tiên cao hơn.

## Điều kiện và override trước khi code

- Email guardian override ngày 06/11 là bắt buộc, bất chấp mô tả Excel cũ.
- Khác nhau giữa email đăng nhập HV và email liên hệ phụ huynh là blocker trước khi code màn đăng ký.
- RBAC kiểm soát ở backend, multi-role theo quyền cao nhất; không có role phụ huynh riêng.

**Mọi phần trích nguồn dưới đây là tài liệu truy vết, không tự chứng minh quy tắc đã duyệt. Đoạn nào xung đột thì chỉ thực hiện theo phần OVERRIDE và Decision Log.**

## Chức năng

### FUNC-001 — Học viên tự đăng ký

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 4`; Câu hỏi mở #8; Vai trò!5–6; Câu hỏi mở #21

**OVERRIDE 06/11/2026:** Đối với HV dưới 16 tuổi, **thay SĐT cha mẹ bằng email cha mẹ**. Các câu trong mô tả Excel yêu cầu SĐT cha mẹ là thông tin cũ, **KHÔNG còn hiệu lực**. Chưa tự quyết định email cha mẹ trùng với email đăng nhập của học viên hay trường riêng, hoặc SĐT học viên còn bắt buộc/duy nhất hay không (AUTH-01/02).

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt HV < 16 tuổi do cha mẹ đăng ký bằng SĐT của cha mẹ (#21). Cần chốt: SĐT đang bắt buộc duy nhất, cha mẹ có 2 con cùng học thì đăng ký thế nào.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép người chưa có tài khoản tự tạo tài khoản Học viên để truy cập hệ thống.
- Sau khi đăng ký, tài khoản ở trạng thái “Chờ xếp lớp” cho đến khi Admin liên kết vào lớp (FUNC-008).
- Không có tài khoản phụ huynh riêng / form tuyển sinh (ngoài phạm vi Phase 1). HV dưới 16 tuổi do cha mẹ đăng ký thay, dùng SĐT của cha mẹ (FUNC-002, Câu hỏi mở #21).
2. Trường thông tin
- Họ và tên: text, bắt buộc, tối đa 100 ký tự
- Ngày sinh: date, bắt buộc
- Số điện thoại: bắt buộc, 10 chữ số, bắt đầu bằng 0, duy nhất; HV < 16 tuổi nhập SĐT của cha mẹ (FUNC-002)
- Email: bắt buộc, đúng định dạng email, duy nhất
- Mật khẩu: bắt buộc, tối thiểu 8 ký tự
- Xác nhận mật khẩu: bắt buộc, phải trùng Mật khẩu
- Checkbox đồng ý của cha mẹ: hiển thị có điều kiện (FUNC-002)
- Nút “Đăng ký”; link “Đã có tài khoản? Đăng nhập”
3. Rule hiển thị / Format
- Ngày sinh: dd/mm/yyyy, chọn bằng date picker
- Validate tuổi theo BR-04 (học viên từ 12 tuổi):
   + Tuổi < 12: chặn đăng ký, lỗi “Học viên phải từ 12 tuổi trở lên”
   + 12 ≤ tuổi < 16: cha mẹ đăng ký thay con bằng SĐT của cha mẹ, hiển thị checkbox đồng ý của cha mẹ (FUNC-002)
- Email/SĐT đã tồn tại: lỗi “Email/Số điện thoại đã được sử dụng”
- Mật khẩu hiển thị dạng ẩn ••••, có icon ẩn/hiện
- Lỗi validate hiển thị ngay dưới trường, chữ đỏ
- Đăng ký thành công: thông báo “Đăng ký thành công. Vui lòng chờ trung tâm xếp lớp” → chuyển về màn Đăng nhập
- Dùng Email làm tên đăng nhập

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 4`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-002 — Đồng ý của cha mẹ khi đăng ký

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 5`; Quy tắc BR-07; Câu hỏi mở #21

**OVERRIDE 06/11/2026:** Hiển thị và lưu **email cha mẹ/người giám hộ**, không yêu cầu SĐT phụ huynh. Nguyên tắc consent vẫn giữ; văn bản đồng ý và quy tắc xác minh email chờ chốt ở AUTH-03.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt cách làm: cha mẹ đăng ký thay con bằng SĐT của cha mẹ (#21). Nội dung câu thông báo đồng ý và cam kết bảo vệ dữ liệu vẫn chưa có.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- HV dưới 16 tuổi: cha mẹ/người giám hộ đăng ký tài khoản cho con, dùng SĐT của cha mẹ làm SĐT của tài khoản (Câu hỏi mở #21).
- Cha mẹ xác nhận đồng ý trước khi tạo tài khoản (BR-07).
- Hệ thống lưu vết xác nhận để đối soát.
2. Trường thông tin
- Số điện thoại: khi HV < 16 tuổi, nhãn trường đổi thành “Số điện thoại của cha mẹ/người giám hộ”
- Checkbox “Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ”: boolean, bắt buộc khi HV < 16 tuổi
- Dữ liệu lưu kèm (không hiển thị cho HV):
   + Giá trị xác nhận (Có/Không)
   + Thời điểm xác nhận
   + Phiên bản nội dung thông báo đã hiển thị
3. Rule hiển thị / Format
- Tuổi tính theo Ngày sinh so với ngày hiện tại:
   + 12 ≤ tuổi < 16: hiển thị checkbox, bắt buộc tick mới cho nhấn Đăng ký
   + Tuổi ≥ 16 hoặc chưa nhập Ngày sinh: ẩn checkbox
- Đổi Ngày sinh: checkbox ẩn/hiện lại theo tuổi mới, reset trạng thái tick
- Không tick khi bắt buộc: lỗi “Vui lòng xác nhận đã có sự đồng ý của cha mẹ”
- Trong Hồ sơ HV (FUNC-007), Admin thấy: “Đã xác nhận đồng ý của cha mẹ – dd/mm/yyyy HH:mm”
- [Chờ chốt] nội dung câu thông báo pháp lý và nghĩa vụ bảo vệ dữ liệu

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 5`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-003 — Đăng nhập hệ thống

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Tất cả vai trò
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 6`; Câu hỏi mở #3, #8; Vai trò!2–6

**KIỂM TRA MÂU THUẪN:** FUNC-001 nói 'dùng Email làm tên đăng nhập', FUNC-003 có 'Email hoặc SĐT', và FUNC-009 áp dụng role cao nhất thay vì role gần nhất. Chưa mặc định bật SĐT login hoặc role-switch làm thay đổi backend authorization.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Hình thức đăng nhập cụ thể do đội kỹ thuật đề xuất.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Học viên, Giáo viên, Admin, Superadmin đăng nhập bằng tài khoản đã đăng ký/được cấp.
- Sau đăng nhập, điều hướng tới màn hình mặc định theo vai trò.
2. Trường thông tin
- Tên đăng nhập (Email hoặc SĐT): bắt buộc
- Mật khẩu: bắt buộc
- Checkbox “Ghi nhớ đăng nhập” 
- Link “Quên mật khẩu?” (FUNC-005)
- Link “Đăng ký” (dành cho Học viên – FUNC-001)
- Nút “Đăng nhập”
3. Rule hiển thị / Format
- Mật khẩu ẩn dạng ••••, có icon ẩn/hiện
- Sai thông tin: “Tên đăng nhập hoặc mật khẩu không đúng” (không chỉ rõ sai trường nào)
- Tài khoản bị vô hiệu hóa: “Tài khoản đã bị khóa, vui lòng liên hệ trung tâm”
- Điều hướng sau đăng nhập:
   + Học viên → Tình trạng học cá nhân (FUNC-073)
   + Giáo viên → Danh sách lớp phụ trách (FUNC-024)
   + Admin/Superadmin → Tổng quan các lớp (FUNC-075)
   + User nhiều vai trò → vai trò dùng gần nhất, chuyển được theo FUNC-009
- HV trạng thái “Chờ xếp lớp”: vẫn đăng nhập được, hiển thị “Bạn chưa được xếp lớp. Vui lòng liên hệ trung tâm”
- Khóa tạm 15 phút sau 5 lần nhập sai liên tiếp

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 6`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-004 — Đăng xuất

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đề xuất
- **Vai trò ghi nhận:** Tất cả vai trò
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 7`; Suy ra từ yêu cầu đăng nhập

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Chi tiết chuẩn về bảo mật tài khoản; không phải yêu cầu khách nêu riêng.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép người dùng kết thúc phiên đăng nhập hiện tại.
2. Trường thông tin
- Menu tài khoản (avatar + tên user, góc trên bên phải) → mục “Đăng xuất”
3. Rule hiển thị / Format
- Hiển thị ở mọi màn hình sau đăng nhập, mọi vai trò
- Click Đăng xuất: hủy phiên, quay về màn Đăng nhập
- HV đang làm bài: popup “Bài làm đã được lưu nháp. Bạn có chắc muốn đăng xuất?” (Đăng xuất / Hủy)
- Sau đăng xuất, bấm Back trên trình duyệt không truy cập lại được trang yêu cầu đăng nhập
- Timeout sau 60 phút không có hoạt động hợp lệ. Hiển thị cảnh báo trước khi tự động đăng xuất 5 phút.

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 7`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-005 — Khôi phục mật khẩu

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Tất cả vai trò
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 8`; Thông lệ bảo mật/khả dụng; Câu hỏi mở #45

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt khôi phục mật khẩu qua email, không làm OTP SĐT (#45).

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép người dùng quên mật khẩu tự đặt lại mật khẩu mới qua link gửi tới Email đã đăng ký (Câu hỏi mở #45: làm qua email, không dùng OTP SĐT).
2. Trường thông tin
- Bước 1 – Yêu cầu:
   + Email đã đăng ký: bắt buộc
   + Nút “Gửi yêu cầu”
- Bước 2 – Đặt lại (mở từ link trong email):
   + Mật khẩu mới, Xác nhận mật khẩu mới: bắt buộc
   + Nút “Lưu mật khẩu”
3. Rule hiển thị / Format
- Bước 1 luôn hiển thị cùng một thông báo “Nếu tài khoản tồn tại, hướng dẫn đã được gửi” (không tiết lộ tài khoản có tồn tại hay không)
- Link reset hết hạn sau 15 phút, hết hạn: “Link đã hết hạn, vui lòng gửi lại”
- Nút “Gửi lại mã” chỉ enable sau 60 giây, hiển thị đếm ngược “Gửi lại sau 59s”
- Mật khẩu mới theo cùng rule ở FUNC-001
- Thành công: “Đặt lại mật khẩu thành công” → chuyển về Đăng nhập
- Gửi link reset qua email đã được nhập ở Bước 1

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 8`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-006 — Quản lý tài khoản giáo viên

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Cần xác nhận
- **Vai trò ghi nhận:** Admin; Superadmin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 9`; Thực thể!2; Chức năng!3

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Hình thức tạo tài khoản giáo viên chưa được nêu trong sheet.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin/Superadmin tạo, xem, cập nhật, vô hiệu hóa/kích hoạt lại tài khoản Giáo viên.
- Không xóa vĩnh viễn tài khoản GV đã có dữ liệu lớp/bài/điểm.
2. Trường thông tin
- Danh sách GV:
   + STT, Họ tên, SĐT, Email, Số lớp đang phụ trách, Trạng thái, Thao tác (Xem / Sửa / Vô hiệu hóa)
- Form tạo/sửa GV:
   + Họ và tên: bắt buộc, tối đa 100 ký tự
   + SĐT: bắt buộc, 10 chữ số
   + Email: bắt buộc, duy nhất
   + Mật khẩu khởi tạo: bắt buộc khi tạo – [Gửi link kích hoạt hoạt tài khoản qua email đã nhập ở trên]
   + Trạng thái: Đang hoạt động / Vô hiệu hóa
   + Ghi chú: tùy chọn
3. Rule hiển thị / Format
- Danh sách mặc định sắp xếp theo Họ tên A–Z; tìm theo tên/SĐT/email; lọc theo Trạng thái
- Tag trạng thái: Đang hoạt động (xanh lá), Vô hiệu hóa (xám)
- GV kiêm vai trò Admin (FUNC-009): hiển thị tag “Admin” cạnh Họ tên
- Vô hiệu hóa GV đang phụ trách lớp: popup “Giáo viên đang phụ trách [n] lớp. Vui lòng phân công giáo viên khác” và chặn thao tác 
- GV bị vô hiệu hóa: không đăng nhập được, không xuất hiện trong dropdown phân công GV
- Phân trang 20 dòng/trang

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 9`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-007 — Quản lý thông tin học viên

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Cần xác nhận
- **Vai trò ghi nhận:** Admin; Superadmin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 10`; Thực thể!3; Chức năng!5

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Phạm vi trường dữ liệu, quyền sửa, xử lý học viên dưới 16 tuổi (BR-07) cần chốt.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin xem danh sách và hồ sơ chi tiết học viên, cập nhật thông tin quản lý, vô hiệu hóa/kích hoạt tài khoản.
2. Trường thông tin
- Danh sách HV:
   + STT, Họ tên, Ngày sinh, SĐT, Email, Lớp đang học, Trạng thái tài khoản, Thao tác
- Hồ sơ chi tiết:
   + Thông tin cá nhân: Họ tên, Ngày sinh, Tuổi (tự tính), SĐT, Email
   + Xác nhận đồng ý của cha mẹ (nếu < 16 tuổi khi đăng ký)
   + Lớp đang học và Lịch sử lớp đã học (FUNC-023)
   + Trạng thái tài khoản: Chờ xếp lớp / Đang hoạt động / Vô hiệu hóa
   + Ghi chú nội bộ (chỉ Admin thấy)
3. Rule hiển thị / Format
- Ngày sinh dd/mm/yyyy; Tuổi là số nguyên
- Tìm theo tên/SĐT/email; lọc theo Lớp, Trạng thái
- Tag trạng thái: Chờ xếp lớp (cam), Đang hoạt động (xanh lá), Vô hiệu hóa (xám)
- Không có xóa vĩnh viễn HV đã có dữ liệu học tập
- Admin được sửa tất cả các trường, riêng trường Ngày sinh sẽ bị khóa sau khi đã xác nhận đồng ý của cha mẹ (đối với HV < 16 tuổi)
- HV chưa có xác nhận đồng ý của cha mẹ: nếu Ngày sinh mới làm tuổi tại thời điểm đăng ký < 16, chặn lưu và báo lỗi “Không thể sửa ngày sinh: học viên dưới 16 tuổi cần xác nhận đồng ý của cha mẹ khi đăng ký”

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 10`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-008 — Liên kết tài khoản với hồ sơ và lớp

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Cần xác nhận
- **Vai trò ghi nhận:** Admin; Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 11`; Câu hỏi mở #8; Vai trò!5–6

**GIỮ CORE:** Admin gắn HV đã đăng ký vào lớp; không tự thêm một workflow xét duyệt nhiều bước. Note Excel '> không cần' không đồng nghĩa bỏ chức năng xếp lớp; mức phê duyệt bổ sung TBD.

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần chốt quy trình duyệt/tham gia lớp; tránh tự chọn lớp trái phép. > không cần

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin gắn tài khoản HV tự đăng ký vào lớp học. Chỉ sau khi được gắn lớp, HV mới thấy lịch, bài tập, điểm của lớp.
- HV không được tự chọn lớp.
2. Trường thông tin
- Danh sách “Tài khoản chờ xếp lớp”:
   + Họ tên, Ngày sinh, SĐT, Email, Ngày đăng ký, Đồng ý cha mẹ, Thao tác “Xếp lớp”
- Popup Xếp lớp:
   + Lớp: dropdown, bắt buộc, chỉ lớp trạng thái Sắp khai giảng/Đang học
   + Ngày vào lớp: date, bắt buộc, mặc định = ngày hiện tại (rule như FUNC-020)
   + Nút Xác nhận / Hủy
3. Rule hiển thị / Format
- Ngày đăng ký dd/mm/yyyy HH:mm; sắp xếp mới nhất lên đầu
- Cột Đồng ý cha mẹ (theo FUNC-002):
   + Đã xác nhận: HV < 16 tuổi khi đăng ký và đã tick xác nhận
   + Không áp dụng: HV ≥ 16 tuổi khi đăng ký
- Badge số lượng tài khoản chờ xếp lớp trên menu Admin
- Xếp lớp thành công: trạng thái tài khoản → Đang hoạt động; HV biến khỏi danh sách chờ
- Phía HV khi chưa được xếp lớp: menu Lớp/Bài tập/Điểm hiển thị empty state “Bạn chưa được xếp lớp. Vui lòng liên hệ trung tâm”

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 11`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-009 — Một người dùng nhiều vai trò

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin; Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 12`; Quy tắc BR-08

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Cần Dev xác nhận

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

Với user có nhiều vai trò, hệ thống áp dụng quyền theo role cao hơn (VD vừa là admin vừa là giáo viên > lấy theo quyền admin)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 12`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-010 — Học viên chỉ xem dữ liệu của mình

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Học viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 13`; Quy tắc BR-06; Vai trò!5

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Yêu cầu bắt buộc tại backend.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Đảm bảo Học viên chỉ xem được thông tin, lịch, điểm danh, bài làm, điểm, nhận xét và lịch sử của chính mình (BR-06).
2. Trường thông tin
- Không có trường nhập. Áp dụng cho dữ liệu: Hồ sơ, Lịch học, Điểm danh, Bài làm, Điểm, Nhận xét, Lịch sử lớp
3. Rule hiển thị / Format
- Thông tin lớp HV được thấy: Mã lớp, Khóa HSK, Tên GV, Lịch học, Tiến độ
- Không hiển thị danh sách/điểm/xếp hạng của HV khác trong lớp
- Truy cập URL/ID dữ liệu người khác: trang “Bạn không có quyền truy cập” (403), không lộ dữ liệu
- Kiểm tra quyền bắt buộc ở cả giao diện và API/backend

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 13`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-011 — Giáo viên chỉ truy cập lớp được phân công

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Giáo viên
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 14`; Quy tắc BR-03; Vai trò!2

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Ngoại lệ giáo viên dạy thay chưa có yêu cầu.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Giới hạn Giáo viên chỉ xem và thao tác trên lớp đang được phân công (BR-03).
2. Trường thông tin
- Phạm vi dữ liệu GV được truy cập: Thông tin lớp, DS học viên, Lịch/buổi học, Điểm danh, Bài tập đã giao, Bài làm & điểm của HV thuộc lớp
3. Rule hiển thị / Format
- Danh sách lớp và mọi dropdown chọn lớp ở màn GV chỉ hiển thị lớp được phân công
- Truy cập lớp khác qua URL: trang 403 “Bạn không có quyền truy cập lớp này”
- Khi bị thay GV (FUNC-018): GV cũ mất quyền thao tác và xem dữ liệu của lớp từ ngày áp dụng
- GV được phép xem được kho đề do GV khác tạo
- Case dạy thay xử lý ngoài hệ thống (GV dạy thay trao đổi kết quả buổi học với GV > GV tự cập nhật lên hệ thống)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 14`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-012 — Admin xem được tất cả lớp

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** High · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Admin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 15`; Vai trò!4; Câu hỏi mở #7

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Quyền chỉnh sửa/xóa cần chi tiết hóa theo chức năng.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Admin tra cứu toàn bộ lớp và dữ liệu liên quan (HV, GV, lịch, điểm danh, bài tập, điểm), không giới hạn theo phân công.
2. Trường thông tin
- Danh sách lớp toàn hệ thống, bộ lọc: Khóa HSK, GV phụ trách, Trạng thái lớp
- Chi tiết lớp gồm các tab: Thông tin, Học viên, Lịch học, Điểm danh, Bài tập & điểm, Tiến độ
3. Rule hiển thị / Format
- Mặc định hiển thị lớp Sắp khai giảng và Đang học của mọi GV; lớp Đã kết thúc hiển thị khi bật lọc (FUNC-079)
- Sắp xếp theo Trạng thái (Đang học → Sắp khai giảng → Đã kết thúc), sau đó Ngày bắt đầu mới nhất
- Quyền thao tác của Admin theo từng chức năng (xem cột Vai trò của từng FUNC)
- Admin được phép sửa điểm/điểm danh thay GV

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 15`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-013 — Superadmin vận hành hệ thống

- **Trạng thái phạm vi:** Phase 1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đã ghi nhận
- **Vai trò ghi nhận:** Superadmin
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 16`; Vai trò!3; Câu hỏi mở #22

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Đã chốt cấu hình: Tên trung tâm, Logo (#22). Bỏ cấu hình AI (#40). Quyền quản lý tài khoản Admin và nhật ký theo mô tả.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép Superadmin vận hành hệ thống: quản lý tài khoản Admin, gán vai trò, cấu hình hệ thống, xem nhật ký hệ thống.
2. Trường thông tin
- Quản lý tài khoản Admin: Họ tên, Email, SĐT, Vai trò, Trạng thái
- Gán vai trò: Superadmin / Admin / Giáo viên / Học viên (multi-select)
- Cấu hình hệ thống (Câu hỏi mở #22):
   + Tên trung tâm: text, bắt buộc
   + Logo: file ảnh .png/.jpg, tối đa 2MB (đề xuất); hiển thị trên header và màn Đăng nhập
- Nhật ký hệ thống: Thời gian, Người thao tác, Hành động, Đối tượng
3. Rule hiển thị / Format
- Menu Superadmin chỉ hiển thị với tài khoản có vai trò Superadmin
- Không cho tự vô hiệu hóa chính mình hoặc gỡ vai trò Superadmin cuối cùng
- Nhật ký: dd/mm/yyyy HH:mm:ss, mới nhất lên đầu, read-only
- Superadmin không được phép xem dữ liệu học tập (bài làm, điểm)

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 16`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

### FUNC-078 — Hồ sơ cá nhân & đổi mật khẩu

- **Trạng thái phạm vi:** Dự kiến P1 · **Ưu tiên:** Medium · **Trạng thái nghiệp vụ trong Excel:** Đề xuất
- **Vai trò ghi nhận:** Tất cả vai trò
- **Dẫn chiếu nguồn:** `Final.xlsx > Function List ! row 72`; Bổ sung khi review – thông lệ quản lý tài khoản

**Ghi chú BA từ Excel (kiểm tra tính hiệu lực trước code):**

> Chưa có yêu cầu từ khách; nên có nếu HV tự đăng ký.

<details>
<summary>Nội dung Excel tham chiếu (lịch sử; có thể có quy tắc bị thay thế)</summary>

1. Chức năng
- Cho phép người dùng đã đăng nhập xem/cập nhật thông tin cá nhân và đổi mật khẩu.
2. Trường thông tin
- Thông tin cá nhân:
   + Họ và tên: sửa được
   + Ngày sinh: read-only với HV (đã dùng để kiểm tra BR-04, BR-07)
   + SĐT, Email: sửa được, duy nhất – Gửi link xác thực qua mail
   + Ảnh đại diện: tùy chọn (đề xuất)
   + Vai trò, Lớp đang học / phụ trách: read-only
- Đổi mật khẩu:
   + Mật khẩu hiện tại, Mật khẩu mới, Xác nhận mật khẩu mới: bắt buộc
3. Rule hiển thị / Format
- Mở từ menu tài khoản (avatar góc trên phải) → “Hồ sơ của tôi”
- Mật khẩu hiện tại sai: “Mật khẩu hiện tại không đúng”
- Mật khẩu mới theo rule FUNC-001, không trùng mật khẩu hiện tại
- Đổi mật khẩu thành công: toast “Đổi mật khẩu thành công”; Đăng xuất các phiên khác
- Ngày sinh hiển thị dd/mm/yyyy

</details>

**Prototype:** nguồn tại `Final.xlsx > Review Prototype theo Function  ! row 72`; trạng thái review: Có – Cần cập nhật; **không coi như kiểm chứng backend**.

## Gate trước khi triển khai

1. Đọc các `TBD/CONFLICT` có liên quan trong `docs/01-business/open-issues.md`.
2. Chốt quyền thao tác và trường dữ liệu tối thiểu của module với người phụ trách.
3. Có prototype màn hình/luồng tương ứng được phê duyệt (nếu là UI user-facing).
4. Viết API/schema/test cases và migration phù hợp với cấu trúc repo **thực tế**.
5. Test phân quyền, ngoại lệ, tính toàn vẹn lịch sử (nếu áp dụng).
