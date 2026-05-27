import { initializeApp, getApps } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const hasValidClientConfig = Object.values(firebaseConfig).every(
  (v) => typeof v === 'string' && v.trim() !== '' && v !== 'undefined',
);
const canInitializeFirebase = typeof window !== 'undefined' && hasValidClientConfig;

let app: FirebaseApp | null = null;
if (canInitializeFirebase) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

export const auth = (app ? getAuth(app) : null) as Auth;
export const db = (app ? getFirestore(app) : null) as Firestore;
export const storage = (app ? getStorage(app) : null) as FirebaseStorage;

// Habilita persistência offline (silencia erros esperados)
if (app && typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('[Firestore] Offline persistence error:', err.code);
    }
  });
}

if (typeof window !== 'undefined' && !hasValidClientConfig) {
  console.error('[Firebase] Configuração NEXT_PUBLIC_FIREBASE_* ausente/inválida no ambiente.');
}

export default app;
