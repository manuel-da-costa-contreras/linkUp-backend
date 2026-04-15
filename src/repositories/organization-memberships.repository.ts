import { firestore } from '../config/firebase';
import { OrgRole, OrganizationMembership } from '../models/organization-membership.model';

function normalizeRole(value: unknown): OrgRole {
  const role = String(value ?? '').toUpperCase();

  if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'MEMBER' || role === 'VIEWER') {
    return role;
  }

  return 'MEMBER';
}

export class OrganizationMembershipsRepository {
  private readonly collection = firestore.collection('organization_memberships');

  async findActiveByUserAndOrg(uid: string, orgId: string): Promise<OrganizationMembership | null> {
    const snapshot = await this.collection
      .where('uid', '==', uid)
      .where('orgId', '==', orgId)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    const data = doc.data() as FirebaseFirestore.DocumentData;

    return {
      id: doc.id,
      uid: String(data.uid ?? ''),
      orgId: String(data.orgId ?? ''),
      role: normalizeRole(data.role),
      active: data.active !== false,
    };
  }
}
