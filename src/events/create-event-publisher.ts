import { env } from '../config/env';
import { EventPublisher } from './publisher';
import { ConsoleEventPublisher } from './publishers/console-event-publisher';
import { FirestoreOutboxEventPublisher } from './publishers/firestore-outbox-event-publisher';
import { NoopEventPublisher } from './publishers/noop-event-publisher';

export function createEventPublisher(): EventPublisher {
  const mode = env.eventPublisher;

  if (mode === 'console') {
    return new ConsoleEventPublisher();
  }

  if (mode === 'firestore_outbox') {
    return new FirestoreOutboxEventPublisher(env.eventOutboxCollection);
  }

  return new NoopEventPublisher();
}
