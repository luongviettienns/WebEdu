import {
  PrismaClient,
  Role,
  UserStatus,
  CourseLevel,
  ClassStatus,
  EnrollmentStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';
import { seedInitialClassSessions } from './seed-sessions.util.mjs';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed script is disabled in production to protect data integrity.');
  }

  console.log('--- Khởi tạo dữ liệu hệ thống Trung Tâm TD Hán Ngữ ---');

  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "question_media",
      "questions",
      "media_assets",
      "assessments",
      "system_audit_logs",
      "class_teacher_assignments",
      "enrollments",
      "classes",
      "courses",
      "auth_rate_limits",
      "email_rate_limits",
      "email_verifications",
      "password_reset_tokens",
      "guardian_consents",
      "teacher_profiles",
      "student_profiles",
      "system_settings",
      "users"
    RESTART IDENTITY CASCADE
  `);

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Superadmin
  await prisma.user.create({
    data: {
      email: 'superadmin@webedu.vn',
      phone: '0909000001',
      fullName: 'Quản Trị Hệ Thống Cấp Cao',
      passwordHash,
      roles: [Role.SUPERADMIN],
      status: UserStatus.ACTIVE,
    },
  });

  // 2. Admin Đào tạo
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@webedu.vn',
      phone: '0909000003',
      fullName: 'Nguyễn Quản Trị Đào Tạo',
      passwordHash,
      roles: [Role.ADMIN],
      status: UserStatus.ACTIVE,
    },
  });

  // 3. Giảng viên
  const teacherLan = await prisma.user.create({
    data: {
      email: 'teacher.lan@webedu.vn',
      phone: '0909000004',
      fullName: 'Trương Mỹ Lan (张美兰)',
      passwordHash,
      roles: [Role.TEACHER],
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.teacherProfile.create({
    data: {
      userId: teacherLan.id,
      notes: 'Giảng viên HSK 1-4',
      activeClassesCount: 2,
    },
  });

  // 4. Khóa học HSK
  const courseHsk1 = await prisma.course.create({
    data: {
      code: 'HSK1',
      name: 'Tiếng Trung HSK 1 — 汉语水平考试一级 (Hànzì)',
      level: CourseLevel.HSK1,
      defaultSessions: 24,
      description:
        'Giáo trình Hán ngữ Chuẩn HSK 1 (300 từ vựng nền tảng, ngữ âm Pinyin & nét chữ Hán cơ bản)',
    },
  });

  const courseHsk2 = await prisma.course.create({
    data: {
      code: 'HSK2',
      name: 'Tiếng Trung HSK 2 — 初级汉语口语 (Chūjí Hànyǔ)',
      level: CourseLevel.HSK2,
      defaultSessions: 24,
      description:
        'Giáo trình Hán ngữ Chuẩn HSK 2 (600 từ vựng giao tiếp sinh hoạt & mẫu câu thông dụng)',
    },
  });

  await prisma.course.create({
    data: {
      code: 'HSK3',
      name: 'Tiếng Trung HSK 3 — 中级汉语综合 (Zhōngjí Hànyǔ)',
      level: CourseLevel.HSK3,
      defaultSessions: 30,
      description:
        'Giáo trình Hán ngữ Chuẩn HSK 3 (1000 từ vựng, đọc hiểu đoạn văn & giao tiếp học thuật cơ sở)',
    },
  });

  await prisma.course.create({
    data: {
      code: 'HSK4',
      name: 'Tiếng Trung HSK 4 — 中高级汉语进阶 (Zhōnggāojí Hànyǔ)',
      level: CourseLevel.HSK4,
      defaultSessions: 36,
      description:
        'Giáo trình Hán ngữ Chuẩn HSK 4 (2000 từ vựng, nghị luận xã hội & luyện đề chuyên sâu)',
    },
  });

  await prisma.course.create({
    data: {
      code: 'GT-CB',
      name: 'Giao Tiếp Tiếng Trung Cơ Bản — 基础汉语会话',
      level: CourseLevel.BASIC_COMMUNICATION,
      defaultSessions: 20,
      description:
        'Luyện phản xạ nghe nói thực tế theo chủ đề đời sống, du lịch và công sở',
    },
  });

  // 5. Lớp học
  const classHsk1 = await prisma.class.create({
    data: {
      code: 'HSK1-K26-01',
      courseId: courseHsk1.id,
      teacherId: teacherLan.id,
      status: ClassStatus.UPCOMING,
      startDate: new Date('2026-11-20T00:00:00.000Z'),
    },
  });

  const classHsk2 = await prisma.class.create({
    data: {
      code: 'HSK2-K26-01',
      courseId: courseHsk2.id,
      teacherId: teacherLan.id,
      status: ClassStatus.ACTIVE,
      startDate: new Date('2026-10-01T00:00:00.000Z'),
    },
  });

  await seedInitialClassSessions(prisma, classHsk1, adminUser);
  await seedInitialClassSessions(prisma, classHsk2, adminUser);

  await prisma.classTeacherAssignment.createMany({
    data: [
      {
        classId: classHsk1.id,
        teacherId: teacherLan.id,
        assignedFrom: new Date('2026-11-20T00:00:00.000Z'),
        changedById: adminUser.id,
        reason: 'Phân công giáo viên phụ trách khi mở lớp mới',
      },
      {
        classId: classHsk2.id,
        teacherId: teacherLan.id,
        assignedFrom: new Date('2026-10-01T00:00:00.000Z'),
        changedById: adminUser.id,
        reason: 'Phân công giáo viên phụ trách khi mở lớp mới',
      },
    ],
  });

  // 6. Học viên đang học (HSK2)
  const activeStudent = await prisma.user.create({
    data: {
      email: 'active.student@webedu.vn',
      phone: '0909000007',
      fullName: 'Phạm Gia Huy',
      passwordHash,
      roles: [Role.STUDENT],
      status: UserStatus.ACTIVE,
    },
  });
  await prisma.studentProfile.create({
    data: {
      userId: activeStudent.id,
      dateOfBirth: new Date('2003-08-20T00:00:00.000Z'),
      assignedClass: 'HSK2-K26-01',
      currentClassId: classHsk2.id,
      enrolledAt: new Date('2026-10-01T00:00:00.000Z'),
      internalNotes: 'Học viên chăm chỉ, mục tiêu thi HSK3 cuối năm',
    },
  });
  await prisma.enrollment.create({
    data: {
      studentId: activeStudent.id,
      classId: classHsk2.id,
      status: EnrollmentStatus.ACTIVE,
      enrolledDate: new Date('2026-10-01T00:00:00.000Z'),
    },
  });

  // 7. Học viên chờ xếp lớp
  const pendingTeen = await prisma.user.create({
    data: {
      email: 'pending.student@webedu.vn',
      phone: '0909100001',
      fullName: 'Lê Minh Châu (黎明珠)',
      passwordHash,
      roles: [Role.STUDENT],
      status: UserStatus.PENDING_CLASS,
    },
  });
  const pendingProfile = await prisma.studentProfile.create({
    data: {
      userId: pendingTeen.id,
      dateOfBirth: new Date('2012-05-15T00:00:00.000Z'),
      guardianEmail: 'phuhuynh.chau@example.com',
      internalNotes: 'Học viên 14 tuổi, phụ huynh đã xác nhận đồng ý.',
    },
  });
  await prisma.guardianConsent.create({
    data: {
      studentProfileId: pendingProfile.id,
      guardianEmail: 'phuhuynh.chau@example.com',
      consentVersion: 'v1.0',
      consentTextSnapshot:
        'Tôi xác nhận đã có sự đồng ý của cha mẹ/người giám hộ cho phép đăng ký tài khoản học tập.',
      ipAddress: '127.0.0.1',
      userAgent: 'SystemInit',
    },
  });

  // 8. Cấu hình hệ thống chính thức
  await prisma.systemSetting.upsert({
    where: { key: 'CENTER_NAME' },
    update: { value: 'Trung Tâm TD Hán Ngữ' },
    create: {
      key: 'CENTER_NAME',
      value: 'Trung Tâm TD Hán Ngữ',
      description: 'Tên trung tâm hiển thị trên hệ thống',
    },
  });

  console.log('✅ Đã khởi tạo thành công dữ liệu chính thức Trung Tâm TD Hán Ngữ!');
}

main()
  .catch((err) => {
    console.error('Lỗi khi khởi tạo dữ liệu:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
