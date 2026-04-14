import { User, UserCreateInput, UserUpdateInput } from '../models/user.model';
import { UsersRepository } from '../repositories/users.repository';
import { HttpError } from '../utils/httpError';

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository = new UsersRepository()) {}

  async list(): Promise<User[]> {
    return this.usersRepository.list();
  }

  async getById(id: string): Promise<User> {
    const user = await this.usersRepository.getById(id);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    return user;
  }

  async create(payload: UserCreateInput): Promise<User> {
    this.validateCreate(payload);
    return this.usersRepository.create(payload);
  }

  async update(id: string, payload: UserUpdateInput): Promise<User> {
    this.validateUpdate(payload);

    const user = await this.usersRepository.update(id, payload);

    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    return user;
  }

  async remove(id: string): Promise<void> {
    const removed = await this.usersRepository.remove(id);

    if (!removed) {
      throw new HttpError(404, 'User not found');
    }
  }

  private validateCreate(payload: UserCreateInput): void {
    if (!payload.email || !payload.email.includes('@')) {
      throw new HttpError(400, 'Valid email is required');
    }

    if (!payload.name || payload.name.trim().length < 2) {
      throw new HttpError(400, 'Valid name is required');
    }

    if (payload.role && payload.role !== 'admin' && payload.role !== 'user') {
      throw new HttpError(400, 'Role must be admin or user');
    }
  }

  private validateUpdate(payload: UserUpdateInput): void {
    if (Object.keys(payload).length === 0) {
      throw new HttpError(400, 'At least one field is required to update');
    }

    if (payload.email !== undefined && !payload.email.includes('@')) {
      throw new HttpError(400, 'Valid email is required');
    }

    if (payload.name !== undefined && payload.name.trim().length < 2) {
      throw new HttpError(400, 'Valid name is required');
    }

    if (payload.role !== undefined && payload.role !== 'admin' && payload.role !== 'user') {
      throw new HttpError(400, 'Role must be admin or user');
    }
  }
}
