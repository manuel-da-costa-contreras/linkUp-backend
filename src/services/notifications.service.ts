import { NotificationDTO, NotificationEntity, NotificationsQuery, NotificationType } from '../models/notification.model';
import { PaginatedResult } from '../models/pagination.model';
import { NotificationsRepository } from '../repositories/notifications.repository';
import { notificationsStreamService } from './notifications-stream.service';
import { HttpError } from '../utils/httpError';
import { paginateArray } from '../utils/pagination';

const TYPE_MAP: Record<string, NotificationType> = {
  JOB_PENDING: 'JOB_PENDING',
  JOB_REJECTED: 'JOB_REJECTED',
  PENDING: 'JOB_PENDING',
  REJECTED: 'JOB_REJECTED',
};

export class NotificationsService {
  constructor(private readonly notificationsRepository: NotificationsRepository = new NotificationsRepository()) {}

  async list(orgId: string, query: NotificationsQuery): Promise<PaginatedResult<NotificationDTO>> {
    const items = await this.notificationsRepository.listByOrg(orgId);

    const allowedTypes = this.parseTypes(query.types);
    const filtered = items.filter((item) => this.matchesStatus(item, query.status) && this.matchesType(item, allowedTypes));

    const sorted = [...filtered].sort((a, b) => {
      const av = a.updatedAt ?? a.createdAt ?? '';
      const bv = b.updatedAt ?? b.createdAt ?? '';
      return av < bv ? 1 : av > bv ? -1 : 0;
    });

    const data = sorted.map((item) => this.toDTO(item));
    return paginateArray(data, query.page, query.pageSize);
  }

  async dismiss(orgId: string, notificationId: string): Promise<void> {
    const dismissed = await this.notificationsRepository.dismiss(orgId, notificationId);

    if (!dismissed) {
      throw new HttpError(
        404,
        'Notification not found',
        { field: 'notificationId' },
        'NOTIFICATION_NOT_FOUND',
      );
    }
  }

  async dismissAll(orgId: string): Promise<void> {
    const dismissedCount = await this.notificationsRepository.dismissAll(orgId);

    notificationsStreamService.emitDismissedAll(orgId, {
      dismissedCount,
      dismissedAt: new Date().toISOString(),
      scope: {
        status: 'active',
        types: ['JOB_PENDING', 'JOB_REJECTED'],
      },
    });
  }

  private parseTypes(types?: string): NotificationType[] | null {
    if (!types || types.trim().length === 0) {
      return null;
    }

    const rawTypes = types
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter(Boolean);

    const mapped: NotificationType[] = [];
    for (const rawType of rawTypes) {
      const mappedType = TYPE_MAP[rawType];
      if (!mappedType) {
        throw new HttpError(
          400,
          'Validation failed',
          { field: 'types', reason: 'invalid_enum' },
          'VALIDATION_ERROR',
        );
      }
      mapped.push(mappedType);
    }

    return mapped;
  }

  private matchesStatus(item: NotificationEntity, status: NotificationsQuery['status']): boolean {
    if (status === 'all') {
      return true;
    }

    if (status === 'dismissed') {
      return !item.active;
    }

    return item.active;
  }

  private matchesType(item: NotificationEntity, types: NotificationType[] | null): boolean {
    if (!types || types.length === 0) {
      return true;
    }

    return types.includes(item.type);
  }

  private toDTO(item: NotificationEntity): NotificationDTO {
    return {
      id: item.id,
      jobId: item.jobId,
      jobName: item.jobName,
      clientName: item.clientName,
      type: item.type,
      status: item.status,
    };
  }
}
