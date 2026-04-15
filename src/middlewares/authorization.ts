import { NextFunction, Request, Response } from 'express';
import { OrgRole } from '../models/organization-membership.model';
import { OrganizationMembershipsRepository } from '../repositories/organization-memberships.repository';
import { HttpError } from '../utils/httpError';

const membershipsRepository = new OrganizationMembershipsRepository();

function normalizeRole(value: unknown): OrgRole | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const role = value.toUpperCase();
  if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'MEMBER' || role === 'VIEWER') {
    return role;
  }

  return undefined;
}

export async function requireOrgAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.auth;
    if (!auth?.uid) {
      throw new HttpError(401, 'Unauthorized', { field: 'authorization' }, 'UNAUTHORIZED');
    }

    const orgId = req.params.orgId;
    if (!orgId) {
      throw new HttpError(400, 'Validation failed', { field: 'orgId', reason: 'required' }, 'VALIDATION_ERROR');
    }

    const claimOrgId = typeof auth.orgId === 'string' ? auth.orgId : undefined;
    const claimRole = normalizeRole(auth.role);

    if (claimOrgId === orgId && claimRole) {
      req.auth = {
        ...auth,
        orgId,
        role: claimRole,
      };
      next();
      return;
    }

    const membership = await membershipsRepository.findActiveByUserAndOrg(auth.uid, orgId);
    if (!membership) {
      throw new HttpError(403, 'Forbidden', { field: 'orgId' }, 'FORBIDDEN');
    }

    req.auth = {
      ...auth,
      orgId: membership.orgId,
      role: membership.role,
    };

    next();
  } catch (error) {
    next(error);
  }
}

export function requireRole(allowedRoles: OrgRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.auth?.role;
    if (!role) {
      next(new HttpError(403, 'Forbidden', { field: 'role' }, 'FORBIDDEN'));
      return;
    }

    if (!allowedRoles.includes(role)) {
      next(
        new HttpError(
          403,
          'Forbidden',
          { field: 'role', reason: 'insufficient_role', allowedRoles },
          'FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}
