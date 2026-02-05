/* eslint-disable no-console */
const admin = require('firebase-admin');

function initAdmin() {
  if (admin.apps.length) return;
  admin.initializeApp();
}

async function deleteCollection(db, collectionPath, batchSize = 200) {
  const collectionRef = db.collection(collectionPath);
  let deleted = 0;

  while (true) {
    const snapshot = await collectionRef.limit(batchSize).get();
    if (snapshot.empty) {
      break;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;

    if (snapshot.size < batchSize) {
      break;
    }
  }

  return deleted;
}

async function deleteWeeklyChallengeInputs(db, batchSize = 200) {
  const types = [
    'weekly_challenge_seed',
    'weekly_challenge_start',
    'weekly_challenge_upsert',
    'weekly_challenge_answer',
    'weekly_challenge_timeout',
  ];

  let deletedTotal = 0;
  for (const type of types) {
    while (true) {
      const snapshot = await db
        .collection('inputs')
        .where('type', '==', type)
        .limit(batchSize)
        .get();

      if (snapshot.empty) {
        break;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deletedTotal += snapshot.size;

      if (snapshot.size < batchSize) {
        break;
      }
    }
  }

  return deletedTotal;
}

async function run() {
  initAdmin();
  const db = admin.firestore();

  console.log('Iniciando reset global dos desafios semanais...');

  const weeklyChallengesDeleted = await deleteCollection(db, 'weeklyChallenges');
  console.log(`weeklyChallenges removidos: ${weeklyChallengesDeleted}`);

  const inputDeleted = await deleteWeeklyChallengeInputs(db);
  console.log(`inputs de desafio removidos: ${inputDeleted}`);

  console.log('Reset concluído.');
}

run().catch((err) => {
  console.error('Falha no reset global:', err);
  process.exitCode = 1;
});
