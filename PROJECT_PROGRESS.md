# Tiến Độ Dự Án WebEdu (PROJECT_PROGRESS)

Tài liệu theo dõi trạng thái tiến độ, các mốc quan trọng và hạng mục công việc trong dự án WebEdu.

---

## 📌 Tổng Quan Dự Án
* **Tên dự án**: WebEdu
* **Repository**: [https://github.com/luongviettienns/WebEdu](https://github.com/luongviettienns/WebEdu)
* **Kiến trúc dự kiến**: Tách biệt `backend` (NestJS) và `frontend` (Web Client).
* **Giai đoạn hiện tại**: **Phase 0 - Thiết lập môi trường & Khởi tạo dự án**

---

## 🧭 Lộ Trình Phát Triển (Roadmap)

### Phase 0: Thiết lập môi trường & Repository
- [x] Kiểm tra môi trường Node.js, npm, NestJS CLI trên máy local.
- [x] Khởi tạo Git repository cục bộ (branch `main`).
- [x] Thiết lập `.gitignore` chuẩn cho Node.js / NestJS / Fullstack.
- [x] Khởi tạo tài liệu dự án ban đầu (`README.md`, `PROJECT_PROGRESS.md`).
- [ ] Tạo Public Repository `WebEdu` trên GitHub (`luongviettienns/WebEdu`) và push commit đầu tiên.

### Phase 1: Khởi tạo khung Backend (NestJS)
- [ ] Khởi tạo dự án NestJS trong thư mục `backend/`.
- [ ] Cấu hình biến môi trường với `@nestjs/config` (`.env`, `.env.example`).
- [ ] Cấu hình Global `ValidationPipe`, CORS, và tiền tố API chuẩn (`/api/v1`).
- [ ] Tích hợp tài liệu tự động Swagger (`/api/docs`).
- [ ] Xây dựng endpoint kiểm tra sức khỏe `GET /api/v1/health`.
- [ ] Viết test xác nhận (unit test / e2e test) cho endpoint health check.

### Phase 2: Khung Frontend & Tích hợp (Tương lai)
- [ ] Khởi tạo thư mục `frontend/`.
- [ ] Thiết lập giao diện cơ bản dựa trên nguyên mẫu `prototype/`.

---

## 📝 Nhật Ký Cập Nhật (Changelog)
* **2026-11-04**:
  - Tạo cấu hình `.gitignore`, `README.md`, `PROJECT_PROGRESS.md`.
  - Chuẩn bị đẩy mã nguồn ban đầu cùng bản mẫu `prototype/` lên GitHub repository `luongviettienns/WebEdu`.
