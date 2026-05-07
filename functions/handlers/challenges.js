/* eslint-disable require-jsdoc */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {
  upsertWeeklyChallengeForPair,
  deleteCollectionInBatches,
  deleteWeeklyChallengeInputs,
} = require("../lib/challenges");

exports.rotateWeeklyChallenges = onSchedule({
  schedule: "every 6 hours",
  timeZone: "America/Sao_Paulo",
}, async () => {
  const db = admin.firestore();
  const nowMs = Date.now();
  const pareamentosSnap = await db.collection("pareamentos").get();
  let created = 0;
  let rotated = 0;
  let skipped = 0;

  for (const doc of pareamentosSnap.docs) {
    const data = doc.data() || {};
    const uidA = data.pessoa1Uid || null;
    const uidB = data.pessoa2Uid || null;
    if (!uidA || !uidB) {
      continue;
    }

    const result = await upsertWeeklyChallengeForPair({
      db,
      pairUids: [uidA, uidB],
      pareamentoId: doc.id,
      nowMs,
    });

    if (result === "created") {
      created += 1;
    } else if (result === "rotated") {
      rotated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log("rotateWeeklyChallenges: done", {
    total: pareamentosSnap.size,
    created,
    rotated,
    skipped,
  });
});

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
