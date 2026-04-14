import * as admin from 'firebase-admin';
import { firestore } from '../config/firebase';
import { ClientDTO, ClientEntity, ClientOptionDTO } from '../models/client.model';

const ACTIVE_JOB_STATUSES = ['pending', 'open', 'todo', 'in_progress', 'in-progress', 'processing'];

export class ClientsRepository {
  private readonly clientsCollection = firestore.collection('clients');
  private readonly jobsCollection = firestore.collection('jobs');

  async list(orgId: string, search?: string): Promise<ClientDTO[]> {
    const clients = await this.getClientsByOrg(orgId);
    const filteredClients = this.filterClientsBySearch(clients, search);
    return filteredClients.map((client) => this.toClientDTO(client));
  }

  async listOptions(orgId: string, search?: string): Promise<ClientOptionDTO[]> {
    const clients = await this.getClientsByOrg(orgId);
    const filteredClients = this.filterClientsBySearch(clients, search);

    return filteredClients.map((client) => ({
      id: client.id,
      name: client.name,
    }));
  }

  async create(orgId: string, name: string): Promise<ClientDTO> {
    const now = admin.firestore.Timestamp.now();
    const docRef = this.clientsCollection.doc();

    await docRef.set({
      name,
      orgId,
      totalJobs: 0,
      pendingJobs: 0,
      inProgressJobs: 0,
      completedJobs: 0,
      createdAt: now,
      updatedAt: now,
    });

    return {
      id: docRef.id,
      name,
      totalJobs: 0,
      pendingJobs: 0,
      inProgressJobs: 0,
      completedJobs: 0,
    };
  }

  async update(orgId: string, clientId: string, name: string): Promise<ClientDTO | null> {
    const doc = await this.clientsCollection.doc(clientId).get();

    if (!doc.exists) {
      return null;
    }

    const raw = doc.data() as { orgId?: string; organizationId?: string };
    if (!this.belongsToOrg(raw, orgId)) {
      return null;
    }

    const now = admin.firestore.Timestamp.now();
    await this.clientsCollection.doc(clientId).update({
      name,
      updatedAt: now,
    });

    const updated = await this.clientsCollection.doc(clientId).get();
    if (!updated.exists) {
      return null;
    }

    const client = this.toClientEntity(updated.id, updated.data() as FirebaseFirestore.DocumentData);
    return this.toClientDTO(client);
  }

  async remove(orgId: string, clientId: string): Promise<boolean> {
    const doc = await this.clientsCollection.doc(clientId).get();

    if (!doc.exists) {
      return false;
    }

    const raw = doc.data() as { orgId?: string; organizationId?: string };
    if (!this.belongsToOrg(raw, orgId)) {
      return false;
    }

    await this.clientsCollection.doc(clientId).delete();
    return true;
  }

  async hasActiveJobs(orgId: string, clientId: string): Promise<boolean> {
    const jobs = await this.getJobsByOrg(orgId);

    return jobs.some((job) => {
      const jobClientId = String(job.clientId ?? job.client_id ?? '');
      if (jobClientId !== clientId) {
        return false;
      }

      const status = String(job.status ?? job.state ?? '').toLowerCase();
      return ACTIVE_JOB_STATUSES.includes(status) || status.includes('progress');
    });
  }

  async existsByName(orgId: string, name: string, excludeClientId?: string): Promise<boolean> {
    const clients = await this.getClientsByOrg(orgId);
    const normalizedTarget = name.trim().toLowerCase();

    return clients.some((client) => {
      if (excludeClientId && client.id === excludeClientId) {
        return false;
      }

      return client.name.trim().toLowerCase() === normalizedTarget;
    });
  }

  
  async listEntities(orgId: string): Promise<ClientEntity[]> {
    return this.getClientsByOrg(orgId);
  }
  async existsById(orgId: string, clientId: string): Promise<boolean> {
    const doc = await this.clientsCollection.doc(clientId).get();
    if (!doc.exists) {
      return false;
    }

    const raw = doc.data() as { orgId?: string; organizationId?: string };
    return this.belongsToOrg(raw, orgId);
  }

  private async getClientsByOrg(orgId: string): Promise<ClientEntity[]> {
    const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
      this.clientsCollection.where('orgId', '==', orgId).get(),
      this.clientsCollection.where('organizationId', '==', orgId).get(),
    ]);

    const byId = new Map<string, ClientEntity>();

    orgIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, this.toClientEntity(doc.id, doc.data()));
    });

    organizationIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, this.toClientEntity(doc.id, doc.data()));
    });

    return [...byId.values()];
  }

  private async getJobsByOrg(orgId: string): Promise<FirebaseFirestore.DocumentData[]> {
    const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
      this.jobsCollection.where('orgId', '==', orgId).get(),
      this.jobsCollection.where('organizationId', '==', orgId).get(),
    ]);

    const byId = new Map<string, FirebaseFirestore.DocumentData>();

    orgIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, doc.data());
    });

    organizationIdSnapshot.docs.forEach((doc) => {
      byId.set(doc.id, doc.data());
    });

    return [...byId.values()];
  }

  private toClientEntity(id: string, data: FirebaseFirestore.DocumentData): ClientEntity {
    return {
      id,
      name: String(data.name ?? ''),
      orgId: String(data.orgId ?? data.organizationId ?? ''),
      totalJobs: this.toNonNegativeInt(data.totalJobs),
      pendingJobs: this.toNonNegativeInt(data.pendingJobs),
      inProgressJobs: this.toNonNegativeInt(data.inProgressJobs),
      completedJobs: this.toNonNegativeInt(data.completedJobs),
      createdAt: this.toTimestamp(data.createdAt),
      updatedAt: this.toTimestamp(data.updatedAt),
    };
  }

  private toTimestamp(value: unknown): FirebaseFirestore.Timestamp {
    if (value instanceof admin.firestore.Timestamp) {
      return value;
    }

    if (value && typeof value === 'object' && 'toDate' in (value as object)) {
      try {
        const candidate = value as { toDate: () => Date };
        return admin.firestore.Timestamp.fromDate(candidate.toDate());
      } catch {
        return admin.firestore.Timestamp.now();
      }
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return admin.firestore.Timestamp.fromDate(date);
      }
    }

    return admin.firestore.Timestamp.now();
  }

  private toNonNegativeInt(value: unknown): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }

    return Math.max(0, Math.floor(value));
  }

  private filterClientsBySearch(clients: ClientEntity[], search?: string): ClientEntity[] {
    if (!search) {
      return clients;
    }

    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return clients;
    }

    return clients.filter((client) => client.name.toLowerCase().includes(normalized));
  }

  private toClientDTO(client: ClientEntity): ClientDTO {
    return {
      id: client.id,
      name: client.name,
      totalJobs: client.totalJobs,
      pendingJobs: client.pendingJobs,
      inProgressJobs: client.inProgressJobs,
      completedJobs: client.completedJobs,
    };
  }

  private belongsToOrg(raw: { orgId?: string; organizationId?: string }, orgId: string): boolean {
    return raw.orgId === orgId || raw.organizationId === orgId;
  }
}

