# Báo Cáo Kiểm Thử Trực Tiếp UI (Playwright CLI trên Chromium), Đối Chiếu Real-Time / Đa Vai Trò & Ponytail Audit Toàn Dự Án

- **Dự án:** WebEdu — Hệ thống Quản lý Học tập & Lớp học Trực tuyến **Trung Tâm TD Hán Ngữ**
- **Nhánh kiểm định:** `develop` (Commit `b14eb82`, sau khi hợp nhất hoàn chỉnh Phase 9 `5d54b6a`)
- **Thời điểm thực thi:** `20/11/2026 03:15 – 03:39 (GMT+7)` (Kích hoạt tự động theo lịch hẹn `/schedule` 2 tiếng 30 phút)
- **Công cụ & Môi trường thực thi:**
  - **Live Browser Automation:** `npx --no-install playwright cli` trên **Chromium** thật (`Desktop 1440×900` & `Mobile iPhone X 375×812`)
  - **Frontend Production Build:** Next.js `next start --port 3005` (`http://localhost:3005`, 26 UI routes)
  - **Backend Production Build:** NestJS `node dist/main.js` (`http://localhost:3001/api/v1`)
  - **Database & Mail Harness:** PostgreSQL 16 thật (Isolated QA Cluster + 25 Prisma migrations) + Local SMTP/Inspector (`127.0.0.1:4025` / `127.0.0.1:4026`)
  - **Chế độ mã nguồn:** **100% Read-Only đối với mã nguồn ứng dụng (`backend/src/**`, `frontend/src/**`)** — tuân thủ nghiêm ngặt yêu cầu *"nếu có bug ghi lại vào 1 file đầy đủ báo cáo bug, sẽ fix bug đó sau"*.

---

## 1. Tóm Tắt Điều Hành (Executive Summary) & Kết Luận Sẵn Sàng Deploy

### 1.1. Trạng thái các cổng kiểm định CI hiện tại (`.github/workflows/ci.yml`)
Toàn bộ các cổng kiểm định tự động trong pipeline GitHub Actions CI hiện tại đều **PASS 100%**:
- **LOC Guardrail (`node scripts/check-loc.js`):** **PASS** (`281/281` tệp nằm trong ngưỡng LOC quy định).
- **Prototype & Spec Tag Hygiene (`git grep`):** **PASS** (`0` rò rỉ nhãn `FUNC-|DEC-|SEC-|BR-|EXAM-|NOTIF-|PROTO-` và `0` dấu vết Dev Quick-Login trên UI).
- **Backend Quality Gates:** `prisma migrate deploy` (**25 migrations**), `npm run typecheck` (**0 lỗi**), `npm run lint` (**0 cảnh báo / 0 lỗi** trên 272 tệp), `npm run build` (**PASS**), `npm run test:cov` (**61/61 suites, 591/591 unit tests PASS** — Coverage: `89.13%` Statements / `80.60%` Branches / `89.64%` Functions / `90.67%` Lines), `npm run test:integration` (**1/1 suite, 20/20 tests PASS**), `npm run test:e2e` (**14/14 suites, 80/80 E2E tests PASS** trên PostgreSQL 16 thật).
- **Frontend Quality Gates:** `npm run typecheck` (**0 lỗi**), `npm run lint` (**0 cảnh báo / 0 lỗi**), `npm run test:unit` (**47/47 unit tests PASS**), `npm run build` (**29 App Router routes**), `npm run test:e2e` (**111 passed, 0 failed** trên Chromium Desktop & Mobile).

### 1.2. Kết luận từ phiên kiểm thử sâu trên Chromium (`playwright-cli`) & `ponytail-audit`
Khi kiểm thử sâu mọi ngóc ngách trên trình duyệt Chromium thật kết hợp với `ponytail-audit` dưới tải giả lập thực tế (**200+ học viên thi đồng thời**, **20 giáo viên chấm bài/điểm danh**, **250 tab mở song song**):
1. **Giao diện, Thẩm mỹ & Responsive (`1440×900` & `375×812`):**
   - Toàn bộ **24/24 route tĩnh & động** được quét trực tiếp trên Chromium đạt **`0px` tràn ngang (`horizontal overflow = 0px`)** ở cả Desktop (`1440×900`) và Mobile (`375×812`), đúng chuẩn thẩm mỹ *Modern Chinese Editorial* (`Be Vietnam Pro`, `Noto Serif SC`, `JetBrains Mono`, dấu triện `.seal`, không có thanh cuộn lồng nhau).
2. **Độ khớp dữ liệu chéo 4 chiều giữa các vai trò (`Cross-Role Data Parity`):**
   - Dữ liệu điểm số, bài tập về nhà (`1/1 · 100%`), bài kiểm tra (`10.0` / `10/10`), quy tắc ẩn điểm tổng kết khi thiếu thành phần bắt buộc (`Chưa đủ dữ liệu`), và sĩ số lớp trên `/student/overview`, `/student/results`, `/teacher/classes/[id]` (Tab *Tiến độ & Kết quả*), và `/admin/overview` **khớp tuyệt đối 100%**.
   - Bất biến **Zero-Leak** ở trạng thái `GRADED` (đã xác nhận điểm nhưng chưa công bố `RETURNED`) hoạt động chính xác 100%: học viên không thấy điểm trên `/student/results` và không nhận thông báo `GRADES_PUBLISHED` cho tới khi giáo viên bấm `"Công bố điểm đã xác nhận"`.
3. **Các lỗi Logic, Đồng bộ Real-Time & Hiệu năng chịu tải phát hiện được (Ghi nhận để xử lý ở đợt Fix tiếp theo):**
   - Phát hiện **11 hạng mục `Must fix`** (5 Frontend/Real-Time Sync + 6 Backend/Concurrency/Scale), **16 hạng mục `Should fix`**, và **5 hạng mục `Nice to have`** (tiết kiệm được **`~420 dòng mã thừa`** mà không cần thêm bất kỳ dependency nào).
   - Nổi bật nhất là các vấn đề về **đồng bộ UI tức thì (Real-Time Sync)** khi người dùng đang mở sẵn trang dữ liệu, **lỗ hổng F5 reset lượt nghe bài thi `LISTENING`**, **race condition khi 20+ học viên nộp bài cùng lúc** làm ghi đè số lượng trên thông báo của giáo viên, và **contention khóa `FOR UPDATE` trên bảng `classes`** giữa luồng giáo viên chấm bài và luồng autosave 15 giây của học viên.

---

## 2. Phần I — Kết Quả Kiểm Thử Trực Tiếp Trên Chromium (`playwright-cli`)

### 2.1. Ma trận kiểm chứng 7 chặng nghiệp vụ (`Stages 1 → 7`)

| Chặng | Phạm vi & Route kiểm thử trên Chromium | Kết quả Live UI | Bằng chứng thực nghiệm từ `playwright-cli` |
| :--- | :--- | :---: | :--- |
| **Stage 1** | `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/profile` | **PASS** *(có 1 lỗi đồng bộ tên Shell sau khi lưu `/profile` — xem `BUG-QA-04`)* | - `/` redirect sạch về `/login` (`h1: "Đăng nhập hệ thống"`, `hasQuickLogin: false`, `hasSeal: true`, `overflow: 0px`).<br>- `/register` với DOB `2018-01-01` (`< 12 tuổi`): khóa cứng `#reg-submit-btn` (`under12Blocked: true`).<br>- `/register` với DOB `2012-05-10` (`12–15 tuổi`): tự động đổi nhãn thành `"Email cha mẹ / người giám hộ *"`, hiển thị checkbox `#reg-guardian-consent`, gửi & xác thực OTP qua SMTP Inspector `127.0.0.1:4026` thành công, chuyển về `/login?registered=1`.<br>- `/forgot-password` → `/reset-password?token=...`: đặt lại mật khẩu thành công (`resetPasswordOk: true`).<br>- `/profile` của học viên `< 16 tuổi` (`pending.desktop@webedu.vn`): `#profile-dob` (`disabled: true, readOnly: true`), `#profile-email` (`disabled: true`), hiển thị thông báo khóa bảo vệ trẻ vị thành niên (`hasUnder16Notice: true`). |
| **Stage 2** | `/superadmin/settings` & RBAC Isolation của `SUPERADMIN` | **PASS** *(có 1 hạn chế đồng bộ tên thương hiệu giữa các tab — xem `BUG-QA-05`)* | - `SUPERADMIN` đăng nhập vào thẳng `/superadmin/settings`.<br>- Không hiển thị chuông thông báo học vụ (`saBellCount: 0`), không có link `/admin/overview` trên Sidebar (`saOverviewLinkCount: 0`), **`0` lỗi `403` ngầm** trên Network (`bg403DuringNormalLoad: []`).<br>- Truy cập cưỡng bức `/admin/overview` và `/student/results` bằng URL đều bị chặn bởi màn hình `403 — Giới hạn quyền truy cập` (`saBlockedOverview: true`, `saBlockedStudentResults: true`).<br>- Đổi tên trung tâm thành `"TD Hán Ngữ · Live QA"`: tab Admin đang mở chưa tự đổi ngay (`brandUpdatedWithoutNav: false`) nhưng tự đồng bộ ngay khi chuyển route SPA sang `/admin/overview` (`brandUpdatedOnSpaNav: true`). |
| **Stage 3** | `/admin/overview`, `/admin/courses`, `/admin/teachers`, `/admin/students`, `/admin/students/pending`, `/admin/classes` | **PASS** *(phát hiện 2 lỗi UX/Sync: `BUG-QA-03` & `BUG-QA-12`)* | - Chuông thông báo của `ADMIN` hiển thị badge đỏ `"1"` ngay sau khi học viên `Lê Thiếu Niên QA` đăng ký ở Stage 1.<br>- Bấm chuông mở popover (`popoverVisible: true`) → click thông báo điều hướng tới `/admin/students/pending` → xếp lớp `HSK2-K26-01` thành công.<br>- Trên `/admin/courses`: nhập tỷ trọng `30 / 30 / 50` báo lỗi `"Tổng tỷ trọng: 110% / 100%"`; sửa thành `30 / 20 / 50` và điểm đạt `5.5` lưu thành công.<br>- Trên `/admin/teachers`: bấm `"Vô hiệu hóa"` giáo viên `Trương Mỹ Lan` (đang dạy lớp active) bật modal chặn `BlockedTeacherDeactivationModal` (`blockedTeacherModalHasActiveClassCount: true`), nhưng bấm phím `Escape` không đóng được modal (`blockedModalClosedByEscape: false` — xem `BUG-QA-12`).<br>- Trên `/admin/students`: mở `StudentDetailModal` của `pending.desktop@webedu.vn` → bấm `"Vô hiệu hóa"` → `"Lưu cập nhật"`: badge Sidebar `"Chờ xếp lớp"` vẫn giữ nguyên số `"2"` (`badgeAfterDeactivateWithoutReload: "Chờ xếp lớp待分班2"`) và chỉ giảm về `"1"` sau khi F5 (`badgeAfterReload: "Chờ xếp lớp待分班1"` — xem `BUG-QA-03`). |
| **Stage 4** | `/admin/schedules`, `/admin/schedule-logs`, `/teacher/schedules`, `/teacher/classes/[id]`, `/student/schedule` | **PASS** | - Lịch học hiển thị đúng trên cả 3 vai trò (`ADMIN`, `TEACHER`, `STUDENT`), bộ lọc lớp/giáo viên và trang `/admin/schedule-logs` render sạch, `0` lỗi console, `overflow: 0px`. |
| **Stage 5** | `/teacher/assessments`, `/student/assignments`, `/student/assignments/[id]` | **PASS** *(phát hiện 2 lỗi Real-Time/Integrity: `BUG-QA-01` & `BUG-QA-02`)* | - Mở trình tạo đề (`+ Tạo đề`) trên `/teacher/assessments`: hiển thị đúng thẻ gợi ý cấu hình preset theo loại đề (`presetHintVisible: true`).<br>- Khi giáo viên giao 2 bài mới (`Mini-test Live QA HSK2` và `BTVN Live QA HSK2`) cho lớp `HSK2-K26-01`, tab của học viên `Phạm Gia Huy` đang mở sẵn `/student/assignments`: khi sự kiện `window.focus` kích hoạt, badge chuông thông báo tăng tức thì từ `null` lên `"2"` (`stuBadgeAfterFocus: "2"`), nhưng bảng danh sách bài tập bên dưới không tự nạp lại (`assignmentsTableUpdatedOnFocus: false`), và ngay cả khi bấm vào dòng thông báo bài tập mới trong chuông (trùng với route `/student/assignments` đang mở), bảng vẫn không tự refresh (`assignmentsPageRefreshedOnSameRouteNotifClick: false` — xem `BUG-QA-02`).<br>- Phòng thi `/student/assignments/[id]`: chọn đáp án `"Xin chào"`, lưu nháp, F5 nạp lại trang giữ nguyên đáp án và nộp bài thành công. |
| **Stage 6** | `/teacher/assignments/[assignmentId]/grading` & Bất biến **Zero-Leak** (`GRADED` vs `RETURNED`) | **PASS** | - Trên màn chấm bài `/teacher/assignments/[assignmentId]/grading`, khi giáo viên bấm `"Xác nhận tất cả điểm"` (`#btn-confirm-all-grades`, chuyển sang `GRADED`), kiểm tra trực tiếp trên tab Học viên: trang `/student/results` và chuông thông báo **hoàn toàn không rò rỉ điểm hay thông báo công bố điểm** (`zeroLeakHeldAtGraded: true`).<br>- Sau khi giáo viên bấm `"Công bố điểm đã xác nhận"` (`#btn-publish-confirmed-grades`, chuyển sang `RETURNED`), điểm `10.0` (`10/10`) xuất hiện ngay trên `/student/results` và `/student/overview` của học viên. |
| **Stage 7** | Đối chiếu chéo 4 chiều (`4-Way Cross-Role Data Parity`) & Quét Mobile `375×812` trên toàn bộ 19 route Portal | **PASS 100%** | - Xem bảng đối chiếu chi tiết tại Mục 2.2 và bảng quét Mobile `375×812` tại Mục 2.3 bên dưới. |

