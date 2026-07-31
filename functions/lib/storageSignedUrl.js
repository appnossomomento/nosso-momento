/* eslint-disable require-jsdoc, linebreak-style, max-len */
"use strict";

const {admin} = require("./config");

const DEFAULT_TTL_MS = 15 * 60 * 1000;

/**
 * Extrai o path do objeto a partir de uma URL legada do Firebase Storage.
 * @param {string} url
 * @return {string|null}
 */
function pathFromFirebaseDownloadUrl(url) {
  if (typeof url !== "string" || !url) return null;
  try {
    const marker = "/o/";
    const idx = url.indexOf(marker);
    if (idx < 0) return null;
    const rest = url.slice(idx + marker.length);
    const pathEnc = rest.split("?")[0];
    if (!pathEnc) return null;
    return decodeURIComponent(pathEnc);
  } catch (_) {
    return null;
  }
}

/**
 * Remove download tokens permanentes do metadata (best-effort).
 * @param {object} file Arquivo do Storage (Admin SDK).
 * @return {Promise<void>}
 */
async function stripDownloadTokens(file) {
  try {
    const [meta] = await file.getMetadata();
    const custom = (meta && meta.metadata) || {};
    if (!custom.firebaseStorageDownloadTokens) return;
    const next = {...custom};
    delete next.firebaseStorageDownloadTokens;
    await file.setMetadata({metadata: next});
  } catch (err) {
    console.warn("[storageSignedUrl] strip tokens failed:", err && err.message);
  }
}

/**
 * Gera URL assinada de leitura (V4), TTL padrão 15 min.
 * @param {string} filePath
 * @param {object=} opts
 * @param {number=} opts.ttlMs
 * @param {boolean=} opts.stripTokens
 * @return {Promise<string|null>}
 */
async function signReadUrl(filePath, opts = {}) {
  if (typeof filePath !== "string" || !filePath.trim()) return null;
  const ttlMs = Number.isFinite(opts.ttlMs) ? opts.ttlMs : DEFAULT_TTL_MS;
  const stripTokens = opts.stripTokens !== false;
  const bucket = admin.storage().bucket();
  const file = bucket.file(filePath);

  try {
    const [exists] = await file.exists();
    if (!exists) return null;
  } catch (_) {
    return null;
  }

  if (stripTokens) {
    // Não aguarda para não atrasar a resposta; fire-and-forget.
    stripDownloadTokens(file).catch(() => {});
  }

  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + ttlMs,
  });
  return url || null;
}

/**
 * Resolve fotoUrl assinado a partir de fotoPath ou URL legada.
 * @param {object} doc
 * @return {Promise<string|null>}
 */
async function signMemoriaDoc(doc) {
  if (!doc || typeof doc !== "object") return null;
  let path = typeof doc.fotoPath === "string" ? doc.fotoPath : null;
  if (!path && typeof doc.fotoUrl === "string") {
    path = pathFromFirebaseDownloadUrl(doc.fotoUrl);
  }
  if (!path) return typeof doc.fotoUrl === "string" ? doc.fotoUrl : null;
  const signed = await signReadUrl(path);
  return signed || null;
}

/**
 * Path de mídia permitido: memorias/... ou custom_momentos/...
 * @param {string} filePath
 * @return {{kind: string, pareamentoId: string, ownerUid: string}|null}
 */
function parseMediaPath(filePath) {
  if (typeof filePath !== "string") return null;
  const parts = filePath.split("/").filter(Boolean);
  if (parts[0] === "custom_momentos" && parts.length >= 4) {
    return {
      kind: "custom_momentos",
      pareamentoId: parts[1],
      ownerUid: parts[2],
    };
  }
  if (parts[0] === "memorias" && parts.length >= 4) {
    return {
      kind: "memorias",
      pareamentoId: parts[1],
      ownerUid: parts[2],
    };
  }
  return null;
}

module.exports = {
  DEFAULT_TTL_MS,
  pathFromFirebaseDownloadUrl,
  stripDownloadTokens,
  signReadUrl,
  signMemoriaDoc,
  parseMediaPath,
};
