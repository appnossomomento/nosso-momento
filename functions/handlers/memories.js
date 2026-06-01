/* eslint-disable require-jsdoc */
const https = require("firebase-functions/v2/https");
const crypto = require("crypto");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {buildMemoriaDescricao} = require("../lib/normalize");

exports.getMemorias = https.onRequest(async (req, res) => {
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
    keyPrefix: "getMemorias",
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

  const rawLimit = req.body && req.body.limit;
  const limitNum = Number(rawLimit);
  const limit = Number.isFinite(limitNum) ?
    Math.min(Math.max(limitNum, 1), 200) :
    50;

  const rawStartMs = req.body && req.body.startMs;
  const rawEndMs = req.body && req.body.endMs;
  const startMs = Number(rawStartMs);
  const endMs = Number(rawEndMs);
  const useRange = Number.isFinite(startMs) && Number.isFinite(endMs);

  const pareamentoId = req.body && typeof req.body.pareamentoId === "string" ?
    req.body.pareamentoId :
    "";
  const usePareamento = !!pareamentoId;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = admin.firestore();
    let query = db
        .collection("memorias")
        .where("pairUids", "array-contains", uid);

    if (usePareamento) {
      query = query.where("pareamentoId", "==", pareamentoId);
    }

    if (useRange) {
      query = query
          .where("createdAtMs", ">=", startMs)
          .where("createdAtMs", "<=", endMs)
          .orderBy("createdAtMs", "desc");
    } else {
      query = query.orderBy("createdAtMs", "desc");
    }

    let snapshot = null;
    try {
      snapshot = await query.limit(limit + 1).get();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      const code = err && err.code ? err.code : null;
      const shouldFallback = code === 9 ||
        code === "FAILED_PRECONDITION" ||
        msg.toLowerCase().includes("index");

      if (!shouldFallback) {
        throw err;
      }

      let fallbackQuery = db
          .collection("memorias")
          .where("pairUids", "array-contains", uid);

      if (usePareamento) {
        fallbackQuery = fallbackQuery.where("pareamentoId", "==", pareamentoId);
      }

      snapshot = await fallbackQuery.limit(limit + 1).get();
    }

    let docs = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (useRange) {
      docs = docs.filter((doc) =>
        (doc.createdAtMs || 0) >= startMs && (doc.createdAtMs || 0) <= endMs,
      );
    }

    docs.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit);

    res.send({items, hasMore});
  } catch (err) {
    console.error("getMemorias error:", err);
    res.status(500).send({error: "get_memorias_failed"});
  }
});

