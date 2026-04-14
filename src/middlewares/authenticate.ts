import { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { firebaseAuth } from '../config/firebase';
import { HttpError } from '../utils/httpError';

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

export async function authenticateRequest(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!env.authEnabled) {
      next();
      return;
    }

    const token = extractBearerToken(req);
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
    const role = getStringClaim(decoded.role);

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
