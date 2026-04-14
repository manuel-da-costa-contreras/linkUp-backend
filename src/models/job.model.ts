export type JobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';

export interface JobListItemDTO {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: JobStatus;
}

export interface JobListRecord extends JobListItemDTO {
  createdAt?: string;
  updatedAt?: string;
}

export interface JobDTO {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  status: JobStatus;
  updatedAt?: string;
  reason?: string;
  rating?: number;
}

export interface CreateJobInput {
  name: string;
  clientId: string;
  status?: JobStatus;
  reason?: string;
  rating?: number;
}

export interface UpdateJobInput {
  name?: string;
  clientId?: string;
  status?: JobStatus;
  reason?: string;
  rating?: number;
}
