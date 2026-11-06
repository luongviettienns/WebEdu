import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Trung Tâm TD Hán Ngữ — Hệ Thống Quản Trị Học Tập',
  description:
    'Nền tảng quản lý lớp học, khóa học HSK, lịch học, điểm danh và học tập trực tuyến',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
