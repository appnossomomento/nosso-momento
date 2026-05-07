/* eslint-disable require-jsdoc */
const {onRequest} = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");

exports.getExtrato = onRequest(async (req, res) => {
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
    keyPrefix: "getExtrato",
    limit: 120,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }
  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const pareamentoId = req.body && typeof req.body.pareamentoId === "string" ?
    req.body.pareamentoId : "";
  if (!pareamentoId) {
    res.status(400).send({error: "missing_pareamento_id"});
    return;
  }

  const rawLimit = req.body && req.body.limit;
  const limitNum = Number(rawLimit);
  const limit = Number.isFinite(limitNum) ?
    Math.min(Math.max(limitNum, 1), 100) : 20;
  const rawStartAfter = req.body && req.body.startAfterMs;
  const startAfterMs = Number(rawStartAfter);
  const useStartAfter = Number.isFinite(startAfterMs);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const pareamentoSnap = await admin.firestore()
        .collection("pareamentos")
        .doc(pareamentoId)
        .get();
    if (!pareamentoSnap.exists) {
      res.status(404).send({error: "pareamento_not_found"});
      return;
    }

    const pData = pareamentoSnap.data();
    if (pData.pessoa1Uid !== uid && pData.pessoa2Uid !== uid) {
      res.status(403).send({error: "not_authorized"});
      return;
    }

    let query = admin.firestore()
        .collection("pareamentos").doc(pareamentoId)
        .collection("extrato")
        .orderBy("createdAtMs", "desc");

    if (useStartAfter) {
      query = query.where("createdAtMs", "<", startAfterMs);
    }

    const snapshot = await query.limit(limit + 1).get();
    const docs = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit);

    items.forEach((item) => {
      if (item.timestamp &&
          typeof item.timestamp.toMillis === "function") {
        item.timestampMs = item.timestamp.toMillis();
      }
      delete item.timestamp;
    });

    res.send({items, hasMore});
  } catch (err) {
    console.error("getExtrato error:", err);
    res.status(500).send({error: "get_extrato_failed"});
  }
});
