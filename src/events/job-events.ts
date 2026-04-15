import { randomUUID } from 'crypto';
import { JobStatus } from '../models/job.model';

export type JobEventType = 'job.created' | 'job.updated' | 'job.deleted';

export interface JobEventPayload {
  jobId: string;
  name: string;
  actorUid?: string;
  oldStatus: JobStatus | null;
  newStatus: JobStatus | null;
  oldClientId: string | null;
  newClientId: string | null;
}

export interface JobDomainEvent {
  eventId: string;
  eventType: JobEventType;
  schemaVersion: 1;
  occurredAt: string;
  orgId: string;
  aggregateId: string;
  data: JobEventPayload;
}

function baseEvent(orgId: string, jobId: string, eventType: JobEventType): Omit<JobDomainEvent, 'data'> {
  return {
    eventId: randomUUID(),
    eventType,
    schemaVersion: 1,
    occurredAt: new Date().toISOString(),
    orgId,
    aggregateId: jobId,
  };
}

export function buildJobCreatedEvent(input: {
  orgId: string;
  jobId: string;
  name: string;
  clientId: string;
  status: JobStatus;
  actorUid?: string;
}): JobDomainEvent {
  return {
    ...baseEvent(input.orgId, input.jobId, 'job.created'),
    data: {
      jobId: input.jobId,
      name: input.name,
      actorUid: input.actorUid,
      oldStatus: null,
      newStatus: input.status,
      oldClientId: null,
      newClientId: input.clientId,
    },
  };
}

export function buildJobUpdatedEvent(input: {
  orgId: string;
  jobId: string;
  oldName: string;
  newName: string;
  oldClientId: string;
  newClientId: string;
  oldStatus: JobStatus;
  newStatus: JobStatus;
  actorUid?: string;
}): JobDomainEvent {
  return {
    ...baseEvent(input.orgId, input.jobId, 'job.updated'),
    data: {
      jobId: input.jobId,
      name: input.newName,
      actorUid: input.actorUid,
      oldStatus: input.oldStatus,
      newStatus: input.newStatus,
      oldClientId: input.oldClientId,
      newClientId: input.newClientId,
    },
  };
}

export function buildJobDeletedEvent(input: {
  orgId: string;
  jobId: string;
  name: string;
  clientId: string;
  status: JobStatus;
  actorUid?: string;
}): JobDomainEvent {
  return {
    ...baseEvent(input.orgId, input.jobId, 'job.deleted'),
    data: {
      jobId: input.jobId,
      name: input.name,
      actorUid: input.actorUid,
      oldStatus: input.status,
      newStatus: null,
      oldClientId: input.clientId,
      newClientId: null,
    },
  };
}