---

### 2.2. Bảng đối chiếu dữ liệu chéo 4 chiều (`4-Way Cross-Role Data Parity Matrix`)

Sau khi học viên `Phạm Gia Huy` (`active.student@webedu.vn`, lớp `HSK2-K26-01`) hoàn thành `BTVN Live QA HSK2` (đạt `0/10` để kiểm chứng BTVN không tính vào điểm tổng kết) và `Mini-test Live QA HSK2` (đạt `10/10` = `10.0`, đã công bố `RETURNED`), trong khi lớp chưa có bài Giữa kỳ (`MIDTERM`) và Cuối kỳ (`FINAL_EXAM`):

| Chỉ số học vụ của `Phạm Gia Huy` (`HSK2-K26-01`) | 1. Học viên `/student/overview` | 2. Học viên `/student/results` | 3. Giáo viên `/teacher/classes/[id]` (Tab *Tiến độ & Kết quả*) | 4. Admin `/admin/overview` | Độ khớp |
| :--- | :--- | :--- | :--- | :--- | :---: |
| **Hoàn thành BTVN (`HOMEWORK`)** | `100%` | Hiển thị nhóm *Bài tập về nhà (Tham khảo)*: `0.0` (`0/10`) | `1/1 · 100%` (`TB tham khảo: 0.0`) | N/A *(tổng hợp cấp lớp)* | **100% KHỚP** |
| **Điểm Mini-test (`MINI_TEST`, trọng số 30%)** | Kết quả gần nhất: `10/10` | `10.0` (`10/10`) | `10.0` | N/A *(tổng hợp cấp lớp)* | **100% KHỚP** |
| **Điểm Giữa kỳ (`MIDTERM`, 20%) & Cuối kỳ (`FINAL_EXAM`, 50%)** | Chưa có | `—` | `—` / `—` | N/A | **100% KHỚP** |
| **Điểm tổng kết (`finalScore`) & Xếp loại (`PASS`/`FAIL`)** | Chưa xét đạt | `Chưa đủ dữ liệu` *(không chia mẫu số giả khi thiếu Giữa kỳ & Cuối kỳ)* | `—` / `Chưa đủ dữ liệu` | Tiến độ lớp `0/24 buổi · 0%`, Điểm danh TB `—`, Trạng thái `Đang học` | **100% KHỚP** |

---

### 2.3. Kết quả quét Responsive Mobile (`375×812`) & Desktop (`1440×900`) trên Chromium

Toàn bộ các route được đo trực tiếp bằng `document.documentElement.scrollWidth - window.innerWidth`:

| Nhóm vai trò | Route kiểm thử | Desktop `1440×900` (`overflowPx`) | Mobile `375×812` (`overflowPx`) | Console / Page Errors |
| :--- | :--- | :---: | :---: | :---: |
| **Public Auth** | `/login`, `/register`, `/forgot-password`, `/reset-password` | `0px` | `0px` | `0` |
| **Shared Portal** | `/profile` | `0px` | `0px` | `0` |
| **Superadmin** | `/superadmin/settings` | `0px` | `0px` | `0` |
| **Student** | `/student/overview` | `0px` | `0px` | `0` |
| **Student** | `/student/schedule` | `0px` | `0px` | `0` |
| **Student** | `/student/assignments` | `0px` | `0px` | `0` |
| **Student** | `/student/results` | `0px` | `0px` | `0` |
| **Teacher** | `/teacher/classes` | `0px` | `0px` | `0` |
| **Teacher** | `/teacher/classes/[id]` | `0px` | `0px` | `0` |
| **Teacher** | `/teacher/schedules` | `0px` | `0px` | `0` |
| **Teacher** | `/teacher/assessments` | `0px` | `0px` | `0` |
| **Teacher** | `/teacher/assignments/[assignmentId]/grading` | `0px` | `0px` | `0` |
| **Admin** | `/admin/overview` | `0px` | `0px` | `0` |
| **Admin** | `/admin/courses` | `0px` | `0px` | `0` |
| **Admin** | `/admin/classes` | `0px` | `0px` | `0` |
| **Admin** | `/admin/classes/[id]` | `0px` | `0px` | `0` |
| **Admin** | `/admin/schedules` | `0px` | `0px` | `0` |
| **Admin** | `/admin/schedule-logs` | `0px` | `0px` | `0` |
| **Admin** | `/admin/students` | `0px` | `0px` | `0` |
| **Admin** | `/admin/students/pending` | `0px` | `0px` | `0` |
| **Admin** | `/admin/teachers` | `0px` | `0px` | `0` *(1 log `409 Conflict` dự kiến khi test khóa GV đang dạy lớp active)* |

---

## 3. Phần II — Danh Mục Chi Tiết Các Bug UI, Đồng Bộ Real-Time & Hiệu Năng Cần Khắc Phục (`Bug Catalog`)

> **Lưu ý:** Theo đúng yêu cầu của bạn, toàn bộ các bug dưới đây đã được khoanh vùng tới từng dòng mã (`file:line`), xác minh nguyên nhân gốc rễ và thiết kế sẵn phương án sửa triệt để nhưng **chưa chỉnh sửa vào mã nguồn ứng dụng** để bạn duyệt và xử lý tập trung ở bước Fix tiếp theo.

### Nhóm A — Bug Nghiêm Trọng về Nghiệp Vụ, Đồng Bộ Real-Time & Chịu Tải (`Must Fix` — 11 Bug)

