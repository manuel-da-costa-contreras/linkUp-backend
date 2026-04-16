import { env } from '../../config/env';
import { EventOutboxRepository } from '../../repositories/events/event-outbox.repository';
import { JobsCountersProjection } from '../../projections/jobs/jobs-counters.projection';
import { JobsNotificationsProjection } from './jobs-notifications.projection';

export class JobsEventsConsumer {
  constructor(
    private readonly outboxRepository: EventOutboxRepository = new EventOutboxRepository(),
    private readonly countersProjection: JobsCountersProjection = new JobsCountersProjection(),
    private readonly notificationsProjection: JobsNotificationsProjection = new JobsNotificationsProjection(),
  ) {}

  async consumeBatch(limit = env.eventConsumerBatchSize): Promise<{ processed: number; failed: number; skipped: number }> {
    const items = await this.outboxRepository.listPending(limit);

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    for (const item of items) {
      try {
        const alreadyProcessed = await this.outboxRepository.isProcessed(item.event.eventId);
        if (alreadyProcessed) {
          await this.outboxRepository.markDuplicateProcessed(item.id, item.event);
          skipped += 1;
          continue;
        }

        if (env.eventProjectionMode === 'apply') {
          if (env.eventApplyCountersProjection) {
            await this.countersProjection.apply(item.event);
          }
          await this.notificationsProjection.apply(item.event);
        }

        await this.outboxRepository.markProcessed(item.id, item.event, env.eventProjectionMode);
        processed += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown event processing error';
        await this.outboxRepository.markFailed(item.id, item.attempts, message);
        failed += 1;
      }
    }

    return { processed, failed, skipped };
  }
}
