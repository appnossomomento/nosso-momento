/* eslint-disable require-jsdoc, linebreak-style, max-len */
"use strict";

const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitFirestore} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {isUserPareamentoMember} = require("../lib/customMoments");
const {signReadUrl, parseMediaPath} = require("../lib/storageSignedUrl");

const HTTP_OPTS = {
  region: "southamerica-east1",
  memory: "256MiB",
  maxInstances: 5,
  cpu: 0.5,
};

/**
 * @param {object} req
 * @param {object} res
 * @return {Promise<string|null>} uid or null if response already sent
 */
async function requireUid(req, res) {
  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ?
    authHeader.split("Bearer ")[1] : null;
  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    return decoded.uid;
  } catch (_) {
    res.status(401).send({error: "invalid_token"});
    return null;
  }
}

/**
 * Upload de capa de momento custom (Admin SDK, sem download token).
 * POST { pareamentoId, base64, contentType, fileName? }
 * → { imgPath, url }  (url assinada curta para preview imediato)
 */
exports.uploadCustomMomentImage = https.onRequest(HTTP_OPTS, async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }
  if (await requireAppCheck(req, res)) return;
  if (await rateLimitFirestore(req, res, {
    keyPrefix: "uploadCustomMomentImage",
    limit: 20,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const uid = await requireUid(req, res);
  if (!uid) return;

  const body = req.body || {};
  const pareamentoId = typeof body.pareamentoId === "string" ?
    body.pareamentoId.trim() : "";
  const contentType = typeof body.contentType === "string" ?
    body.contentType : "image/jpeg";
  const base64 = typeof body.base64 === "string" ? body.base64 : "";
  const fileName = typeof body.fileName === "string" ? body.fileName : "capa";

  if (!pareamentoId || !base64) {
    res.status(400).send({error: "invalid_payload"});
    return;
  }
  if (!contentType.startsWith("image/")) {
    res.status(400).send({error: "invalid_content_type"});
    return;
  }

  let buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (_) {
    res.status(400).send({error: "invalid_base64"});
    return;
  }

  const MAGIC_OK =
    (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) ||
    (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E &&
      buffer[3] === 0x47) ||
    (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) ||
    (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 &&
      buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50);
  if (!MAGIC_OK) {
    res.status(400).send({error: "invalid_image_signature"});
    return;
  }
  if (buffer.length > 5 * 1024 * 1024) {
    res.status(400).send({error: "image_too_large"});
    return;
  }

  try {
    const db = admin.firestore();
    const pairSnap = await db.collection("pareamentos").doc(pareamentoId).get();
    if (!pairSnap.exists) {
      res.status(404).send({error: "pareamento_not_found"});
      return;
    }
    if (!isUserPareamentoMember(pairSnap.data(), uid)) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const ext =
      contentType.includes("png") ? "png" :
      contentType.includes("webp") ? "webp" : "jpg";
    const safe = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const imgPath =
      `custom_momentos/${pareamentoId}/${uid}/${Date.now()}_${safe}.${ext}`;

    await admin.storage().bucket().file(imgPath).save(buffer, {
      metadata: {contentType},
    });

    const url = await signReadUrl(imgPath);
    res.send({imgPath, url: url || null});
  } catch (err) {
    console.error("uploadCustomMomentImage error:", err);
    res.status(500).send({error: "upload_failed"});
  }
});

/**
 * Resolve paths de mídia em signed URLs (15 min).
 * POST { paths: string[] }
 * → { urls: Record<path, string|null> }
 */
exports.resolveMediaUrls = https.onRequest(HTTP_OPTS, async (req, res) => {
  setCorsHeaders(req, res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }
  if (await requireAppCheck(req, res)) return;
  if (await rateLimitFirestore(req, res, {
    keyPrefix: "resolveMediaUrls",
    limit: 60,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const uid = await requireUid(req, res);
  if (!uid) return;

  const rawPaths = req.body && Array.isArray(req.body.paths) ?
    req.body.paths : [];
  const paths = [...new Set(
      rawPaths
          .filter((p) => typeof p === "string" && p.length > 0 && p.length < 512)
          .slice(0, 40),
  )];

  if (!paths.length) {
    res.send({urls: {}});
    return;
  }

  try {
    const db = admin.firestore();
    const pairCache = new Map();
    const canAccess = async (pareamentoId) => {
      if (pairCache.has(pareamentoId)) return pairCache.get(pareamentoId);
      const snap = await db.collection("pareamentos").doc(pareamentoId).get();
      const ok = snap.exists && isUserPareamentoMember(snap.data(), uid);
      pairCache.set(pareamentoId, ok);
      return ok;
    };

    const urls = {};
    await Promise.all(paths.map(async (filePath) => {
      const parsed = parseMediaPath(filePath);
      if (!parsed) {
        urls[filePath] = null;
        return;
      }
      const ok = await canAccess(parsed.pareamentoId);
      if (!ok) {
        urls[filePath] = null;
        return;
      }
      urls[filePath] = await signReadUrl(filePath);
    }));

    res.send({urls});
  } catch (err) {
    console.error("resolveMediaUrls error:", err);
    res.status(500).send({error: "resolve_failed"});
  }
});
