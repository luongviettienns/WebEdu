# Phase 5 Implementation Plan: Module 06 (P1) — Question Bank & Word/PDF Import (`FUNC-039..050`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** GV/Admin tạo đề thủ công với 7 dạng câu HSK, upload Word/PDF để hệ thống trích câu hỏi nháp, GV duyệt trước khi phát hành — HV chưa thấy đáp án đúng ở bất kỳ endpoint nào.

**Trạng thái đối soát (13/11/2026):** **ĐANG Ở NHÁNH `feature/phase-05-question-bank-and-import` (CHƯA MERGE `develop`)** — Backend & Frontend Module 06 (P1) đã cài đặt và pass unit/integration/E2E/Playwright hiện có (`#7`), nhưng còn các bug/gap mở bên dưới cần user quyết định trước khi merge `develop` và mở Phase 6.

**Đối soát triển khai thực tế (`#7`):**
- **Schema & Migrations:** Đã thêm 4 models (`Assessment`, `Question`, `MediaAsset`, `QuestionMedia`) qua 3 migrations (`20261113090000_phase05_assessments`, `20261113120000_phase05_assessment_original_and_description`, `20261113130000_phase05_media_assessment_id`), nâng tổng schema lên **22 models / 13 migrations**. Lưu ý: `QuestionMedia` đã có trong schema nhưng hiện chưa được ghi bản ghi trong luồng upload/import.
- **API & UI:** `AssessmentsController` thực tế cung cấp **17 HTTP endpoints** (gồm `PATCH /assessments/:id/questions/:qid`, `DELETE /assessments/:id/questions/:qid`, `GET /assessments/:id/original`, `GET /assessments/:id/media/:mediaId`, ...); guard trả `409` khi `isLocked || PUBLISHED`, `403` khi `TEACHER` không phải chủ sở hữu, và `POST /assessments/:id/questions` trả `201`. Frontend thêm `/teacher/assessments` (`ALLOWED_ROLES = ['ADMIN', 'TEACHER']`), nâng tổng số lên **21 `page.tsx` (`24` Next build entries)**.
- **Open Backlog từ audit `#7` (xem chi tiết tại [TECH_DEBT_AND_SECURITY_BACKLOG.md](../TECH_DEBT_AND_SECURITY_BACKLOG.md)):**
  - `QB-BUG-01`: `QuestionTypeFields.tsx` sinh option ID bằng `97 + options.length` (trùng ID khi xóa option giữa), `IMAGE_BASED` thiếu xóa ảnh/multi/text-only; `QuestionSchemaPolicy` chưa validate kiểu `pinyinSensitive`; `QuestionCrudService.update` tự clear `needsReview`; inactive course vẫn được chấp nhận khi tạo/import đề.
  - `QB-SEC-01`: `DocumentImportService` khi tách ảnh nhúng `.docx` bỏ qua kiểm tra magic bytes.
  - `QB-UI-01`: `AssessmentEditor` thiếu nút `Phát hành`, `Xóa câu`, reorder và sửa `prompt`/`points` câu có sẵn; `ImportReviewPane` thiếu nút `Xuống`, ô sửa `points` từng câu và `Lưu nháp` chỉ cập nhật trạng thái UI.
  - `TD-09`: `PortalTopbar` `ROUTE_LABELS` chưa có nhãn cho route Phase 3–5 và `nav-links.ts` còn thiếu ánh xạ một số route đa vai trò.

**Architecture:** Module `assessments/` mới theo đúng Anti-God-File của Phase 4 (`policies/` pure + `services/` ≤350 LOC + `mappers/`). Câu hỏi lưu polymorphic: cột chung (`prompt`, `points`, `position`) + `payload JSONB` validate theo từng dạng câu. Upload dùng multipart `FileInterceptor` (repo chưa có — logo hiện đi base64 qua JSON, không tái dùng được). Parse `.docx` bằng `mammoth`, `.pdf` có lớp chữ bằng `pdfjs-dist`; `.doc` cũ và PDF scan từ chối ngay với message rõ — không hứa nhận diện 100%.

**Tech Stack:** NestJS 12, Prisma 6.4.1 (PostgreSQL 16), Next.js 16 + Tailwind, Vitest, Playwright. Thêm mới: `mammoth`, `pdfjs-dist` (backend).

**Spec:** `TD_Han_Ngu_Project_Context_v1.0/docs/02-requirements/modules/06-bai-tap-ngan-hang-de.md`, `MASTER_PLAN.md` (Phase 5), `decision-log.md` (`DEC-012`, `DEC-013`), `open-issues.md` (`ASSIGN-01` TBD-DEFERRED).

## Global Constraints

