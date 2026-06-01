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

export const adminApp = initAdmin();
export const adminAuth = admin.auth(adminApp);
