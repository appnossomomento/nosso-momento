/**
 * Reset parcial do Firestore + Firebase Auth.
 * Preserva contas listadas em KEEP_EMAILS; apaga demais usuários e todo histórico de interações.
 *
 * Uso:
 *   node scripts/reset-user-data.mjs --dry-run
 *   node scripts/reset-user-data.mjs --confirm
 *   node scripts/reset-user-data.mjs --storage --confirm   # só Firebase Storage
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KEEP_EMAILS = ['adm@nossomomento.app', 't1@gmail.com'].map((e) => e.toLowerCase());

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
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val.replace(/\\n/g, '\n');
  }
  // Garante bucket para Storage (não está no bloco Admin do .env.local)
  if (!process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) {
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET = 'nosso-momento-app.firebasestorage.app';
  }
}

function initAdmin() {
  if (admin.apps.length) return admin.app();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const storageBucket =
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`;
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY obrigatórios (.env.local)');
  }
  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    storageBucket,
  });
}

async function deleteQueryBatch(query, label, dryRun) {
  let total = 0;
  let lastDoc = null;
  while (true) {
    let q = query.limit(200);
    if (dryRun && lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;
    total += snap.size;
    if (!dryRun) {
      const batch = admin.firestore().batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } else {
      lastDoc = snap.docs[snap.docs.length - 1];
    }
    if (snap.size < 200) break;
  }
  console.log(`  ${label}: ${total}${dryRun ? ' (dry-run)' : ''}`);
  return total;
}

async function deleteCollection(db, name, dryRun) {
  return deleteQueryBatch(db.collection(name), name, dryRun);
}

async function deletePareamentosWithSubcollections(db, dryRun) {
  let total = 0;
  while (true) {
    const snap = await db.collection('pareamentos').limit(20).get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      for (const sub of ['climaDiario', 'extrato']) {
        await deleteQueryBatch(doc.ref.collection(sub), `${doc.id}/${sub}`, dryRun);
      }
      if (!dryRun) await doc.ref.delete();
      total += 1;
    }
    if (snap.size < 20) break;
  }
  console.log(`  pareamentos (docs): ${total}${dryRun ? ' (dry-run)' : ''}`);
  return total;
}

async function resolveKeepUids(auth) {
  const keep = new Map();
  for (const email of KEEP_EMAILS) {
    try {
      const user = await auth.getUserByEmail(email);
      keep.set(user.uid, email);
      console.log(`  Manter: ${email} → ${user.uid}`);
    } catch {
      console.warn(`  AVISO: ${email} não encontrado no Firebase Auth (será ignorado na preservação)`);
    }
  }
  return keep;
}

async function resetKeptUserDocs(db, keepUids, dryRun) {
  for (const uid of keepUids) {
    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      console.log(`  ${uid}: sem doc usuarios (ok)`);
      continue;
    }
    const patch = {
      pareadoUid: null,
      pareadoCom: null,
      pareamentosAtivos: [],
    };
    if (!dryRun) await ref.update(patch);
    console.log(`  Reset pareamento em usuarios/${uid}${dryRun ? ' (dry-run)' : ''}`);
  }
}

async function deleteOtherFirestoreUsers(db, keepUids, dryRun) {
  let deleted = 0;
  while (true) {
    const snap = await db.collection('usuarios').limit(200).get();
    if (snap.empty) break;
    const batch = dryRun ? null : db.batch();
    let batchCount = 0;
    for (const doc of snap.docs) {
      if (keepUids.has(doc.id)) continue;
      if (!dryRun) batch.delete(doc.ref);
      deleted += 1;
      batchCount += 1;
    }
    if (!dryRun && batchCount > 0) await batch.commit();
    if (snap.size < 200) break;
  }
  console.log(`  usuarios removidos: ${deleted}${dryRun ? ' (dry-run)' : ''}`);
  return deleted;
}

async function deleteOtherAuthUsers(auth, keepEmails, dryRun) {
  let deleted = 0;
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    for (const user of res.users) {
      const email = (user.email ?? '').toLowerCase();
      if (keepEmails.has(email)) continue;
      if (!dryRun) await auth.deleteUser(user.uid);
      deleted += 1;
      console.log(`  Auth − ${email || user.uid}${dryRun ? ' (dry-run)' : ''}`);
    }
    pageToken = res.pageToken;
  } while (pageToken);
  console.log(`  Auth removidos: ${deleted}${dryRun ? ' (dry-run)' : ''}`);
  return deleted;
}

async function cleanupStorage(keepUids, dryRun) {
  const bucket = admin.storage().bucket();
  let deletedMemorias = 0;
  let deletedProfiles = 0;
  let keptProfiles = 0;

  console.log('\nStorage — memorias/ (apagar tudo)...');
  const [memoriaFiles] = await bucket.getFiles({ prefix: 'memorias/' });
  for (const file of memoriaFiles) {
    if (!dryRun) await file.delete({ ignoreNotFound: true });
    deletedMemorias += 1;
  }
  console.log(`  memorias/: ${deletedMemorias} arquivo(s)${dryRun ? ' (dry-run)' : ''}`);

  console.log('\nStorage — profile_pics/ (preservar contas mantidas)...');
  const [profileFiles] = await bucket.getFiles({ prefix: 'profile_pics/' });
  for (const file of profileFiles) {
    const uid = file.name.split('/')[1];
    if (uid && keepUids.has(uid)) {
      keptProfiles += 1;
      console.log(`  manter ${file.name}`);
      continue;
    }
    if (!dryRun) await file.delete({ ignoreNotFound: true });
    deletedProfiles += 1;
  }
  console.log(`  profile_pics/: ${deletedProfiles} removido(s), ${keptProfiles} mantido(s)${dryRun ? ' (dry-run)' : ''}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirm = process.argv.includes('--confirm');
  const storageOnly = process.argv.includes('--storage');
  if (!dryRun && !confirm) {
    console.error('Use --dry-run para simular ou --confirm para executar.');
    process.exit(1);
  }

  loadEnvLocal();
  initAdmin();
  const db = admin.firestore();
  const auth = admin.auth();

  console.log(`\nProjeto: ${process.env.FIREBASE_PROJECT_ID}`);
  console.log(`Modo: ${dryRun ? 'DRY-RUN' : 'EXECUÇÃO REAL'}\n`);
  console.log('Contas preservadas:');
  const keepMap = await resolveKeepUids(auth);
  const keepUids = new Set(keepMap.keys());
  const keepEmails = new Set(KEEP_EMAILS);

  if (storageOnly) {
    await cleanupStorage(keepUids, dryRun);
    console.log(dryRun ? '\nDry-run Storage concluído.' : '\nLimpeza Storage concluída.');
    return;
  }

  console.log('\nApagando interações...');
  await deleteCollection(db, 'tarefasMomentos', dryRun);
  await deleteCollection(db, 'memorias', dryRun);
  await deleteCollection(db, 'notificacoes', dryRun);
  await deleteCollection(db, 'pairingRequests', dryRun);
  await deleteCollection(db, 'weeklyChallenges', dryRun);
  await deleteCollection(db, 'inputs', dryRun);
  await deleteCollection(db, 'userNotificationTokens', dryRun);
  await deletePareamentosWithSubcollections(db, dryRun);

  console.log('\nUsuários Firestore...');
  await resetKeptUserDocs(db, keepUids, dryRun);
  await deleteOtherFirestoreUsers(db, keepUids, dryRun);

  console.log('\nFirebase Authentication...');
  await deleteOtherAuthUsers(auth, keepEmails, dryRun);

  await cleanupStorage(keepUids, dryRun);

  console.log(dryRun ? '\nDry-run concluído. Rode com --confirm para aplicar.' : '\nReset concluído.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
