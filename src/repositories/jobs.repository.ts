import * as admin from 'firebase-admin';
import { firestore } from '../config/firebase';
import { CreateJobInput, JobDTO, JobListRecord, JobStatus, UpdateJobInput } from '../models/job.model';

export type CreateJobResult =
  | { kind: 'ok'; job: JobDTO }
  | { kind: 'client_not_found' };

export type UpdateJobResult =
  | {
      kind: 'ok';
      job: JobDTO;
      previous: {
        name: string;
        clientId: string;
        status: JobStatus;
      };
    }
  | { kind: 'job_not_found' }
  | { kind: 'client_not_found' };

export type DeleteJobResult =
  | {
      kind: 'ok';
      deleted: {
        id: string;
        name: string;
        clientId: string;
        status: JobStatus;
      };
    }
  | { kind: 'job_not_found' }
  | { kind: 'client_not_found' };

type ClientCounters = {
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
};

const JOB_STATUSES: JobStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];

function safeInc(value: number, delta: number): number {
  return Math.max(0, value + delta);
}

function applyStatusTransition(
  counters: ClientCounters,
  fromStatus: JobStatus | null,
  toStatus: JobStatus | null,
): ClientCounters {
  const next: ClientCounters = { ...counters };

  if (fromStatus === 'PENDING') next.pendingJobs = safeInc(next.pendingJobs, -1);
  if (fromStatus === 'IN_PROGRESS') next.inProgressJobs = safeInc(next.inProgressJobs, -1);
  if (fromStatus === 'COMPLETED') next.completedJobs = safeInc(next.completedJobs, -1);

  if (toStatus === 'PENDING') next.pendingJobs = safeInc(next.pendingJobs, +1);
  if (toStatus === 'IN_PROGRESS') next.inProgressJobs = safeInc(next.inProgressJobs, +1);
  if (toStatus === 'COMPLETED') next.completedJobs = safeInc(next.completedJobs, +1);

  return next;
}

export class JobsRepository {
  private readonly jobsCollection = firestore.collection('jobs');
  private readonly clientsCollection = firestore.collection('clients');

  async list(orgId: string): Promise<JobListRecord[]> {
    const [jobs, clients] = await Promise.all([this.getJobsByOrg(orgId), this.getClientsByOrg(orgId)]);

    const clientById = new Map<string, { name: string }>();
    clients.forEach((client) => {
      clientById.set(client.id, { name: String(client.name ?? '') });
    });

    return jobs.map((job) => {
      const clientId = String(job.clientId ?? job.client_id ?? '');
      const clientName = clientId ? (clientById.get(clientId)?.name ?? '') : 'Sin cliente';

      return {
        id: String(job.id),
        name: String(job.name ?? ''),
        clientId,
        clientName,
        status: this.normalizeStatus(String(job.status ?? 'PENDING')),
        updatedAt: this.toIsoString(job.updatedAt),
        reason: typeof job.reason === 'string' ? job.reason : undefined,
        rating: typeof job.rating === 'number' ? job.rating : undefined,
      };
    });
  }

  async create(orgId: string, payload: CreateJobInput): Promise<CreateJobResult> {
    const status = this.normalizeStatus(payload.status ?? 'PENDING');

    return firestore.runTransaction(async (tx) => {
      const clientRef = this.clientsCollection.doc(payload.clientId);
      const clientSnap = await tx.get(clientRef);

      if (!clientSnap.exists || !this.belongsToOrg(clientSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'client_not_found' };
      }

      const clientData = clientSnap.data() as FirebaseFirestore.DocumentData;
      const clientCounters = this.getClientCounters(clientData);
      const transitioned = applyStatusTransition(clientCounters, null, status);
      const now = admin.firestore.Timestamp.now();
      const reason = payload.reason?.trim();
      const rating = payload.rating;

      const jobRef = this.jobsCollection.doc();
      tx.set(jobRef, {
        id: jobRef.id,
        orgId,
        name: payload.name,
        clientId: payload.clientId,
        status,
        ...(reason ? { reason } : {}),
        ...(rating !== undefined ? { rating } : {}),
        createdAt: now,
        updatedAt: now,
      });

      tx.update(clientRef, {
        totalJobs: safeInc(clientCounters.totalJobs, +1),
        pendingJobs: transitioned.pendingJobs,
        inProgressJobs: transitioned.inProgressJobs,
        completedJobs: transitioned.completedJobs,
        updatedAt: now,
      });

      return {
        kind: 'ok',
        job: {
          id: jobRef.id,
          name: payload.name,
          clientId: payload.clientId,
          clientName: String(clientData.name ?? ''),
          status,
          updatedAt: now.toDate().toISOString(),
          ...(reason ? { reason } : {}),
          ...(rating !== undefined ? { rating } : {}),
        },
      };
    });
  }

