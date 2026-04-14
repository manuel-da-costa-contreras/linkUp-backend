import { JobDomainEvent } from './job-events';

export interface EventPublisher {
  publish(event: JobDomainEvent): Promise<void>;
}
