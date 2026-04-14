import * as admin from 'firebase-admin';
import { firestore } from '../../config/firebase';
import { JobDomainEvent } from '../../events/job-events';
import { JobStatus } from '../../models/job.model';

function safeInc(value: number, delta: number): number {
  return Math.max(0, value + delta);
}

type Counters = {
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
};

function applyStatusTransition(counters: Counters, fromStatus: JobStatus | null, toStatus: JobStatus | null): Counters {
  const next = { ...counters };

  if (fromStatus === 'PENDING') next.pendingJobs = safeInc(next.pendingJobs, -1);
  if (fromStatus === 'IN_PROGRESS') next.inProgressJobs = safeInc(next.inProgressJobs, -1);
  if (fromStatus === 'COMPLETED') next.completedJobs = safeInc(next.completedJobs, -1);

  if (toStatus === 'PENDING') next.pendingJobs = safeInc(next.pendingJobs, +1);
  if (toStatus === 'IN_PROGRESS') next.inProgressJobs = safeInc(next.inProgressJobs, +1);
  if (toStatus === 'COMPLETED') next.completedJobs = safeInc(next.completedJobs, +1);

  return next;
}

export class JobsCountersProjection {
  private readonly clients = firestore.collection('clients');

  async apply(event: JobDomainEvent): Promise<void> {
    const { orgId, data } = event;

    await firestore.runTransaction(async (tx) => {
      const oldClientRef = data.oldClientId ? this.clients.doc(data.oldClientId) : null;
      const newClientRef = data.newClientId ? this.clients.doc(data.newClientId) : null;

      const oldClientSnap = oldClientRef ? await tx.get(oldClientRef) : null;
      const newClientSnap =
        newClientRef && (!oldClientRef || oldClientRef.id !== newClientRef.id)
          ? await tx.get(newClientRef)
          : oldClientSnap;

      const oldBelongs = oldClientSnap && oldClientSnap.exists && this.belongsToOrg(oldClientSnap.data()!, orgId);
      const newBelongs = newClientSnap && newClientSnap.exists && this.belongsToOrg(newClientSnap.data()!, orgId);

      if (data.oldClientId && !oldBelongs) {
        throw new Error(`Projection client not found for oldClientId=${data.oldClientId}`);
      }

      if (data.newClientId && !newBelongs) {
        throw new Error(`Projection client not found for newClientId=${data.newClientId}`);
      }

      if (oldClientRef && newClientRef && oldClientRef.id === newClientRef.id) {
        const base = this.getCounters(oldClientSnap!.data() as FirebaseFirestore.DocumentData);
        const transitioned = applyStatusTransition(base, data.oldStatus, data.newStatus);
        const totalDelta = this.totalDelta(data.oldStatus, data.newStatus);

        tx.update(oldClientRef, {
          totalJobs: safeInc(base.totalJobs, totalDelta),
          pendingJobs: transitioned.pendingJobs,
          inProgressJobs: transitioned.inProgressJobs,
          completedJobs: transitioned.completedJobs,
          updatedAt: admin.firestore.Timestamp.now(),
        });

        return;
      }

      if (oldClientRef && oldClientSnap) {
        const base = this.getCounters(oldClientSnap.data() as FirebaseFirestore.DocumentData);
        const transitioned = applyStatusTransition(base, data.oldStatus, null);
        tx.update(oldClientRef, {
          totalJobs: safeInc(base.totalJobs, data.oldStatus ? -1 : 0),
          pendingJobs: transitioned.pendingJobs,
          inProgressJobs: transitioned.inProgressJobs,
          completedJobs: transitioned.completedJobs,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }

      if (newClientRef && newClientSnap) {
        const base = this.getCounters(newClientSnap.data() as FirebaseFirestore.DocumentData);
        const transitioned = applyStatusTransition(base, null, data.newStatus);
        tx.update(newClientRef, {
          totalJobs: safeInc(base.totalJobs, data.newStatus ? +1 : 0),
          pendingJobs: transitioned.pendingJobs,
          inProgressJobs: transitioned.inProgressJobs,
          completedJobs: transitioned.completedJobs,
          updatedAt: admin.firestore.Timestamp.now(),
        });
      }
    });
  }

  private totalDelta(fromStatus: JobStatus | null, toStatus: JobStatus | null): number {
    if (!fromStatus && toStatus) return 1;
    if (fromStatus && !toStatus) return -1;
    return 0;
  }

  private getCounters(data: FirebaseFirestore.DocumentData): Counters {
    return {
      totalJobs: this.toInt(data.totalJobs),
      pendingJobs: this.toInt(data.pendingJobs),
      inProgressJobs: this.toInt(data.inProgressJobs),
      completedJobs: this.toInt(data.completedJobs),
    };
  }

  private toInt(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) return 0;
    return Math.max(0, Math.floor(value));
  }

  private belongsToOrg(data: FirebaseFirestore.DocumentData, orgId: string): boolean {
    return data.orgId === orgId || data.organizationId === orgId;
  }
}

