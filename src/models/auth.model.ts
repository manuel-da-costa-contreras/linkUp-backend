import { OrgRole } from './organization-membership.model';

export interface AuthPayload {
  email: string;
  password: string;
}

export interface RegisterAuthPayload extends AuthPayload {
  orgId: string;
  name?: string;
}

export interface AuthUserContext {
  uid: string;
  email?: string;
  orgId?: string;
  role?: OrgRole;
  claims: Record<string, unknown>;
}
