import { JobsEventsConsumer } from '../../projections/jobs/jobs-events.consumer';

async function run(): Promise<void> {
  const consumer = new JobsEventsConsumer();
  const result = await consumer.consumeBatch();
  console.log('[events.consume.once]', result);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[events.consume.once.error]', error);
    process.exit(1);
  });
