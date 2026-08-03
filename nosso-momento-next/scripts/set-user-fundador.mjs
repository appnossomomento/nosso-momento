/**
 * Liga/desliga fundador no doc Firestore usuarios/{uid}.
 *
 * Uso:
 *   node scripts/set-user-fundador.mjs --email user@email.com --on
 *   node scripts/set-user-fundador.mjs --email user@email.com --off
 *   node scripts/set-user-fundador.mjs --uid ABC123 --on
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
  const out = { email: null, uid: null, on: null, numero: 1 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--uid') out.uid = argv[++i];
    else if (a === '--numero') out.numero = Number(argv[++i]);
    else if (a === '--on') out.on = true;
    else if (a === '--off') out.on = false;
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
  const { email, uid, on, numero } = parseArgs(process.argv.slice(2));
  if (on == null || (!email && !uid)) {
    console.error(
      'Uso: node scripts/set-user-fundador.mjs --email user@email.com --on|--off [--numero 1]',
    );
    process.exit(1);
  }

  initAdmin();
  const auth = admin.auth();
  const db = admin.firestore();
  const resolvedUid = uid || (await auth.getUserByEmail(email)).uid;
  const ref = db.collection('usuarios').doc(resolvedUid);
  const snap = await ref.get();
  if (!snap.exists) {
    console.error(`usuarios/${resolvedUid} não encontrado`);
    process.exit(1);
  }

  const fundadorNumero =
    Number.isFinite(numero) && numero > 0 ? Math.floor(numero) : 1;

  if (on) {
    await ref.update({
      fundador: true,
      fundadorNumero,
      fundadorSince: admin.firestore.FieldValue.serverTimestamp(),
      fundadorUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Mantém o contador de casais >= número atribuído (preview/admin)
    const counterRef = db.collection('config').doc('fundadores');
    await db.runTransaction(async (tx) => {
      const c = await tx.get(counterRef);
      const prev = Number(c.exists ? c.data()?.couplesGranted : 0);
      const next = Math.max(Number.isFinite(prev) ? prev : 0, fundadorNumero);
      tx.set(
        counterRef,
        {
          couplesGranted: next,
          maxCouples: 100,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    });
  } else {
    await ref.update({
      fundador: false,
      fundadorUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  console.log(
    `OK: fundador=${on}${on ? ` #${fundadorNumero}` : ''} para ${email || resolvedUid} (uid=${resolvedUid})`,
  );
  console.log(`Projeto: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log('Recarregue o app (/dashboard) para ver o badge.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
