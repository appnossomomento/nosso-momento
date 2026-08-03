/**
 * Garante numeroUsuario para um email/uid (backfill manual).
 *
 * Uso:
 *   node scripts/assign-user-number.mjs --email user@email.com
 *   node scripts/assign-user-number.mjs --uid ABC123
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val.replace(/\\n/g, '\n');
  }
}

function parseArgs(argv) {
  const out = { email: null, uid: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--uid') out.uid = argv[++i];
  }
  return out;
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      'FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY obrigatórios (.env.local)',
    );
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

async function main() {
  loadEnvLocal();
  const { email, uid } = parseArgs(process.argv.slice(2));
  if (!email && !uid) {
    console.error('Uso: node scripts/assign-user-number.mjs --email user@email.com');
    process.exit(1);
  }

  initAdmin();
  const db = admin.firestore();
  const resolvedUid = uid || (await admin.auth().getUserByEmail(email)).uid;
  const userRef = db.collection('usuarios').doc(resolvedUid);
  const counterRef = db.collection('config').doc('usuarios');

  const numero = await db.runTransaction(async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists) throw new Error(`usuarios/${resolvedUid} não encontrado`);
    const existing = Number(userSnap.data()?.numeroUsuario);
    if (Number.isFinite(existing) && existing > 0) return existing;

    const counterSnap = await tx.get(counterRef);
    const prev = Number(counterSnap.exists ? counterSnap.data()?.last : 0);
    const next = (Number.isFinite(prev) ? prev : 0) + 1;
    tx.set(
      counterRef,
      { last: next, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
    tx.update(userRef, {
      numeroUsuario: next,
      numeroUsuarioAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return next;
  });

  console.log(`OK: numeroUsuario=#${numero} uid=${resolvedUid}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
