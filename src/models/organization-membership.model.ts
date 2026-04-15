export type OrgRole = 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER' | 'VIEWER';

export interface OrganizationMembership {
  id: string;
  uid: string;
  orgId: string;
  role: OrgRole;
  active: boolean;
}
