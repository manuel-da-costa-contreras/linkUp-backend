export const env = {
  port: Number(process.env.PORT) || 3001,
  corsOrigins: (
    process.env.CORS_ORIGINS ??
    'http://localhost:3000,http://localhost:3002,http://localhost:5173,http://web:3000,http://host.docker.internal:3002'
  )
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  corsCredentials: (process.env.CORS_CREDENTIALS ?? 'true').toLowerCase() === 'true',
  authEnabled: (process.env.AUTH_ENABLED ?? 'true').toLowerCase() === 'true',
  authCheckRevoked: (process.env.AUTH_CHECK_REVOKED ?? 'false').toLowerCase() === 'true',
  sseTokenSecret: process.env.SSE_TOKEN_SECRET ?? 'change-me-in-production',
  sseTokenTtlSeconds: Number(process.env.SSE_TOKEN_TTL_SECONDS) || 300,
  eventPublisher: (process.env.EVENT_PUBLISHER ?? 'noop') as 'noop' | 'console' | 'firestore_outbox',
  eventOutboxCollection: process.env.EVENT_OUTBOX_COLLECTION ?? 'event_outbox',
  eventProcessedCollection: process.env.EVENT_PROCESSED_COLLECTION ?? 'processed_events',
  eventConsumerBatchSize: Number(process.env.EVENT_CONSUMER_BATCH_SIZE) || 50,
  eventConsumerIntervalMs: Number(process.env.EVENT_CONSUMER_INTERVAL_MS) || 2000,
  eventProjectionMode: (process.env.EVENT_PROJECTION_MODE ?? 'shadow') as 'shadow' | 'apply',
  eventApplyCountersProjection: (process.env.EVENT_APPLY_COUNTERS_PROJECTION ?? 'false').toLowerCase() === 'true',
};
