export interface AuthPayload {
  email: string;
  password: string;
}

export interface AuthUserContext {
  uid: string;
  email?: string;
  orgId?: string;
  role?: string;
  claims: Record<string, unknown>;
}
