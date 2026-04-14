import * as admin from 'firebase-admin';
import { firestore } from '../../config/firebase';
import { JobDomainEvent } from '../job-events';
import { EventPublisher } from '../publisher';

export class FirestoreOutboxEventPublisher implements EventPublisher {
  constructor(private readonly collectionName: string) {}

  async publish(event: JobDomainEvent): Promise<void> {
    await firestore.collection(this.collectionName).doc(event.eventId).set({
      ...event,
      status: 'pending',
      attempts: 0,
      publishedAt: admin.firestore.Timestamp.now(),
    });
  }
}
