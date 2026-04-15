import { Response } from 'express';
import { firestore } from '../config/firebase';
import { NotificationType } from '../models/notification.model';
import { HttpError } from '../utils/httpError';

type StreamStatusFilter = 'active' | 'inactive';
type StreamEventName = 'notification.upsert' | 'notification.dismissed' | 'notification.dismissed_all';

interface StreamFilter {
  ownerUid: string;
  status: StreamStatusFilter;
  types: NotificationType[] | null;
}

interface StreamClient {
  id: string;
  ownerUid: string;
  res: Response;
  filter: StreamFilter;
  pingTimer: NodeJS.Timeout;
}

interface StreamEnvelope {
  id: string;
  event: StreamEventName;
  orgId: string;
  ownerUid?: string;
  notificationType?: NotificationType;
  payload: Record<string, unknown>;
}

interface OrgChannel {
  clients: Map<string, StreamClient>;
  known: Map<string, { active: boolean; type: NotificationType; jobId: string; ownerUid?: string }>;
  history: StreamEnvelope[];
  initialized: boolean;
  unsubscribe?: () => void;
}

const TYPE_MAP: Record<string, NotificationType> = {
  JOB_PENDING: 'JOB_PENDING',
  JOB_REJECTED: 'JOB_REJECTED',
  PENDING: 'JOB_PENDING',
  REJECTED: 'JOB_REJECTED',
};

const HISTORY_LIMIT = 500;
const PING_INTERVAL_MS = 20000;

export class NotificationsStreamService {
  private readonly channels = new Map<string, OrgChannel>();
  private globalEventCounter = Date.now();

  subscribe(
    orgId: string,
    ownerUid: string,
    res: Response,
    query: { status?: string; types?: string },
    lastEventId?: string,
  ): () => void {
    const filter = this.parseFilter(ownerUid, query.status, query.types);
    const channel = this.ensureChannel(orgId);
    this.ensureListener(orgId, channel);

    const clientId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    const pingTimer = setInterval(() => {
      res.write(': ping\n\n');
    }, PING_INTERVAL_MS);

    const client: StreamClient = {
      id: clientId,
      ownerUid,
      res,
      filter,
      pingTimer,
    };

    channel.clients.set(clientId, client);
    this.replayMissedEvents(channel, client, lastEventId);

    return () => {
      const current = channel.clients.get(clientId);
      if (!current) {
        return;
      }

      clearInterval(current.pingTimer);
      channel.clients.delete(clientId);

      if (channel.clients.size === 0) {
        channel.unsubscribe?.();
        this.channels.delete(orgId);
      }
    };
  }

  emitDismissedAll(
    orgId: string,
    ownerUid: string,
    payload: { dismissedCount: number; dismissedAt: string; scope: { status: 'active'; types: NotificationType[] } },
  ): void {
    const envelope: StreamEnvelope = {
      id: this.nextEventId(),
      event: 'notification.dismissed_all',
      orgId,
      ownerUid,
      payload: {
        type: 'notification.dismissed_all',
        orgId,
        timestamp: new Date().toISOString(),
        data: payload,
      },
    };

    this.broadcast(orgId, envelope);
  }

  private ensureChannel(orgId: string): OrgChannel {
    const existing = this.channels.get(orgId);
    if (existing) {
      return existing;
    }

    const created: OrgChannel = {
      clients: new Map(),
      known: new Map(),
      history: [],
      initialized: false,
    };

    this.channels.set(orgId, created);
    return created;
  }

