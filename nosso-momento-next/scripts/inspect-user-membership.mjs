/**
 * Uso: node scripts/inspect-user-membership.mjs --email x@y.com
 *      node scripts/inspect-user-membership.mjs --numero 2
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
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
  const out = { email: null, uid: null, numero: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--email') out.email = argv[++i];
    else if (a === '--uid') out.uid = argv[++i];
    else if (a === '--numero') out.numero = Number(argv[++i]);
  }
  return out;
}

async function main() {
  loadEnvLocal();
  const { email, uid, numero } = parseArgs(process.argv.slice(2));
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
  const db = admin.firestore();

  if (numero) {
    const snap = await db
      .collection('usuarios')
      .where('numeroUsuario', '==', numero)
      .limit(5)
      .get();
    if (snap.empty) {
      console.log(`Nenhum usuário com numeroUsuario=${numero}`);
      return;
    }
    for (const doc of snap.docs) {
      const d = doc.data();
      console.log({
        uid: doc.id,
        email: d.email,
        nome: d.nome,
        numeroUsuario: d.numeroUsuario,
        fundador: d.fundador ?? false,
        fundadorNumero: d.fundadorNumero ?? null,
        pareadoUid: d.pareadoUid ?? null,
      });
    }
    return;
  }

  const resolvedUid = uid || (await admin.auth().getUserByEmail(email)).uid;
  const snap = await db.collection('usuarios').doc(resolvedUid).get();
  const d = snap.data() || {};
  console.log({
    uid: resolvedUid,
    email: d.email,
    nome: d.nome,
    numeroUsuario: d.numeroUsuario,
    fundador: d.fundador ?? false,
    fundadorNumero: d.fundadorNumero ?? null,
    pareadoUid: d.pareadoUid ?? null,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
