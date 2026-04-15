import { createHmac, timingSafeEqual } from 'crypto';
import { env } from '../config/env';
import { OrgRole } from '../models/organization-membership.model';
import { HttpError } from './httpError';

interface SseTokenPayload {
  uid: string;
  orgId: string;
  role?: OrgRole;
  iat: number;
  exp: number;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payloadPart: string): string {
  return createHmac('sha256', env.sseTokenSecret).update(payloadPart).digest('base64url');
}

export function createSseToken(input: { uid: string; orgId: string; role?: OrgRole }): {
  token: string;
  expiresAt: string;
  ttlSeconds: number;
} {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + env.sseTokenTtlSeconds;

  const payload: SseTokenPayload = {
    uid: input.uid,
    orgId: input.orgId,
    role: input.role,
    iat: now,
    exp,
  };

  const payloadPart = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(payloadPart);
  const token = `${payloadPart}.${signature}`;

  return {
    token,
    expiresAt: new Date(exp * 1000).toISOString(),
    ttlSeconds: env.sseTokenTtlSeconds,
  };
}

export function verifySseToken(token: string): SseTokenPayload {
  const parts = token.split('.');
  if (parts.length !== 2) {
    throw new HttpError(401, 'Unauthorized', { field: 'token', reason: 'invalid_format' }, 'UNAUTHORIZED');
  }

  const [payloadPart, signature] = parts;
  const expected = sign(payloadPart);
  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expected, 'utf8');
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new HttpError(401, 'Unauthorized', { field: 'token', reason: 'invalid_signature' }, 'UNAUTHORIZED');
  }

  let payload: SseTokenPayload;
  try {
    payload = JSON.parse(base64UrlDecode(payloadPart)) as SseTokenPayload;
  } catch {
    throw new HttpError(401, 'Unauthorized', { field: 'token', reason: 'invalid_payload' }, 'UNAUTHORIZED');
  }

  if (!payload.uid || !payload.orgId || !payload.exp || !payload.iat) {
    throw new HttpError(401, 'Unauthorized', { field: 'token', reason: 'missing_claims' }, 'UNAUTHORIZED');
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) {
    throw new HttpError(401, 'Unauthorized', { field: 'token', reason: 'expired' }, 'UNAUTHORIZED');
  }

  return payload;
}
