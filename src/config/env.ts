export const env = {
  port: Number(process.env.PORT) || 3001,
  authEnabled: (process.env.AUTH_ENABLED ?? 'true').toLowerCase() === 'true',
  authCheckRevoked: (process.env.AUTH_CHECK_REVOKED ?? 'false').toLowerCase() === 'true',
  eventPublisher: (process.env.EVENT_PUBLISHER ?? 'noop') as 'noop' | 'console' | 'firestore_outbox',
  eventOutboxCollection: process.env.EVENT_OUTBOX_COLLECTION ?? 'event_outbox',
  eventProcessedCollection: process.env.EVENT_PROCESSED_COLLECTION ?? 'processed_events',
  eventConsumerBatchSize: Number(process.env.EVENT_CONSUMER_BATCH_SIZE) || 50,
  eventConsumerIntervalMs: Number(process.env.EVENT_CONSUMER_INTERVAL_MS) || 2000,
  eventProjectionMode: (process.env.EVENT_PROJECTION_MODE ?? 'shadow') as 'shadow' | 'apply',
};
