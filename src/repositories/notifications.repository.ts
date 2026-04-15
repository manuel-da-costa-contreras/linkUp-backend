import * as admin from 'firebase-admin';
import { firestore } from '../config/firebase';
import { NotificationEntity } from '../models/notification.model';
import { JobDTO } from '../models/job.model';

export class NotificationsRepository {
  private readonly collection = firestore.collection('notifications');

  async listByOrgAndOwner(orgId: string, ownerUid: string): Promise<NotificationEntity[]> {
    const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
      this.collection.where('orgId', '==', orgId).where('ownerUid', '==', ownerUid).get(),
      this.collection.where('organizationId', '==', orgId).where('ownerUid', '==', ownerUid).get(),
    ]);

    const byId = new Map<string, NotificationEntity>();

    orgIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, this.toEntity(doc.id, doc.data()));
    });

    organizationIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, this.toEntity(doc.id, doc.data()));
    });

    return [...byId.values()];
  }

  async syncFromJob(orgId: string, job: Pick<JobDTO, 'id' | 'name' | 'clientName' | 'status'>): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const pendingId = `${job.id}_JOB_PENDING`;
    const rejectedId = `${job.id}_JOB_REJECTED`;

    const batch = firestore.batch();

    const pendingRef = this.collection.doc(pendingId);
    const rejectedRef = this.collection.doc(rejectedId);

    const base = {
      orgId,
      jobId: job.id,
      jobName: job.name,
      clientName: job.clientName,
      updatedAt: now,
    };

    if (job.status === 'PENDING') {
      batch.set(
        pendingRef,
        {
          ...base,
          type: 'JOB_PENDING',
          status: 'PENDING',
          active: true,
          createdAt: now,
          dismissedAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );

      batch.set(
        rejectedRef,
        {
          ...base,
          type: 'JOB_REJECTED',
          status: 'REJECTED',
          active: false,
          dismissedAt: now,
        },
        { merge: true },
      );
    } else if (job.status === 'REJECTED') {
      batch.set(
        rejectedRef,
        {
          ...base,
          type: 'JOB_REJECTED',
          status: 'REJECTED',
          active: true,
          createdAt: now,
          dismissedAt: admin.firestore.FieldValue.delete(),
        },
        { merge: true },
      );

      batch.set(
        pendingRef,
        {
          ...base,
          type: 'JOB_PENDING',
          status: 'PENDING',
          active: false,
          dismissedAt: now,
        },
        { merge: true },
      );
    } else {
      batch.set(
        pendingRef,
        {
          ...base,
          type: 'JOB_PENDING',
          status: 'PENDING',
          active: false,
          dismissedAt: now,
        },
        { merge: true },
      );

      batch.set(
        rejectedRef,
        {
          ...base,
          type: 'JOB_REJECTED',
          status: 'REJECTED',
          active: false,
          dismissedAt: now,
        },
        { merge: true },
      );
    }

    await batch.commit();
  }

  async deactivateByJob(orgId: string, jobId: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const batch = firestore.batch();

    ['JOB_PENDING', 'JOB_REJECTED'].forEach((type) => {
      const ref = this.collection.doc(`${jobId}_${type}`);
      batch.set(
        ref,
        {
          orgId,
          jobId,
          type,
          active: false,
          dismissedAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    });

    await batch.commit();
  }

  async dismiss(orgId: string, ownerUid: string, notificationId: string): Promise<boolean> {
    const ref = this.collection.doc(notificationId);
    const doc = await ref.get();

    if (!doc.exists) {
      return false;
    }

    const data = doc.data() as FirebaseFirestore.DocumentData;
    if (!this.belongsToOrgAndOwner(data, orgId, ownerUid)) {
      return false;
    }

    await ref.update({
      active: false,
      dismissedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return true;
  }

  async dismissAll(orgId: string, ownerUid: string): Promise<number> {
    const items = await this.listByOrgAndOwner(orgId, ownerUid);
    const activeItems = items.filter((item) => item.active);

    if (activeItems.length === 0) {
      return 0;
    }

    const batch = firestore.batch();
    const now = new Date().toISOString();

    activeItems.forEach((item) => {
      batch.update(this.collection.doc(item.id), {
        active: false,
        dismissedAt: now,
        updatedAt: now,
      });
    });

    await batch.commit();
    return activeItems.length;
  }

  private toEntity(id: string, data: FirebaseFirestore.DocumentData): NotificationEntity {
    return {
      id,
      orgId: String(data.orgId ?? data.organizationId ?? ''),
      ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : undefined,
      jobId: String(data.jobId ?? ''),
      jobName: String(data.jobName ?? ''),
      clientName: String(data.clientName ?? ''),
      type: data.type,
      status: data.status,
      active: data.active !== false,
      createdAt: this.toIso(data.createdAt),
      updatedAt: this.toIso(data.updatedAt),
      dismissedAt: this.toIso(data.dismissedAt),
    };
  }

  private belongsToOrgAndOwner(data: FirebaseFirestore.DocumentData, orgId: string, ownerUid: string): boolean {
    const belongsOrg = data.orgId === orgId || data.organizationId === orgId;
    const belongsOwner = data.ownerUid === ownerUid;
    return belongsOrg && belongsOwner;
  }

  private toIso(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null && 'toDate' in (value as object)) {
      try {
        return (value as { toDate: () => Date }).toDate().toISOString();
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
