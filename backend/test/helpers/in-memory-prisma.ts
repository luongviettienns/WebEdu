import { Role, UserStatus } from '@prisma/client';

export interface InMemoryConsentRecord {
  id: string;
  studentProfileId: string;
  guardianEmail: string;
  consented: boolean;
  consentVersion: string;
  consentTextSnapshot: string;
  ipAddress: string | null;
  userAgent: string | null;
  consentedAt: Date;
}

export interface InMemoryStudentProfileRecord {
  id: string;
  userId: string;
  dateOfBirth: Date;
  guardianEmail: string | null;
  assignedClass: string | null;
  internalNotes: string | null;
  enrolledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  consent: InMemoryConsentRecord | null;
}

export interface InMemoryTeacherProfileRecord {
  id: string;
  userId: string;
  notes: string | null;
  activeClassesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryUserRecord {
  id: string;
  email: string;
  phone: string;
  fullName: string;
  passwordHash: string;
  roles: Role[];
  status: UserStatus;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  tokenVersion: number;
  lastLoginAt: Date | null;
  lastActivityAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface InMemoryResetTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export interface InMemoryAuditLogRecord {
  id: string;
  actorId: string | null;
  actingRole: Role | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: unknown;
  createdAt: Date;
}

interface UserWhereFilter {
  id?: string | { not?: string };
  email?: string | { contains?: string; mode?: string };
  phone?: string | { contains?: string };
  fullName?: { contains?: string; mode?: string };
  roles?: { has?: Role };
  status?: UserStatus;
  studentProfile?: { assignedClass?: string };
  OR?: Array<{
    email?: string | { contains?: string; mode?: string };
    phone?: string | { contains?: string };
    fullName?: { contains?: string; mode?: string };
  }>;
}

export class InMemoryPrismaService {
  readonly users = new Map<string, InMemoryUserRecord>();
  readonly studentProfiles = new Map<string, InMemoryStudentProfileRecord>();
  readonly guardianConsents = new Map<string, InMemoryConsentRecord>();
  readonly teacherProfiles = new Map<string, InMemoryTeacherProfileRecord>();
  readonly resetTokens = new Map<string, InMemoryResetTokenRecord>();
  readonly systemSettings = new Map<string, { key: string; value: string; description: string | null }>();
  readonly auditLogs: InMemoryAuditLogRecord[] = [];

  private idSeq = 1;

  private nextId(prefix: string): string {
    const val = `${prefix}-${this.idSeq}`;
    this.idSeq += 1;
    return val;
  }

  async $connect(): Promise<void> {}
  async $disconnect(): Promise<void> {}

  async $queryRaw<T = Array<Record<string, unknown>>>(
    query?: TemplateStringsArray | { strings?: readonly string[]; sql?: string } | string,
    ...values: unknown[]
  ): Promise<T> {
    let sqlText = '';
    if (typeof query === 'string') {
      sqlText = query;
    } else if (Array.isArray(query)) {
      sqlText = (query as readonly string[]).join('?');
    } else if (query && typeof query === 'object') {
      if ('sql' in query && typeof query.sql === 'string') {
        sqlText = query.sql;
      } else if ('strings' in query && Array.isArray(query.strings)) {
        sqlText = query.strings.join('?');
      }
    }

    if (sqlText.includes('SUPERADMIN')) {
      const activeSuperadmins = Array.from(this.users.values())
        .filter(
          (u) =>
            u.roles.includes(Role.SUPERADMIN) && u.status === UserStatus.ACTIVE,
        )
        .map((u) => ({ id: u.id }));
      return activeSuperadmins as unknown as T;
    }

    if (sqlText.includes('FROM "users"') && typeof values[0] === 'string') {
      const matched = this.users.get(values[0]);
      return (matched ? [{ id: matched.id }] : []) as unknown as T;
    }

    return [{ 1: 1 }] as unknown as T;
  }

  async $transaction<T>(fn: (tx: InMemoryPrismaService) => Promise<T>): Promise<T> {
    return fn(this);
  }

  private hydrateUser(u: InMemoryUserRecord) {
    const sp = this.studentProfiles.get(u.id) ?? null;
    const tp = this.teacherProfiles.get(u.id) ?? null;
    return {
      ...u,
      roles: [...u.roles],
      studentProfile: sp ? { ...sp } : null,
      teacherProfile: tp ? { ...tp } : null,
    };
  }

  private matchesUserWhere(u: InMemoryUserRecord, where?: UserWhereFilter): boolean {
    if (!where) return true;

    if (typeof where.id === 'string' && u.id !== where.id) {
      return false;
    }
    if (
      typeof where.id === 'object' &&
      where.id !== null &&
      where.id.not !== undefined &&
      u.id === where.id.not
    ) {
      return false;
    }

    if (where.roles?.has && !u.roles.includes(where.roles.has)) {
      return false;
    }

    if (where.status && u.status !== where.status) {
      return false;
    }

    if (where.studentProfile?.assignedClass !== undefined) {
      const sp = this.studentProfiles.get(u.id);
      if (!sp || sp.assignedClass !== where.studentProfile.assignedClass) {
        return false;
      }
    }

    if (where.OR && where.OR.length > 0) {
      const matchedOr = where.OR.some((cond) => {
        if (typeof cond.email === 'string') {
          return u.email === cond.email;
        }
        if (typeof cond.email === 'object' && cond.email.contains !== undefined) {
          return u.email.toLowerCase().includes(cond.email.contains.toLowerCase());
        }
        if (typeof cond.phone === 'string') {
          return u.phone === cond.phone;
        }
        if (typeof cond.phone === 'object' && cond.phone.contains !== undefined) {
          return u.phone.includes(cond.phone.contains);
        }
        if (typeof cond.fullName === 'object' && cond.fullName.contains !== undefined) {
          return u.fullName.toLowerCase().includes(cond.fullName.contains.toLowerCase());
        }
        return false;
      });
      if (!matchedOr) return false;
    }

    return true;
  }

  readonly user = {
    findFirst: async ({ where }: { where?: UserWhereFilter }) => {
      for (const u of this.users.values()) {
        if (this.matchesUserWhere(u, where)) {
          return this.hydrateUser(u);
        }
      }
      return null;
    },

    findUnique: async ({ where }: { where: { id?: string; email?: string } }) => {
      if (where.id) {
        const u = this.users.get(where.id);
        return u ? this.hydrateUser(u) : null;
      }
      if (where.email) {
        for (const u of this.users.values()) {
          if (u.email === where.email) {
            return this.hydrateUser(u);
          }
        }
      }
      return null;
    },

    findMany: async (args?: {
      where?: UserWhereFilter;
      orderBy?: { fullName?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' };
      skip?: number;
      take?: number;
    }) => {
      let list = Array.from(this.users.values()).filter((u) =>
        this.matchesUserWhere(u, args?.where),
      );

      if (args?.orderBy?.fullName) {
        const dir = args.orderBy.fullName === 'asc' ? 1 : -1;
        list = list.sort((a, b) => dir * a.fullName.localeCompare(b.fullName));
      } else if (args?.orderBy?.createdAt) {
        const dir = args.orderBy.createdAt === 'asc' ? 1 : -1;
        list = list.sort(
          (a, b) => dir * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }

      const start = args?.skip ?? 0;
      const end = args?.take !== undefined ? start + args.take : undefined;
      return list.slice(start, end).map((u) => this.hydrateUser(u));
    },

    count: async (args?: { where?: UserWhereFilter }) => {
      return Array.from(this.users.values()).filter((u) =>
        this.matchesUserWhere(u, args?.where),
      ).length;
    },

    create: async ({
      data,
    }: {
      data: {
        id?: string;
        email: string;
        phone: string;
        fullName: string;
        passwordHash: string;
        roles?: Role[];
        status?: UserStatus;
        createdAt?: Date;
      };
    }) => {
      for (const existing of this.users.values()) {
        if (existing.email === data.email || existing.phone === data.phone) {
          const dupErr = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          dupErr.code = 'P2002';
          throw dupErr;
        }
      }

      const id = data.id ?? this.nextId('user');
      const now = data.createdAt ?? new Date();
      const record: InMemoryUserRecord = {
        id,
        email: data.email,
        phone: data.phone,
        fullName: data.fullName,
        passwordHash: data.passwordHash,
        roles: data.roles ? [...data.roles] : [Role.STUDENT],
        status: data.status ?? UserStatus.PENDING_CLASS,
        failedLoginAttempts: 0,
        lockedUntil: null,
        tokenVersion: 0,
        lastLoginAt: null,
        lastActivityAt: now,
        createdAt: now,
        updatedAt: now,
      };
      this.users.set(id, record);
      return this.hydrateUser(record);
    },

    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: {
        email?: string;
        phone?: string;
        fullName?: string;
        passwordHash?: string;
        roles?: Role[];
        status?: UserStatus;
        failedLoginAttempts?: number;
        lockedUntil?: Date | null;
        lastLoginAt?: Date | null;
        lastActivityAt?: Date | null;
        tokenVersion?: number | { increment: number };
      };
    }) => {
      const record = this.users.get(where.id);
      if (!record) {
        throw new Error(`User ${where.id} not found`);
      }

      for (const existing of this.users.values()) {
        if (existing.id === where.id) continue;
        if (
          (data.email !== undefined && existing.email === data.email) ||
          (data.phone !== undefined && existing.phone === data.phone)
        ) {
          const dupErr = new Error('Unique constraint failed') as Error & {
            code: string;
          };
          dupErr.code = 'P2002';
          throw dupErr;
        }
      }

      if (data.email !== undefined) record.email = data.email;
      if (data.phone !== undefined) record.phone = data.phone;
      if (data.fullName !== undefined) record.fullName = data.fullName;
      if (data.passwordHash !== undefined) record.passwordHash = data.passwordHash;
      if (data.roles !== undefined) record.roles = [...data.roles];
      if (data.status !== undefined) record.status = data.status;
      if (data.failedLoginAttempts !== undefined) {
        record.failedLoginAttempts = data.failedLoginAttempts;
      }
      if ('lockedUntil' in data) {
        record.lockedUntil = data.lockedUntil ?? null;
      }
      if ('lastLoginAt' in data) {
        record.lastLoginAt = data.lastLoginAt ?? null;
      }
      if ('lastActivityAt' in data) {
        record.lastActivityAt = data.lastActivityAt ?? null;
      }
      if (typeof data.tokenVersion === 'number') {
        record.tokenVersion = data.tokenVersion;
      } else if (
        data.tokenVersion &&
        typeof data.tokenVersion === 'object' &&
        'increment' in data.tokenVersion
      ) {
        record.tokenVersion += data.tokenVersion.increment;
      }

      record.updatedAt = new Date();
      return this.hydrateUser(record);
    },
  };

  readonly studentProfile = {
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        dateOfBirth: Date;
        guardianEmail?: string | null;
        assignedClass?: string | null;
        internalNotes?: string | null;
        enrolledAt?: Date | null;
      };
    }) => {
      const now = new Date();
      const record: InMemoryStudentProfileRecord = {
        id: this.nextId('sp'),
        userId: data.userId,
        dateOfBirth: data.dateOfBirth,
        guardianEmail: data.guardianEmail ?? null,
        assignedClass: data.assignedClass ?? null,
        internalNotes: data.internalNotes ?? null,
        enrolledAt: data.enrolledAt ?? null,
        createdAt: now,
        updatedAt: now,
        consent: null,
      };
      this.studentProfiles.set(data.userId, record);
      return record;
    },

