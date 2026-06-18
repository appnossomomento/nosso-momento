/* eslint-disable require-jsdoc, linebreak-style, max-len, valid-jsdoc */
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {areUsersPaired} = require("../lib/pairing");

function pickPublicPartnerProfile(partnerUid, data, pareamentoId) {
  const catalogo = data.catalogoPersonalizado;
  return {
    uid: partnerUid,
    nome: typeof data.nome === "string" ? data.nome : "",
    telefone: typeof data.telefone === "string" ? data.telefone : undefined,
    fotoUrl: typeof data.fotoUrl === "string" ? data.fotoUrl : undefined,
    foguinhos: typeof data.foguinhos === "number" ? data.foguinhos : undefined,
    sexo: typeof data.sexo === "string" ? data.sexo : undefined,
    catalogoPersonalizado:
      catalogo && typeof catalogo === "object" ? catalogo : {},
    pareamentoId: pareamentoId || undefined,
  };
}

exports.getParceiroPerfil = https.onRequest(async (req, res) => {
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
    keyPrefix: "getParceiroPerfil",
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

  const partnerUid =
    req.body && typeof req.body.partnerUid === "string" ?
      req.body.partnerUid.trim() :
      "";

  if (!partnerUid) {
    res.status(400).send({error: "missing_partner_uid"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    if (partnerUid === uid) {
      res.status(400).send({error: "self_partner_not_allowed"});
      return;
    }

    const db = admin.firestore();
    const [callerSnap, partnerSnap] = await Promise.all([
      db.collection("usuarios").doc(uid).get(),
      db.collection("usuarios").doc(partnerUid).get(),
    ]);

    if (!callerSnap.exists || !partnerSnap.exists) {
      res.status(404).send({error: "user_not_found"});
      return;
    }

    const callerData = callerSnap.data();
    const partnerData = partnerSnap.data();

    if (!areUsersPaired(callerData, partnerData, uid, partnerUid)) {
      res.status(403).send({error: "not_paired"});
      return;
    }

    const callerAtivos = Array.isArray(callerData.pareamentosAtivos) ?
      callerData.pareamentosAtivos :
      [];
    const entrada = callerAtivos.find((p) => p && p.uid === partnerUid);
    const pareamentoId =
      entrada && typeof entrada.pareamentoId === "string" ?
        entrada.pareamentoId :
        null;

    res.status(200).send(
        pickPublicPartnerProfile(partnerUid, partnerData, pareamentoId),
    );
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    console.error("[getParceiroPerfil]", message);
    res.status(500).send({error: "internal_error"});
  }
});
