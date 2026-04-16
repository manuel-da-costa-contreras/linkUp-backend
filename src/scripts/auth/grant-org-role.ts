import * as admin from 'firebase-admin';
import { firebaseAuth, firestore } from '../../config/firebase';
import { OrgRole } from '../../models/organization-membership.model';

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const matched = process.argv.find((arg) => arg.startsWith(prefix));
  if (matched) {
    return matched.slice(prefix.length).trim();
  }

  const flag = `--${name}`;
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1].trim();
  }

  return undefined;
}

function normalizeRole(value: string | undefined): OrgRole {
  const role = String(value ?? 'MEMBER').toUpperCase();

  if (role === 'OWNER' || role === 'ADMIN' || role === 'MANAGER' || role === 'MEMBER' || role === 'VIEWER') {
    return role;
  }

  throw new Error(`Invalid role: ${value}. Allowed: OWNER|ADMIN|MANAGER|MEMBER|VIEWER`);
}

async function run(): Promise<void> {
  const uid = parseArg('uid');
  const orgId = parseArg('orgId');
  const role = normalizeRole(parseArg('role'));

  if (!uid || !orgId) {
    throw new Error('Usage: npm run auth:grant-org-role -- --uid=<firebase_uid> --orgId=<org_id> --role=<ADMIN>');
  }

  const id = `${orgId}_${uid}`;
  await firestore.collection('organization_memberships').doc(id).set(
    {
      uid,
      orgId,
      role,
      active: true,
      createdAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.Timestamp.now(),
    },
    { merge: true },
  );

  const user = await firebaseAuth.getUser(uid);
  const existingClaims = (user.customClaims ?? {}) as Record<string, unknown>;
  const existingOrgRoles =
    typeof existingClaims.orgRoles === 'object' && existingClaims.orgRoles !== null
      ? (existingClaims.orgRoles as Record<string, unknown>)
      : {};

  await firebaseAuth.setCustomUserClaims(uid, {
    ...existingClaims,
    orgId,
    organizationId: orgId,
    role,
    orgRoles: {
      ...existingOrgRoles,
      [orgId]: role,
    },
  });

  console.log(`Granted role ${role} to uid=${uid} in org=${orgId} and updated custom claims`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Grant failed:', error);
    process.exit(1);
  });
