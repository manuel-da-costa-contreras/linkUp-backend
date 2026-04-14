export type NotificationType = 'JOB_PENDING' | 'JOB_REJECTED';
export type NotificationJobStatus = 'PENDING' | 'REJECTED';
export type NotificationFilterStatus = 'active' | 'dismissed' | 'all';

export interface NotificationDTO {
  id: string;
  jobId: string;
  jobName: string;
  clientName: string;
  type: NotificationType;
  status: NotificationJobStatus;
}

export interface NotificationsQuery {
  page: number;
  pageSize: number;
  status: NotificationFilterStatus;
  types?: string;
}

export interface NotificationEntity {
  id: string;
  orgId: string;
  jobId: string;
  jobName: string;
  clientName: string;
  type: NotificationType;
  status: NotificationJobStatus;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
  dismissedAt?: string;
}
