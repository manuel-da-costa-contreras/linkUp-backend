import * as admin from 'firebase-admin';
import { firestore } from '../../config/firebase';

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

type ClientCounters = {
  totalJobs: number;
  pendingJobs: number;
  inProgressJobs: number;
  completedJobs: number;
};

function normalizeStatus(raw: unknown): 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' {
  const value = String(raw ?? '').toUpperCase();
  if (value === 'PENDING' || value === 'IN_PROGRESS' || value === 'COMPLETED' || value === 'REJECTED') {
    return value;
  }
  if (value.includes('PROGRESS')) return 'IN_PROGRESS';
  if (value === 'DONE' || value === 'PAID') return 'COMPLETED';
  return 'PENDING';
}

async function run(): Promise<void> {
  const orgId = parseArg('orgId') ?? 'acme';
  const clientsCollection = firestore.collection('clients');
  const jobsCollection = firestore.collection('jobs');

  const [clientsOrg, clientsOrgAlias, jobsOrg, jobsOrgAlias] = await Promise.all([
    clientsCollection.where('orgId', '==', orgId).get(),
    clientsCollection.where('organizationId', '==', orgId).get(),
    jobsCollection.where('orgId', '==', orgId).get(),
    jobsCollection.where('organizationId', '==', orgId).get(),
  ]);

  const clientDocs = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  clientsOrg.docs.forEach((doc) => clientDocs.set(doc.id, doc));
  clientsOrgAlias.docs.forEach((doc) => clientDocs.set(doc.id, doc));

  const jobs = new Map<string, FirebaseFirestore.DocumentData>();
  jobsOrg.docs.forEach((doc) => jobs.set(doc.id, doc.data()));
  jobsOrgAlias.docs.forEach((doc) => jobs.set(doc.id, doc.data()));

  const countersByClient = new Map<string, ClientCounters>();
  clientDocs.forEach((_doc, clientId) => {
    countersByClient.set(clientId, {
      totalJobs: 0,
      pendingJobs: 0,
      inProgressJobs: 0,
      completedJobs: 0,
    });
  });

  jobs.forEach((job) => {
    const clientId = String(job.clientId ?? '');
    if (!clientId || !countersByClient.has(clientId)) {
      return;
    }

    const counters = countersByClient.get(clientId)!;
    counters.totalJobs += 1;

    const status = normalizeStatus(job.status);
    if (status === 'PENDING') counters.pendingJobs += 1;
    if (status === 'IN_PROGRESS') counters.inProgressJobs += 1;
    if (status === 'COMPLETED') counters.completedJobs += 1;
  });

  let updated = 0;
  const now = admin.firestore.Timestamp.now();
  const refs = [...clientDocs.keys()];

  for (let i = 0; i < refs.length; i += 400) {
    const batch = firestore.batch();
    refs.slice(i, i + 400).forEach((clientId) => {
      const counters = countersByClient.get(clientId)!;
      batch.update(clientsCollection.doc(clientId), {
        ...counters,
        updatedAt: now,
      });
      updated += 1;
    });
    await batch.commit();
  }

  console.log(`[db.recalc-client-counters] orgId=${orgId} clientsUpdated=${updated}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('[db.recalc-client-counters] failed:', error);
    process.exit(1);
  });
