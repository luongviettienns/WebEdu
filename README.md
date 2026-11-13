# WebEdu — Hệ Thống Quản Lý Lớp Học & Học Tập Trực Tuyến (TD Hán Ngữ)

Dự án nền tảng giáo dục trực tuyến WebEdu cho Trung tâm TD Hán Ngữ.

## 📁 Cấu trúc dự án

```text
WebEdu/
├── backend/                        # Backend REST API (NestJS 12, Prisma ORM 6, PostgreSQL 16+)
├── frontend/                       # Frontend web app (Next.js 16 App Router, React 19, Tailwind CSS v4)
├── docs/                           # Kế hoạch từng Phase, báo cáo kiểm toán, kho kiểm kê API/UI & kịch bản test
├── scripts/                        # Cổng kiểm tra cấu trúc & giới hạn dòng code (check-loc.js)
├── prototype/                      # Bản mẫu giao diện tham chiếu ban đầu
├── TD_Han_Ngu_Project_Context_v1.0/# Ngữ cảnh nghiệp vụ, Business Rules, Decision Log & Đặc tả 10 module
├── MASTER_PLAN.md                  # Kế hoạch triển khai tổng thể 10 giai đoạn (Phases 0–9)
├── PROJECT_PROGRESS.md             # Theo dõi tiến độ triển khai và kiểm chứng thực tế
└── README.md
```

## 🚀 Hướng dẫn khởi chạy (Development)

### Cách 1: Chạy từ thư mục gốc (Root)
```bash
# Khởi chạy Backend (NestJS API - http://localhost:3001)
npm run dev:backend

# Khởi chạy Frontend (Next.js - http://localhost:3000)
npm run dev:frontend
```

### Cách 2: Chạy trực tiếp từ từng thư mục
```bash
# Backend
cd backend
npm run start:dev

# Frontend
cd frontend
npm run dev
```

## 🧪 Lệnh kiểm thử & kiểm soát chất lượng

```bash
# Cổng kiểm tra LOC & cấu trúc module
node scripts/check-loc.js

# Backend: typecheck, oxlint, build, Vitest unit, PG integration & HTTP E2E
cd backend
npm run typecheck && npm run lint && npm run build
npm run test
npm run test:integration
npm run test:e2e

# Frontend: typecheck, eslint, Next.js production build & Playwright E2E
cd frontend
npm run typecheck && npm run lint && npm run build
npm run test:e2e
```

## 📚 Tài liệu điều hành & kiểm kê

- Kế hoạch tổng thể: [MASTER_PLAN.md](./MASTER_PLAN.md)
- Tiến độ & trạng thái nhánh hiện tại: [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md)
- Kho kiểm kê API (71 endpoints / 11 controllers): [docs/test-inventory-api.md](./docs/test-inventory-api.md)
- Kho kiểm kê giao diện (21 `page.tsx` routes): [docs/test-inventory-ui.md](./docs/test-inventory-ui.md)
- Backlog nợ kỹ thuật & bảo mật: [docs/TECH_DEBT_AND_SECURITY_BACKLOG.md](./docs/TECH_DEBT_AND_SECURITY_BACKLOG.md)
