# WebEdu

Dự án nền tảng giáo dục trực tuyến WebEdu.

## 📁 Cấu trúc dự án dự kiến

```text
WebEdu/
├── backend/          # Backend REST API phát triển bằng NestJS
├── frontend/         # Frontend web application (dành cho phát triển giao diện sau)
├── prototype/        # Bản mẫu giao diện / tài liệu thử nghiệm sơ bộ
├── PROJECT_PROGRESS.md # Báo cáo và theo dõi tiến độ phát triển dự án
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

## 🚀 Tiến trình phát triển

Theo dõi chi tiết các giai đoạn triển khai tại [PROJECT_PROGRESS.md](./PROJECT_PROGRESS.md).
