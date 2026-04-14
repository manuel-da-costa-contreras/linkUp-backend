import { AuthPayload } from '../models/auth.model';
import { AuthRepository } from '../repositories/auth.repository';

export class AuthService {
  constructor(private readonly authRepository: AuthRepository = new AuthRepository()) {}

  async login(payload: AuthPayload): Promise<{ token: string; email: string }> {
    await this.authRepository.health();
    return {
      token: 'stub-token',
      email: payload.email,
    };
  }

  async register(payload: AuthPayload): Promise<{ message: string; email: string }> {
    await this.authRepository.health();
    return {
      message: 'User registered (stub)',
      email: payload.email,
    };
  }
}