- `tsc --noEmit`, `oxlint --type-aware`, eslint: 0 warnings/errors; cấm `any`, `@ts-ignore`.
- Backend service ≤ 350 LOC, frontend page ≤ 250 LOC (`node scripts/check-loc.js`); mọi `useEffect` gọi API gắn `AbortController`.
- Chỉ `ADMIN` + GV tạo/sửa đề; HV không bao giờ nhận `correctAnswer`/`explanation` qua DTO (Zero-Leak, tiền đề Phase 7 `FUNC-063`).
- Đề đã có bài làm (Phase 6 dùng sau): khóa sửa câu hỏi, chỉ cho nhân bản — schema chuẩn bị `isLocked` ngay từ Task 5.1.
- Upload: `.docx`/`.pdf` ≤ 20MB, audio `.mp3/.m4a/.wav` ≤ 20MB, ảnh `.jpg/.png` ≤ 5MB; kiểm magic bytes, không tin MIME client.
- Không nút "Dùng file mẫu demo" (Cleanup #5), không text `FUNC-xxx` trên production UI.
- `ASSIGN-01` chưa có file mẫu thực tế → parser ở mức best-effort + cờ `needsReview`; mọi câu import bắt buộc qua màn duyệt `FUNC-042` mới phát hành được.

## Review Focus

- HV gọi API GV (IDOR đề chưa phát hành) → phải 403/404, có test cho từng endpoint.
- File giả `.docx` (zip chứa script) / PDF.alpha → từ chối bằng magic bytes + giới hạn dung lượng, không crash worker parse.
- Câu trắc nghiệm `correctOptionIds` rỗng hoặc trỏ option không tồn tại → DTO chặn, DB check constraint đỡ.
- Audio/ảnh đính kèm bị xóa file nhưng row còn → GET trả 404 thân thiện, không vỡ trang soạn đề.
- Đề Nháp gắn cờ phát hành lén qua API (`status: PUBLISHED` khi còn câu `needsReview`) → service chặn, test pin.

---

### Task 5.1: Schema `Assessment`/`Question`/`MediaAsset` + upload media an toàn (`FUNC-049, 050` nền)

**Files:**
- Create: `backend/prisma/migrations/20261113090000_phase05_assessments/migration.sql`
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/src/modules/assessments/policies/media-upload.policy.ts` (pure: check magic bytes, size, ext)
- Test: `backend/src/modules/assessments/policies/media-upload.policy.spec.ts`

**Interfaces:**
- Consumes: `PrismaService`, `AssessmentAccessPolicy` *(plan cũ dự kiến `ClassAccessService`, thực tế Phase 5 chưa giao bài nên dùng `AssessmentAccessPolicy`)*.
- Produces: `AssessmentStatus (DRAFT|PUBLISHED)`, `QuestionType (7 giá trị)`, `MediaAsset {id, kind: AUDIO|IMAGE, mime, sizeBytes, storageKey}`; `assertSafeUpload(buffer, ext) -> {mime} | throw 400`.

- [x] **Step 1: Write the failing test** — `media-upload.policy.spec.ts`: buffer `%PDF` gắn ext `.mp3` → throw; buffer PNG thật > 5MB → throw; MP3 thật ≤ 20MB → pass.
- [x] **Step 2: Run it** — `npm --prefix backend run test -- --run src/modules/assessments` → FAIL (file chưa tồn tại).
- [x] **Step 3: Implement** schema Prisma: `Assessment(id, title≤200, description?, type: HOMEWORK|MINI_TEST|MIDTERM|FINAL, courseId, durationMinutes?, status=DRAFT, isLocked=false, originalFileName?, originalStorageKey?, createdById)`; `Question(id, assessmentId, type, position, prompt, payload Json, points>0, needsReview=false)` + **`@@unique([assessmentId, position])`** *(plan cũ ghi `totalPoints derived` & partial unique — thực tế không có cột `totalPoints` và dùng `@@unique` chuẩn)*; `MediaAsset(id, kind, mime, sizeBytes, storageKey @unique, assessmentId?)`; `QuestionMedia(questionId, mediaAssetId, role)` *(chưa ghi từ CRUD)*. Migration SQL + `media-upload.policy.ts` (magic bytes PNG `89 50 4E 47`, JPG `FF D8 FF`, MP3 `ID3`/frame sync, WAV `RIFF....WAVE`, M4A `ftyp`).
- [x] **Step 4: Run tests + migrate dry-run** — unit PASS; `prisma migrate diff` không lỗi.
- [x] **Step 5: Commit** — `feat(phase-05): assessment schema and safe media upload policy`.

### Task 5.2: CRUD đề + biên tập thủ công 7 dạng câu (`FUNC-039, 043..050`)

**Files:**
- Create: `backend/src/modules/assessments/{assessments.module.ts,assessments.controller.ts,dto/assessments.dto.ts}`
- Create: `backend/src/modules/assessments/policies/{assessment-access.policy.ts,question-schema.policy.ts}` (pure)
- Create: `backend/src/modules/assessments/services/assessment-crud.service.ts`, `services/question-crud.service.ts`
- Create: `backend/src/modules/assessments/mappers/assessment.mapper.ts` (2 view: `TeacherDetailDto` full vs `StudentSafeDto` — Task này chỉ teacher view; student view để Phase 6)
- Test: `backend/src/modules/assessments/services/assessment-crud.service.spec.ts`, `policies/question-schema.policy.spec.ts`

**Interfaces:**
- Consumes: `assertSafeUpload` (Task 5.1), `AssessmentAccessPolicy` *(thay cho `ClassAccessService` trong plan cũ)*, `AssessmentStatus`, `QuestionType`.
- Produces: `POST/GET/PATCH/DELETE /api/v1/assessments`, `GET /assessments/:id/original`, `GET/POST /assessments/:id/media`, `GET /assessments/:id/media/:mediaId`, `POST /assessments/:id/questions`, `PATCH/DELETE /assessments/:id/questions/:qid` *(plan cũ ghi `PUT`)*, `PUT /assessments/:id/questions/reorder`, `POST /assessments/:id/duplicate`, `POST /assessments/:id/publish` (`201`); `TeacherAssessmentDto` (có đáp án) — tuyệt đối chưa có student endpoint.

- [x] **Step 1: Write failing tests** — policy spec: 7 payload mẫu (1 đúng + 1 sai mỗi dạng, lấy giá trị từ module spec: trắc nghiệm 1 đáp án đúng 1/4; nhiều đáp án ≥2 đúng; điền từ có `acceptedAnswers`; sắp xếp có `tokens`; viết có `maxLength`; nghe bắt buộc `mediaId`; ảnh bắt buộc `mediaId`); service spec: publish khi còn `needsReview=true` → 400; sửa câu khi `isLocked` / `PUBLISHED` → **`409 Conflict`** trong `assertEditableAssessment` *(`403` cho GV khác chủ sở hữu; plan cũ ghi nhầm `403` cho `isLocked`)*; xóa đề `PUBLISHED`/`isLocked` → `409`.
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** — DTO validation + policy switch theo `QuestionType` (điểm > 0, trắc nghiệm 2–4 options, `correctOptionIds` ⊆ options, điền từ ≥1 accepted answer, sắp xếp `tokens.length ≥ 2`); service bọc `$transaction` + `FOR UPDATE` assessment khi reorder (đánh lại `position 1..N`); `publish` kiểm tra: hết `needsReview`, câu tự chấm có đáp án, tự luận có rubric/mẫu; `duplicate` deep-copy questions + file gốc + media & reset status DRAFT.
- [x] **Step 4: Run** — unit PASS, `check-loc` PASS.
- [x] **Step 5: Commit** — `feat(phase-05): assessment CRUD and 7-type manual editor`.

### Task 5.3: Upload + parse Word/PDF → câu nháp, GV duyệt (`FUNC-040, 041, 042`)

**Files:**
- Create: `backend/src/modules/assessments/services/document-import.service.ts` (parse + tạo nháp)
- Create: `backend/src/modules/assessments/dto/import.dto.ts` (`POST /assessments/import` multipart)
- Modify: `assessments.controller.ts`, `assessment-crud.service.ts` *(thực tế lưu `originalFileName` & `originalStorageKey` trực tiếp trên `Assessment`; không tạo model `ImportJob` / `importJobId`)*
- Test: `backend/src/modules/assessments/services/document-import.service.spec.ts` (dùng fixture `.docx`/`pdf` thật tự tạo tối thiểu, không chờ file khách hàng)

**Interfaces:**
- Consumes: `question-schema.policy.validatePayload`, `assertSafeUpload`, `Question`/`MediaAsset` create.
- Produces: `POST /api/v1/assessments/import {file, courseId, type}` → `{assessmentId, recognizedCount, needsReviewCount}`; nguyên tắc: câu nào parser không chắc → `needsReview=true`, không bao giờ tự publish.

- [x] **Step 1: Write failing tests** — `.doc` cũ → 400; PDF scan (không lớp chữ) → 400 message rõ; `.docx` fixture 3 câu trắc nghiệm → tạo 3 `Question` DRAFT, câu thiếu đáp án gắn `needsReview`; ảnh nhúng trích ra `MediaAsset` và hiển thị ở review.
- [x] **Step 2: Run** → FAIL.
- [x] **Step 3: Implement** — `mammoth.convertToHtml` + trích `<img>` base64 → MediaAsset; `pdfjs-dist` `getTextContent` theo dòng, heuristic nhận diện `Câu N.` + phương án `A.`; giữ nguyên chữ Hán/pinyin (không normalize NFKC làm mất dấu thanh); tóm tắt `Nhận diện [n] câu; [m] câu cần kiểm tra`; `add mammoth, pdfjs-dist` vào `package.json`.
- [x] **Step 4: Run** — unit PASS với fixture tự tạo; ghi rõ trong PR: chất lượng phụ thuộc đề thật (`ASSIGN-01` vẫn mở).
- [x] **Step 5: Commit** — `feat(phase-05): word/pdf import pipeline with mandatory review`.

### Task 5.4: UI ngân hàng đề + soạn thảo + duyệt import (Cleanup #5)

**Files:**
- Create: `frontend/src/features/assessments/api/assessments.api.ts`, `hooks/useAssessments.ts` (+`AbortController`)
- Create: `frontend/src/features/assessments/components/{AssessmentList.tsx, AssessmentEditor.tsx, QuestionTypeFields.tsx, ImportUploadPane.tsx, ImportReviewPane.tsx, MediaAttach.tsx}`, `utils/`
- Modify: `frontend/src/app/(portal)/teacher/assessments/page.tsx` (≤250 LOC, gọi components), sidebar `nav-links.ts` (menu Ngân hàng đề cho GV/Admin — lưu ý `TD-09` còn thiếu ánh xạ với `[SUPERADMIN, TEACHER]` không có `ADMIN`)
- Test: `frontend/e2e/phase05-question-bank.spec.ts` (CRUD 1 đề trắc nghiệm, upload fixture lỗi → message, publish bị chặn khi còn câu cần kiểm tra)

**Interfaces:**
- Consumes: API Task 5.2/5.3 (`TeacherAssessmentDto`), `requestJson` + `buildQueryString` hiện có.
- Produces: trang GV `/teacher/assessments` khớp style Paper-Ink; preview 2 cột file gốc/nháp ở `ImportReviewPane`.

- [x] **Step 1: Write failing e2e** — 3 case trên, chạy → FAIL (route chưa tồn tại).
- [x] **Step 2: Implement** — list (lọc Loại/Khóa/Trạng thái, tìm tên), editor form theo từng dạng câu (đổi `QuestionType` thì đổi fields, giữ UI soạn ở mức cơ bản theo Q15; lưu ý `QB-UI-01`/`QB-BUG-01`: `AssessmentEditor` hiện chưa có nút `Phát hành`/`Xóa câu`/reorder và nút `Nhân bản`/`Phát hành` đặt ở list/review), xem trước như HV (dùng student-safe render, không gọi API đáp án), `ImportReviewPane` filter "chỉ câu cần kiểm tra".
- [x] **Step 3: Run** — `typecheck`, `lint`, `build`, Playwright PASS; `check-loc` PASS.
- [x] **Step 4: Commit** — `feat(phase-05): question bank UI and import review`.
- [x] **Step 5: Phase exit gate (trên nhánh `feature/phase-05-question-bank-and-import`)** — đã chạy verify test suite Phase 5 (`37` unit files / `266` tests, `1` PG integration / `16` tests, `8` BE HTTP E2E / `43` tests, `6` Playwright files / `52` runs) & cập nhật trạng thái vào `PROJECT_PROGRESS.md`.
- [ ] **Merge Gate (`feature/phase-05-question-bank-and-import` -> `develop`) & Mở Phase 6** — **CHƯA THỰC HIỆN** (còn open backlog/bugs từ audit `#7`: `QB-BUG-01`, `QB-SEC-01`, `QB-UI-01`, `TD-09` — chờ user duyệt hướng xử lý trước khi merge `develop` và mở nhánh Phase 6).

## Self-review

- Spec coverage: FUNC-039→T5.2, 040/041→T5.3, 042→T5.3+5.4, 043→T5.2, 044–050→T5.2 (schema) +T5.4 (UI), media upload→T5.1. FUNC-051..054 thuộc Phase 6, không ở đây. `isLocked`/submission-guard là chuẩn bị cho Phase 6, ghi rõ trong code là forward-guard.
- Type consistency: `TeacherAssessmentDto` đặt tên 1 lần ở T5.2, T5.3/5.4 tái dùng; student-safe DTO cấm tạo trong Phase 5 (để Phase 6 + Phase 7 Zero-Leak review).
- Proportion: plan ngắn hơn spec module 06 vì spec chi tiết từng dạng câu đã nằm trong module doc — plan chỉ chốt interface và test.
