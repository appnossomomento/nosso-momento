/* eslint-disable require-jsdoc */
const {
  admin,
  WEEKLY_CHALLENGE_QUESTIONS,
  WEEKLY_CHALLENGE_CHOICES,
  ROULETTE_OPTIONS,
  WEEKLY_CHALLENGE_CYCLE_MS,
} = require("./config");

function getChallengeQuestionForCycle(seed, cycleIndex) {
  const seedStr = `${seed || "alma_gemea"}:${cycleIndex || 0}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % WEEKLY_CHALLENGE_QUESTIONS.length;
  return WEEKLY_CHALLENGE_QUESTIONS[index];
}

async function deleteCollectionInBatches(db, collectionPath, batchSize = 200) {
  let deleted = 0;
  let hasMore = true;
  while (hasMore) {
    const snapshot = await db.collection(collectionPath)
        .limit(batchSize)
        .get();
    if (snapshot.empty) {
      break;
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    hasMore = snapshot.size >= batchSize;
  }
  return deleted;
}

async function deleteWeeklyChallengeInputs(db, batchSize = 200) {
  const types = [
    "weekly_challenge_seed",
    "weekly_challenge_start",
    "weekly_challenge_upsert",
    "weekly_challenge_answer",
    "weekly_challenge_timeout",
  ];
  let deleted = 0;
  for (const type of types) {
    let hasMore = true;
    while (hasMore) {
      const snapshot = await db.collection("inputs")
          .where("type", "==", type)
          .limit(batchSize)
          .get();
      if (snapshot.empty) {
        break;
      }
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += snapshot.size;
      hasMore = snapshot.size >= batchSize;
    }
  }
  return deleted;
}

async function upsertWeeklyChallengeForPair({
  db,
  pairUids,
  pareamentoId,
  nowMs,
  forceReset = false,
}) {
  const sortedUids = [...pairUids].sort();
  const pairKey = sortedUids.join("_");
  const challengeDocId = `alma_gemea_${pairKey}`;
  const challengeRef = db.collection("weeklyChallenges").doc(challengeDocId);
  const snap = await challengeRef.get();
  const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);

  if (!snap.exists) {
    const pergunta = getChallengeQuestionForCycle(pairKey, 0);
    await challengeRef.set({
      id: challengeDocId,
      challengeId: "alma_gemea",
      titulo: "Alma Gêmea",
      descricao: "Respondam a mesma pergunta para ganhar 2 foguinhos.",
      pergunta,
      reward: 2,
      status: "pendente",
      pairUids: sortedUids,
      pareamentoId: pareamentoId || null,
      cycleIndex: 0,
      respostas: {},
      respondeuEm: {},
      respondeuNome: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      criadoEm: nowTs,
      startedAtMs: nowMs,
      startedAt: nowTs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return "created";
  }

  const data = snap.data() || {};
  const startedAtMs = Number(data.startedAtMs || data.createdAtMs || 0) || 0;
  const cycleIndex = Number.isFinite(Number(data.cycleIndex)) ?
    Number(data.cycleIndex) :
    0;
  const isExpired = !startedAtMs || (nowMs - startedAtMs) >=
    WEEKLY_CHALLENGE_CYCLE_MS;
  const shouldReset = forceReset || isExpired;

  if (!shouldReset) {
    return "skipped";
  }

  const nextIndex = cycleIndex + 1;
  const pergunta = getChallengeQuestionForCycle(pairKey, nextIndex);
  await challengeRef.set({
    id: challengeDocId,
    challengeId: data.challengeId || "alma_gemea",
    titulo: data.titulo || "Alma Gêmea",
    descricao: data.descricao ||
      "Respondam a mesma pergunta para ganhar 1 foguinho.",
    pergunta,
    reward: Number.isFinite(Number(data.reward)) ? Number(data.reward) : 1,
    status: "pendente",
    pairUids: sortedUids,
    pareamentoId: pareamentoId || data.pareamentoId || null,
    cycleIndex: nextIndex,
    respostas: {},
    respondeuEm: {},
    respondeuNome: {},
    respostaUsuario: null,
    respostaParceiro: null,
    parceiroNomeResposta: null,
    concluido: false,
    rewarded: false,
    completedAt: null,
    completedAtMs: null,
    createdAtMs: nowMs,
    criadoEm: nowTs,
    startedAtMs: nowMs,
    startedAt: nowTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return forceReset ? "reset" : "rotated";
}

function pickRouletteValue(options) {
  options = options || ROULETTE_OPTIONS;
  let cumulative = 0;
  const r = Math.random();
  for (const opt of options) {
    cumulative += opt.prob;
    if (r < cumulative) return opt.valor;
  }
  return options[options.length - 1].valor;
}

async function upsertPreferencesChallengeForPair({
  db,
  pairUids,
  pareamentoId,
  nowMs,
  forceReset = false,
}) {
  const sortedUids = [...pairUids].sort();
  const pairKey = sortedUids.join("_");
  const challengeDocId = `preferencias_${pairKey}`;
  const challengeRef = db.collection("weeklyChallenges").doc(challengeDocId);
  const snap = await challengeRef.get();
  const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);

  if (!snap.exists) {
    const choice = WEEKLY_CHALLENGE_CHOICES[
        Math.floor(Math.random() * WEEKLY_CHALLENGE_CHOICES.length)
    ];
    await challengeRef.set({
      id: challengeDocId,
      challengeId: "preferencias",
      titulo: "Preferências",
      descricao: "Escolham a mesma opção para ganhar 2 foguinhos.",
      tipo: "escolha",
      opcaoA: choice.opcaoA,
      opcaoB: choice.opcaoB,
      reward: 2,
      status: "pendente",
      pairUids: sortedUids,
      pareamentoId: pareamentoId || null,
      cycleIndex: 0,
      respostas: {},
      respondeuEm: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      criadoEm: nowTs,
      startedAtMs: nowMs,
      startedAt: nowTs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return "created";
  }

  const data = snap.data() || {};
  const startedAtMs = Number(data.startedAtMs || data.createdAtMs || 0) || 0;
  const cycleIndex = Number.isFinite(Number(data.cycleIndex)) ?
    Number(data.cycleIndex) : 0;
  const isExpired = !startedAtMs ||
    (nowMs - startedAtMs) >= WEEKLY_CHALLENGE_CYCLE_MS;
  if (!forceReset && !isExpired) return "skipped";

  const nextIndex = cycleIndex + 1;
  const choiceIdx = (nextIndex) % WEEKLY_CHALLENGE_CHOICES.length;
  const choice = WEEKLY_CHALLENGE_CHOICES[choiceIdx];
  await challengeRef.set({
    id: challengeDocId,
    challengeId: "preferencias",
    titulo: "Preferências",
    descricao: "Escolham a mesma opção para ganhar 2 foguinhos.",
    tipo: "escolha",
    opcaoA: choice.opcaoA,
    opcaoB: choice.opcaoB,
    reward: 2,
    status: "pendente",
    pairUids: sortedUids,
    pareamentoId: pareamentoId || data.pareamentoId || null,
    cycleIndex: nextIndex,
    respostas: {},
    respondeuEm: {},
    concluido: false,
    rewarded: false,
    completedAt: null,
    completedAtMs: null,
    createdAtMs: nowMs,
    criadoEm: nowTs,
    startedAtMs: nowMs,
    startedAt: nowTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return forceReset ? "reset" : "rotated";
}

async function upsertRouletteChallengeForPair({
  db,
  pairUids,
  pareamentoId,
  nowMs,
  forceReset = false,
}) {
  const sortedUids = [...pairUids].sort();
  const pairKey = sortedUids.join("_");
  const challengeDocId = `roleta_${pairKey}`;
  const challengeRef = db.collection("weeklyChallenges").doc(challengeDocId);
  const snap = await challengeRef.get();
  const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);

  if (!snap.exists) {
    await challengeRef.set({
      id: challengeDocId,
      challengeId: "roleta",
      titulo: "Roleta dos Foguinhos",
      descricao: "Cada um gira a roleta. A soma dos resultados é o bônus!",
      tipo: "roleta",
      status: "pendente",
      pairUids: sortedUids,
      pareamentoId: pareamentoId || null,
      cycleIndex: 0,
      respostas: {},
      respondeuEm: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      criadoEm: nowTs,
      startedAtMs: nowMs,
      startedAt: nowTs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return "created";
  }

  const data = snap.data() || {};
  const startedAtMs = Number(data.startedAtMs || data.createdAtMs || 0) || 0;
  const cycleIndex = Number.isFinite(Number(data.cycleIndex)) ?
    Number(data.cycleIndex) : 0;
  const isExpired = !startedAtMs ||
    (nowMs - startedAtMs) >= WEEKLY_CHALLENGE_CYCLE_MS;
  if (!forceReset && !isExpired) return "skipped";

  await challengeRef.set({
    id: challengeDocId,
    challengeId: "roleta",
    titulo: "Roleta dos Foguinhos",
    descricao: "Cada um gira a roleta. A soma dos resultados é o bônus!",
    tipo: "roleta",
    status: "pendente",
    pairUids: sortedUids,
    pareamentoId: pareamentoId || data.pareamentoId || null,
    cycleIndex: cycleIndex + 1,
    respostas: {},
    respondeuEm: {},
    concluido: false,
    rewarded: false,
    completedAt: null,
    completedAtMs: null,
    createdAtMs: nowMs,
    criadoEm: nowTs,
    startedAtMs: nowMs,
    startedAt: nowTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return forceReset ? "reset" : "rotated";
}

async function expireActiveChallengesForPair({db, pairUids, except}) {
  const sortedUids = [...pairUids].sort();
  const pairKey = sortedUids.join("_");
  const allTypes = ["alma_gemea", "preferencias", "roleta"];
  const toExpire = allTypes.filter((t) => t !== except);
  for (const tipo of toExpire) {
    const docId = `${tipo}_${pairKey}`;
    const ref = db.collection("weeklyChallenges").doc(docId);
    const snap = await ref.get();
    if (!snap.exists) continue;
    const data = snap.data() || {};
    if (data.status !== "expirado") {
      await ref.update({
        status: "expirado",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

module.exports = {
  getChallengeQuestionForCycle,
  deleteCollectionInBatches,
  deleteWeeklyChallengeInputs,
  upsertWeeklyChallengeForPair,
  upsertPreferencesChallengeForPair,
  upsertRouletteChallengeForPair,
  pickRouletteValue,
  ROULETTE_OPTIONS,
  expireActiveChallengesForPair,
};
