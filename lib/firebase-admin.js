// Firebase Admin SDK configuration for server-side
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
let app;
if (getApps().length === 0) {
  // In production, use a service account key
  // For development, we'll use the emulator or project ID
  app = initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  });
} else {
  app = getApps()[0];
}

// Initialize Firestore
export const adminDb = getFirestore(app);

export default app;