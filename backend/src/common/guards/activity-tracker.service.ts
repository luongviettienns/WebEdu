import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000; // 60 seconds

@Injectable()
export class ActivityTrackerService {
  private readonly inFlight = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async recordIfDue(
    userId: string,
    lastActivityAt: Date | null,
    now: Date,
  ): Promise<void> {
    const isDue =
      !lastActivityAt ||
      now.getTime() - lastActivityAt.getTime() >= ACTIVITY_UPDATE_THROTTLE_MS;
    if (!isDue || this.inFlight.has(userId)) {
      return;
    }

    this.inFlight.add(userId);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { lastActivityAt: now },
      });
    } finally {
      this.inFlight.delete(userId);
    }
  }
}
