import { AuthPayload, RegisterAuthPayload } from '../models/auth.model';
import { OrgRole } from '../models/organization-membership.model';
import { AuthRepository } from '../repositories/auth.repository';
import { OrganizationMembershipsRepository } from '../repositories/organization-memberships.repository';
import { HttpError } from '../utils/httpError';
import { createSseToken } from '../utils/sseToken';

export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository = new AuthRepository(),
    private readonly membershipsRepository: OrganizationMembershipsRepository = new OrganizationMembershipsRepository(),
  ) {}

  async login(payload: AuthPayload): Promise<{ token: string; email: string }> {
    await this.authRepository.health();
    return {
      token: 'stub-token',
      email: payload.email,
    };
  }

  async register(payload: RegisterAuthPayload): Promise<{
    message: string;
    email: string;
    uid: string;
    orgId: string;
    role: OrgRole;
  }> {
    let createdUid: string | null = null;

    try {
      const user = await this.authRepository.createFirebaseUser({
        email: payload.email,
        password: payload.password,
        name: payload.name,
      });

      createdUid = user.uid;

      await this.authRepository.upsertMembership({
        uid: user.uid,
        orgId: payload.orgId,
        role: 'VIEWER',
      });

      return {
        message: 'User registered',
        email: user.email ?? payload.email,
        uid: user.uid,
        orgId: payload.orgId,
        role: 'VIEWER',
      };
    } catch (error) {
      if (createdUid) {
        try {
          await this.authRepository.deleteFirebaseUser(createdUid);
        } catch {
          // Best-effort rollback if membership creation fails.
        }
      }

      if (this.hasErrorCode(error, 'auth/email-already-exists')) {
        throw new HttpError(
          409,
          'Email already exists',
          { field: 'email', reason: 'already_exists' },
          'EMAIL_ALREADY_EXISTS',
        );
      }

      if (this.hasErrorCode(error, 'auth/invalid-password')) {
        throw new HttpError(
          400,
          'Validation failed',
          { field: 'password', reason: 'invalid_password' },
          'VALIDATION_ERROR',
        );
      }

      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(500, 'Unexpected server error', undefined, 'INTERNAL_ERROR');
    }
  }

  async issueSseToken(input: { uid: string; orgId: string; claimOrgId?: string; claimRole?: OrgRole }): Promise<{
    token: string;
    expiresAt: string;
    ttlSeconds: number;
  }> {
    const claimRole = this.normalizeRole(input.claimRole);

    if (input.claimOrgId === input.orgId && claimRole) {
      return createSseToken({
        uid: input.uid,
        orgId: input.orgId,
        role: claimRole,
      });
    }

    const membership = await this.membershipsRepository.findActiveByUserAndOrg(input.uid, input.orgId);
    if (!membership) {
      throw new HttpError(403, 'Forbidden', { field: 'orgId' }, 'FORBIDDEN');
    }

    return createSseToken({
      uid: input.uid,
      orgId: membership.orgId,
      role: membership.role,
    });
  }

  private normalizeRole(value: unknown): OrgRole | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const role = value.toUpperCase();
    if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'MEMBER' || role === 'VIEWER') {
      return role;
    }

    return undefined;
  }

  private hasErrorCode(error: unknown, code: string): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string' &&
      (error as { code: string }).code === code
    );
  }
}
