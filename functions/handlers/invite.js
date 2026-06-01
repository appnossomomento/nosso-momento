/* eslint-disable require-jsdoc */
"use strict";

const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {
  setCorsHeaders, rateLimitHttp, rateLimitFirestore,
} = require("../lib/http");
const crypto = require("crypto");

const CONVITE_URL_BASE = "https://nossomomento.app";
const CONVITE_TTL_MS = 48 * 60 * 60 * 1000; // 48 horas

/**
 * Gera um link de convite único para um usuário autenticado convidar
 * seu par para o app. O token é válido por 48h e só pode ser usado
 * uma vez (usado: false → true ao aceitar).
 *
 * POST /gerarConvite
 * Authorization: Bearer <idToken>
 * → 200 { token: string, url: string }
 */
exports.gerarConvite = https.onRequest(async (req, res) => {
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
    keyPrefix: "gerarConvite",
    limit: 5,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader =
    req.get("Authorization") || req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ?
    authHeader.split("Bearer ")[1] : null;

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  let decoded;
  try {
    decoded = await admin.auth().verifyIdToken(idToken);
  } catch (_) {
    res.status(401).send({error: "invalid_token"});
    return;
  }

  const uid = decoded.uid;
  const db = admin.firestore();

  const userSnap = await db.collection("usuarios").doc(uid).get();
  if (!userSnap.exists) {
    res.status(404).send({error: "user_not_found"});
    return;
  }

  const token = crypto.randomBytes(20).toString("hex");
  const expiraEm = new Date(Date.now() + CONVITE_TTL_MS);

  await db.collection("convites").doc(token).set({
    senderUid: uid,
    expiraEm: admin.firestore.Timestamp.fromDate(expiraEm),
    usado: false,
    criadoEm: admin.firestore.FieldValue.serverTimestamp(),
  });

  const url = `${CONVITE_URL_BASE}?convite=${token}`;
  res.status(200).json({token, url});
});

/**
 * Verifica se um usuário com o telefone informado existe no banco.
 * Usado pelo frontend antes de enviar uma solicitação de pareamento,
 * evitando que clientes consultem a coleção diretamente.
 *
 * POST /verificarTelefone
 * Authorization: Bearer <idToken>
 * Body: { telefone: "11999999999" }
 * → 202 { ok: true } sempre (resposta neutra, anti-enumeracao
 * de telefones)
 *
 * SEGURANCA: nunca retorna se o numero existe ou nao. O cliente deve prosseguir
 * para a solicitacao de pareamento mesmo sem confirmacao previa, e o backend
 * (processInput) rejeita a solicitacao se o destinatario nao for encontrado.
 */
exports.verificarTelefone = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  // Rate limit centralizado: 3 tentativas por minuto por IP (Firestore-backed).
  if (await rateLimitFirestore(req, res, {
    keyPrefix: "verificarTelefone",
    limit: 3,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader =
    req.get("Authorization") || req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ?
    authHeader.split("Bearer ")[1] : null;

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (_) {
    res.status(401).send({error: "invalid_token"});
    return;
  }

  const {telefone} = req.body || {};
  if (!telefone || !/^\d{11}$/.test(telefone)) {
    res.status(400).send({error: "invalid_telefone"});
    return;
  }

  // Resposta sempre neutra: nao vaza se o numero esta cadastrado.
  // A validacao real acontece dentro de processInput (Admin SDK), onde
  // a solicitacao de pareamento e rejeitada se o destinatario nao existe.
  res.status(202).json({ok: true});
});
