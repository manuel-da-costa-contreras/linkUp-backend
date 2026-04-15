import * as admin from 'firebase-admin';
import { firestore } from '../../config/firebase';
import { JobDomainEvent } from '../../events/job-events';

export class JobsNotificationsProjection {
  private readonly notifications = firestore.collection('notifications');
  private readonly clients = firestore.collection('clients');

  async apply(event: JobDomainEvent): Promise<void> {
    const { orgId, data } = event;

    if (event.eventType === 'job.deleted') {
      await this.deactivateBoth(orgId, data.jobId);
      return;
    }

    const newStatus = data.newStatus;
    const jobId = data.jobId;
    const jobName = data.name;
    const clientId = data.newClientId;
    const clientName = clientId ? await this.resolveClientName(orgId, clientId) : '';
    const ownerUid = await this.resolveOwnerUid(jobId, data.actorUid);

    if (newStatus === 'PENDING') {
      await this.activatePending(orgId, jobId, jobName, clientName, ownerUid);
      await this.deactivateRejected(orgId, jobId, jobName, clientName, ownerUid);
      return;
    }

    if (newStatus === 'REJECTED') {
      await this.activateRejected(orgId, jobId, jobName, clientName, ownerUid);
      await this.deactivatePending(orgId, jobId, jobName, clientName, ownerUid);
      return;
    }

    await this.deactivateBoth(orgId, jobId, jobName, clientName, ownerUid);
  }

  private async resolveClientName(orgId: string, clientId: string): Promise<string> {
    const doc = await this.clients.doc(clientId).get();
    if (!doc.exists) {
      return '';
    }

    const data = doc.data() as FirebaseFirestore.DocumentData;
    const belongs = data.orgId === orgId || data.organizationId === orgId;
    if (!belongs) {
      return '';
    }

    return String(data.name ?? '');
  }

  private async resolveOwnerUid(jobId: string, actorUid?: string): Promise<string | undefined> {
    const [pendingDoc, rejectedDoc] = await Promise.all([
      this.notifications.doc(`${jobId}_JOB_PENDING`).get(),
      this.notifications.doc(`${jobId}_JOB_REJECTED`).get(),
    ]);

    const pendingOwner = pendingDoc.exists ? (pendingDoc.data() as FirebaseFirestore.DocumentData).ownerUid : undefined;
    if (typeof pendingOwner === 'string' && pendingOwner.trim().length > 0) {
      return pendingOwner;
    }

    const rejectedOwner = rejectedDoc.exists ? (rejectedDoc.data() as FirebaseFirestore.DocumentData).ownerUid : undefined;
    if (typeof rejectedOwner === 'string' && rejectedOwner.trim().length > 0) {
      return rejectedOwner;
    }

    if (typeof actorUid === 'string' && actorUid.trim().length > 0) {
      return actorUid;
    }

    return undefined;
  }

  private async activatePending(orgId: string, jobId: string, jobName: string, clientName: string, ownerUid?: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    await this.notifications.doc(`${jobId}_JOB_PENDING`).set(
      {
        orgId,
        ...(ownerUid ? { ownerUid } : {}),
        jobId,
        jobName,
        clientName,
        type: 'JOB_PENDING',
        status: 'PENDING',
        active: true,
        updatedAt: now,
        createdAt: now,
        dismissedAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
  }

  private async activateRejected(orgId: string, jobId: string, jobName: string, clientName: string, ownerUid?: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    await this.notifications.doc(`${jobId}_JOB_REJECTED`).set(
      {
        orgId,
        ...(ownerUid ? { ownerUid } : {}),
        jobId,
        jobName,
        clientName,
        type: 'JOB_REJECTED',
        status: 'REJECTED',
        active: true,
        updatedAt: now,
        createdAt: now,
        dismissedAt: admin.firestore.FieldValue.delete(),
      },
      { merge: true },
    );
  }

  private async deactivatePending(orgId: string, jobId: string, jobName = '', clientName = '', ownerUid?: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    await this.notifications.doc(`${jobId}_JOB_PENDING`).set(
      {
        orgId,
        ...(ownerUid ? { ownerUid } : {}),
        jobId,
        jobName,
        clientName,
        type: 'JOB_PENDING',
        status: 'PENDING',
        active: false,
        updatedAt: now,
        dismissedAt: now,
      },
      { merge: true },
    );
  }

  private async deactivateRejected(orgId: string, jobId: string, jobName = '', clientName = '', ownerUid?: string): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    await this.notifications.doc(`${jobId}_JOB_REJECTED`).set(
      {
        orgId,
        ...(ownerUid ? { ownerUid } : {}),
        jobId,
        jobName,
        clientName,
        type: 'JOB_REJECTED',
        status: 'REJECTED',
        active: false,
        updatedAt: now,
        dismissedAt: now,
      },
      { merge: true },
    );
  }

  private async deactivateBoth(orgId: string, jobId: string, jobName = '', clientName = '', ownerUid?: string): Promise<void> {
    await Promise.all([
      this.deactivatePending(orgId, jobId, jobName, clientName, ownerUid),
      this.deactivateRejected(orgId, jobId, jobName, clientName, ownerUid),
    ]);
  }
}
