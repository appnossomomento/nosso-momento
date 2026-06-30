/* eslint-disable require-jsdoc */
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");

exports.createInput = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    // Preflight request
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
    keyPrefix: "createInput",
    limit: 60,
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

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const input = req.body && req.body.input;
    if (!input || typeof input !== "object") {
      res.status(400).send({error: "missing_input"});
      return;
    }

    // Basic validation: ensure fromUid matches token uid
    if (!input.fromUid || input.fromUid !== decoded.uid) {
      res.status(403).send({error: "fromUid_mismatch"});
      return;
    }

    // Validate allowed types roughly (same as firestore.rules)
    const allowedTypes = [
      "pairing_request",
      "pairing_response",
      "pairing_cancel",
      "pairing_unpair",
      "gift",
      "daily_check_in",
      "moment_redeem",
      "clima_update",
      "weekly_challenge_seed",
      "weekly_challenge_start",
      "weekly_challenge_upsert",
      "weekly_challenge_answer",
      "weekly_challenge_timeout",
      "preference_challenge_answer",
      "roulette_spin",
      "catalog_update",
      "moment_complete",
      "profile_photo_upload",
      "moment_photo_upload",
      "convite_aceitar",
      "catalog_personalizado_save",
      "custom_moment_create",
      "custom_moment_delete",
    ];
    if (!input.type || !allowedTypes.includes(input.type)) {
      res.status(400).send({error: "unsupported_type"});
      return;
    }

    // --- SECURITY: Schema validation por tipo ---
    // Só copia campos permitidos para cada tipo de input
    const ALLOWED_FIELDS_BY_TYPE = {
      pairing_request: [
        "type", "fromUid", "fromName", "fromPhone",
        "toUid", "toPhone", "toName",
      ],
      pairing_response: [
        "type", "fromUid", "requestId", "response",
      ],
      pairing_cancel: [
        "type", "fromUid", "requestId",
      ],
      convite_aceitar: [
        "type", "fromUid", "token",
      ],
      pairing_unpair: [
        "type", "fromUid", "partnerUid", "partnerPhone", "pareamentoId",
      ],
      gift: [
        "type", "fromUid", "partnerUid", "amount", "pareamentoId",
      ],
      daily_check_in: [
        "type", "fromUid", "partnerUid", "pareamentoId",
      ],
      moment_redeem: [
        "type", "fromUid", "partnerUid", "pareamentoId", "items",
      ],
      clima_update: [
        "type", "fromUid", "partnerUid", "pareamentoId", "humor",
      ],
      weekly_challenge_seed: [
        "type", "fromUid", "partnerUid", "pareamentoId",
      ],
      weekly_challenge_start: [
        "type", "fromUid", "partnerUid", "pareamentoId", "payloadJson",
      ],
      weekly_challenge_upsert: [
        "type", "fromUid", "partnerUid", "pareamentoId", "payloadJson",
      ],
      weekly_challenge_answer: [
        "type", "fromUid", "partnerUid", "pareamentoId",
        "challengeId", "challengeDocId",
        "responderUid", "responderName", "answer", "payloadJson",
      ],
      weekly_challenge_timeout: [
        "type", "fromUid", "partnerUid", "pareamentoId",
        "challengeId", "payloadJson",
      ],
      preference_challenge_answer: [
        "type", "fromUid", "partnerUid", "pareamentoId",
        "challengeId", "challengeDocId",
        "responderUid", "responderName", "answer",
      ],
      roulette_spin: [
        "type", "fromUid", "partnerUid", "pareamentoId",
        "challengeId", "challengeDocId", "responderUid",
      ],
      catalog_update: [
        "type", "fromUid", "partnerUids",
      ],
      moment_complete: [
        "type", "fromUid", "pareamentoId", "tarefaId", "comFoto",
      ],
      profile_photo_upload: [
        "type", "fromUid",
      ],
      moment_photo_upload: [
        "type", "fromUid",
      ],
      catalog_personalizado_save: [
        "type", "fromUid", "catalogoPersonalizado",
      ],
      custom_moment_create: [
        "type", "fromUid", "pareamentoId", "nome", "preco", "emoji", "img",
      ],
      custom_moment_delete: [
        "type", "fromUid", "pareamentoId", "itemId",
      ],
    };

    const allowed =
      ALLOWED_FIELDS_BY_TYPE[input.type] || ["type", "fromUid"];
    const toWrite = {};
    for (const field of allowed) {
      if (input[field] !== undefined) {
        toWrite[field] = input[field];
      }
    }
    toWrite.processed = false;
    toWrite.timestamp = admin.firestore.FieldValue.serverTimestamp();

    const ref = await admin.firestore().collection("inputs").add(toWrite);
    res.send({ok: true, id: ref.id});
  } catch (err) {
    console.error("createInput: error", err);
    // map common auth errors
    if (err && err.code === "auth/argument-error") {
      res.status(401).send({error: "invalid_token"});
    } else {
      res.status(500).send({error: "internal_error"});
    }
  }
});