  private ensureListener(orgId: string, channel: OrgChannel): void {
    if (channel.unsubscribe) {
      return;
    }

    const query = firestore.collection('notifications').where('orgId', '==', orgId);
    channel.unsubscribe = query.onSnapshot((snapshot) => {
      if (!channel.initialized) {
        snapshot.docs.forEach((doc) => {
          const normalized = this.normalizeNotification(doc.id, doc.data());
          channel.known.set(doc.id, {
            active: normalized.active,
            type: normalized.notificationType,
            jobId: normalized.jobId,
            ownerUid: normalized.ownerUid,
          });
        });
        channel.initialized = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        const normalized = this.normalizeNotification(change.doc.id, change.doc.data());
        const previous = channel.known.get(change.doc.id);
        channel.known.set(change.doc.id, {
          active: normalized.active,
          type: normalized.notificationType,
          jobId: normalized.jobId,
          ownerUid: normalized.ownerUid,
        });

        if (normalized.active) {
          const envelope: StreamEnvelope = {
            id: this.nextEventId(),
            event: 'notification.upsert',
            orgId,
            ownerUid: normalized.ownerUid,
            notificationType: normalized.notificationType,
            payload: {
              type: 'notification.upsert',
              orgId,
              timestamp: new Date().toISOString(),
              data: {
                id: normalized.id,
                jobId: normalized.jobId,
                jobName: normalized.jobName,
                clientName: normalized.clientName,
                status: normalized.status,
                notificationType: normalized.notificationType,
                active: true,
                createdAt: normalized.createdAt,
                updatedAt: normalized.updatedAt,
              },
            },
          };
          this.broadcast(orgId, envelope);
          return;
        }

        if (!previous || previous.active) {
          const envelope: StreamEnvelope = {
            id: this.nextEventId(),
            event: 'notification.dismissed',
            orgId,
            ownerUid: normalized.ownerUid,
            notificationType: normalized.notificationType,
            payload: {
              type: 'notification.dismissed',
              orgId,
              timestamp: new Date().toISOString(),
              data: {
                id: normalized.id,
                jobId: normalized.jobId,
                dismissedAt: normalized.dismissedAt ?? normalized.updatedAt ?? new Date().toISOString(),
              },
            },
          };
          this.broadcast(orgId, envelope);
        }
      });
    });
  }

  private broadcast(orgId: string, envelope: StreamEnvelope): void {
    const channel = this.channels.get(orgId);
    if (!channel) {
      return;
    }

    channel.history.push(envelope);
    if (channel.history.length > HISTORY_LIMIT) {
      channel.history.shift();
    }

    channel.clients.forEach((client) => {
      if (!this.matchesFilter(client.filter, envelope)) {
        return;
      }

      this.writeEvent(client.res, envelope);
    });
  }

  private replayMissedEvents(channel: OrgChannel, client: StreamClient, lastEventId?: string): void {
    if (!lastEventId) {
      return;
    }

    const lastNumeric = Number(lastEventId);
    if (!Number.isFinite(lastNumeric)) {
      return;
    }

    channel.history.forEach((event) => {
      if (Number(event.id) <= lastNumeric) {
        return;
      }
      if (!this.matchesFilter(client.filter, event)) {
        return;
      }
      this.writeEvent(client.res, event);
    });
  }

  private writeEvent(res: Response, envelope: StreamEnvelope): void {
    res.write(`id: ${envelope.id}\n`);
    res.write(`event: ${envelope.event}\n`);
    res.write(`data: ${JSON.stringify(envelope.payload)}\n\n`);
  }

  private nextEventId(): string {
    this.globalEventCounter += 1;
    return String(this.globalEventCounter);
  }

  private matchesFilter(filter: StreamFilter, envelope: StreamEnvelope): boolean {
    if (!envelope.ownerUid) {
      return false;
    }

    if (filter.ownerUid !== envelope.ownerUid) {
      return false;
    }

    if (envelope.event === 'notification.dismissed_all') {
      return true;
    }

    if (filter.types && envelope.notificationType && !filter.types.includes(envelope.notificationType)) {
      return false;
    }

    if (filter.status === 'inactive') {
      return envelope.event === 'notification.dismissed';
    }

    return envelope.event === 'notification.upsert' || envelope.event === 'notification.dismissed';
  }

  private parseFilter(ownerUid: string, status?: string, types?: string): StreamFilter {
    const normalizedStatus = (status ?? 'active').toLowerCase();
    if (normalizedStatus !== 'active' && normalizedStatus !== 'inactive') {
      throw new HttpError(400, 'Validation failed', { field: 'status', reason: 'invalid_enum' }, 'VALIDATION_ERROR');
    }

    if (!types || types.trim().length === 0) {
      return { ownerUid, status: normalizedStatus, types: null };
    }

    const parsed = types
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean)
      .map((raw) => {
        const mapped = TYPE_MAP[raw];
        if (!mapped) {
          throw new HttpError(400, 'Validation failed', { field: 'types', reason: 'invalid_enum' }, 'VALIDATION_ERROR');
        }
        return mapped;
      });

    return { ownerUid, status: normalizedStatus, types: parsed };
  }

  private normalizeNotification(id: string, raw: FirebaseFirestore.DocumentData): {
    id: string;
    ownerUid?: string;
    jobId: string;
    jobName: string;
    clientName: string;
    status: 'PENDING' | 'REJECTED';
    notificationType: NotificationType;
    active: boolean;
    createdAt: string;
    updatedAt: string;
    dismissedAt?: string;
  } {
    const notificationType = (raw.type as NotificationType) === 'JOB_REJECTED' ? 'JOB_REJECTED' : 'JOB_PENDING';
    const status = notificationType === 'JOB_REJECTED' ? 'REJECTED' : 'PENDING';

    const createdAt = this.toIso(raw.createdAt) ?? new Date().toISOString();
    const updatedAt = this.toIso(raw.updatedAt) ?? createdAt;
    const dismissedAt = this.toIso(raw.dismissedAt);

    return {
      id,
      ownerUid: typeof raw.ownerUid === 'string' ? raw.ownerUid : undefined,
      jobId: String(raw.jobId ?? ''),
      jobName: String(raw.jobName ?? ''),
      clientName: String(raw.clientName ?? ''),
      status,
      notificationType,
      active: raw.active !== false,
      createdAt,
      updatedAt,
      dismissedAt,
    };
  }

  private toIso(value: unknown): string | undefined {
    if (!value) {
      return undefined;
    }

    if (typeof value === 'string') {
      return value;
    }

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

export const notificationsStreamService = new NotificationsStreamService();
