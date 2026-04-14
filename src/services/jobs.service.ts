import {
  JobDomainEvent,
  buildJobCreatedEvent,
  buildJobDeletedEvent,
  buildJobUpdatedEvent,
} from '../events/job-events';
import { createEventPublisher } from '../events/create-event-publisher';
import { EventPublisher } from '../events/publisher';
import { PaginatedResult, PaginationQuery } from '../models/pagination.model';
import { CreateJobInput, JobDTO, JobListItemDTO, JobListRecord, JobStatus, UpdateJobInput } from '../models/job.model';
import { JobsRepository } from '../repositories/jobs.repository';
import { HttpError } from '../utils/httpError';
import { paginateArray } from '../utils/pagination';

const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  PENDING: ['IN_PROGRESS'],
  IN_PROGRESS: ['COMPLETED', 'REJECTED'],
  COMPLETED: [],
  REJECTED: ['PENDING'],
};

export class JobsService {
  constructor(
    private readonly jobsRepository: JobsRepository = new JobsRepository(),
    private readonly eventPublisher: EventPublisher = createEventPublisher(),
  ) {}

  async list(orgId: string, query: PaginationQuery): Promise<PaginatedResult<JobListItemDTO>> {
    const jobs = await this.jobsRepository.list(orgId);
    const filtered = this.filterBySearch(jobs, query.search);
    const sorted = this.sortItems(filtered, query.sortBy ?? 'createdAt', query.sortDir);

    const data = sorted.map((item) => ({
      id: item.id,
      name: item.name,
      clientId: item.clientId,
      clientName: item.clientName,
      status: item.status,
    }));

    return paginateArray(data, query.page, query.pageSize);
  }

  async create(orgId: string, payload: CreateJobInput): Promise<JobDTO> {
    const created = await this.jobsRepository.create(orgId, payload);

    if (created.kind === 'client_not_found') {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    await this.publishSafely(
      buildJobCreatedEvent({
        orgId,
        jobId: created.job.id,
        name: created.job.name,
        clientId: created.job.clientId,
        status: created.job.status,
      }),
    );

    return created.job;
  }

  async update(orgId: string, jobId: string, payload: UpdateJobInput): Promise<JobDTO> {
    const updated = await this.jobsRepository.update(orgId, jobId, payload);

    if (updated.kind === 'job_not_found') {
      throw new HttpError(404, 'Job not found', { field: 'jobId' }, 'JOB_NOT_FOUND');
    }

    if (updated.kind === 'client_not_found') {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    await this.publishSafely(
      buildJobUpdatedEvent({
        orgId,
        jobId: updated.job.id,
        oldName: updated.previous.name,
        newName: updated.job.name,
        oldClientId: updated.previous.clientId,
        newClientId: updated.job.clientId,
        oldStatus: updated.previous.status,
        newStatus: updated.job.status,
      }),
    );

    return updated.job;
  }

  async updateStatus(
    orgId: string,
    jobId: string,
    payload: { status?: unknown; reason?: unknown; rating?: unknown },
  ): Promise<JobDTO> {
    const current = (await this.jobsRepository.list(orgId)).find((job) => job.id === jobId);

    if (!current) {
      throw new HttpError(404, 'Job not found', { field: 'jobId' }, 'JOB_NOT_FOUND');
    }

    if (typeof payload.status !== 'string' || !this.isJobStatus(payload.status)) {
      throw new HttpError(
        400,
        'Validation failed',
        { field: 'status', reason: 'invalid_enum' },
        'VALIDATION_ERROR',
      );
    }

    const nextStatus = payload.status;
    const allowedTransitions = STATUS_TRANSITIONS[current.status] ?? [];

    if (nextStatus !== current.status && !allowedTransitions.includes(nextStatus)) {
      throw new HttpError(
        409,
        'Invalid status transition',
        {
          field: 'status',
          reason: 'transition_not_allowed',
          status: current.status,
          allowedTransitions,
        },
        'INVALID_STATUS_TRANSITION',
      );
    }

    if (payload.reason !== undefined) {
      if (typeof payload.reason !== 'string') {
        throw new HttpError(400, 'Validation failed', { field: 'reason', reason: 'invalid_type' }, 'VALIDATION_ERROR');
      }

      const trimmed = payload.reason.trim();
      if (trimmed.length === 0) {
        throw new HttpError(400, 'Validation failed', { field: 'reason', reason: 'min_length' }, 'VALIDATION_ERROR');
      }

      if (trimmed.length > 500) {
        throw new HttpError(
          400,
          'Reason cannot exceed 500 characters',
          { field: 'reason', reason: 'max_length_exceeded' },
          'REASON_TOO_LONG',
        );
      }
    }

    if (nextStatus === 'COMPLETED') {
      if (payload.rating === undefined) {
        throw new HttpError(
          400,
          'Rating is required when status is COMPLETED',
          { field: 'rating', reason: 'required_for_completed' },
          'RATING_REQUIRED',
        );
      }

      if (!this.isValidRating(payload.rating)) {
        throw new HttpError(
          400,
          'Rating must be between 1 and 5',
          { field: 'rating', reason: 'out_of_range' },
          'RATING_OUT_OF_RANGE',
        );
      }
    } else if (payload.rating !== undefined) {
      throw new HttpError(
        400,
        'Validation failed',
        { field: 'rating', reason: 'not_allowed_for_status' },
        'VALIDATION_ERROR',
      );
    }

    const updated = await this.update(orgId, jobId, {
      status: nextStatus,
      reason: typeof payload.reason === 'string' ? payload.reason : undefined,
      rating: typeof payload.rating === 'number' ? payload.rating : undefined,
    });

    return updated;
  }

  async remove(orgId: string, jobId: string): Promise<void> {
    const removed = await this.jobsRepository.remove(orgId, jobId);

    if (removed.kind === 'job_not_found') {
      throw new HttpError(404, 'Job not found', { field: 'jobId' }, 'JOB_NOT_FOUND');
    }

    if (removed.kind === 'client_not_found') {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    await this.publishSafely(
      buildJobDeletedEvent({
        orgId,
        jobId: removed.deleted.id,
        name: removed.deleted.name,
        clientId: removed.deleted.clientId,
        status: removed.deleted.status,
      }),
    );
  }

  private filterBySearch(items: JobListRecord[], search?: string): JobListRecord[] {
    const normalized = (search ?? '').trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => {
      return (
        item.name.toLowerCase().includes(normalized) ||
        item.clientName.toLowerCase().includes(normalized) ||
        item.status.toLowerCase().includes(normalized)
      );
    });
  }

  private sortItems(items: JobListRecord[], sortBy: string, sortDir: 'asc' | 'desc'): JobListRecord[] {
    const direction = sortDir === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      const av = this.getSortValue(a, sortBy);
      const bv = this.getSortValue(b, sortBy);

      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
  }

  private getSortValue(item: JobListRecord, sortBy: string): number | string {
    switch (sortBy) {
      case 'name':
        return item.name.toLowerCase();
      case 'clientName':
        return item.clientName.toLowerCase();
      case 'status':
        return item.status;
      case 'updatedAt':
        return item.updatedAt ? new Date(item.updatedAt).getTime() : 0;
      case 'createdAt':
      default:
        return item.createdAt ? new Date(item.createdAt).getTime() : 0;
    }
  }

  private isJobStatus(value: string): value is JobStatus {
    return ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'].includes(value);
  }

  private isValidRating(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
  }

  private async publishSafely(event: JobDomainEvent): Promise<void> {
    try {
      await this.eventPublisher.publish(event);
    } catch (error) {
      console.error('[event-publish-failed]', error);
    }
  }
}
