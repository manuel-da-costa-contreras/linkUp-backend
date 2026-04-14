import { env } from '../../config/env';
import { JobsEventsConsumer } from '../../projections/jobs/jobs-events.consumer';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoop(): Promise<void> {
  const consumer = new JobsEventsConsumer();
  console.log('[events.consume.watch] started', {
    batchSize: env.eventConsumerBatchSize,
    intervalMs: env.eventConsumerIntervalMs,
    mode: env.eventProjectionMode,
  });

  while (true) {
    const result = await consumer.consumeBatch();
    if (result.processed > 0 || result.failed > 0 || result.skipped > 0) {
      console.log('[events.consume.watch]', result);
    }

    await sleep(env.eventConsumerIntervalMs);
  }
}

runLoop().catch((error) => {
  console.error('[events.consume.watch.error]', error);
  process.exit(1);
});
