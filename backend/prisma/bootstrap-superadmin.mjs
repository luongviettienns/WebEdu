import { PrismaClient, Role, UserStatus } from '@prisma/client';
import { isEmail } from 'class-validator';
import { assertPasswordWithinLimit, hashPassword } from '../src/common/auth/password-hash.util.ts';

const email = (process.env.BOOTSTRAP_SUPERADMIN_EMAIL ?? '').trim().toLowerCase();
const phone = (process.env.BOOTSTRAP_SUPERADMIN_PHONE ?? '').trim();
const fullName = (process.env.BOOTSTRAP_SUPERADMIN_NAME ?? '').trim();
const password = process.env.BOOTSTRAP_SUPERADMIN_PASSWORD ?? '';
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl || !isEmail(email) || email.length > 255 || !/^0\d{9}$/.test(phone) ||
    !fullName || fullName.length > 100) {
  throw new Error('Cần DATABASE_URL, email, số điện thoại và họ tên Superadmin hợp lệ');
}
assertPasswordWithinLimit(password);
const passwordHash = await hashPassword(password);
const prisma = new PrismaClient({ datasourceUrl: databaseUrl });

try {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(20261117, 1)`;
    const existing = await tx.user.findFirst({
      where: { roles: { has: Role.SUPERADMIN } },
      select: { id: true },
    });
    if (existing) throw new Error('Hệ thống đã có Superadmin');
    if (await tx.user.findFirst({ where: { OR: [{ email }, { phone }] }, select: { id: true } })) {
      throw new Error('Email hoặc số điện thoại đã được sử dụng');
    }
    await tx.user.create({
      data: { email, phone, fullName, passwordHash, roles: [Role.SUPERADMIN], status: UserStatus.ACTIVE },
    });
  });
  console.log('Đã khởi tạo Superadmin đầu tiên.');
} finally {
  await prisma.$disconnect();
}
