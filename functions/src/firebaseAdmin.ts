import { getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const app = getApps().length ? getApp() : initializeApp();

const databaseId = process.env.FIRESTORE_DATABASE_ID;

export const adminAuth = getAuth(app);
export const adminDb =
  databaseId && databaseId !== '(default)'
    ? getFirestore(app, databaseId)
    : getFirestore(app);

export const ENFORCE_APP_CHECK = process.env.ENFORCE_APP_CHECK === 'true';
