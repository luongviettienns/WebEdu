/**
 * Sinh buổi học mặc định cho các lớp mẫu trong seed dev và QA browser harness.
 * Bảo đảm đồng bộ quy tắc thứ [1, 3, 5] và expectedEndDate giống SessionGeneratorService.
 */
export async function seedInitialClassSessions(prisma, cls, actor) {
  const days = new Set(cls.scheduleDays ?? [1, 3, 5]);
  const totalSessions = cls.totalSessions ?? 24;
  const startTime = cls.scheduleStartTime ?? '18:00';
  const endTime = cls.scheduleEndTime ?? '19:30';

  const dates = [];
  const cursor = new Date(cls.startDate);
  while (dates.length < totalSessions) {
    if (days.has(cursor.getUTCDay())) {
      dates.push(new Date(cursor));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  await prisma.lessonSession.createMany({
    data: dates.map((sessionDate, idx) => ({
      classId: cls.id,
      sessionNumber: idx + 1,
      type: 'REGULAR',
      sessionDate,
      startTime,
      endTime,
      status: 'SCHEDULED',
    })),
  });

  const lastDate = dates[dates.length - 1] ?? cls.startDate;
  await prisma.class.update({
    where: { id: cls.id },
    data: { expectedEndDate: lastDate },
  });

  if (actor?.id) {
    await prisma.sessionChangeLog.create({
      data: {
        classId: cls.id,
        action: 'GENERATE',
        actorId: actor.id,
        actorName: actor.fullName || 'Quản trị hệ thống',
        newDate: dates[0] ?? cls.startDate,
        newStartTime: startTime,
        newEndTime: endTime,
        reason: `Khởi tạo ${totalSessions} buổi học định kỳ từ dữ liệu mẫu`,
      },
    });
  }
}
