export interface ClientOptionDTO {
  id: string;
  name: string;
}

export interface ClientDTO {
  id: string;
  name: string;
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
}

export interface ClientEntity {
  id: string;
  name: string;
  orgId: string;
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
}

export interface CreateClientInput {
  name: string;
}

export interface UpdateClientInput {
  name: string;
}
