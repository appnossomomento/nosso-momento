/* eslint-disable require-jsdoc */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {
  upsertWeeklyChallengeForPair,
  upsertPreferencesChallengeForPair,
  upsertRouletteChallengeForPair,
  expireActiveChallengesForPair,
  deleteCollectionInBatches,
  deleteWeeklyChallengeInputs,
} = require("../lib/challenges");

// Shared handler for challenge rotation
async function runChallengeRotation(tipo) {
  const db = admin.firestore();
  const nowMs = Date.now();
  const pareamentosSnap = await db.collection("pareamentos").get();
  let created = 0; let rotated = 0; let expired = 0;

  for (const pareDoc of pareamentosSnap.docs) {
    const data = pareDoc.data() || {};
    const uidA = data.pessoa1Uid || null;
    const uidB = data.pessoa2Uid || null;
    if (!uidA || !uidB) continue;

    // Expire the other two challenge types for this pair
    await expireActiveChallengesForPair({
      db, pairUids: [uidA, uidB], except: tipo,
    });
    expired += 1;

    // Create/reset the new challenge
    let result;
    if (tipo === "alma_gemea") {
      result = await upsertWeeklyChallengeForPair({
        db, pairUids: [uidA, uidB],
        pareamentoId: pareDoc.id, nowMs, forceReset: true,
      });
    } else if (tipo === "preferencias") {
      result = await upsertPreferencesChallengeForPair({
        db, pairUids: [uidA, uidB],
        pareamentoId: pareDoc.id, nowMs, forceReset: true,
      });
    } else if (tipo === "roleta") {
      result = await upsertRouletteChallengeForPair({
        db, pairUids: [uidA, uidB],
        pareamentoId: pareDoc.id, nowMs, forceReset: true,
      });
    }
    if (result === "created") created += 1;
    else rotated += 1;
  }

  console.log(`runChallengeRotation(${tipo}): done`, {
    total: pareamentosSnap.size, created, rotated, expired,
  });
}

// Segunda-feira 20h → Perguntas (Alma Gêmea)
exports.rotateWeeklyChallenges = onSchedule({
  schedule: "0 20 * * 1",
  timeZone: "America/Sao_Paulo",
}, async () => runChallengeRotation("alma_gemea"));

// Quarta-feira 20h → Preferências
exports.startPreferenciasDesafio = onSchedule({
  schedule: "0 20 * * 3",
  timeZone: "America/Sao_Paulo",
}, async () => runChallengeRotation("preferencias"));

// Domingo 22h → Roleta
exports.startRoletaDesafio = onSchedule({
  schedule: "0 22 * * 0",
  timeZone: "America/Sao_Paulo",
}, async () => runChallengeRotation("roleta"));

exports.resetWeeklyChallengesAdmin = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (await requireAppCheck(req, res)) {
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "resetWeeklyChallengesAdmin",
    limit: 10,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") ||
    req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }
  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const adminClaim = decoded && decoded.admin === true;
    let isAllowed = adminClaim;
    if (!isAllowed) {
      const adminDoc = await admin.firestore()
          .collection("adminUsers")
          .doc(decoded.uid)
          .get();
      isAllowed = adminDoc.exists;
    }
    if (!isAllowed) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const db = admin.firestore();
    const weeklyChallengesDeleted = await deleteCollectionInBatches(
        db,
        "weeklyChallenges",
    );
    const inputsDeleted = await deleteWeeklyChallengeInputs(db);

    res.send({
      ok: true,
      weeklyChallengesDeleted,
      inputsDeleted,
    });
  } catch (err) {
    console.error("resetWeeklyChallengesAdmin: error", err);
    if (err && err.code === "auth/argument-error") {
      res.status(401).send({error: "invalid_token"});
    } else {
      res.status(500).send({error: "internal_error"});
    }
  }
});
