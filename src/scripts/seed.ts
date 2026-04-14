import * as admin from 'firebase-admin';
import { firestore } from '../config/firebase';

const now = new Date();
const ORG_ID = 'acme';

function daysAgo(days: number): admin.firestore.Timestamp {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - days);
  return admin.firestore.Timestamp.fromDate(date);
}

function monthsAgo(months: number): admin.firestore.Timestamp {
  const date = new Date(now);
  date.setUTCMonth(date.getUTCMonth() - months);
  return admin.firestore.Timestamp.fromDate(date);
}

async function seedCollection(
  collectionName: string,
  docs: Array<{ id: string; data: FirebaseFirestore.DocumentData }>,
): Promise<void> {
  const batch = firestore.batch();

  docs.forEach((item) => {
    const ref = firestore.collection(collectionName).doc(item.id);
    batch.set(ref, item.data, { merge: true });
  });

  await batch.commit();
  console.log(`Seeded ${collectionName}: ${docs.length} docs`);
}

async function runSeed(): Promise<void> {
  await seedCollection('users', [
    {
      id: 'seed-user-1',
      data: {
        orgId: ORG_ID,
        email: 'ana@linkup.app',
        name: 'Ana Rivera',
        role: 'admin',
        createdAt: daysAgo(2),
      },
    },
    {
      id: 'seed-user-2',
      data: {
        orgId: ORG_ID,
        email: 'leo@linkup.app',
        name: 'Leo Martin',
        role: 'user',
        createdAt: daysAgo(10),
      },
    },
    {
      id: 'seed-user-3',
      data: {
        orgId: ORG_ID,
        email: 'maria@linkup.app',
        name: 'Maria Perez',
        role: 'user',
        createdAt: monthsAgo(1),
      },
    },
  ]);

  await seedCollection('clients', [
    {
      id: 'seed-client-1',
      data: {
        orgId: ORG_ID,
        name: 'Acme Corp',
        createdAt: daysAgo(30),
        updatedAt: daysAgo(1),
        totalJobs: 3,
        pendingJobs: 1,
        inProgressJobs: 1,
        completedJobs: 1,
      },
    },
    {
      id: 'seed-client-2',
      data: {
        orgId: ORG_ID,
        name: 'Globex Inc',
        createdAt: daysAgo(20),
        updatedAt: daysAgo(2),
        totalJobs: 1,
        pendingJobs: 1,
        inProgressJobs: 0,
        completedJobs: 0,
      },
    },
  ]);

  await seedCollection('orders', [
    {
      id: 'seed-order-1',
      data: {
        orgId: ORG_ID,
        userId: 'seed-user-1',
        status: 'paid',
        total: 220,
        createdAt: daysAgo(1),
      },
    },
    {
      id: 'seed-order-2',
      data: {
        orgId: ORG_ID,
        userId: 'seed-user-2',
        status: 'PENDING',
        total: 95,
        createdAt: daysAgo(0),
      },
    },
    {
      id: 'seed-order-3',
      data: {
        orgId: ORG_ID,
        userId: 'seed-user-3',
        status: 'paid',
        total: 140,
        createdAt: daysAgo(6),
      },
    },
  ]);

  await seedCollection('alerts', [
    {
      id: 'seed-alert-1',
      data: {
        orgId: ORG_ID,
        status: 'PENDING',
        title: 'Pago rechazado',
        createdAt: daysAgo(0),
      },
    },
    {
      id: 'seed-alert-2',
      data: {
        orgId: ORG_ID,
        status: 'PENDING',
        title: 'Integracion caida',
        createdAt: daysAgo(0),
      },
    },
    {
      id: 'seed-alert-3',
      data: {
        orgId: ORG_ID,
        status: 'PENDING',
        title: 'Stock bajo',
        createdAt: daysAgo(1),
      },
    },
  ]);

  await seedCollection('tasks', [
    {
      id: 'seed-task-1',
      data: {
        orgId: ORG_ID,
        status: 'COMPLETED',
        title: 'Onboarding cliente A',
        createdAt: daysAgo(1),
      },
    },
    {
      id: 'seed-task-2',
      data: {
        orgId: ORG_ID,
        status: 'COMPLETED',
        title: 'Revision seguridad',
        createdAt: daysAgo(3),
      },
    },
    {
      id: 'seed-task-3',
      data: {
        orgId: ORG_ID,
        status: 'COMPLETED',
        title: 'Migracion parcial',
        createdAt: daysAgo(8),
      },
    },
  ]);

  await seedCollection('jobs', [
    {
      id: 'seed-job-1',
      data: {
        orgId: ORG_ID,
        clientId: 'seed-client-1',
        status: 'PENDING',
        createdAt: daysAgo(0),
      },
    },
    {
      id: 'seed-job-2',
      data: {
        orgId: ORG_ID,
        clientId: 'seed-client-1',
        status: 'IN_PROGRESS',
        createdAt: daysAgo(1),
      },
    },
    {
      id: 'seed-job-3',
      data: {
        orgId: ORG_ID,
        clientId: 'seed-client-1',
        status: 'COMPLETED',
        createdAt: daysAgo(2),
      },
    },
    {
      id: 'seed-job-4',
      data: {
        orgId: ORG_ID,
        clientId: 'seed-client-2',
        status: 'PENDING',
        createdAt: daysAgo(5),
      },
    },
  ]);

  await seedCollection('feedback', [
    {
      id: 'seed-feedback-1',
      data: {
        orgId: ORG_ID,
        sentiment: 'positive',
        rating: 5,
        createdAt: daysAgo(2),
      },
    },
    {
      id: 'seed-feedback-2',
      data: {
        orgId: ORG_ID,
        sentiment: 'neutral',
        rating: 3,
        createdAt: daysAgo(4),
      },
    },
    {
      id: 'seed-feedback-3',
      data: {
        orgId: ORG_ID,
        sentiment: 'negative',
        rating: 2,
        createdAt: daysAgo(7),
      },
    },
    {
      id: 'seed-feedback-4',
      data: {
        orgId: ORG_ID,
        sentiment: 'positive',
        rating: 4,
        createdAt: monthsAgo(4),
      },
    },
    {
      id: 'seed-feedback-5',
      data: {
        orgId: ORG_ID,
        sentiment: 'negative',
        rating: 1,
        createdAt: monthsAgo(5),
      },
    },
  ]);

  console.log('Seed completed successfully.');
}

runSeed()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });

