import type { Metadata } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import './globals.css';

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam-pro',
  display: 'swap',
});

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
    <html lang="vi" className={`h-full ${beVietnamPro.variable}`}>
      <body className="min-h-full flex flex-col bg-[var(--paper)] text-[var(--ink)] antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