#### `BUG-QA-01` [Must Fix | Exam Integrity | Frontend] — Học viên có thể bấm F5 để reset số lượt nghe (`audioPlayCounts`) của câu hỏi `LISTENING`, vượt qua giới hạn `maxListens`
- **Vị trí mã nguồn:**
  - [useStudentExamSession.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/hooks/useStudentExamSession.ts#L273-L277)
  - [exam-session-transport.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/utils/exam-session-transport.ts#L64-L76)
- **Các bước tái hiện:**
  1. Học viên mở bài thi có câu hỏi `LISTENING` với giới hạn `maxListens = 2`.
  2. Học viên bấm nghe đoạn băng 2 lần (bộ đếm trên giao diện tăng lên `2/2` và khóa nút phát), nhưng **chưa chọn/thay đổi đáp án** của câu hỏi đó.
  3. Học viên bấm `F5` (Reload trang).
- **Kỳ vọng vs Thực tế:**
  - *Kỳ vọng:* Số lượt đã nghe (`2/2`) phải được lưu vào `localStorage` ngay khi bấm Play và gửi lên server qua `autosave` để sau khi F5 vẫn giữ nguyên `2/2`.
  - *Thực tế:* `recordAudioPlay(questionId)` chỉ cập nhật `snapshot.audioPlayCounts` trong RAM mà không đưa `questionId` vào `pending.current`, không ghi `localStorage`, và không kích hoạt `flushAutosave()`. Do `buildSyncPayload()` chỉ đóng gói các câu hỏi nằm trong `editedIds = new Set(Object.keys(pending.current))`, lượt nghe không bao giờ được gửi lên server nếu học viên chưa chọn đáp án câu đó. Sau khi F5, `audioPlayCount` quay về `0/2` (nghe lại vô hạn lần).
- **Hướng khắc phục triệt để:** Trong `recordAudioPlay(questionId)` tại `useStudentExamSession.ts:L273-277`, thêm `questionId` vào `pending.current` (giữ nguyên đáp án hiện tại của câu đó), gọi `storePendingExamAnswers(...)`, và đặt lịch `scheduleForType('LISTENING', () => { if (navigator.onLine && !document.hidden) void flushAutosave(); })`.

---

#### `BUG-QA-02` [Must Fix | Real-Time Sync | Frontend] — Khi nhận thông báo mới hoặc click vào thông báo trùng với trang đang mở, dữ liệu trên màn hình không tự động làm mới
- **Vị trí mã nguồn:**
  - [NotificationBellPopover.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/notifications/components/NotificationBellPopover.tsx#L78-L81)
  - [useNotifications.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/notifications/hooks/useNotifications.ts#L55-L89)
- **Bằng chứng Live Chromium (`task-911`):**
  - Học viên mở sẵn `/student/assignments`. Giáo viên giao bài tập mới. Khi học viên quay lại tab (`window.focus`), badge chuông thông báo nhảy ngay lên `"2"` (`stuBadgeAfterFocus: "2"`), nhưng bảng bài tập vẫn không hiển thị bài mới (`assignmentsTableUpdatedOnFocus: false`).
  - Khi học viên bấm vào chuông và click dòng thông báo `"Bài tập mới được giao"` (trỏ tới `/student/assignments`), popover đóng lại nhưng `router.push('/student/assignments')` trên cùng pathname không làm component remount hay chạy lại `useEffect`, khiến màn hình trước mặt học viên vẫn trống bài mới (`assignmentsPageRefreshedOnSameRouteNotifClick: false`) cho tới khi bấm F5 thủ công.
- **Hướng khắc phục triệt để:** Phát sự kiện `window.dispatchEvent(new CustomEvent('webedu:notifications-changed'))` trong `useNotifications.ts` mỗi khi `unreadCount` tăng lên hoặc khi người dùng click vào một thông báo có `href` trùng với `window.location.pathname`; đồng thời đăng ký lắng nghe sự kiện này trên các trang dữ liệu (`/student/assignments`, `/student/results`, `/student/overview`, `/student/schedule`, `/admin/students/pending`, `/admin/overview`, `/teacher/assignments/[assignmentId]/grading`).

---

#### `BUG-QA-03` [Must Fix | Real-Time Sync | Frontend] — Vô hiệu hóa hoặc kích hoạt lại học viên `PENDING_CLASS` trong `StudentDetailModal` không cập nhật badge `"Chờ xếp lớp"` trên Sidebar
- **Vị trí mã nguồn:**
  - [useStudentDetailForm.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/hooks/useStudentDetailForm.ts#L177-L187)
- **Bằng chứng Live Chromium (`task-947`):**
  - Trước khi vô hiệu hóa học viên `pending.desktop@webedu.vn` trên `/admin/students`, badge Sidebar hiển thị `"Chờ xếp lớp 2"` (`badgeBeforeDeactivate: "Chờ xếp lớp待分班2"`).
  - Sau khi bấm `"Vô hiệu hóa"` → `"Lưu cập nhật"` trong `StudentDetailModal`, badge Sidebar vẫn giữ nguyên `"Chờ xếp lớp 2"` (`badgeAfterDeactivateWithoutReload: "Chờ xếp lớp待分班2"`), chỉ giảm về `"1"` sau khi F5 (`badgeAfterReload: "Chờ xếp lớp待分班1"`).
- **Nguyên nhân gốc rễ:** Sau khi `await updateStudent(...)` thành công tại `useStudentDetailForm.ts:L186`, hook quên gọi `notifyPendingEnrollmentUpdated()`.
- **Hướng khắc phục triệt để:** Gọi `notifyPendingEnrollmentUpdated()` ngay sau `await updateStudent(...)` tại `useStudentDetailForm.ts:L186`, đồng thời bổ sung lắng nghe `PENDING_ENROLLMENT_UPDATED_EVENT` tại `/admin/overview` và `/admin/students/pending`.

---

#### `BUG-QA-04` [Must Fix | Cross-Component Sync | Frontend] — Cập nhật Họ tên (`fullName`) trên `/profile` không cập nhật tên và chữ viết tắt avatar trên `PortalTopbar` & `SidebarFooter`
- **Vị trí mã nguồn:**
  - [profile/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/profile/page.tsx#L48-L49)
  - [usePortalSession.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/auth/hooks/usePortalSession.ts#L103-L121)
- **Bằng chứng Live Chromium (`task-911`):**
  - Khi đổi họ tên từ `"Phạm Gia Huy"` thành `"Phạm Gia Huy · QA"` trên `/profile` và bấm lưu, thông báo thành công hiển thị nhưng Sidebar/Topbar vẫn hiển thị `"Phạm Gia Huy"` (`profileSaveUpdatedShellName: false`).
- **Nguyên nhân gốc rễ:** `ProfilePage` khởi tạo `usePortalProfileSession()` độc lập với `PortalSessionContext`, và hàm `recheckSession` trong `usePortalSession.ts:L105-109` chỉ so sánh `id`, `status`, `roles` mà bỏ qua thay đổi `fullName`, `email`, `phone`.
- **Hướng khắc phục triệt để:** Cập nhật điều kiện so sánh trong `usePortalSession.ts:L105-109` để kiểm tra cả `prev.fullName !== fresh.fullName || prev.email !== fresh.email || prev.phone !== fresh.phone`, và phát sự kiện đồng bộ session khi lưu `/profile`.

---

#### `BUG-QA-05` [Must Fix | Network Efficiency | Frontend] — `usePendingEnrollmentCount` tải toàn bộ danh sách hồ sơ học viên chờ xếp lớp mỗi lần `window.focus` chỉ để đọc 1 con số `totalPending`
- **Vị trí mã nguồn:**
  - [usePendingEnrollmentCount.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/hooks/usePendingEnrollmentCount.ts#L25-L34)
- **Nguyên nhân gốc rễ:** Gọi `listPendingEnrollmentStudents()` không truyền `limit`, khiến mỗi lần Admin alt-tab quay lại cửa sổ trình duyệt (`window.focus` / `visibilitychange`), frontend tải nguyên trang danh sách học viên thay vì `{ page: 1, limit: 1 }`.
- **Hướng khắc phục triệt để:** Truyền `{ page: 1, limit: 1 }` vào `listPendingEnrollmentStudents({ page: 1, limit: 1 })` tại dòng 27.

---

#### `BUG-QA-06` [Must Fix | Concurrency Race Condition | Backend] — Nhiều học viên nộp bài thi cùng lúc làm ghi đè thông báo chờ chấm của giáo viên về số lượng thấp (`"1 bài nộp"` thay vì `"20 bài nộp"`)
- **Vị trí mã nguồn:**
  - [notification-academic-triggers.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/notifications/services/notification-academic-triggers.service.ts#L231-L261)
  - [student-submission.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/student-submission.service.ts#L237-L254)
- **Nguyên nhân gốc rễ:** `onSubmissionPendingGradingTx` chạy bên trong transaction `READ COMMITTED` của từng học viên trong khi dòng `class_assignments` chỉ khóa `FOR SHARE` (`submission-session.util.ts:L218`). Khi 20 học viên nộp bài cùng thời điểm hết giờ thi, mỗi transaction gọi `tx.submission.count(...)` tại dòng 241 trước khi 19 transaction kia commit nên chỉ đếm thấy bài của chính mình (`pendingCount = 1`). Sau đó cả 20 transaction xếp hàng tại `ON CONFLICT ("recipient_id", "dedup_key") DO UPDATE` (`notification-dispatch.service.ts:L100-109`), và transaction cuối cùng ghi đè `body` bằng giá trị `EXCLUDED."body"` đã tính sẵn trước khi giữ lock.
- **Hướng khắc phục triệt để:** Thực hiện tính lại số lượng `SUBMITTED_WAITING` sau khi transaction nộp bài đã commit (hoặc dùng subquery trực tiếp trong câu lệnh SQL `ON CONFLICT DO UPDATE SET body = ...`).

---

#### `BUG-QA-07` [Must Fix | High-Load Scale & Performance | Backend] — Mỗi nhịp `autosave` và heartbeat 15 giây trong phòng thi đều đọc lại toàn bộ đề thi, xáo trộn lại toàn bộ câu hỏi và trả nguyên đề thi về HTTP response
- **Vị trí mã nguồn:**
  - [student-submission.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/student-submission.service.ts#L136-L142)
  - [submission-session.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/submission-session.util.ts#L166-L190)
- **Nguyên nhân gốc rễ:** Ngay cả khi `dto.answers` rỗng (`[]` — heartbeat gia hạn lease 10–15 giây) hoặc chỉ sửa 1 câu hỏi, `autosave` vẫn gọi `loadAssignmentForSession`, tải toàn bộ câu hỏi và JSON payload của đề thi từ PostgreSQL, đọc `submission_answers` 2 lần (`L210`, `L376`), chạy HMAC-SHA256 shuffle trên toàn bộ câu hỏi (`buildStudentExamSessionDto` tại `L529-531`), và trả toàn bộ đề thi về client. Với 200 học viên thi đồng thời (~13.3–26.6 req/s), hệ thống phát sinh **106–213 câu lệnh SQL/giây** trong transaction có khóa và truyền hàng trăm MB JSON dư thừa mỗi phút.
- **Hướng khắc phục triệt để:** Khi `autosave` trên bài làm chưa hết giờ, chỉ truy vấn các câu hỏi có trong `dto.answers` (`where: { id: { in: dto.answers.map(a => a.questionId) } }`) để validate và chỉ trả về metadata phiên thi (`submission` + `savedAnswerIds`) thay vì nạp và shuffle lại toàn bộ đề thi.

---

#### `BUG-QA-08` [Must Fix | Lock Contention under Concurrency | Backend] — Giáo viên chấm bài hoặc chạy AI chấm hàng loạt khóa độc quyền `FOR UPDATE` trên bảng `classes`, làm nghẽn toàn bộ request `autosave` phòng thi của học viên cùng lớp
- **Vị trí mã nguồn:**
  - [grading-locking.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/grading/services/grading-locking.util.ts#L61-L86)
  - [submission-session.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/submission-session.util.ts#L214-L221)
- **Nguyên nhân gốc rễ:** `lockClassRowForSubmissionTx` và `lockClassRowForAssignmentTx` thực thi `SELECT id FROM "classes" ... FOR UPDATE` (`grading-locking.util.ts:L68, L83`) dù luồng chấm bài không bao giờ sửa bảng `classes`. Trong khi đó, mọi request `autosave`, `start`, `submit` và phát audio của học viên đều xin khóa `FOR SHARE OF c` trên bảng `classes` (`submission-session.util.ts:L218`). Khi giáo viên chấm bài hoặc chạy AI batch grading (`BATCH_AI_CONCURRENCY = 4`), khóa `FOR UPDATE` trên dòng `classes` chặn trực tiếp các nhịp heartbeat/autosave 15 giây của toàn bộ học viên trong lớp đó.
- **Hướng khắc phục triệt để:** Đổi `FOR UPDATE` thành `FOR SHARE` trong `lockClassRowForAssignmentTx` và `lockClassRowForSubmissionTx` (`grading-locking.util.ts:L68, L83`), đồng bộ với `reopenSubmission` (`assignment-delivery.service.ts:L220`).

---

#### `BUG-QA-09` [Must Fix | State Machine Dead-End | Backend] — Học viên từng được xếp lớp nhưng đã rút khỏi lớp (`DROPPED`), nếu sau đó bị chuyển sang `INACTIVE` thì bị kẹt vĩnh viễn không thể kích hoạt lại hoặc xếp lớp mới
- **Vị trí mã nguồn:**
  - [class-enrollment.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-enrollment.service.ts#L288-L297)
  - [student-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/services/student-crud.service.ts#L243-L272)
  - [user-role-status.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/user-role-status.service.ts#L143-L159)
- **Nguyên nhân gốc rễ:**
  - Khi học viên rút khỏi lớp (`dropStudent`), `Enrollment.status` chuyển thành `DROPPED` và `User.status` chuyển về `PENDING_CLASS`.
  - Nếu Admin hoặc Superadmin tạm khóa học viên đó sang `INACTIVE`, tài khoản bị kẹt ở mọi ngả:
    1. Chuyển `INACTIVE -> ACTIVE` bị chặn vì `hasActiveOrCompletedEnrollment` là `false` (`student-crud.service.ts:L256`, `user-role-status.service.ts:L149`).
    2. Chuyển `INACTIVE -> PENDING_CLASS` cũng bị chặn vì `hasEverBeenEnrolled` là `true` do có bản ghi lịch sử `DROPPED` (`student-crud.service.ts:L266`, `user-role-status.service.ts:L154`).
    3. Thêm vào lớp mới (`POST /classes/:id/enrollments`) từ chối học viên `INACTIVE` (`class-enrollment.service.ts:L65`), và xếp lớp ban đầu (`assign-initial-class`) từ chối học viên không ở trạng thái `PENDING_CLASS`.
- **Hướng khắc phục triệt để:** Trong `student-crud.service.ts:L263-271` và `user-role-status.service.ts:L154-158`, chỉ chặn chuyển về `PENDING_CLASS` khi `hasActiveOrCompletedEnrollment === true` (học viên chỉ có bản ghi `DROPPED` hợp lệ ở trạng thái `PENDING_CLASS`).

---

#### `BUG-QA-10` [Must Fix | Polling Write Amplification | Backend] — Mỗi lần học viên poll thông báo trong 24h trước hạn nộp bài đều mở transaction ghi trùng lặp `ASSIGNMENT_DUE_SOON` vào PostgreSQL
- **Vị trí mã nguồn:**
  - [notification-deadline.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/notifications/services/notification-deadline.service.ts#L50-L170)
- **Nguyên nhân gốc rễ:** `dispatchDueSoonReminders` không kiểm tra xem thông báo `due_soon:<assignmentId>:<dueAtMs>` đã tồn tại trong bảng `notifications` hay chưa trước khi mở `this.prisma.$transaction(...)` (`L167`) và chạy `INSERT ... ON CONFLICT DO NOTHING`. Ngoài ra, khi `lastStudentCheckAt.size >= 2000` (`L59-61`), lệnh `.clear()` xóa trắng toàn bộ 2.000 mốc thời gian cùng lúc gây hiệu ứng thác lũ truy vấn (`cache stampede`).
- **Hướng khắc phục triệt để:** Lọc bỏ các `dedupKey` đã tồn tại trong bảng `notifications` của `recipientId` trước khi mở `$transaction`, và khi Map đầy `2000` phần tử thì chỉ xóa phần tử cũ nhất (`this.lastStudentCheckAt.keys().next().value`) thay vì `.clear()`.

---

#### `BUG-QA-11` [Must Fix | Missing Notification Trigger | Backend] — Tự động thu bài nháp hết hạn (`submitExpiredDrafts`) khi Giáo viên/Admin mở bảng chấm bài bỏ sót việc tạo thông báo `SUBMISSION_PENDING_GRADING`
- **Vị trí mã nguồn:**
  - [grading-tracker.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/grading/services/grading-tracker.service.ts#L66-L86)
- **Nguyên nhân gốc rễ:** Khác với `StudentSubmissionService.finalizeExpiredReadDraft` (`student-submission.service.ts:L153-156`), hàm `GradingTrackerService.submitExpiredDrafts` chuyển các bài `IN_PROGRESS` đã hết hạn sang `SUBMITTED_WAITING` nhưng không gọi `academicNotifications.onSubmissionPendingGradingTx(...)`.
- **Hướng khắc phục triệt để:** Inject `@Optional() private readonly academicNotifications?: NotificationAcademicTriggersService` vào `GradingTrackerService` và gọi `onSubmissionPendingGradingTx` cho các bài nháp vừa được tự động thu.

---

### Nhóm B — Bug Giao Diện, A11y, Phân Trang, Tìm Kiếm & Hiệu Năng (`Should Fix` — 6 Bug tiêu biểu)

#### `BUG-QA-12` [Should Fix | Accessibility & Keyboard UX | Frontend] — 5 Modal tự viết không dùng `BaseDialog`, không đóng được bằng phím `Escape`, không khóa cuộn nền và không có Focus Trap
- **Vị trí mã nguồn:**
  - [AssignInitialClassModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/components/AssignInitialClassModal.tsx#L95-L100)
  - [BlockedTeacherDeactivationModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/teachers/components/BlockedTeacherDeactivationModal.tsx#L15-L20)
  - [TeacherFormModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/teachers/components/TeacherFormModal.tsx#L119-L124)
  - [CreateSystemUserModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/components/CreateSystemUserModal.tsx#L98-L103)
  - [EditUserRolesModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/components/EditUserRolesModal.tsx#L102-L107)
  - *(Cùng `StudentDetailModal.tsx:L41-50` đã có `Escape` nhưng chưa gắn `useDialogFocusTrap`)*
- **Bằng chứng Live Chromium (`task-923`):** Mở `BlockedTeacherDeactivationModal` trên `/admin/teachers` và nhấn phím `Escape`, modal vẫn đứng yên (`blockedModalClosedByEscape: false`).
- **Hướng khắc phục triệt để:** Bọc 5 modal trên bằng `<BaseDialog>` ([BaseDialog.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/common/components/BaseDialog.tsx#L32-L153)) và gắn `useDialogFocusTrap` vào `StudentDetailModal.tsx`.

---

#### `BUG-QA-13` [Should Fix | Pagination Edge Case | Frontend] — 4 bảng phân trang bị kẹt ở màn hình trống `"Trang 2 / 1"` khi phần tử cuối cùng của trang `> 1` bị chuyển trạng thái hoặc lọc mất
- **Vị trí mã nguồn:**
  - [admin/students/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/students/page.tsx#L74-L76)
  - [admin/teachers/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/teachers/page.tsx#L64-L66)
  - [useSuperadminSettings.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/hooks/useSuperadminSettings.ts#L80-L82)
  - [ClassAssignmentTrackerModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/components/ClassAssignmentTrackerModal.tsx#L90-L92)
- **Hướng khắc phục triệt để:** Thêm kiểm tra lùi trang tự động giống `useClassList.ts:L62-66`: `const lastPage = Math.max(1, Math.ceil(res.total / LIMIT)); if (page > lastPage) { setPage(lastPage); return; }`.

---

#### `BUG-QA-14` [Should Fix | Search Bug | Backend] — Tìm kiếm tên đề thi trên `/teacher/assessments` escape ký tự `_`, `%`, `\` hai lần (`escapeLike`), làm tìm kiếm tên đề có dấu gạch dưới (ví dụ `HSK1_01`) trả về 0 kết quả
- **Vị trí mã nguồn:**
  - [assessment-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/services/assessment-crud.service.ts#L86) (`L332-L334`)
- **Nguyên nhân gốc rễ:** Toán tử `{ title: { contains: ..., mode: 'insensitive' } }` của Prisma đã tự động escape các ký tự đại diện `ILIKE` (`%`, `_`, `\`). Việc bọc thêm `escapeLike(search)` biến `HSK1_01` thành `HSK1\_01`, khiến PostgreSQL tìm chuỗi có dấu backslash thật và không khớp đề `HSK1_01`.
- **Hướng khắc phục triệt để:** Xóa hàm `escapeLike` tại `assessment-crud.service.ts:L332-334` và truyền trực tiếp `search` vào `contains` (đồng bộ với `courses.service.ts:L53` và `user-search.util.ts:L17`).

---

#### `BUG-QA-15` [Should Fix | Bandwidth & Memory Spike | Backend] — Endpoint công khai `GET /api/v1/system-settings/config` đọc PostgreSQL trên mọi lần tải tab và trả về chuỗi base64 Logo nhân đôi 2 lần (`~5.34 MB/request` với logo 2MB) kèm `Cache-Control: no-store`
- **Vị trí mã nguồn:**
  - [system-config.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/system-config.service.ts#L28-L51)
  - [system-settings.controller.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/system-settings.controller.ts#L74-L80)
- **Hướng khắc phục triệt để:** Cache kết quả `SystemConfigResponseDto` trong RAM của `SystemConfigService` (TTL 60 giây, xóa cache ngay khi `updateSystemConfig` được gọi).

---

#### `BUG-QA-16` [Should Fix | Unbounded Memory Load | Backend] — `AdminOverviewService.getOverview` và `SessionQueryService` nạp toàn bộ bản ghi điểm danh của mọi học viên/lớp vào bộ nhớ Node.js
- **Vị trí mã nguồn:**
  - [admin-overview.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/progress/services/admin-overview.service.ts#L84-L98) (`L134-L167`)
  - [session-query.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/schedules/services/session-query.service.ts#L47-L49)
- **Nguyên nhân gốc rễ:**
  - `/progress/admin-overview` kéo toàn bộ `lesson_sessions`, `enrollments`, và `attendance_records` của tất cả các lớp khớp bộ lọc về Node.js để cộng tay trong RAM.
  - `SESSION_DETAIL_INCLUDE` trong `session-query.service.ts` tải `attendanceRecords` của **tất cả bạn cùng lớp** trong mỗi buổi học khi học viên xem lịch học `/student/schedule`, sau đó mới lọc `records.find((r) => r.studentId === actor.id)` tại `session.mapper.ts:L164`.
- **Hướng khắc phục triệt để:** Giới hạn `attendanceRecords` theo `{ where: { studentId: actor.id } }` khi người gọi là `STUDENT`, và chỉ truy vấn `attendance_records` của các buổi `COMPLETED` (hoặc `groupBy` trong SQL) cho `AdminOverviewService`.

---

#### `BUG-QA-17` [Should Fix | QA Harness Environment Pollution | Backend Test Harness] — `qa-environment.mjs` khởi tạo `new PrismaClient()` trong `seedQaFixtures` trước khi spawn backend, làm nạp `backend/.env` (`CORS_ORIGIN=http://localhost:3000`) và ghi đè fallback `http://localhost:3000,http://localhost:3005`
- **Vị trí mã nguồn:**
  - [qa-environment.mjs](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/scripts/qa-environment.mjs#L198-L200) (`L462-L477`)
- **Bằng chứng thực nghiệm:** Khi chạy `node test/scripts/qa-environment.mjs` độc lập từ terminal mà không export trước `CORS_ORIGIN` ngoài shell, `new PrismaClient()` trong `seedQaFixtures` tự động nạp `backend/.env` vào `process.env.CORS_ORIGIN = 'http://localhost:3000'`. Khi tới dòng 476 (`CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000,http://localhost:3005'`), biểu thức `||` lấy `'http://localhost:3000'`, khiến mọi request `POST` từ frontend chạy trên cổng `3005` bị `CsrfOriginPolicy` trả về `403 Forbidden ("Nguồn gửi yêu cầu (Origin) không hợp lệ")`.
- **Hướng khắc phục triệt để:** Tại đầu hàm `main()` của `qa-environment.mjs` (trước khi gọi `seedQaFixtures`), gán rõ `process.env.CORS_ORIGIN ||= 'http://localhost:3000,http://localhost:3005';`.

---

## 4. Phần III — Báo Cáo `ponytail-audit` Toàn Kho Mã Nguồn (Frontend + Backend)

**What this repo does:**
WebEdu là nền tảng quản lý học tập và vận hành học vụ trực tuyến cho **Trung Tâm TD Hán Ngữ** (Backend NestJS 12 REST API + Prisma 6 + PostgreSQL 16; Frontend Next.js 16 App Router + Tailwind CSS 4). Hệ thống quản lý tài khoản nhân sự/học viên (có bảo vệ học viên dưới 16 tuổi với sự đồng ý của phụ huynh), khóa học HSK, lớp học, lịch học định kỳ/học bù, điểm danh với cửa sổ chỉnh sửa T+2 cho giáo viên, ngân hàng đề hỗ trợ bóc tách DOCX/PDF, phòng thi tính giờ với lease heartbeat 15 giây & autosave, chấm điểm tự động kết hợp AI chấm tự luận Zero-PII, báo cáo tiến độ học vụ và hệ thống thông báo in-app.

**Assumed load:**
Một trung tâm ngoại ngữ vào khung giờ cao điểm đổi ca và kiểm tra định kỳ: **200+ học viên thi trực tuyến đồng thời** với nhịp heartbeat 15 giây và autosave 15–30 giây, **20 giáo viên** điểm danh, chấm bài và kích hoạt AI chấm tự luận hàng loạt, cùng **250 tab trình duyệt mở song song** định kỳ poll `/notifications/unread-count`, `/notifications`, hàng chờ xếp lớp và `/system-settings/config`.

---

### Must fix (11 hạng mục)

1. **Học viên có thể bấm F5 để reset số lượt nghe (`audioPlayCounts`) của câu hỏi `LISTENING` và vượt giới hạn `maxListens`** ([useStudentExamSession.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/hooks/useStudentExamSession.ts#L273-L277), [exam-session-transport.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/utils/exam-session-transport.ts#L64-L76))
   - **What this is:** `recordAudioPlay` tăng bộ đếm số lần phát audio cho câu hỏi nghe (`LISTENING`), còn `buildSyncPayload` đóng gói câu trả lời và số lượt nghe để gửi lên server khi autosave hoặc nộp bài.
   - **Problem:** `recordAudioPlay` chỉ cập nhật `snapshot.audioPlayCounts` trong bộ nhớ React mà không đưa `questionId` vào `pending.current`, không lưu vào `localStorage`, và không đặt lịch `flushAutosave`. Vì `buildSyncPayload` chỉ lấy các câu nằm trong `editedIds = new Set(Object.keys(pending.current))` (`useStudentExamSession.ts:L114, L183`), nếu học viên bấm nghe mà chưa chọn/đổi đáp án của câu đó, `audioPlayCount` không bao giờ được gửi lên server. Bấm F5 sẽ nạp lại `audioPlayCount = 0`.
   - **Fix:** Trong `recordAudioPlay(questionId)` (`useStudentExamSession.ts:L273-277`), đưa `questionId` vào `pending.current`, gọi `storePendingExamAnswers`, và đặt lịch `scheduleForType('LISTENING', () => { if (navigator.onLine && !document.hidden) void flushAutosave(); })`.
   - **If we skip it:** Học viên làm bài thi Nghe có giới hạn `maxListens` có thể nghe hết lượt rồi bấm F5 để nghe lại không giới hạn.

2. **Nhiều học viên nộp bài thi cùng lúc làm ghi đè thông báo chờ chấm của giáo viên về số lượng thấp (`"1 bài nộp"` thay vì `"20 bài nộp"`)** ([notification-academic-triggers.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/notifications/services/notification-academic-triggers.service.ts#L231-L261), [student-submission.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/student-submission.service.ts#L237-L254))
   - **What this is:** Khi học viên nộp bài, `onSubmissionPendingGradingTx` đếm số bài đang chờ chấm (`SUBMITTED_WAITING`) của bài tập đó và upsert dòng thông báo `sub_pending:<assignmentId>` cho giáo viên.
   - **Problem:** Hàm chạy bên trong transaction `READ COMMITTED` của từng học viên trong khi dòng `class_assignments` chỉ giữ khóa `FOR SHARE` (`submission-session.util.ts:L218`). Khi 20 học viên cùng nộp bài lúc hết giờ, mỗi transaction gọi `tx.submission.count(...)` (`L241`) trước khi 19 transaction kia commit nên đều đếm được `pendingCount = 1`. Cả 20 transaction sau đó tuần tự chờ khóa tại `ON CONFLICT ("recipient_id", "dedup_key") DO UPDATE` (`notification-dispatch.service.ts:L100-109`), và transaction cuối cùng ghi đè `body` bằng `"1 bài nộp ... đang chờ chấm."`.
   - **Fix:** Tính số lượng `SUBMITTED_WAITING` trực tiếp trong câu SQL `ON CONFLICT DO UPDATE` sau khi đã giữ row lock (hoặc chạy `onSubmissionPendingGradingTx` ngay sau khi transaction nộp bài đã commit).
   - **If we skip it:** Khi cả lớp nộp bài kiểm tra cùng lúc, thông báo của giáo viên chỉ báo có 1 hoặc 2 bài chờ chấm thay vì 20+ bài thực tế.

3. **Mỗi nhịp `autosave` và heartbeat 15 giây trong phòng thi đều đọc lại toàn bộ đề thi, xáo trộn lại toàn bộ câu hỏi và trả nguyên đề thi về HTTP response** ([student-submission.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/student-submission.service.ts#L136-L142), [submission-session.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/submission-session.util.ts#L166-L190))
   - **What this is:** Mỗi 15–30 giây trong phòng thi, mỗi tab học viên gọi `PATCH /api/v1/assignments/:assignmentId/submissions/autosave` để gia hạn lease thời gian làm bài và lưu các đáp án thay đổi.
   - **Problem:** Ngay cả khi `dto.answers` rỗng (`[]`, chỉ là heartbeat đồng hồ) hoặc chỉ có 1 đáp án, `autosave` vẫn gọi `loadAssignmentForSession` (`submission-session.util.ts:L166-190`), tải toàn bộ câu hỏi và payload JSON 32 KB của đề thi từ PostgreSQL, tải `submission_answers` 2 lần (`L210`, `L376`), chạy HMAC-SHA256 shuffle trên tất cả câu hỏi (`buildStudentExamSessionDto` tại `L529-531`), và gửi toàn bộ đề thi về lại trong HTTP response. Với 200 học viên thi đồng thời, hệ thống gánh 106–213 câu SQL/giây trong transaction có khóa và hàng trăm MB JSON mỗi phút.
   - **Fix:** Trong `autosave`, chỉ tải các câu hỏi có mặt trong `dto.answers` khi `dto.answers.length > 0`, và không tải/shuffle lại toàn bộ đề thi khi bài làm chưa hết giờ.
   - **If we skip it:** Một ca thi 200 học viên đồng thời sẽ làm bão hòa I/O PostgreSQL, connection pool và CPU/GC của Node.js cứ mỗi 15 giây.

4. **Giáo viên chấm bài hoặc chạy AI chấm hàng loạt khóa độc quyền `FOR UPDATE` trên bảng `classes`, làm nghẽn toàn bộ request `autosave` phòng thi của học viên cùng lớp** ([grading-locking.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/grading/services/grading-locking.util.ts#L61-L86), [submission-session.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/submission-session.util.ts#L214-L221))
   - **What this is:** Trước khi lưu điểm chấm tay, chấm tự động, nháp AI, xác nhận/công bố điểm hoặc phúc khảo, các service chấm bài khóa dòng `classes` qua `lockClassRowForSubmissionTx` / `lockClassRowForAssignmentTx`.
   - **Problem:** Cả hai helper đều chạy `SELECT id FROM "classes" ... FOR UPDATE` (`grading-locking.util.ts:L68, L83`) dù không sửa bảng `classes`. Vì mọi request `autosave`, `start`, `submit` và phát audio của học viên đều xin khóa `FOR SHARE OF c` trên bảng `classes` (`submission-session.util.ts:L218`), giáo viên chấm bài hoặc chạy AI batch grading sẽ chặn trực tiếp các nhịp heartbeat 15 giây của học viên trong lớp đó.
   - **Fix:** Đổi `FOR UPDATE` thành `FOR SHARE` trong `lockClassRowForAssignmentTx` và `lockClassRowForSubmissionTx` (`grading-locking.util.ts:L68, L83`).
   - **If we skip it:** Giáo viên chấm bài tập cũ hoặc chạy AI chấm hàng loạt sẽ làm khựng luồng autosave và gia hạn đồng hồ phòng thi của học viên đang làm bài trong lớp đó.

5. **Học viên từng được xếp lớp nhưng đã rút khỏi lớp (`DROPPED`), nếu sau đó bị chuyển sang `INACTIVE` thì bị kẹt vĩnh viễn không thể kích hoạt lại hoặc xếp lớp mới** ([class-enrollment.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/services/class-enrollment.service.ts#L288-L297), [student-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/services/student-crud.service.ts#L243-L272), [user-role-status.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/user-role-status.service.ts#L143-L159))
   - **What this is:** Các chốt chặn chuyển trạng thái trong `StudentCrudService` và `UserRoleStatusService` ngăn việc kích hoạt học viên chưa có lớp hoặc đưa học viên đang học về lại `PENDING_CLASS`.
   - **Problem:** Khi học viên rút khỏi lớp (`dropStudent`), `Enrollment.status` chuyển thành `DROPPED` và `User.status` về `PENDING_CLASS`. Nếu sau đó học viên bị tạm khóa sang `INACTIVE`, tài khoản bị kẹt hoàn toàn: `INACTIVE -> ACTIVE` bị từ chối vì `hasActiveOrCompletedEnrollment = false`, còn `INACTIVE -> PENDING_CLASS` cũng bị từ chối vì `hasEverBeenEnrolled = true` (do có bản ghi `DROPPED`).
   - **Fix:** Trong `student-crud.service.ts:L263-271` và `user-role-status.service.ts:L154-158`, chỉ chặn `nextStatus === UserStatus.PENDING_CLASS` khi `hasActiveOrCompletedEnrollment` là `true`.
   - **If we skip it:** Bất kỳ học viên nào rút khỏi lớp rồi bị tạm khóa `INACTIVE` sẽ không bao giờ có thể được kích hoạt lại hoặc xếp vào lớp mới qua bất kỳ API nào.

6. **Khi nhận thông báo mới hoặc click vào thông báo trùng với route đang mở, trang dữ liệu đang hiển thị không tự động làm mới** ([NotificationBellPopover.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/notifications/components/NotificationBellPopover.tsx#L78-L81), [useNotifications.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/notifications/hooks/useNotifications.ts#L55-L89))
   - **What this is:** Khi `useNotifications` phát hiện `unreadCount` tăng lên hoặc khi người dùng click vào một dòng thông báo trong `NotificationBellPopover`, ứng dụng gọi `router.push(href)`.
   - **Problem:** `useNotifications` chỉ cập nhật con số trên quả chuông Topbar; các trang dữ liệu đang mở chỉ fetch khi mount. Nếu người dùng đang đứng sẵn ở `/student/assignments` hoặc `/student/results` và click vào thông báo trỏ tới chính route đó, `router.push(href)` không remount hay chạy lại `useEffect`.
   - **Fix:** Phát sự kiện `window.dispatchEvent(new CustomEvent('webedu:notifications-changed'))` trong `useNotifications.ts` khi `unreadCount` tăng hoặc khi click thông báo trùng `window.location.pathname`, và lắng nghe tại các trang dữ liệu.
   - **If we skip it:** Người dùng thấy chuông báo có điểm mới hoặc bài tập mới, bấm vào thông báo, popover đóng lại nhưng màn hình trước mặt vẫn hiển thị dữ liệu cũ cho tới khi bấm F5.

7. **Mỗi lần học viên poll thông báo trong 24h trước hạn nộp bài đều mở transaction ghi trùng lặp `ASSIGNMENT_DUE_SOON` vào PostgreSQL** ([notification-deadline.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/notifications/services/notification-deadline.service.ts#L50-L170))
   - **What this is:** Khi học viên poll `/notifications/unread-count` (throttle 55s) hoặc `/notifications` (throttle 5s), cùng timer nền 15 phút, `NotificationDeadlineService` quét các bài tập sắp đến hạn trong 24h để tạo thông báo `ASSIGNMENT_DUE_SOON`.
   - **Problem:** `dispatchDueSoonReminders` (`L83-169`) không kiểm tra xem thông báo `due_soon:<assignmentId>:<dueAtMs>` đã được tạo chưa, nên mọi lần poll sau ngưỡng throttle suốt 24h đều truy vấn lại `classAssignment.findMany`, mở transaction ghi `$transaction` (`L167`) và chạy `INSERT ... ON CONFLICT DO NOTHING`. Ngoài ra `.clear()` khi Map đạt 2.000 phần tử (`L59-61`) gây stampede truy vấn đồng loạt.
   - **Fix:** Lọc bỏ các `inputs` có `dedupKey` đã tồn tại trong `notifications` của `recipientId` trước khi mở `$transaction`, và chỉ xóa key cũ nhất khi Map đầy.
   - **If we skip it:** Trong 24 giờ trước kỳ thi, 200 tab học viên sẽ kích hoạt hàng nghìn transaction ghi dư thừa mỗi giờ.

8. **Tự động thu bài nháp hết hạn (`submitExpiredDrafts`) khi Giáo viên/Admin mở bảng chấm bài bỏ sót việc tạo thông báo `SUBMISSION_PENDING_GRADING`** ([grading-tracker.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/grading/services/grading-tracker.service.ts#L66-L86))
   - **What this is:** Khi giáo viên hoặc admin gọi `GET /api/v1/assignments/:assignmentId/grading-tracker` hoặc `POST /api/v1/assignments/:assignmentId/overdue-zero`, `submitExpiredDrafts` tự động thu các bài nháp `IN_PROGRESS` đã quá hạn.
   - **Problem:** `GradingTrackerService.submitExpiredDrafts` (`L79-84`) chuyển trạng thái sang `SUBMITTED_WAITING` nhưng không gọi `academicNotifications.onSubmissionPendingGradingTx`.
   - **Fix:** Inject `NotificationAcademicTriggersService` vào `GradingTrackerService` và gọi `onSubmissionPendingGradingTx` sau khi thu bài nháp quá hạn.
   - **If we skip it:** Khi giáo viên mở bảng theo dõi sau hạn nộp bài trước khi học viên tự tải lại trang, các bài nháp tự động thu sẽ không tạo hoặc cập nhật thông báo chờ chấm cho giáo viên.

9. **Vô hiệu hóa hoặc kích hoạt lại học viên `PENDING_CLASS` trong `StudentDetailModal` làm lệch số đếm badge `"Chờ xếp lớp"` trên Sidebar** ([useStudentDetailForm.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/hooks/useStudentDetailForm.ts#L177-L187))
   - **What this is:** Drawer chi tiết học viên tại `/admin/students` cho phép Admin vô hiệu hóa học viên `PENDING_CLASS` sang `INACTIVE` hoặc kích hoạt lại về `PENDING_CLASS`.
   - **Problem:** Sau khi `await updateStudent(...)` thành công tại `useStudentDetailForm.ts:L186`, hàm không gọi `notifyPendingEnrollmentUpdated()`.
   - **Fix:** Gọi `notifyPendingEnrollmentUpdated()` sau `await updateStudent(...)` tại `useStudentDetailForm.ts:L186`.
   - **If we skip it:** Badge `"Chờ xếp lớp"` trên Sidebar của Admin hiển thị sai số lượng ngay sau khi khóa hoặc mở khóa học viên chưa xếp lớp.

10. **Cập nhật `fullName` trên `/profile` không cập nhật tên hoặc chữ viết tắt avatar trên `PortalTopbar` & `SidebarFooter`** ([profile/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/profile/page.tsx#L48-L49), [usePortalSession.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/auth/hooks/usePortalSession.ts#L103-L121))
    - **What this is:** Trang `/profile` cho phép đổi họ tên, số điện thoại và email, trong khi `PortalShell` hiển thị họ tên và chữ viết tắt trên Topbar và Sidebar.
    - **Problem:** `ProfilePage` giữ state `user` riêng qua `usePortalProfileSession()`, và `recheckSession` trong `usePortalSession.ts:L105-109` chỉ cập nhật state khi `id`, `status`, hoặc `roles` thay đổi, bỏ qua `fullName`, `email`, `phone`.
    - **Fix:** Bổ sung kiểm tra `prev.fullName !== fresh.fullName || prev.email !== fresh.email || prev.phone !== fresh.phone` trong `usePortalSession.ts:L105-109` và đồng bộ `PortalSessionContext` sau khi lưu hồ sơ.
    - **If we skip it:** Sau khi đổi tên trên `/profile`, Topbar và Sidebar vẫn hiển thị tên cũ cho tới khi F5.

11. **`usePendingEnrollmentCount` tải toàn bộ danh sách học viên chờ xếp lớp mỗi lần `window.focus` thay vì `{ page: 1, limit: 1 }`** ([usePendingEnrollmentCount.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/hooks/usePendingEnrollmentCount.ts#L25-L34))
    - **What this is:** Hook lấy số lượng học viên chờ xếp lớp cho badge Sidebar của Admin khi mount và mỗi khi `window.focus` / `visibilitychange`.
    - **Problem:** Gọi `listPendingEnrollmentStudents()` không có tham số `limit`, tải nguyên trang hồ sơ học viên qua mạng mỗi lần Admin chuyển cửa sổ chỉ để đọc `res.totalPending`.
    - **Fix:** Truyền `{ page: 1, limit: 1 }` vào `listPendingEnrollmentStudents({ page: 1, limit: 1 })` tại dòng 27.
    - **If we skip it:** Mỗi lần Admin alt-tab quay lại trình duyệt đều tải payload danh sách học viên dư thừa chỉ để vẽ 1 số nguyên trên badge.

---

### Should fix (16 hạng mục)

12. **6 Modal tự viết không dùng `BaseDialog`, thiếu Focus Trap bàn phím, khóa cuộn trang và đóng bằng phím `Escape`** ([AssignInitialClassModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/components/AssignInitialClassModal.tsx#L95-L100), [TeacherFormModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/teachers/components/TeacherFormModal.tsx#L119-L124), [BlockedTeacherDeactivationModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/teachers/components/BlockedTeacherDeactivationModal.tsx#L15-L20), [CreateSystemUserModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/components/CreateSystemUserModal.tsx#L98-L103), [EditUserRolesModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/components/EditUserRolesModal.tsx#L102-L107), [StudentDetailModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/components/StudentDetailModal.tsx#L41-L50))
    - **What this is:** Các hộp thoại tạo/sửa giáo viên, xếp lớp ban đầu, cảnh báo khóa giáo viên, tạo/sửa tài khoản hệ thống và drawer hồ sơ học viên.
    - **Problem:** 5 modal căn giữa tự dựng `<div role="dialog">` mà không dùng `<BaseDialog>`, không đóng được khi bấm `Escape`, không khóa `document.body.style.overflow` và cho phép `Tab` nhảy ra các nút phía sau lớp phủ.
    - **Fix:** Bọc 5 modal căn giữa bằng `<BaseDialog>` (tiết kiệm ~110 dòng mã) và gắn `useDialogFocusTrap` cho `StudentDetailModal.tsx`.
    - **If we skip it:** Người dùng bàn phím có thể `Tab` ra ngoài modal đang mở và không thể bấm `Escape` để đóng hộp thoại.

13. **5 bảng phân trang bị kẹt ở màn hình trống `"Trang 2 / 1"` khi phần tử cuối cùng trên trang `> 1` bị xóa/chuyển trạng thái** ([admin/students/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/students/page.tsx#L74-L76), [admin/teachers/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/teachers/page.tsx#L64-L66), [useSuperadminSettings.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/hooks/useSuperadminSettings.ts#L80-L82), [ClassAssignmentTrackerModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/components/ClassAssignmentTrackerModal.tsx#L90-L92))
    - **What this is:** Logic nạp trang dữ liệu cho học viên, giáo viên, tài khoản hệ thống, nhật ký hệ thống và theo dõi bài tập lớp.
    - **Problem:** Không giống `useClassList.ts:L62-66` và `admin/students/pending/page.tsx:L56-59`, 5 bảng này không lùi `page` khi `page > Math.max(1, Math.ceil(res.total / LIMIT))`.
    - **Fix:** Thêm `const lastPage = Math.max(1, Math.ceil(res.total / LIMIT)); if (page > lastPage) { setPage(lastPage); return; }` sau mỗi lần fetch.
    - **If we skip it:** Admin thao tác trên phần tử cuối cùng của trang 2 sẽ thấy bảng báo `"Không tìm thấy..."` và `"Trang 2 / 1"` dù trang 1 vẫn đầy dữ liệu.

14. **4 bản cài đặt thanh phân trang trùng lặp trên các bảng Admin** ([PaginationBar.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/common/components/PaginationBar.tsx#L15-L56), [SettingsPaginationFooter.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/system-settings/components/SettingsPaginationFooter.tsx#L15-L55), [StudentListTable.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/components/StudentListTable.tsx#L116-L138), [TeacherListTable.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/teachers/components/TeacherListTable.tsx#L160-L182), [ClassAssignmentTrackerModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/components/ClassAssignmentTrackerModal.tsx#L260-L293))
    - **What this is:** Thanh điều hướng phân trang Trước/Sau ở chân các bảng dữ liệu.
    - **Problem:** Dự án đã có `<PaginationBar>` dùng chung, nhưng `SettingsPaginationFooter.tsx` là bản sao nguyên mẫu, còn `StudentListTable`, `TeacherListTable`, `ClassAssignmentTrackerModal` tự viết lại JSX phân trang và quên khóa nút Trước/Sau khi `loading === true`.
    - **Fix:** Dùng `<PaginationBar>` ở cả 5 nơi và xóa `SettingsPaginationFooter.tsx` (`-95` dòng).
    - **If we skip it:** Bấm nhanh nút phân trang trên bảng Học viên/Giáo viên khi mạng chậm gây chồng chéo các request fetch trang.

15. **Màu HEX cứng (`#E0DED5`, `#B5322A`, `#1C2320`, `#5A6460`) thay vì biến CSS design token trên tiêu đề `/profile` và `/superadmin/settings`** ([profile/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/profile/page.tsx#L23-L32), [superadmin/settings/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/superadmin/settings/page.tsx#L29-L39))
    - **What this is:** Header của trang Hồ sơ cá nhân và Vận hành hệ thống.
    - **Problem:** Dùng mã HEX cứng từ bản mẫu ban đầu thay vì `var(--line)`, `var(--red)`, `var(--ink)`, `var(--ink-2)` trong `globals.css`.
    - **Fix:** Thay bằng các class token `border-[var(--line)]`, `text-[var(--red)]`, `text-[var(--ink)]`, `text-[var(--ink-2)]`.
    - **If we skip it:** Hai trang này lệch tông nhẹ so với bảng màu chuẩn của toàn bộ 24 route còn lại.

16. **Ô tìm kiếm trên `/admin/students` và `/admin/teachers` dùng độ rộng cố định `w-72` (288px) thay vì `w-full sm:w-72` trên màn hình hẹp** ([admin/students/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/students/page.tsx#L131), [admin/teachers/page.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/app/(portal)/admin/teachers/page.tsx#L148))
    - **What this is:** Ô input tìm kiếm trên thanh công cụ danh sách Học viên và Giáo viên.
    - **Problem:** Đặt cố định `w-72` thay vì responsive `w-full sm:w-72` như `/admin/courses` và `/admin/classes`.
    - **Fix:** Đổi `w-72` thành `w-full sm:w-72`.
    - **If we skip it:** Trên màn hình mobile `320px–375px`, ô tìm kiếm không co giãn linh hoạt theo chiều ngang thẻ bọc.

17. **Endpoint công khai `GET /api/v1/system-settings/config` truy vấn PostgreSQL và trả về 2 bản sao base64 Logo (`~5.34 MB`) với `Cache-Control: no-store` trên mỗi lần mở tab** ([system-config.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/system-config.service.ts#L28-L51), [system-settings.controller.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/system-settings.controller.ts#L74-L80))
    - **What this is:** Endpoint `@Public()` trả về tên trung tâm và logo cho màn hình đăng nhập và `PortalShell`.
    - **Problem:** Logo 2 MB được lưu dưới dạng chuỗi base64 ~2.67 MB và được trả về 2 lần trong cùng JSON (`centerLogoUrl` và `centerLogoBase64`, tổng ~5.34 MB/response) không qua bộ nhớ đệm. Khi 250 tab mở hoặc F5, backend đọc ~670 MB từ PostgreSQL và serialize ~1.33 GB JSON.
    - **Fix:** Cache `SystemConfigResponseDto` trong RAM của `SystemConfigService` (TTL 60s, invalidate ngay khi `updateSystemConfig`).
    - **If we skip it:** 250 tab tải cấu hình thương hiệu với logo 2 MB sẽ gây đột biến băng thông PostgreSQL, bộ nhớ heap Node.js và độ trễ phản hồi.

18. **Tìm kiếm tiêu đề đề thi escape ký tự `%`, `_`, `\` hai lần (`escapeLike`), làm hỏng tìm kiếm các đề có dấu gạch dưới hoặc phần trăm** ([assessment-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/services/assessment-crud.service.ts#L86))
    - **What this is:** `GET /api/v1/assessments?search=...` lọc đề thi theo tiêu đề bằng Prisma `{ title: { contains: ..., mode: 'insensitive' } }`.
    - **Problem:** Dòng 86 bọc `search` trong `escapeLike(search)` (`L332-334`). Vì Prisma `contains` đã tự escape wildcard `ILIKE`, `escapeLike('HSK1_01')` khiến PostgreSQL tìm dấu backslash thật trước dấu `_` và trả về 0 kết quả.
    - **Fix:** Xóa `escapeLike` (`L332-334`) và truyền trực tiếp `search` vào `contains`.
    - **If we skip it:** Giáo viên tìm đề thi có ký tự `_` hoặc `%` (như `HSK1_01`) sẽ không tìm thấy kết quả.

19. **`AdminOverviewService.getOverview` nạp toàn bộ buổi học, ghi danh và bản ghi điểm danh của tất cả các lớp khớp bộ lọc vào RAM Node.js** ([admin-overview.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/progress/services/admin-overview.service.ts#L84-L98))
    - **What this is:** `GET /api/v1/progress/admin-overview` tổng hợp dữ liệu bảng điều khiển Admin.
    - **Problem:** Truy vấn toàn bộ `lessonSession.findMany`, `enrollment.findMany`, và `attendanceRecord.findMany` của mọi `classIds` vào RAM (`L138-166`). Khi bật `includeEnded=true` (hoặc khi có 80+ lớp × 24 buổi × 25 học viên), một request kéo 48.000+ dòng `attendance_records` về Node.js chỉ để tính tỷ lệ chuyên cần trung bình.
    - **Fix:** Chỉ lọc `attendance_records` của các buổi `status: SessionStatus.COMPLETED` (hoặc gộp `groupBy` trong SQL) và giới hạn số lớp truy vấn.
    - **If we skip it:** Khi dữ liệu các khóa học tích lũy qua nhiều kỳ, trang `/admin/overview` sẽ truyền hàng chục nghìn bản ghi mỗi lần mở.

20. **Truy vấn lịch học (`SessionQueryService`) nạp bản ghi điểm danh của toàn bộ bạn cùng lớp vào Node.js trên mỗi buổi học** ([session-query.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/schedules/services/session-query.service.ts#L47-L49), [session.mapper.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/schedules/mappers/session.mapper.ts#L135-L165))
    - **What this is:** `GET /api/v1/schedules/calendar` và `GET /api/v1/classes/:classId/sessions` tải danh sách buổi học dùng `SESSION_DETAIL_INCLUDE`.
    - **Problem:** `SESSION_DETAIL_INCLUDE` tải `attendanceRecords` của tất cả học viên trong lớp trên mỗi buổi học, rồi `session.mapper.ts:L164` mới lọc lấy bản ghi của `actor.id` trong Node.js.
    - **Fix:** Khi `effectiveRole === 'STUDENT'`, giới hạn `attendanceRecords: { where: { studentId: actor.id } }` ngay trong Prisma query.
    - **If we skip it:** Mỗi lần học viên mở lịch học đều tải lượng bản ghi điểm danh gấp ~25 lần mức cần thiết từ PostgreSQL.

21. **Vòng lặp `for` chạy tuần tự `N` câu lệnh `UPDATE` bên trong transaction khi xóa/sắp xếp lại câu hỏi hoặc khi mở lại lớp học có buổi học tự động hủy** ([question-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/services/question-crud.service.ts#L102-L105), [class-session-lifecycle.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/policies/class-session-lifecycle.util.ts#L395-L406))
    - **What this is:** `QuestionCrudService.remove/reorder` đánh lại số thứ tự câu hỏi `position`, và `restoreAutoCancelledSessionsOnReopenInTx` khôi phục các buổi học bị hủy tự động khi mở lại lớp.
    - **Problem:** Cả hai dùng vòng lặp `for` với `await tx.question.update(...)` hoặc `await tx.lessonSession.update(...)` từng dòng một bên trong transaction đang giữ khóa `FOR UPDATE`.
    - **Fix:** Dùng 1 câu lệnh `tx.lessonSession.updateMany(...)` trong `class-session-lifecycle.util.ts:L395-406` (vì partial unique index `lesson_sessions_class_active_num_unique` đã bỏ qua `session_number >= 200000` và dòng 423 gọi `renumberAndSyncFn` bằng `ROW_NUMBER()`), và dùng `tx.question.updateMany({ where: { assessmentId, position: { gt: existing.position } }, data: { position: { decrement: 1 } } })` khi xóa câu hỏi.
    - **If we skip it:** Mở lại lớp học hoặc xóa Câu 1 của đề thi 200 câu thực hiện tới 200 round-trip SQL tuần tự trong khi giữ khóa transaction.

22. **`PrismaService` và `backend/.env.example` chưa cấu hình `connection_limit` và `pool_timeout` cho tải 200+ người dùng đồng thời** ([prisma.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/common/prisma/prisma.service.ts#L5-L19), [backend/.env.example](file:///c:/Users/ASUS/Desktop/WebEdu/backend/.env.example#L12))
    - **What this is:** Cấu hình connection pool PostgreSQL cho Prisma Client.
    - **Problem:** `DATABASE_URL` trong `backend/.env.example:L12` không khai báo `connection_limit` hay `pool_timeout`. Trên máy chủ/container 2 vCPU, Prisma mặc định chỉ mở `num_cpus * 2 + 1 = 5` kết nối. Vì `SessionValidatorService.validateSession` truy vấn `users` trên mọi request xác thực trước khi vào transaction nghiệp vụ, đợt cao điểm 200 học viên thi + 20 giáo viên + 250 tab poll sẽ làm cạn pool 5 kết nối và văng lỗi Prisma `P2024`.
    - **Fix:** Thêm `&connection_limit=25&pool_timeout=20` vào `DATABASE_URL` mẫu trong `backend/.env.example` và tài liệu hóa trong `README.md`.
    - **If we skip it:** Triển khai production trên VPS/container 2–4 vCPU sao chép từ `.env.example` sẽ gặp lỗi timeout pool `P2024` khi thi tập trung.

23. **Mã chết (Dead code) ở Backend: `GradingEventsService` không có subscriber, 2 tệp policy 1 dòng mồ côi, hàm `htmlToPlainText` trùng lặp và `vitest.config.rbac-audit.ts` không dùng** ([grading-events.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/grading/services/grading-events.service.ts#L1-L45), [student-enrollment-facts.policy.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/students/policies/student-enrollment-facts.policy.ts#L1), [teacher-assignment.policy.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/teachers/policies/teacher-assignment.policy.ts#L1), [document-import.parser.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/policies/document-import.parser.ts#L32-L50), [vitest.config.rbac-audit.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/vitest.config.rbac-audit.ts#L1-L11))
    - **What this is:** Các tệp và hàm còn sót lại từ các phase trước không có nơi nào trong mã nguồn production gọi tới.
    - **Problem:** `GradingEventsService` đẩy tới 200 sự kiện vào mảng RAM khi công bố điểm nhưng Phase 9 đã gửi thông báo trực tiếp qua `NotificationAcademicTriggersService.onGradesPublishedTx`; không có module nào subscribe `GradingEventsService`. Hai tệp policy 1 dòng và `vitest.config.rbac-audit.ts` có 0 tham chiếu.
    - **Fix:** Xóa các tệp/hàm không dùng trên (`-85` dòng).
    - **If we skip it:** Mã chết và bộ đệm sự kiện trong RAM không có người đọc tiếp tục tồn tại trong đồ thị module.

24. **Trùng lặp helper `groupByKey` và `selectPrimaryEnrollment` (lệch điều kiện tie-break `createdAt`) cùng danh sách `TRUNCATE TABLE` ở 3 nơi** ([attendance-query.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/attendance/services/attendance-query.service.ts#L20-L37), [progress.mapper.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/progress/mappers/progress.mapper.ts#L19-L40), [seed.mjs](file:///c:/Users/ASUS/Desktop/WebEdu/backend/prisma/seed.mjs#L23-L50), [qa-environment.mjs](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/scripts/qa-environment.mjs#L201-L227), [postgres-test-container.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/helpers/postgres-test-container.ts#L193-L220))
    - **What this is:** Hàm gom nhóm theo khóa, chọn bản ghi ghi danh chính của học viên trong lớp và làm sạch bảng khi seed/test.
    - **Problem:** `selectPrimaryEnrollment` được copy-paste giữa `attendance-query.service.ts` và `progress.mapper.ts` nhưng bản ở `progress.mapper.ts:L38` có thêm nhánh so sánh `createdAt` mà `attendance-query.service.ts:L25` không có.
    - **Fix:** Gom `groupByKey` và `selectPrimaryEnrollment` vào 1 helper dùng chung và tái sử dụng `truncateAllTables` (`-70` dòng).
    - **If we skip it:** Học viên được ghi danh lại trong cùng một ngày có thể bị chọn khác bản ghi enrollment giữa tab Điểm danh và tab Tiến độ.

25. **`scripts/check-loc.js` bỏ qua các tệp `.util.ts`, `.adapter.ts`, `.repository.ts`, để lọt các tệp 390–539 LOC qua cổng CI** ([check-loc.js](file:///c:/Users/ASUS/Desktop/WebEdu/scripts/check-loc.js#L50-L73), [submission-session.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/services/submission-session.util.ts#L1-L539), [class-session-lifecycle.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/classes/policies/class-session-lifecycle.util.ts#L1-L528))
    - **What this is:** Script kiểm tra giới hạn số dòng mã mỗi tệp trong CI (`350` LOC tối đa cho backend service, `250` LOC cho module part).
    - **Problem:** `scripts/check-loc.js` chỉ quét `.service.ts`, `.guard.ts`, và `.(controller|policy|mapper|parser).ts`. Các tệp `.util.ts` và `.adapter.ts` chứa logic nghiệp vụ lớn như `submission-session.util.ts` (`539` LOC) và `class-session-lifecycle.util.ts` (`528` LOC) không nằm trong diện quét.
    - **Fix:** Tách nhỏ 2 tệp `.util.ts` trên theo đúng đơn nhiệm và bổ sung `.util.ts`, `.adapter.ts`, `.repository.ts` vào `scripts/check-loc.js`.
    - **If we skip it:** Các tệp `.util.ts` đa nhiệm trên 500 dòng sẽ tiếp tục phình to ngoài tầm kiểm soát của cổng LOC CI.

26. **`SystemUsersService.createSystemUser` khóa toàn bộ các dòng Superadmin đang hoạt động khi tạo bất kỳ tài khoản nhân sự nào và âm thầm bỏ qua `CreateSystemUserDto.status`** ([system-users.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/system-users.service.ts#L115-L131), [system-settings.dto.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/dto/system-settings.dto.ts#L75-L78))
    - **What this is:** `POST /api/v1/system-settings/users` tạo mới tài khoản quản trị/giáo viên.
    - **Problem:** Dòng 115 gọi `lockUserAndActiveSuperadmins(tx, actor.id)` và `assertAnotherActiveSuperadminRemains(...)` dù thao tác tạo tài khoản mới không bao giờ hạ quyền hay vô hiệu hóa Superadmin nào. Ngoài ra `CreateSystemUserDto` khai báo trường tùy chọn `status?: UserStatus` nhưng service gán cứng `status: UserStatus.ACTIVE` (`L130`).
    - **Fix:** Chỉ gọi `assertFreshActiveSuperadminActorInTx(tx, actor, ...)` khi tạo tài khoản mới và bỏ trường `status` không dùng khỏi `CreateSystemUserDto`.
    - **If we skip it:** Client gửi `status: 'INACTIVE'` khi tạo user theo schema Swagger nhưng luôn nhận về tài khoản `ACTIVE`.

27. **Tinh chỉnh cấu hình CI & скрипт vận hành production (`bootstrap-superadmin.mjs`, `.github/workflows/ci.yml`, `qa-environment.mjs`)** ([ci.yml](file:///c:/Users/ASUS/Desktop/WebEdu/.github/workflows/ci.yml#L45-L48), [bootstrap-superadmin.mjs](file:///c:/Users/ASUS/Desktop/WebEdu/backend/prisma/bootstrap-superadmin.mjs#L3), [qa-environment.mjs](file:///c:/Users/ASUS/Desktop/WebEdu/backend/test/scripts/qa-environment.mjs#L458-L478))
    - **What this is:** Cấu hình biến môi trường cấp job trên GitHub Actions, script khởi tạo Superadmin trên production và script khởi chạy môi trường QA.
    - **Problem:**
      - `bootstrap-superadmin.mjs:L3` import trực tiếp từ `../src/common/auth/password-hash.util.ts` thay vì `../dist/...`, sẽ lỗi nếu Docker image production chỉ copy thư mục `dist/`.
      - `qa-environment.mjs` gọi `seedQaFixtures` (`new PrismaClient()`) trước khi gán `CORS_ORIGIN`, làm nạp `backend/.env` (`http://localhost:3000`) nếu shell chưa đặt `CORS_ORIGIN`.
      - Job `backend-gates` trong `.github/workflows/ci.yml:L45-48` chưa khai báo tường minh `NODE_ENV: test` ở mức `env:` của job.
    - **Fix:** Thêm `process.env.CORS_ORIGIN ||= 'http://localhost:3000,http://localhost:3005'` ở đầu `main()` trong `qa-environment.mjs`, thêm `NODE_ENV: test` vào `ci.yml`, và hỗ trợ import từ `dist/` trong `bootstrap-superadmin.mjs`.
    - **If we skip it:** Chạy `npm run bootstrap:superadmin` trong container production tối giản (không chứa `src/`) hoặc chạy tay `qa-environment.mjs` không kèm biến môi trường `CORS_ORIGIN` sẽ phát sinh lỗi.

---

### Nice to have (5 hạng mục)

28. **Mã chết / export không có nơi gọi ở Frontend** ([auth-api.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/lib/auth-api.ts#L1-L8), [nav-links.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/components/layout/nav-links.ts#L204-L211), [exam-draft.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/assignments/utils/exam-draft.ts#L626-L631))
    - **What this is:** File barrel re-export `frontend/src/lib/auth-api.ts`, hàm `getNavLinks` và hàm `parseIncomingDraftUpdate`.
    - **Problem:** Có `0` nơi import trong toàn bộ `frontend/src` và `frontend/e2e`.
    - **Fix:** Xóa `frontend/src/lib/auth-api.ts`, `getNavLinks` và `parseIncomingDraftUpdate` (`-22` dòng).
    - **If we skip it:** Các hàm không dùng vẫn nằm lại trong codebase.

29. **4 bản sao hàm tính ngày ISO theo múi giờ Việt Nam (`getTodayVnIsoDate`) và 2 bản sao hàm lấy chữ viết tắt tên người dùng ở Frontend** ([schedule.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/classes/utils/schedule.util.ts#L35-L42), [AssignInitialClassModal.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/components/AssignInitialClassModal.tsx#L13-L21), [useCalendarSchedule.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/schedules/hooks/useCalendarSchedule.ts#L9-L11), [StudentAttendanceView.tsx](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/attendance/components/StudentAttendanceView.tsx#L32-L35), [nav-links.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/components/layout/nav-links.ts#L112-L120), [useStudentDetailForm.ts](file:///c:/Users/ASUS/Desktop/WebEdu/frontend/src/features/students/hooks/useStudentDetailForm.ts#L116-L122))
    - **What this is:** Các hàm tiện ích lấy chuỗi `YYYY-MM-DD` theo `Asia/Ho_Chi_Minh` và lấy 2 ký tự viết tắt họ tên.
    - **Problem:** Được viết lặp lại ở 4 nơi (cho ngày VN) và 2 nơi (cho chữ viết tắt) thay vì import từ `frontend/src/lib/utils/date.ts` và `nav-links.ts`.
    - **Fix:** Export `getTodayVnIsoDate()` từ `frontend/src/lib/utils/date.ts` và tái sử dụng `getUserInitials()` từ `nav-links.ts` (`-28` dòng).
    - **If we skip it:** Các bản sao tiện ích ngày giờ nằm rải rác ở nhiều feature.

30. **`SmtpEmailProvider.sendEmail` khởi tạo mới `nodemailer.createTransport(...)` trên mỗi bức email mà không tái sử dụng kết nối** ([smtp-email.provider.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/common/mail/smtp-email.provider.ts#L64-L87))
    - **What this is:** Dịch vụ gửi mã OTP đăng ký, đổi email và khôi phục mật khẩu qua SMTP.
    - **Problem:** Mỗi lần gọi `sendEmail` đều tạo mới đối tượng `Transporter` và bắt tay TCP + TLS lại từ đầu với máy chủ SMTP.
    - **Fix:** Cache instance `Transporter` theo bộ cấu hình `(host, port, secure, smtpUser, smtpPass)`.
    - **If we skip it:** Mỗi email OTP/khôi phục mật khẩu tốn thêm ~300–800 ms bắt tay SMTP.

31. **Tệp media mồ côi trên đĩa khi câu hỏi nháp bị xóa hoặc đổi `mediaId` trước khi phát hành đề, cùng câu lệnh `tx.questionMedia.deleteMany` trên bảng không dùng** ([question-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/services/question-crud.service.ts#L56-L107), [assessment-crud.service.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assessments/services/assessment-crud.service.ts#L152))
    - **What this is:** Tải tệp âm thanh/hình ảnh (`POST /assessments/:id/media`) lưu vào thư mục `uploads/media/` và bảng `media_assets`.
    - **Problem:** Nếu giáo viên tải tệp lên đề nháp rồi xóa câu hỏi hoặc thay tệp khác trước khi publish, các bản ghi `media_assets` và tệp trên ổ đĩa không được dọn dẹp.
    - **Fix:** Khi publish đề thi trong `AssessmentCrudService.publish`, dọn các bản ghi `media_assets` của đề đó không nằm trong `collectPayloadMediaIds(existing.questions)` và xóa tệp tương ứng trên đĩa.
    - **If we skip it:** Các tệp audio/ảnh nháp không dùng sẽ tích tụ dần trên ổ đĩa `uploads/media`.

32. **`env.validation.ts` và `backend/.env.example` chưa liệt kê 4 biến môi trường tùy chọn `AI_CONFIG_ENCRYPTION_KEY`, `EXAM_SHUFFLE_SECRET`, `TRUST_PROXY`, `UPLOAD_DIR`** ([env.validation.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/config/env.validation.ts#L20-L98), [ai-config-crypto.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/system-settings/services/ai-config-crypto.util.ts#L9-L25), [submission-payload.util.ts](file:///c:/Users/ASUS/Desktop/WebEdu/backend/src/modules/assignments/policies/submission-payload.util.ts#L6-L16))
    - **What this is:** Kiểm tra biến môi trường khi khởi động và tệp mẫu `.env.example` cho vận hành production.
    - **Problem:** `ai-config-crypto.util.ts` dùng `AI_CONFIG_ENCRYPTION_KEY || JWT_SECRET` để mã hóa AES-256-GCM cho API key AI, và `submission-payload.util.ts` dùng `EXAM_SHUFFLE_SECRET || JWT_SECRET` để xáo trộn đề thi. Nếu DevOps không biết để đặt riêng 2 biến này mà dùng chung `JWT_SECRET`, khi xoay vòng (rotate) `JWT_SECRET` trên production sẽ làm mất khả năng giải mã API key AI đã lưu trong DB và làm đổi thứ tự đáp án của các bài thi đang diễn ra.
    - **Fix:** Khai báo tường minh `AI_CONFIG_ENCRYPTION_KEY`, `EXAM_SHUFFLE_SECRET`, `TRUST_PROXY`, `UPLOAD_DIR` trong `EnvironmentVariables` (`env.validation.ts`) và `backend/.env.example`.
    - **If we skip it:** Xoay vòng `JWT_SECRET` trên production sẽ làm vô hiệu hóa API key AI đã lưu nếu `AI_CONFIG_ENCRYPTION_KEY` chưa được tách riêng.

---

### Kết luận Ponytail Audit
- **Verdict:** Nền tảng bảo mật, phân quyền RBAC, bất biến Zero-Leak và kiến trúc giao dịch được xây dựng rất chắc chắn (vượt qua toàn bộ 658 test backend và 158 test frontend/E2E); tuy nhiên **nên khắc phục 11 hạng mục `Must fix` (Mục 1–11)** trước khi mở tải thật 200+ học viên thi đồng thời để đảm bảo đồng bộ UI tức thì, chống F5 reset lượt nghe và loại bỏ nghẽn khóa DB khi nộp bài/chấm bài hàng loạt.
- **Lean:** **`-420 lines, 0 dependencies possible`** (`-245` dòng ở Frontend từ việc dùng chung `<BaseDialog>`, `<PaginationBar>`, xóa dead code và gom hàm ngày giờ/initials; `-175` dòng ở Backend từ việc xóa `GradingEventsService`, 2 tệp policy mồ côi, `vitest.config.rbac-audit.ts`, `escapeLike`, `htmlToPlainText` trùng lặp và gom `selectPrimaryEnrollment` / `truncateAllTables`).
- **Not checked:** Kiểm thử tải thực tế trên cụm nhiều máy chủ vật lý (Multi-Node Load Test) và tích hợp Object Storage S3/R2 bên ngoài (hiện lưu trữ media trên ổ đĩa cục bộ `UPLOAD_DIR` theo ghi chú `shortcut:` tại `document-extract.ts:L201`).

---

## 5. Phần IV — Bảng Kiểm Chứng Sẵn Sàng Cho GitHub Actions CI & Production Deployment

| Hạng mục kiểm chứng | Trạng thái hiện tại | Chi tiết kỹ thuật & Khuyến nghị trước khi Go-Live |
| :--- | :---: | :--- |
| **1. GitHub Actions CI (`.github/workflows/ci.yml`) — Job `backend-gates`** | **PASS 100%** | Đã pass `check-loc.js`, `prisma migrate deploy` (25 migrations), `typecheck`, `lint`, `build`, `test:cov` (591 tests), `test:integration` (20 tests), `test:e2e` (80 tests). *Khuyến nghị nhỏ:* thêm `NODE_ENV: test` ở cấp job `env:`. |
| **2. GitHub Actions CI (`.github/workflows/ci.yml`) — Job `frontend-and-browser-qa`** | **PASS 100%** | Đã pass `typecheck`, `lint`, `test:unit` (47 tests), `build` (29 routes), `test:e2e` (111 Playwright tests trên Chromium Desktop & Mobile). |
| **3. Cookie Security, CORS & Reverse Proxy (`TRUST_PROXY`)** | **SẴN SÀNG** | `httpOnly: true`, `sameSite: 'lax'`, `secure: NODE_ENV === 'production'`. `main.ts` bật `trust proxy = 1` khi `TRUST_PROXY=1` và fail-fast nếu thiếu `CORS_ORIGIN` hoặc dùng `JWT_SECRET` mặc định trên production. |
| **4. Tách khóa mã hóa AI & Shuffle đề thi (`AI_CONFIG_ENCRYPTION_KEY`, `EXAM_SHUFFLE_SECRET`)** | **CẦN CẤU HÌNH KHI DEPLOY** | Đặt giá trị độc lập với `JWT_SECRET` trên môi trường production (và bổ sung vào `.env.example` theo Finding #32) để xoay vòng `JWT_SECRET` an toàn. |
| **5. Kích thước Connection Pool PostgreSQL (`DATABASE_URL`)** | **CẦN CẤU HÌNH KHI DEPLOY** | Thêm `&connection_limit=25&pool_timeout=20` vào `DATABASE_URL` trên production (Finding #22) để phục vụ 200+ học viên thi đồng thời. |
| **6. Lưu trữ tệp tải lên (`UPLOAD_DIR`)** | **SẴN SÀNG (1 NODE)** | Mount persistent volume cho `UPLOAD_DIR` (`uploads/media`) khi triển khai container đơn node; nếu scale ngang nhiều replica thì chuyển sang S3/R2 theo đúng `shortcut:` đã đánh dấu tại `document-extract.ts:L201`. |

---

## 6. Lộ Trình Đề Xuất Cho Phiên Fix Bug Tiếp Theo

Khi bạn yêu cầu bắt đầu phiên sửa lỗi (`Fix Phase`), chúng ta có thể xử lý gọn toàn bộ báo cáo này trong **2 đợt commit nhỏ gọn, an toàn 100%**:
1. **Đợt 1 — Fix Backend Concurrency, Scale & Edge Cases (`BUG-QA-06` → `BUG-QA-11`, `BUG-QA-14` → `BUG-QA-17` + Lean Cleanup `-175 LOC`):**
   - Khắc phục race condition đếm bài chờ chấm (`onSubmissionPendingGradingTx`), tối ưu nhẹ payload `autosave`, đổi `FOR UPDATE` → `FOR SHARE` trên `grading-locking.util.ts`, mở khóa trạng thái cho học viên `DROPPED -> INACTIVE -> PENDING_CLASS`, lọc `dedupKey` trước khi mở transaction `ASSIGNMENT_DUE_SOON`, bổ sung trigger thông báo khi `submitExpiredDrafts`, cache 60s cho `/system-settings/config`, xóa `escapeLike` thừa và dọn mã chết Backend.
2. **Đợt 2 — Fix Frontend Real-Time Sync, Exam Audio Integrity & Modal A11y (`BUG-QA-01` → `BUG-QA-05`, `BUG-QA-12` → `BUG-QA-13` + Lean Cleanup `-245 LOC`):**
   - Lưu & đồng bộ tức thì `recordAudioPlay` chống F5 reset lượt nghe, phát sự kiện `webedu:notifications-changed` để tự động làm mới trang dữ liệu đang mở khi có thông báo mới hoặc khi click thông báo cùng route, gọi `notifyPendingEnrollmentUpdated()` trong `useStudentDetailForm.ts`, đồng bộ `fullName` lên `PortalShell` ngay khi lưu `/profile`, truyền `{ page: 1, limit: 1 }` cho `usePendingEnrollmentCount`, bọc 5 modal vào `<BaseDialog>` và tự động lùi trang khi trang cuối rỗng.
