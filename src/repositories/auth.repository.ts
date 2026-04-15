import * as admin from 'firebase-admin';
import { firebaseAuth, firestore } from '../config/firebase';
import { OrgRole } from '../models/organization-membership.model';

export class AuthRepository {
  private readonly collection = firestore.collection('auth_sessions');
  private readonly memberships = firestore.collection('organization_memberships');

  async health(): Promise<string> {
    return `Repository ready: ${this.collection.id}`;
  }

  async createFirebaseUser(input: { email: string; password: string; name?: string }): Promise<admin.auth.UserRecord> {
    return firebaseAuth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
      emailVerified: false,
      disabled: false,
    });
  }

  async deleteFirebaseUser(uid: string): Promise<void> {
    await firebaseAuth.deleteUser(uid);
  }

  async upsertMembership(input: { uid: string; orgId: string; role: OrgRole }): Promise<void> {
    const now = admin.firestore.Timestamp.now();
    const docId = `${input.orgId}_${input.uid}`;

    await this.memberships.doc(docId).set(
      {
        uid: input.uid,
        orgId: input.orgId,
        role: input.role,
        active: true,
        createdAt: now,
        updatedAt: now,
      },
      { merge: true },
    );
  }
}
