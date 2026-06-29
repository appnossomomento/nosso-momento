/**
 * Firebase Admin SDK — inicialização singleton para uso em API Routes e Server Components.
 * Nunca importe este módulo em código client-side ou Edge Runtime.
 */
import * as admin from 'firebase-admin';

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0] as admin.app.App;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'Variáveis de ambiente Firebase Admin não configuradas: ' +
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket: `${projectId}.appspot.com`,
  });
}

export function getAdminApp(): admin.app.App {
  return initAdmin();
}

export function getAdminFirestore(): admin.firestore.Firestore {
  return initAdmin().firestore();
}

export function getAdminAuth(): admin.auth.Auth {
  return admin.auth(initAdmin());
}

// Aliases mantidos para compatibilidade — inicializam apenas quando acessados (lazy via getter)
let _adminApp: admin.app.App | null = null;
let _adminAuth: admin.auth.Auth | null = null;

export const adminApp = new Proxy({} as admin.app.App, {
  get(_target, prop) {
    if (!_adminApp) _adminApp = initAdmin();
    return (_adminApp as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_target, prop) {
    if (!_adminAuth) _adminAuth = admin.auth(initAdmin());
    return (_adminAuth as unknown as Record<string | symbol, unknown>)[prop];
  },
});
