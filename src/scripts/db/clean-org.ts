import { firestore } from '../../config/firebase';

type CollectionTarget = {
  name: string;
  includeOrganizationIdAlias?: boolean;
};

const TARGET_COLLECTIONS: CollectionTarget[] = [
  { name: 'users', includeOrganizationIdAlias: true },
  { name: 'clients', includeOrganizationIdAlias: true },
  { name: 'jobs', includeOrganizationIdAlias: true },
  { name: 'orders', includeOrganizationIdAlias: true },
  { name: 'alerts', includeOrganizationIdAlias: true },
  { name: 'tasks', includeOrganizationIdAlias: true },
  { name: 'feedback', includeOrganizationIdAlias: true },
  { name: 'notifications', includeOrganizationIdAlias: true },
  { name: 'organization_memberships', includeOrganizationIdAlias: false },
  { name: 'auth_sessions', includeOrganizationIdAlias: true },
  { name: 'event_outbox', includeOrganizationIdAlias: true },
  { name: 'processed_events', includeOrganizationIdAlias: false },
];

function parseArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const withEquals = process.argv.find((arg) => arg.startsWith(prefix));
  if (withEquals) {
    return withEquals.slice(prefix.length).trim();
  }

  const flag = `--${name}`;
  const index = process.argv.findIndex((arg) => arg === flag);
  if (index >= 0 && process.argv[index + 1]) {
    return process.argv[index + 1].trim();
  }

  return undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function getDocRefsByOrg(collectionName: string, orgId: string, includeOrganizationIdAlias: boolean): Promise<FirebaseFirestore.DocumentReference[]> {
  const collection = firestore.collection(collectionName);

  const [orgIdSnapshot, organizationIdSnapshot] = await Promise.all([
    collection.where('orgId', '==', orgId).get(),
    includeOrganizationIdAlias ? collection.where('organizationId', '==', orgId).get() : Promise.resolve(null),
  ]);

  const byPath = new Map<string, FirebaseFirestore.DocumentReference>();
  orgIdSnapshot.docs.forEach((doc) => byPath.set(doc.ref.path, doc.ref));
  organizationIdSnapshot?.docs.forEach((doc) => byPath.set(doc.ref.path, doc.ref));

  if (collectionName === 'processed_events') {
    const byOrgSnapshot = await collection.where('orgId', '==', orgId).get();
    byOrgSnapshot.docs.forEach((doc) => byPath.set(doc.ref.path, doc.ref));
  }

  return [...byPath.values()];
}

async function deleteRefs(refs: FirebaseFirestore.DocumentReference[]): Promise<number> {
  if (refs.length === 0) {
    return 0;
  }

  let deleted = 0;
  const chunkSize = 400;

  for (let i = 0; i < refs.length; i += chunkSize) {
    const chunk = refs.slice(i, i + chunkSize);
    const batch = firestore.batch();
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
    deleted += chunk.length;
  }

  return deleted;
}

async function run(): Promise<void> {
  const orgId = parseArg('orgId') ?? 'acme';
  const apply = hasFlag('apply');

  if (!apply) {
    console.log('[db.clean-org] DRY RUN (no deletes). Use --apply to execute.');
  }

  console.log(`[db.clean-org] target orgId=${orgId}`);
  const summary: Array<{ collection: string; count: number }> = [];

  for (const target of TARGET_COLLECTIONS) {
    const refs = await getDocRefsByOrg(target.name, orgId, Boolean(target.includeOrganizationIdAlias));
    summary.push({ collection: target.name, count: refs.length });
  }

  const total = summary.reduce((acc, item) => acc + item.count, 0);
  console.table(summary);
  console.log(`[db.clean-org] total docs matched=${total}`);

  if (!apply) {
    return;
  }

  let deletedTotal = 0;
  for (const target of TARGET_COLLECTIONS) {
    const refs = await getDocRefsByOrg(target.name, orgId, Boolean(target.includeOrganizationIdAlias));
    const deleted = await deleteRefs(refs);
    deletedTotal += deleted;
    console.log(`[db.clean-org] deleted ${deleted} docs from ${target.name}`);
  }

  console.log(`[db.clean-org] DONE. total deleted=${deletedTotal}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[db.clean-org] failed:', error);
    process.exit(1);
  });
