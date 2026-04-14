import { ClientDTO, ClientEntity, ClientOptionDTO, CreateClientInput, UpdateClientInput } from '../models/client.model';
import { PaginatedResult, PaginationQuery } from '../models/pagination.model';
import { ClientsRepository } from '../repositories/clients.repository';
import { HttpError } from '../utils/httpError';
import { paginateArray } from '../utils/pagination';

export class ClientsService {
  constructor(private readonly clientsRepository: ClientsRepository = new ClientsRepository()) {}

  async list(orgId: string, query: PaginationQuery): Promise<PaginatedResult<ClientDTO>> {
    const entities = await this.clientsRepository.listEntities(orgId);
    const filtered = this.filterBySearch(entities, query.search);
    const sorted = this.sortEntities(filtered, query.sortBy ?? 'createdAt', query.sortDir);

    const data = sorted.map((client) => ({
      id: client.id,
      name: client.name,
      totalJobs: client.totalJobs,
      pendingJobs: client.pendingJobs,
      inProgressJobs: client.inProgressJobs,
      completedJobs: client.completedJobs,
    }));

    return paginateArray(data, query.page, query.pageSize);
  }

  async listOptions(orgId: string, search?: string): Promise<ClientOptionDTO[]> {
    return this.clientsRepository.listOptions(orgId, search);
  }

  async create(orgId: string, payload: CreateClientInput): Promise<ClientDTO> {
    const exists = await this.clientsRepository.existsByName(orgId, payload.name);

    if (exists) {
      throw new HttpError(
        409,
        'Client name already exists in this organization',
        { field: 'name' },
        'CLIENT_NAME_EXISTS',
      );
    }

    return this.clientsRepository.create(orgId, payload.name.trim());
  }

  async update(orgId: string, clientId: string, payload: UpdateClientInput): Promise<ClientDTO> {
    const clientExists = await this.clientsRepository.existsById(orgId, clientId);
    if (!clientExists) {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    const duplicatedName = await this.clientsRepository.existsByName(orgId, payload.name, clientId);
    if (duplicatedName) {
      throw new HttpError(
        409,
        'Client name already exists in this organization',
        { field: 'name' },
        'CLIENT_NAME_EXISTS',
      );
    }

    const updated = await this.clientsRepository.update(orgId, clientId, payload.name.trim());
    if (!updated) {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    return updated;
  }

  async remove(orgId: string, clientId: string): Promise<void> {
    const clientExists = await this.clientsRepository.existsById(orgId, clientId);
    if (!clientExists) {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }

    const hasActiveJobs = await this.clientsRepository.hasActiveJobs(orgId, clientId);
    if (hasActiveJobs) {
      throw new HttpError(
        409,
        'Client has active jobs and cannot be deleted',
        { field: 'clientId' },
        'CLIENT_DELETE_BLOCKED',
      );
    }

    const removed = await this.clientsRepository.remove(orgId, clientId);
    if (!removed) {
      throw new HttpError(404, 'Client not found', { field: 'clientId' }, 'CLIENT_NOT_FOUND');
    }
  }

  private filterBySearch(items: ClientEntity[], search?: string): ClientEntity[] {
    const normalized = (search ?? '').trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((item) => item.name.toLowerCase().includes(normalized));
  }

  private sortEntities(items: ClientEntity[], sortBy: string, sortDir: 'asc' | 'desc'): ClientEntity[] {
    const direction = sortDir === 'asc' ? 1 : -1;

    return [...items].sort((a, b) => {
      const av = this.getSortValue(a, sortBy);
      const bv = this.getSortValue(b, sortBy);

      if (av < bv) return -1 * direction;
      if (av > bv) return 1 * direction;
      return 0;
    });
  }

  private getSortValue(item: ClientEntity, sortBy: string): number | string {
    switch (sortBy) {
      case 'name':
        return item.name.toLowerCase();
      case 'totalJobs':
        return item.totalJobs;
      case 'pendingJobs':
        return item.pendingJobs;
      case 'inProgressJobs':
        return item.inProgressJobs;
      case 'completedJobs':
        return item.completedJobs;
      case 'createdAt':
      default:
        return item.createdAt.toMillis();
    }
  }
}
