import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { firebaseAuth } from '../config/firebase';
import { OrgRole } from '../models/organization-membership.model';
import { HttpError } from '../utils/httpError';
import { verifySseToken } from '../utils/sseToken';

function extractBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || typeof header !== 'string') {
    return null;
  }

  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
}

function getStringClaim(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

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

export async function authenticateRequest(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.authEnabled) {
      next();
      return;
    }

    const token = extractBearerToken(req);
    const isNotificationsStream = req.path.endsWith('/notifications/stream');

    if (!token && isNotificationsStream) {
      const streamToken = typeof req.query.token === 'string' ? req.query.token : undefined;
      if (!streamToken) {
        throw new HttpError(
          401,
          'Unauthorized',
          { field: 'authorization', reason: 'missing_bearer_token' },
          'UNAUTHORIZED',
        );
      }

      const payload = verifySseToken(streamToken);
      const orgIdParam = typeof req.params.orgId === 'string' ? req.params.orgId : undefined;
      if (orgIdParam && payload.orgId !== orgIdParam) {
        throw new HttpError(403, 'Forbidden', { field: 'orgId' }, 'FORBIDDEN');
      }

      req.auth = {
        uid: payload.uid,
        orgId: payload.orgId,
        role: payload.role,
        claims: {
          source: 'sse_token',
        },
      };

      next();
      return;
    }

    if (!token) {
      throw new HttpError(
        401,
        'Unauthorized',
        { field: 'authorization', reason: 'missing_bearer_token' },
        'UNAUTHORIZED',
      );
    }

    const decoded = await firebaseAuth.verifyIdToken(token, env.authCheckRevoked);
    const orgId = getStringClaim(decoded.orgId) ?? getStringClaim(decoded.organizationId);
    const role = normalizeRole(decoded.role);

    req.auth = {
      uid: decoded.uid,
      email: decoded.email,
      orgId,
      role,
      claims: decoded as unknown as Record<string, unknown>,
    };

    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }

    next(
      new HttpError(
        401,
        'Unauthorized',
        { field: 'authorization', reason: 'invalid_or_expired_token' },
        'UNAUTHORIZED',
      ),
    );
  }
}
