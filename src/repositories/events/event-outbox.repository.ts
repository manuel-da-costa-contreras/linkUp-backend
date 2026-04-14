import * as admin from 'firebase-admin';
import { firestore } from '../../config/firebase';
import { env } from '../../config/env';
import { JobDomainEvent } from '../../events/job-events';

export interface OutboxRecord {
  id: string;
  event: JobDomainEvent;
  attempts: number;
  status: 'pending' | 'processed' | 'failed';
}

export class EventOutboxRepository {
  private readonly outbox = firestore.collection(env.eventOutboxCollection);
  private readonly processed = firestore.collection(env.eventProcessedCollection);

  async listPending(limit = env.eventConsumerBatchSize): Promise<OutboxRecord[]> {
    const pendingLimit = Math.max(1, Math.ceil(limit * 0.8));
    const failedLimit = Math.max(1, limit - pendingLimit);

    const [pendingSnapshot, failedSnapshot] = await Promise.all([
      this.outbox.where('status', '==', 'pending').limit(pendingLimit).get(),
      this.outbox.where('status', '==', 'failed').limit(failedLimit).get(),
    ]);

    const docs = [...pendingSnapshot.docs, ...failedSnapshot.docs].slice(0, limit);

    return docs.map((doc) => {
      const data = doc.data() as FirebaseFirestore.DocumentData;
      return {
        id: doc.id,
        event: {
          eventId: String(data.eventId),
          eventType: data.eventType,
          schemaVersion: 1,
          occurredAt: String(data.occurredAt),
          orgId: String(data.orgId),
          aggregateId: String(data.aggregateId),
          data: data.data,
        } as JobDomainEvent,
        attempts: this.toNonNegativeInt(data.attempts),
        status: (data.status ?? 'pending') as 'pending' | 'processed' | 'failed',
      };
    });
  }

  async isProcessed(eventId: string): Promise<boolean> {
    const doc = await this.processed.doc(eventId).get();
    return doc.exists;
  }

  async markProcessed(outboxId: string, event: JobDomainEvent, mode: 'shadow' | 'apply'): Promise<void> {
    const now = admin.firestore.Timestamp.now();

    await firestore.runTransaction(async (tx) => {
      tx.set(
        this.processed.doc(event.eventId),
        {
          eventId: event.eventId,
          eventType: event.eventType,
          orgId: event.orgId,
          aggregateId: event.aggregateId,
          mode,
          processedAt: now,
        },
        { merge: true },
      );

      tx.update(this.outbox.doc(outboxId), {
        status: 'processed',
        consumedAt: now,
        lastError: admin.firestore.FieldValue.delete(),
      });
    });
  }

  async markDuplicateProcessed(outboxId: string, event: JobDomainEvent): Promise<void> {
    await this.outbox.doc(outboxId).update({
      status: 'processed',
      consumedAt: admin.firestore.Timestamp.now(),
      duplicate: true,
      duplicateEventId: event.eventId,
      lastError: admin.firestore.FieldValue.delete(),
    });
  }

  async markFailed(outboxId: string, attempts: number, errorMessage: string): Promise<void> {
    await this.outbox.doc(outboxId).update({
      status: 'failed',
      attempts: attempts + 1,
      lastError: errorMessage,
      lastFailedAt: admin.firestore.Timestamp.now(),
    });
  }

  private toNonNegativeInt(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(value));
  }
}
