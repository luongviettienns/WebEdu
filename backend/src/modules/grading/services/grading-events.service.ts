import { Injectable, Logger } from '@nestjs/common';
import type { AssignmentScoresPublishedEvent } from '../grading.types.js';

export type AssignmentScoresPublishedListener = (
  event: AssignmentScoresPublishedEvent,
) => void | Promise<void>;

/**
 * In-process domain event bus for Phase 7 -> Phase 9 decoupling.
 * Module 10 (Notifications) can subscribe here cleanly without modifying grading services.
 */
@Injectable()
export class GradingEventsService {
  private readonly logger = new Logger(GradingEventsService.name);
  private readonly listeners = new Set<AssignmentScoresPublishedListener>();
  private readonly publishedEvents: AssignmentScoresPublishedEvent[] = [];

  onScoresPublished(listener: AssignmentScoresPublishedListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getPublishedEvents(): ReadonlyArray<AssignmentScoresPublishedEvent> {
    return [...this.publishedEvents];
  }

  emitScoresPublished(event: AssignmentScoresPublishedEvent): void {
    this.publishedEvents.push(event);
    if (this.publishedEvents.length > 200) {
      this.publishedEvents.shift();
    }

    for (const listener of this.listeners) {
      try {
        void listener(event);
      } catch (err) {
        this.logger.warn(
          `Scores published listener error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