exports.createMemoriaPhoto = https.onRequest(async (req, res) => {
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
    keyPrefix: "createMemoriaPhoto",
    limit: 10,
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

  const body = req.body || {};
  const tarefaId = typeof body.tarefaId === "string" ? body.tarefaId : "";
  const fileName = typeof body.fileName === "string" ?
    body.fileName :
    "memoria";
  const contentType = typeof body.contentType === "string" ?
    body.contentType :
    "image/jpeg";
  const base64 = typeof body.base64 === "string" ? body.base64 : "";

  if (!tarefaId || !base64) {
    res.status(400).send({error: "invalid_payload"});
    return;
  }

  if (!contentType.startsWith("image/")) {
    res.status(400).send({error: "invalid_content_type"});
    return;
  }

  let buffer = null;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (err) {
    res.status(400).send({error: "invalid_base64"});
    return;
  }

  // Validação de magic bytes: verifica a assinatura real do arquivo
  // independente do contentType declarado pelo cliente (anti-polyglot attack).
  const MAGIC = {
    jpeg: [0xFF, 0xD8, 0xFF],
    png: [0x89, 0x50, 0x4E, 0x47],
    gif: [0x47, 0x49, 0x46],
    webp: [0x52, 0x49, 0x46, 0x46], // RIFF....WEBP — verificado nos bytes 8-11
  };
  const b = buffer;
  const isJpeg = b[0] === MAGIC.jpeg[0] &&
                 b[1] === MAGIC.jpeg[1] && b[2] === MAGIC.jpeg[2];
  const isPng = b[0] === MAGIC.png[0] && b[1] === MAGIC.png[1] &&
                 b[2] === MAGIC.png[2] && b[3] === MAGIC.png[3];
  const isGif = b[0] === MAGIC.gif[0] &&
                b[1] === MAGIC.gif[1] && b[2] === MAGIC.gif[2];
  const isWebp = b[0] === MAGIC.webp[0] && b[1] === MAGIC.webp[1] &&
                 b[2] === MAGIC.webp[2] && b[3] === MAGIC.webp[3] &&
                 b[8] === 0x57 && b[9] === 0x45 &&
                 b[10] === 0x42 && b[11] === 0x50;
  if (!isJpeg && !isPng && !isGif && !isWebp) {
    res.status(400).send({error: "invalid_image_signature"});
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).send({error: "image_too_large"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const tarefaRef = db.collection("tarefasMomentos").doc(tarefaId);
    const tarefaSnap = await tarefaRef.get();

    if (!tarefaSnap.exists) {
      res.status(404).send({error: "tarefa_not_found"});
      return;
    }

    const tarefa = tarefaSnap.data() || {};
    const executadoUid = tarefa.executadoPorUid || null;
    const resgatadoUid = tarefa.resgatadoPorUid || null;

    if (uid !== executadoUid && uid !== resgatadoUid) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const pareamentoId = tarefa.idPareamento ||
      tarefa.pareamentoId ||
      tarefa.pareamentoAmigavelId ||
      "";
    const pairUids = [executadoUid, resgatadoUid].filter(Boolean).sort();

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `memorias/${pareamentoId}/${uid}/${tarefaId}/` +
      `${Date.now()}_${safeName}`;

    const bucket = admin.storage().bucket();
    const token = crypto.randomUUID();
    await bucket.file(filePath).save(buffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const encodedPath = encodeURIComponent(filePath);
    const downloadURL =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
      `/o/${encodedPath}?alt=media&token=${token}`;

    let executadoNome = tarefa.executadoPorNome || "";
    let resgatadoNome = tarefa.resgatadoPorNome || "";

    if (!executadoNome && executadoUid) {
      const snap = await db
          .collection("usuarios")
          .doc(executadoUid)
          .get();
      executadoNome = snap.exists ? (snap.data().nome || "") : "";
    }

    if (!resgatadoNome && resgatadoUid) {
      const snap = await db
          .collection("usuarios")
          .doc(resgatadoUid)
          .get();
      resgatadoNome = snap.exists ? (snap.data().nome || "") : "";
    }

    const descricao = buildMemoriaDescricao(
        executadoNome,
        resgatadoNome,
        tarefa.momentoNome || null,
    );

    const momentoCategoria = tarefa.momentoCategoria ||
      tarefa.categoria ||
      null;
    const memoriaSchemaVersion = 2;
    const payload = {
      tarefaId,
      momentoNome: tarefa.momentoNome || null,
      momentoCategoria,
      categoria: momentoCategoria,
      memoriaSchemaVersion,
      custoFoguinhos: Number.isFinite(Number(tarefa.custoFoguinhos)) ?
        Number(tarefa.custoFoguinhos) :
        0,
      fotoUrl: downloadURL,
      fotoPath: filePath,
      pareamentoId: pareamentoId || null,
      pairUids,
      executadoPorUid: executadoUid,
      resgatadoPorUid: resgatadoUid,
      executadoPorNome: executadoNome || null,
      resgatadoPorNome: resgatadoNome || null,
      descricao,
      autorUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    };

    const memoriaRef = await db.collection("memorias").add(payload);
    res.send({item: {id: memoriaRef.id, ...payload}});
  } catch (err) {
    console.error("createMemoriaPhoto error:", err);
    res.status(500).send({error: "create_memoria_failed"});
  }
});

exports.deleteMemoria = https.onRequest(async (req, res) => {
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
    keyPrefix: "deleteMemoria",
    limit: 20,
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

  const body = req.body || {};
  const memoriaId = typeof body.memoriaId === "string" ? body.memoriaId : "";

  if (!memoriaId) {
    res.status(400).send({error: "invalid_payload"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const memoriaRef = db.collection("memorias").doc(memoriaId);
    const memoriaSnap = await memoriaRef.get();

    if (!memoriaSnap.exists) {
      res.status(404).send({error: "memoria_not_found"});
      return;
    }

    const memoria = memoriaSnap.data() || {};
    const pairUids = Array.isArray(memoria.pairUids) ? memoria.pairUids : [];
    const isAllowed = pairUids.includes(uid) || memoria.autorUid === uid;

    if (!isAllowed) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const bucket = admin.storage().bucket();
    const fotoPath = memoria.fotoPath || null;
    if (fotoPath) {
      try {
        await bucket.file(fotoPath).delete({ignoreNotFound: true});
      } catch (err) {
        console.warn("deleteMemoria: falha ao remover arquivo", err);
      }
    }

    await memoriaRef.delete();
    res.send({ok: true});
  } catch (err) {
    console.error("deleteMemoria error:", err);
    res.status(500).send({error: "delete_memoria_failed"});
  }
});
