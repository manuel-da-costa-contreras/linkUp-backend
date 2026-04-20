import { env } from '../../config/env';
import { JobsEventsConsumer } from '../../projections/jobs/jobs-events.consumer';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop(): Promise<void> {
  const consumer = new JobsEventsConsumer();
  let backoffMs = env.eventConsumerErrorBackoffMs;

  const isQuotaError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('RESOURCE_EXHAUSTED') || message.includes('Quota exceeded') || message.includes('code: 8');
  };

  console.log('[events.consume.watch] started', {
    batchSize: env.eventConsumerBatchSize,
    intervalMs: env.eventConsumerIntervalMs,
    idleIntervalMs: env.eventConsumerIdleIntervalMs,
    errorBackoffMs: env.eventConsumerErrorBackoffMs,
    maxBackoffMs: env.eventConsumerMaxBackoffMs,
    mode: env.eventProjectionMode,
  });

  while (true) {
    try {
      const result = await consumer.consumeBatch();
      const hasWork = result.processed > 0 || result.failed > 0 || result.skipped > 0;
      if (hasWork) {
        console.log('[events.consume.watch]', result);
      }

      backoffMs = env.eventConsumerErrorBackoffMs;
      await sleep(hasWork ? env.eventConsumerIntervalMs : env.eventConsumerIdleIntervalMs);
    } catch (error) {
      const quotaError = isQuotaError(error);
      const waitMs = quotaError ? backoffMs : env.eventConsumerErrorBackoffMs;
      console.error('[events.consume.watch.error]', {
        quotaError,
        waitMs,
        message: error instanceof Error ? error.message : String(error),
      });

      if (quotaError) {
        backoffMs = Math.min(backoffMs * 2, env.eventConsumerMaxBackoffMs);
      } else {
        backoffMs = env.eventConsumerErrorBackoffMs;
      }

      await sleep(waitMs);
    }
  }
}

runLoop().catch((error) => {
  console.error('[events.consume.watch.error]', error);
  process.exit(1);
});
