/* eslint-disable require-jsdoc */
const https = require("firebase-functions/v2/https");
const crypto = require("crypto");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {
  normalizeLeadText,
  normalizeLeadEmail,
  normalizeLeadPhone,
} = require("../lib/normalize");

// HTTP endpoint seguro para criar um `input` via Admin SDK.
// O cliente envia um idToken (Authorization: Bearer <token>) e o objeto
// `input` no body. A função verifica o token, valida fromUid e cria o
// documento em `inputs` com privilégios admin.
exports.joinWaitlist = https.onRequest(async (req, res) => {
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
    keyPrefix: "joinWaitlist",
    limit: 30,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const nome = normalizeLeadText(body.nome, 120);
    const email = normalizeLeadEmail(body.email);
    const telefoneWhatsapp = normalizeLeadPhone(body.telefoneWhatsapp);
    const nomeParceiro = normalizeLeadText(body.nomeParceiro, 120);
    const telefoneWhatsappParceiro = normalizeLeadPhone(
        body.telefoneWhatsappParceiro,
    );
    const cidade = normalizeLeadText(body.cidade, 80);
    const estado = normalizeLeadText(body.estado, 32).toUpperCase();
    const source = normalizeLeadText(body.source || "cadastrovip", 80);
    const utmSource = normalizeLeadText(body.utm_source, 120);
    const utmMedium = normalizeLeadText(body.utm_medium, 120);
    const utmCampaign = normalizeLeadText(body.utm_campaign, 160);

    if (!nome) {
      res.status(400).send({error: "missing_nome"});
      return;
    }
    if (!email) {
      res.status(400).send({error: "invalid_email"});
      return;
    }
    if (!telefoneWhatsapp) {
      res.status(400).send({error: "invalid_telefone_whatsapp"});
      return;
    }
    if (!nomeParceiro) {
      res.status(400).send({error: "missing_nome_parceiro"});
      return;
    }
    if (!telefoneWhatsappParceiro) {
      res.status(400).send({error: "invalid_telefone_whatsapp_parceiro"});
      return;
    }

    const db = admin.firestore();
    const dedupKey = `${email}|${telefoneWhatsapp}`;
    const leadHash = crypto.createHash("sha256")
        .update(dedupKey)
        .digest("hex")
        .slice(0, 32);
    const docId = `lead_${leadHash}`;
    const ref = db.collection("lista-de-espera").doc(docId);
    const snap = await ref.get();

    const payload = {
      nome,
      email,
      telefoneWhatsapp,
      nomeParceiro,
      telefoneWhatsappParceiro,
      cidade: cidade || null,
      estado: estado || null,
      source,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      status: "novo",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      submissions: admin.firestore.FieldValue.increment(1),
    };

    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.set(payload, {merge: true});
    res.send({ok: true, id: docId, created: !snap.exists});
  } catch (err) {
    console.error("joinWaitlist: error", err);
    res.status(500).send({error: "join_waitlist_failed"});
  }
});