    update: async ({
      where,
      data,
    }: {
      where: { userId: string };
      data: {
        dateOfBirth?: Date;
        assignedClass?: string | null;
        internalNotes?: string | null;
        enrolledAt?: Date | null;
      };
    }) => {
      const record = this.studentProfiles.get(where.userId);
      if (!record) {
        throw new Error(`StudentProfile for ${where.userId} not found`);
      }
      if (data.dateOfBirth !== undefined) record.dateOfBirth = data.dateOfBirth;
      if ('assignedClass' in data) record.assignedClass = data.assignedClass ?? null;
      if ('internalNotes' in data) record.internalNotes = data.internalNotes ?? null;
      if ('enrolledAt' in data) record.enrolledAt = data.enrolledAt ?? null;
      record.updatedAt = new Date();
      return record;
    },
  };

  readonly guardianConsent = {
    create: async ({
      data,
    }: {
      data: {
        studentProfileId: string;
        guardianEmail: string;
        consented: boolean;
        consentVersion: string;
        consentTextSnapshot: string;
        ipAddress?: string | null;
        userAgent?: string | null;
      };
    }) => {
      const consent: InMemoryConsentRecord = {
        id: this.nextId('gc'),
        studentProfileId: data.studentProfileId,
        guardianEmail: data.guardianEmail,
        consented: data.consented,
        consentVersion: data.consentVersion,
        consentTextSnapshot: data.consentTextSnapshot,
        ipAddress: data.ipAddress ?? null,
        userAgent: data.userAgent ?? null,
        consentedAt: new Date(),
      };
      this.guardianConsents.set(consent.id, consent);

      for (const sp of this.studentProfiles.values()) {
        if (sp.id === data.studentProfileId) {
          sp.consent = consent;
        }
      }
      return consent;
    },
  };

  readonly teacherProfile = {
    create: async ({
      data,
    }: {
      data: {
        userId: string;
        notes?: string | null;
        activeClassesCount?: number;
      };
    }) => {
      const now = new Date();
      const record: InMemoryTeacherProfileRecord = {
        id: this.nextId('tp'),
        userId: data.userId,
        notes: data.notes ?? null,
        activeClassesCount: data.activeClassesCount ?? 0,
        createdAt: now,
        updatedAt: now,
      };
      this.teacherProfiles.set(data.userId, record);
      return record;
    },

    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { userId: string };
      update: { notes?: string | null; activeClassesCount?: number };
      create: { userId: string; notes?: string | null; activeClassesCount?: number };
    }) => {
      const existing = this.teacherProfiles.get(where.userId);
      if (existing) {
        if ('notes' in update) existing.notes = update.notes ?? null;
        if (update.activeClassesCount !== undefined) {
          existing.activeClassesCount = update.activeClassesCount;
        }
        existing.updatedAt = new Date();
        return existing;
      }
      return this.teacherProfile.create({ data: create });
    },
  };

  readonly passwordResetToken = {
    create: async ({
      data,
    }: {
      data: { userId: string; tokenHash: string; expiresAt: Date };
    }) => {
      const item: InMemoryResetTokenRecord = {
        id: this.nextId('prt'),
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        usedAt: null,
        createdAt: new Date(),
      };
      this.resetTokens.set(data.tokenHash, item);
      return item;
    },

    updateMany: async ({
      where,
      data,
    }: {
      where: { tokenHash: string; usedAt: null; expiresAt: { gt: Date } };
      data: { usedAt: Date };
    }) => {
      const item = this.resetTokens.get(where.tokenHash);
      if (
        !item ||
        item.usedAt !== null ||
        item.expiresAt.getTime() <= where.expiresAt.gt.getTime()
      ) {
        return { count: 0 };
      }
      item.usedAt = data.usedAt;
      return { count: 1 };
    },

    findUnique: async ({ where }: { where: { tokenHash: string } }) => {
      return this.resetTokens.get(where.tokenHash) ?? null;
    },
  };

  readonly systemSetting = {
    findMany: async (args?: { where?: { key?: { in?: string[] } } }) => {
      const allowedKeys = args?.where?.key?.in;
      const rows = Array.from(this.systemSettings.values());
      if (!allowedKeys) return rows;
      return rows.filter((r) => allowedKeys.includes(r.key));
    },

    upsert: async ({
      where,
      update,
      create,
    }: {
      where: { key: string };
      update: { value: string };
      create: { key: string; value: string; description?: string };
    }) => {
      const existing = this.systemSettings.get(where.key);
      if (existing) {
        existing.value = update.value;
        return existing;
      }
      const created = {
        key: create.key,
        value: create.value,
        description: create.description ?? null,
      };
      this.systemSettings.set(where.key, created);
      return created;
    },
  };

  readonly systemAuditLog = {
    create: async ({
      data,
    }: {
      data: {
        actorId?: string | null;
        actingRole?: Role | null;
        action: string;
        targetType: string;
        targetId?: string | null;
        metadata?: unknown;
      };
    }) => {
      const entry: InMemoryAuditLogRecord = {
        id: this.nextId('audit'),
        actorId: data.actorId ?? null,
        actingRole: data.actingRole ?? null,
        action: data.action,
        targetType: data.targetType,
        targetId: data.targetId ?? null,
        metadata: data.metadata ?? null,
        createdAt: new Date(),
      };
      this.auditLogs.unshift(entry);
      return entry;
    },

    findMany: async (args?: { skip?: number; take?: number }) => {
      const start = args?.skip ?? 0;
      const end = args?.take !== undefined ? start + args.take : undefined;
      return this.auditLogs.slice(start, end).map((log) => {
        const actor = log.actorId ? this.users.get(log.actorId) : undefined;
        return {
          ...log,
          actor: actor
            ? {
                id: actor.id,
                fullName: actor.fullName,
                email: actor.email,
              }
            : null,
        };
      });
    },

    count: async () => this.auditLogs.length,
  };
}