  async update(orgId: string, jobId: string, patch: UpdateJobInput): Promise<UpdateJobResult> {
    return firestore.runTransaction(async (tx) => {
      const jobRef = this.jobsCollection.doc(jobId);
      const jobSnap = await tx.get(jobRef);

      if (!jobSnap.exists || !this.belongsToOrg(jobSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'job_not_found' };
      }

      const job = jobSnap.data() as FirebaseFirestore.DocumentData;
      const oldClientId = String(job.clientId ?? '');
      const newClientId = patch.clientId ?? oldClientId;
      const oldStatus = this.normalizeStatus(String(job.status ?? 'PENDING'));
      const newStatus = this.normalizeStatus(patch.status ?? oldStatus);
      const oldName = String(job.name ?? '');

      const oldClientRef = this.clientsCollection.doc(oldClientId);
      const newClientRef = this.clientsCollection.doc(newClientId);

      const oldClientSnap = await tx.get(oldClientRef);
      if (!oldClientSnap.exists || !this.belongsToOrg(oldClientSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'client_not_found' };
      }

      const newClientSnap = newClientId === oldClientId ? oldClientSnap : await tx.get(newClientRef);

      if (!newClientSnap.exists || !this.belongsToOrg(newClientSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'client_not_found' };
      }

      const oldClientData = oldClientSnap.data() as FirebaseFirestore.DocumentData;
      const newClientData = newClientSnap.data() as FirebaseFirestore.DocumentData;
      const oldCounters = this.getClientCounters(oldClientData);
      const newCounters = this.getClientCounters(newClientData);
      const now = admin.firestore.Timestamp.now();

      if (oldClientId === newClientId) {
        if (oldStatus !== newStatus) {
          const next = applyStatusTransition(oldCounters, oldStatus, newStatus);
          tx.update(oldClientRef, {
            pendingJobs: next.pendingJobs,
            inProgressJobs: next.inProgressJobs,
            completedJobs: next.completedJobs,
            updatedAt: now,
          });
        }
      } else {
        const oldNext = applyStatusTransition(oldCounters, oldStatus, null);
        tx.update(oldClientRef, {
          totalJobs: safeInc(oldCounters.totalJobs, -1),
          pendingJobs: oldNext.pendingJobs,
          inProgressJobs: oldNext.inProgressJobs,
          completedJobs: oldNext.completedJobs,
          updatedAt: now,
        });

        const newNext = applyStatusTransition(newCounters, null, newStatus);
        tx.update(newClientRef, {
          totalJobs: safeInc(newCounters.totalJobs, +1),
          pendingJobs: newNext.pendingJobs,
          inProgressJobs: newNext.inProgressJobs,
          completedJobs: newNext.completedJobs,
          updatedAt: now,
        });
      }

      const updatedName = patch.name ?? oldName;
      const reason = patch.reason?.trim();

      const updateData: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
        name: updatedName,
        clientId: newClientId,
        status: newStatus,
        updatedAt: now,
      };

      if (patch.reason !== undefined) {
        updateData.reason = reason ? reason : admin.firestore.FieldValue.delete();
      }

      if (patch.rating !== undefined) {
        updateData.rating = patch.rating;
      } else if (patch.status !== undefined && newStatus !== 'COMPLETED') {
        updateData.rating = admin.firestore.FieldValue.delete();
      }

      tx.update(jobRef, updateData);

      return {
        kind: 'ok',
        job: {
          id: jobId,
          name: updatedName,
          clientId: newClientId,
          clientName: String(newClientData.name ?? ''),
          status: newStatus,
          updatedAt: now.toDate().toISOString(),
          ...(patch.reason !== undefined
            ? reason
              ? { reason }
              : {}
            : typeof job.reason === 'string'
              ? { reason: job.reason }
              : {}),
          ...(patch.rating !== undefined
            ? { rating: patch.rating }
            : newStatus === 'COMPLETED' && typeof job.rating === 'number'
              ? { rating: job.rating }
              : {}),
        },
        previous: {
          name: oldName,
          clientId: oldClientId,
          status: oldStatus,
        },
      };
    });
  }

  async remove(orgId: string, jobId: string): Promise<DeleteJobResult> {
    return firestore.runTransaction(async (tx) => {
      const jobRef = this.jobsCollection.doc(jobId);
      const jobSnap = await tx.get(jobRef);

      if (!jobSnap.exists || !this.belongsToOrg(jobSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'job_not_found' };
      }

      const job = jobSnap.data() as FirebaseFirestore.DocumentData;
      const clientId = String(job.clientId ?? '');
      const status = this.normalizeStatus(String(job.status ?? 'PENDING'));
      const name = String(job.name ?? '');

      const clientRef = this.clientsCollection.doc(clientId);
      const clientSnap = await tx.get(clientRef);

      if (!clientSnap.exists || !this.belongsToOrg(clientSnap.data() as FirebaseFirestore.DocumentData, orgId)) {
        return { kind: 'client_not_found' };
      }

      const clientData = clientSnap.data() as FirebaseFirestore.DocumentData;
      const counters = this.getClientCounters(clientData);
      const next = applyStatusTransition(counters, status, null);
      const now = admin.firestore.Timestamp.now();

      tx.delete(jobRef);
      tx.update(clientRef, {
        totalJobs: safeInc(counters.totalJobs, -1),
        pendingJobs: next.pendingJobs,
        inProgressJobs: next.inProgressJobs,
        completedJobs: next.completedJobs,
        updatedAt: now,
      });

      return {
        kind: 'ok',
        deleted: {
          id: jobId,
          name,
          clientId,
          status,
        },
      };
    });
  }

  private getClientCounters(client: FirebaseFirestore.DocumentData): ClientCounters {
    return {
      totalJobs: this.toNonNegativeInt(client.totalJobs),
      pendingJobs: this.toNonNegativeInt(client.pendingJobs),
      inProgressJobs: this.toNonNegativeInt(client.inProgressJobs),
      completedJobs: this.toNonNegativeInt(client.completedJobs),
    };
  }

  private toNonNegativeInt(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(value));
  }

  private async getJobsByOrg(orgId: string): Promise<Array<FirebaseFirestore.DocumentData & { id: string }>> {
    const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
      this.jobsCollection.where('orgId', '==', orgId).get(),
      this.jobsCollection.where('organizationId', '==', orgId).get(),
    ]);

    const byId = new Map<string, FirebaseFirestore.DocumentData & { id: string }>();

    orgIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, { id: doc.id, ...doc.data() });
    });

    organizationIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, { id: doc.id, ...doc.data() });
    });

    return [...byId.values()];
  }

  private async getClientsByOrg(orgId: string): Promise<Array<FirebaseFirestore.DocumentData & { id: string }>> {
    const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
      this.clientsCollection.where('orgId', '==', orgId).get(),
      this.clientsCollection.where('organizationId', '==', orgId).get(),
    ]);

    const byId = new Map<string, FirebaseFirestore.DocumentData & { id: string }>();

    orgIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, { id: doc.id, ...doc.data() });
    });

    organizationIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, { id: doc.id, ...doc.data() });
    });

    return [...byId.values()];
  }

  private belongsToOrg(data: FirebaseFirestore.DocumentData, orgId: string): boolean {
    return data.orgId === orgId || data.organizationId === orgId;
  }

  private toIsoString(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (value instanceof admin.firestore.Timestamp) {
      return value.toDate().toISOString();
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }

    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
    }

    if (typeof value === 'object' && 'toDate' in (value as object)) {
      try {
        const d = (value as { toDate: () => Date }).toDate();
        return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
      } catch {
        return undefined;
      }
    }

    return undefined;
  }

  private normalizeStatus(status: string): JobStatus {
    const upper = status.toUpperCase();
    if (JOB_STATUSES.includes(upper as JobStatus)) {
      return upper as JobStatus;
    }

    if (upper === 'OPEN' || upper === 'TODO') {
      return 'PENDING';
    }

    if (upper === 'DONE' || upper === 'PAID') {
      return 'COMPLETED';
    }

    if (upper.includes('PROGRESS')) {
      return 'IN_PROGRESS';
    }

    return 'PENDING';
  }
}

