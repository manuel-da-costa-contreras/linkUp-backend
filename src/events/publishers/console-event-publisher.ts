import { JobDomainEvent } from '../job-events';
import { EventPublisher } from '../publisher';

export class ConsoleEventPublisher implements EventPublisher {
  async publish(event: JobDomainEvent): Promise<void> {
    console.log('[domain-event]', JSON.stringify(event));
  }
}
