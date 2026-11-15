# Implementation Sub-Plan: Phase 7 — Module 07: Chấm Điểm Rule-Based, AI Gợi Ý Tự Luận & Công Bố Điểm 2 Bước

> **Ngày lập kế hoạch:** 15/11/2026  
> **Phạm vi:** `FUNC-056`, `FUNC-057` *(khôi phục theo `DEC-036`)*, `FUNC-058`, `FUNC-059`, `FUNC-060`, `FUNC-061`, `FUNC-062`, `FUNC-063`, `FUNC-064`  
> **Gate Decisions đã chốt:** `DEC-036`, `DEC-037` (`GRADE-01`), `DEC-038` (`GRADE-02`)  
> **Tham chiếu thiết kế:** [07-cham-diem.md](file:///c:/Users/ASUS/Desktop/WebEdu/TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/modules/07-cham-diem.md), [decision-log.md](file:///c:/Users/ASUS/Desktop/WebEdu/TD_Han_Ngu_Project_Context_v1.0/docs/01-business/decision-log.md)

---

## 1. Mục Tiêu & Ràng Buộc Kiến Trúc Cốt Lõi

Phase 7 hoàn thiện vòng đời sau khi học viên nộp bài từ Phase 6 (`Submission.status = SUBMITTED_WAITING | AUTO_GRADED_PENDING_REVIEW`), bảo đảm chấm điểm chính xác, hỗ trợ AI gợi ý an toàn cho câu tự luận, tách biệt hoàn toàn bước **Xác nhận điểm** và **Công bố điểm**, và giữ vết kiểm toán đầy đủ khi chỉnh sửa điểm.

### 1.1 Quy Tắc Nghiệp Vụ & Bảo Mật Bắt Buộc

1. **Zero-Leak Gate cho Học viên (`FUNC-063`, `DEC-012`, `DEC-013`):**
   - Học viên chỉ được xem điểm số, chi tiết đúng/sai từng câu, đáp án đúng, giải thích đáp án và nhận xét giáo viên khi `Submission.status === 'RETURNED'` (tương ứng trạng thái nghiệp vụ `PUBLISHED`).
   - Với mọi trạng thái khác (`IN_PROGRESS`, `SUBMITTED_WAITING`, `AUTO_GRADED_PENDING_REVIEW`, `GRADED`, `SUPERSEDED`), API phía học viên **tuyệt đối không trả về** `autoScore`, `totalScore`, `isCorrect`, `earnedPoints`, `teacherFeedback`, `teacherComment`, hay đáp án đúng (`correctAnswer`).
   - Các trường nháp AI (`aiSuggestedPoints`, `aiFeedback`) **không bao giờ** được trả về ở endpoint học viên ở bất kỳ trạng thái nào (kể cả sau khi `RETURNED`).

2. **Rule-Based Auto-Grading Chuẩn Xác (`FUNC-056`, `DEC-037`):**
   - **Chọn nhiều đáp án đúng (`MULTIPLE_CHOICE` multi-select & `IMAGE_BASED` multi-select):** Áp dụng công thức *partial credit có trừ điểm chọn sai*: với `K` đáp án đúng và điểm tối đa `P`:
     $$\text{raw} = \left(\text{số chọn đúng} - \text{số chọn sai}\right) \times \frac{P}{K}$$
     lấy sàn `max(0, raw)` và làm tròn về bội số `0.25`.
   - **Chọn một đáp án (`MULTIPLE_CHOICE` single, `IMAGE_BASED` single):** Chọn đúng đạt `P`, sai đạt `0`.
   - **Điền từ (`FILL_BLANK`) & Sắp xếp (`ORDERING`):** Chuẩn hóa câu trả lời và đáp án mẫu theo pipeline: `Unicode NFKC` $\rightarrow$ `trim()` $\rightarrow$ gộp chuỗi khoảng trắng liên tiếp thành 1 dấu cách $\rightarrow$ bỏ dấu câu kết thúc câu (`.`, `。`, `!`, `！`, `?`, `？`). Mặc định so sánh không phân biệt chữ hoa/thường, trừ khi câu hỏi có cờ `pinyinSensitive === true`.
   - **Bước điểm thống nhất toàn hệ thống:** Tất cả điểm thành phần và tổng điểm đều quy chuẩn theo bội số `0.25`.
   - **Trạng thái chuyển tiếp sau nộp bài:**
     - Nếu bài chỉ có câu khách quan: tự động tính `autoScore` và có thể điền nháp `totalScore = autoScore`, nhưng `Submission.status` chuyển về `AUTO_GRADED_PENDING_REVIEW` (hoặc `SUBMITTED_WAITING` chờ GV xác nhận — tuyệt đối không nhảy thẳng sang `RETURNED`).
     - Nếu bài có ít nhất 1 câu `ESSAY` (hoặc `AUDIO_RESPONSE` cần nghe/chấm tay): chấm phần khách quan vào `autoScore` và chuyển `SUBMITTED_WAITING` (giáo viên chấm phần tự luận).

3. **AI Gợi Ý Chấm Tự Luận Đa Nhà Cung Cấp Động (`FUNC-057`, `DEC-036`):**
   - **Cấu hình tập trung:** Chỉ vai trò `SUPERADMIN` mới được xem/cập nhật cấu hình AI tại `/superadmin/settings` qua endpoint riêng `/api/v1/system-settings/ai-grading`. Cấu hình AI **không bao giờ** được trả về qua endpoint public `/api/v1/system-settings/config`.
   - **Hỗ trợ 3 nhà cung cấp (`AiProviderType`):**
     - `OPENAI`: OpenAI Chat Completions / Responses API (`baseUrl` mặc định `https://api.openai.com/v1`).
     - `GEMINI`: Google Gemini REST API (`generateContent`).
     - `CUSTOM`: Endpoint tương thích chuẩn OpenAI (`/chat/completions`) cho Ollama, vLLM, Groq, Together, LM Studio, Azure-compatible proxy...
   - **Bảo mật cấu hình & khóa:**
     - `apiKey` được mã hóa bằng `AES-256-GCM` trước khi lưu trong bảng `system_settings` (dùng secret khóa mã hóa từ biến môi trường; response API và UI luôn mask `••••` — hỗ trợ giữ nguyên key cũ nếu admin không nhập key mới).
     - **SSRF Protection:** Validate `CUSTOM` `baseUrl` (chặn loopback nội bộ/metadata IP `169.254.169.254`, yêu cầu `https://` ở production hoặc danh sách protocol/host hợp lệ theo cấu hình môi trường an toàn) + timeout chặt chẽ (ví dụ `15s`) + nút **Test Connection**.
   - **Kích hoạt theo yêu cầu (`On-Demand`) & Zero-PII:**
     - Tuyệt đối không chạy AI lúc học viên nộp bài. Chỉ chạy khi Giáo viên hoặc Admin bấm nút `"Gợi ý chấm bằng AI"` cho 1 bài hoặc theo lô bài nộp chưa chấm.
     - Chỉ xử lý câu loại `ESSAY` (`prompt`, `points`, `sampleAnswer`, `rubric`, `studentAnswer`). Không gửi `studentId`, `fullName`, `email`, `phone`, `className` hay bất kỳ PII nào lên LLM.
     - Kết quả AI parse JSON có validate schema: `aiSuggestedPoints` được `clamp(0, points)` và làm tròn bước `0.25`; lưu cùng `aiFeedback` vào `SubmissionAnswer` và cập nhật `Submission.gradingStatus = AI_DRAFT_READY`. Nếu lỗi mạng/provider/timeout/thiếu cấu hình, hệ thống không làm gián đoạn luồng chấm thủ công và báo thông điệp fallback rõ ràng cho GV.

4. **Quy Trình 2 Bước, Bài Quá Hạn & Kiểm Toán Sửa Điểm (`FUNC-059..062`, `FUNC-064`, `DEC-038`):**
   - **Mapping trạng thái với Prisma `SubmissionStatus` hiện hữu (không sửa phá hủy enum):**
     - Business status `TEACHER_CONFIRMED` $\leftrightarrow$ `SubmissionStatus.GRADED` (`FUNC-059`).
     - Business status `PUBLISHED` $\leftrightarrow$ `SubmissionStatus.RETURNED` (`FUNC-060`).
   - **Xác nhận $\rightarrow$ Công bố tách biệt:**
     - GV kiểm tra xong toàn bộ câu hỏi của bài nộp $\rightarrow$ bấm **"Xác nhận điểm"** $\rightarrow$ kiểm tra mọi câu tự luận đã có điểm hợp lệ $\rightarrow$ tính lại `totalScore`, lưu `gradedById`, `gradedAt`, chuyển `Submission.status = GRADED`, `gradingStatus = GRADED`.
     - Nút **"Công bố điểm"** (`RETURNED`) **chỉ công bố** những bài đang ở trạng thái `GRADED`. Học viên quá hạn chưa nộp vẫn giữ nguyên trạng thái hiển thị *Quá hạn chưa nộp*.
     - **Nút ghi `0 điểm` cho bài quá hạn chưa nộp:** Cung cấp hành động tường minh riêng biệt cho GV/Admin trên bảng theo dõi (`FUNC-062`) để tạo bản ghi `Submission` `0 điểm` kèm lý do/xác nhận khi giáo viên thực sự muốn chốt `0` cho học viên không nộp sau hạn `dueAt`.
   - **Chỉnh sửa điểm sau xác nhận hoặc sau công bố (`FUNC-061`, `FUNC-064`):**
     - Cả **Giáo viên phụ trách hiện tại của lớp** và **Admin** đều có quyền sửa điểm sau khi `GRADED` hoặc `RETURNED`, với điều kiện **bắt buộc nhập `reason` (không rỗng)**.
     - Mọi thay đổi ghi ngay một dòng bất biến vào `GradeAuditLog` (`submissionId`, `answerId?`, `actorId`, `oldScore`, `newScore`, `reason`, `createdAt`).
     - Nếu bài đang ở trạng thái `RETURNED`, điểm mới cập nhật ngay cho học viên và cập nhật `Submission.gradeUpdatedAt = now()` để UI hiển thị huy hiệu `"Đã cập nhật dd/mm/yyyy"`.

---

## 2. Hợp Đồng Dữ Liệu & Interface Giữa Các Module

### 2.1 Cập Nhật Prisma Schema (Additive Only)

Tái sử dụng các enum & bảng từ Phase 6 (`SubmissionStatus`, `GradingStatus`, `Submission`, `SubmissionAnswer`, `SystemSetting`):

1. **`Submission`** *(bổ sung 1 cột)*:
   - `gradeUpdatedAt DateTime?` — cập nhật khi chỉnh sửa điểm ở trạng thái `RETURNED`.
2. **`SubmissionAnswer`** *(bổ sung 2 cột)*:
   - `aiSuggestedPoints Decimal? @db.Decimal(6, 2)` — điểm gợi ý nháp từ AI cho câu `ESSAY` (không lộ sang học viên).
   - `teacherEdited Boolean @default(false)` — đánh dấu câu đã được GV/Admin chỉnh sửa thủ công so với auto-score/AI.
3. **`GradeAuditLog`** *(model mới)*:
   - `id String @id @default(cuid())`
   - `submissionId String` (FK $\rightarrow$ `Submission.id`, index `[submissionId, createdAt]`)
   - `answerId String?` (FK $\rightarrow$ `SubmissionAnswer.id`, tùy chọn khi sửa từng câu)
   - `actorId String` (FK $\rightarrow$ `User.id`)
   - `oldScore Decimal @db.Decimal(6, 2)`
   - `newScore Decimal @db.Decimal(6, 2)`
   - `reason String @db.Text`
   - `createdAt DateTime @default(now())`
4. **`SystemSetting` (đã có trong DB):**
   - Lưu JSON mã hóa dưới key nội bộ `ai_grading_config` (không nằm trong allowlist public của `/system-settings/config`).

### 2.2 Domain Event Contract Cho Phase 9

- Emit `AssignmentScoresPublishedEvent` (`assignmentId`, `classId`, `submissionIds`, `studentIds`, `publishedById`, `publishedAt`) mỗi khi công bố điểm (`GRADED` $\rightarrow$ `RETURNED`) để Module 10 (Thông báo In-App ở Phase 9) lắng nghe không cần sửa code Phase 7.

---

## 3. Kế Hoạch Thực Thi Theo Vertical Slices (Slices 7.1 – 7.6)

### Slice 7.1: Rule-Based Auto-Grading Engine (`FUNC-056`, `DEC-037`)
- **Mục tiêu:** Chấm tự động 100% deterministic cho mọi câu hỏi có đáp án xác định, tuân thủ `DEC-037` và làm tròn `0.25`.
- **Phạm vi file dự kiến:**
  - `backend/src/modules/grading/policies/answer-normalizer.policy.ts` (`NFKC`, `trim`, collapse whitespace, strip trailing punctuation `.。!！?？`, optional `pinyinSensitive`).
  - `backend/src/modules/grading/policies/auto-grading.policy.ts` (single/multi-select `MULTIPLE_CHOICE`, `IMAGE_BASED` với `+P/K` & `-P/K` sàn `0`, `FILL_BLANK`, `ORDERING`, round `0.25`).
  - `backend/src/modules/grading/services/auto-grading.service.ts` (tích hợp chạy ngay khi học viên/system nộp bài `submitAttempt` ở Phase 6 hoặc re-grade phần khách quan).
  - Unit tests đầy đủ ca biên tiếng Trung/Pinyin, dấu câu Toàn giác/Bán giác, chọn dư đáp án sai, tổng làm tròn `0.25`.
- **DoD:** Mọi ca biên rule-based có unit test xanh; `Submission.autoScore` và `SubmissionAnswer.earnedPoints` / `isCorrect` được ghi chính xác khi nộp bài; bài không chuyển sang `GRADED`/`RETURNED`.

### Slice 7.2: Dynamic Multi-Provider AI Config & On-Demand Essay Grading (`FUNC-057`, `DEC-036`)
- **Mục tiêu:** Superadmin cấu hình động `OPENAI` / `GEMINI` / `CUSTOM`, mã hóa `AES-256-GCM`, và Giáo viên/Admin kích hoạt AI gợi ý chấm câu `ESSAY` theo yêu cầu.
- **Phạm vi file dự kiến:**
  - `backend/src/modules/system-settings/services/ai-config-crypto.util.ts` (`AES-256-GCM` encrypt/decrypt + key masking `••••`).
  - `backend/src/modules/system-settings/services/ai-grading-config.service.ts` & controller endpoint `/api/v1/system-settings/ai-grading` (`@Roles(Role.SUPERADMIN)`, `GET`, `PUT`, `POST /test`, SSRF guard cho `CUSTOM` `baseUrl`).
  - `backend/src/modules/grading/adapters/ai-provider.adapter.ts` + 3 adapters (`openai`, `gemini`, `custom-openai-compatible`) dùng `fetch` chuẩn + timeout + strict JSON output parsing.
  - `backend/src/modules/grading/services/ai-essay-grading.service.ts` (Zero-PII prompt builder, clamp `0..points`, round `0.25`, batch/single on-demand endpoint, fallback error message khi mất kết nối/sai key/chưa bật).
  - Unit tests cho crypto, SSRF guard, masking, Zero-PII payload assertion, clamp/rounding, và mocked HTTP adapter cho cả 3 providers.
- **DoD:** Public `/system-settings/config` không rò bất kỳ field AI nào; payload gửi AI không chứa PII; điểm gợi ý AI chỉ lưu vào `aiSuggestedPoints` + `aiFeedback` dưới dạng nháp.

### Slice 7.3: Teacher Grading Workspace API & Submission Tracker (`FUNC-058`, `FUNC-062`, `DEC-038`)
- **Mục tiêu:** Cung cấp API để GV/Admin xem danh sách theo dõi từng bài tập, lọc học viên theo trạng thái, chấm tay câu tự luận/nghe, sửa điểm câu hỏi, và thao tác ghi `0 điểm` tường minh cho bài quá hạn chưa nộp.
- **Phạm vi file dự kiến:**
  - `backend/prisma/schema.prisma` + migration cho `GradeAuditLog`, `Submission.gradeUpdatedAt`, `SubmissionAnswer.aiSuggestedPoints`, `SubmissionAnswer.teacherEdited`.
  - `backend/src/modules/grading/grading.module.ts` & `grading-tracker.service.ts` (trả tổng hợp học viên đang học trong lớp: Đã nộp, Quá hạn chưa nộp, Chưa tới hạn chưa nộp, `AUTO_GRADED_PENDING_REVIEW`, `SUBMITTED_WAITING`, `GRADED`, `RETURNED`).
  - `backend/src/modules/grading/services/teacher-grading.service.ts` (chấm điểm câu `ESSAY`, áp dụng nhanh gợi ý AI, nhập nhận xét câu/bài, validation điểm bội `0.25` trong `0..question.points`).
  - `backend/src/modules/grading/services/overdue-zero.service.ts` (hành động riêng biệt chốt `0 điểm` cho học viên quá hạn chưa nộp sau `dueAt`).
- **DoD:** GV chỉ thao tác được trên lớp mình phụ trách hiện tại; Admin thao tác được toàn trường; học viên quá hạn chưa nộp mặc định không bị ghi `0 điểm` tự động.

### Slice 7.4: 2-Step Confirm/Publish, Post-Publish Edit + `GradeAuditLog` & Zero-Leak Gate (`FUNC-059..061`, `FUNC-063`, `FUNC-064`, `DEC-038`)
- **Mục tiêu:** Thực thi state machine 2 bước `GRADED` $\rightarrow$ `RETURNED`, khóa Zero-Leak cho học viên, hỗ trợ sửa điểm sau xác nhận/công bố bắt buộc kèm `reason`, và phát sự kiện `AssignmentScoresPublishedEvent`.
- **Phạm vi file dự kiến:**
  - `backend/src/modules/grading/services/grade-publication.service.ts`:
    - `confirmSubmission` / batch confirm (`FUNC-059`): kiểm tra mọi câu đã chấm điểm $\rightarrow$ chuyển `GRADED` (`TEACHER_CONFIRMED`).
    - `publishAssignmentGrades` (`FUNC-060`): **chỉ** chuyển các bài đang `GRADED` sang `RETURNED` (`PUBLISHED`), ghi `returnedAt`, emit `AssignmentScoresPublishedEvent`.
  - `backend/src/modules/grading/services/grade-adjustment.service.ts` (`FUNC-061`, `FUNC-064`): sửa điểm câu hỏi hoặc tổng bài sau khi `GRADED`/`RETURNED`, bắt buộc `reason.trim().length > 0`, ghi `GradeAuditLog`, cập nhật `Submission.gradeUpdatedAt` nếu đang `RETURNED`.
  - `backend/src/modules/grading/repositories/published-grades.repository.ts` & student result endpoint (`FUNC-063`): chặn 100% dữ liệu điểm/đáp án khi `status !== 'RETURNED'` và loại bỏ hoàn toàn `aiSuggestedPoints` / `aiFeedback` khỏi serializer học viên.
- **DoD:** Integration tests + Negative Security Tests chứng minh học viên gọi trực tiếp endpoint kết quả khi bài đang `SUBMITTED_WAITING`, `AUTO_GRADED_PENDING_REVIEW`, hoặc `GRADED` nhận phản hồi an toàn không chứa điểm, đúng/sai, hay đáp án; sửa điểm thiếu `reason` bị từ chối `400 Bad Request`.

### Slice 7.5: Superadmin AI Settings UI & Teacher Grading / Publication Console
- **Mục tiêu:** Xây dựng giao diện tiếng Việt trực quan, thân thiện người dùng non-tech cho Superadmin và Giáo viên/Admin.
- **Phạm vi file dự kiến:**
  - `frontend/src/features/system-settings/` — bổ sung thẻ **Cấu hình AI Gợi ý Chấm Tự luận (`FUNC-057`)** trên `/superadmin/settings`: chọn provider (`OpenAI` / `Google Gemini` / `Custom OpenAI-Compatible`), `Base URL`, `Model`, `API Key` (hiện trạng thái đã cấu hình/mask, không ghi đè key cũ nếu để trống), nút **Kiểm tra kết nối**, nút **Lưu cấu hình AI** tách biệt hoàn toàn với form `#cfg-center-name` / `"Lưu cấu hình hệ thống"` hiện hữu (đảm bảo không vỡ E2E Phase 2).
  - `frontend/src/features/grading/` & routes `/teacher/grading`, `/teacher/assignments/[assignmentId]/grading`:
    - Bảng theo dõi 1 màn hình: tab lọc *Tất cả*, *Cần chấm*, *Đã xác nhận (`Chờ công bố`)*, *Đã công bố*, *Quá hạn chưa nộp*.
    - Màn hình chấm chi tiết: xem kết quả tự động, cột **Gợi ý AI** hiển thị nhãn rõ *Nháp gợi ý — Học viên chưa thấy* kèm nút **"Gợi ý chấm bằng AI"** (theo bài hoặc hàng loạt) và nút **"Áp dụng gợi ý AI"** một chạm; nhập điểm bước `0.25` + nhận xét.
    - Thanh hành động 2 bước rõ ràng: Bước 1 **"Xác nhận điểm"** $\rightarrow$ Bước 2 **"Công bố điểm các bài đã xác nhận"** (hiển thị số bài sẽ công bố và số bài quá hạn chưa nộp không bị tác động); nút riêng **"Ghi 0 điểm (Quá hạn chưa nộp)"** có hộp thoại xác nhận; modal **"Chỉnh sửa điểm & Lịch sử thay đổi"** bắt buộc nhập lý do.

### Slice 7.6: Student Published Result UI, Security Verification & Phase 7 Gate
- **Mục tiêu:** Hoàn thiện giao diện Học viên xem kết quả sau công bố, bổ sung kiểm thử E2E end-to-end toàn luồng Phase 7 và chạy đủ cổng kiểm soát chất lượng.
- **Phạm vi file dự kiến:**
  - `frontend/src/features/assignments/` & `/student/assignments/[assignmentId]/result`:
    - Nếu bài chưa `RETURNED`: hiển thị trạng thái dễ hiểu (*"Bài đã nộp — Đang chờ giáo viên chấm và công bố điểm"*), **không render** bất kỳ điểm số hay đáp án nào.
    - Nếu bài đã `RETURNED`: hiển thị tổng điểm, trạng thái/huy hiệu `"Đã cập nhật dd/mm/yyyy"` nếu có `gradeUpdatedAt`, nhận xét tổng bài, và từng câu hỏi kèm điểm đạt được, đáp án học viên chọn, đáp án đúng và giải thích.
  - `frontend/e2e/phase07-grading-publication.spec.ts`:
    - Test `SUPERADMIN` cấu hình AI (mocked/test provider) + xác nhận endpoint public không rò key.
    - Test học viên nộp bài có cả trắc nghiệm/điền từ + tự luận $\rightarrow$ kiểm tra trang học viên + API trả về Zero-Leak trước khi công bố.
    - Test GV bấm `"Gợi ý chấm bằng AI"` (mock adapter ở test env) $\rightarrow$ xác nhận điểm (`GRADED`) $\rightarrow$ học viên vẫn chưa thấy điểm $\rightarrow$ bấm `"Công bố điểm"` (`RETURNED`) $\rightarrow$ học viên xem được kết quả; quá hạn chưa nộp vẫn giữ trạng thái riêng.
    - Test GV/Admin sửa điểm sau công bố bắt buộc nhập lý do $\rightarrow$ ghi `GradeAuditLog` & hiện `"Đã cập nhật dd/mm/yyyy"` ở phía học viên.
  - **Verification Gate cuối Phase 7:** `node scripts/check-loc.js`, `backend` unit + integration/e2e tests + build, `frontend` `typecheck`, `lint`, `test:unit`, `build`, và Playwright E2E xanh hoàn toàn; cập nhật `PROJECT_PROGRESS.md`.

---

## 4. Rủi Ro & Biện Pháp Kiểm Soát

| Rủi ro | Biện pháp kiểm soát |
|---|---|
| Rò rỉ `apiKey` AI ra client hoặc log | Mã hóa `AES-256-GCM`, chỉ endpoint `SUPERADMIN` trả key đã mask `••••`, tuyệt đối không log prompt/headers/key ở level `info`. |
| SSRF qua `CUSTOM` `baseUrl` | Kiểm tra URL scheme (`https:` / môi trường dev an toàn), chặn dải IP private/loopback/link-local (`169.254.0.0/16`, `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `::1`) trước khi gọi `fetch`. |
| Phá vỡ E2E Phase 2 ở `/superadmin/settings` | Tách thẻ/form cấu hình AI thành block độc lập với test ID và nút riêng, giữ nguyên `#cfg-center-name`, nút `"Lưu cấu hình hệ thống"` và action `UPDATE_SYSTEM_CONFIG`. |
| Rò điểm nháp AI hoặc điểm trước `RETURNED` | Tách DTO học viên riêng ở tầng Repository/Mapper (`PublishedGradesRepository`) chỉ chọn cột an toàn và chỉ hoạt động khi `status === 'RETURNED'`. |
| Sai số dấu phẩy động khi cộng/chia điểm `P/K` | Dùng phép làm tròn chuẩn `Math.round(value * 4) / 4` (hoặc số nguyên phần tư `quarters`) cho mọi tính toán `0.25`. |
