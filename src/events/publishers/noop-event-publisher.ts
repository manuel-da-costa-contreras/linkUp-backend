import { JobDomainEvent } from '../job-events';
import { EventPublisher } from '../publisher';

export class NoopEventPublisher implements EventPublisher {
  async publish(_event: JobDomainEvent): Promise<void> {
    return;
  }
}
