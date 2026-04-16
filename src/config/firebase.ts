import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

function readServiceAccountFromEnv(): admin.ServiceAccount | null {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) {
    return JSON.parse(json) as admin.ServiceAccount;
  }

  const base64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (base64 && base64.trim().length > 0) {
    const decoded = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(decoded) as admin.ServiceAccount;
  }

  return null;
}

function readServiceAccountFromFile(): admin.ServiceAccount | null {
  const candidates = [
    path.join(process.cwd(), 'serviceAccountKey.json'),
    path.join(process.cwd(), 'src', 'serviceAccountKey.json'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(raw) as admin.ServiceAccount;
    }
  }

  return null;
}

if (!admin.apps.length) {
  const fromEnv = readServiceAccountFromEnv();
  if (fromEnv) {
    admin.initializeApp({
      credential: admin.credential.cert(fromEnv),
    });
  } else {
    const fromFile = readServiceAccountFromFile();

    if (fromFile) {
      admin.initializeApp({
        credential: admin.credential.cert(fromFile),
      });
    } else {
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
    }
  }
}

export const firestore = admin.firestore();
export const firebaseAuth = admin.auth();
