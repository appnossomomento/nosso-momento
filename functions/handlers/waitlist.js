/* eslint-disable require-jsdoc, linebreak-style, max-len */
const https = require("firebase-functions/v2/https");
const crypto = require("crypto");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitFirestore} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {
  normalizeLeadText,
  normalizeLeadEmail,
  normalizeLeadPhone,
} = require("../lib/normalize");

const WAITLIST_META = Number(process.env.WAITLIST_META || "50") || 50;

/**
 * HTTP público (sem login) protegido por App Check + rate limit Firestore.
 * POST: cria/atualiza lead em lista-de-espera
 * GET ?action=count: contador de casais (para a LP)
 */
exports.joinWaitlist = https.onRequest(async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (await requireAppCheck(req, res)) {
    return;
  }

  if (req.method === "GET") {
    if (await rateLimitFirestore(req, res, {
      keyPrefix: "joinWaitlistCount",
      limit: 60,
      windowMs: 60 * 1000,
    })) {
      return;
    }
    const action = String(req.query.action || "");
    if (action !== "count") {
      res.status(400).send({error: "invalid_action"});
      return;
    }
    try {
      const snap = await admin.firestore().collection("lista-de-espera").count()
          .get();
      const count = snap.data().count || 0;
      res.send({ok: true, count, meta: WAITLIST_META});
    } catch (err) {
      console.error("joinWaitlist count: error", err);
      res.status(500).send({error: "count_failed"});
    }
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (await rateLimitFirestore(req, res, {
    keyPrefix: "joinWaitlist",
    limit: 20,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Aliases da LP (cadastrovip.html) + contrato antigo da CF
    const nome = normalizeLeadText(body.nome, 120);
    const email = normalizeLeadEmail(body.email);
    const telefoneWhatsapp = normalizeLeadPhone(
        body.telefoneWhatsapp || body.whatsapp,
    );
    const nomeParceiro = normalizeLeadText(
        body.nomeParceiro || body.parceiro_nome, 120,
    );
    const telefoneWhatsappParceiro = normalizeLeadPhone(
        body.telefoneWhatsappParceiro || body.whatsappParceiro || "",
    );
    let cidade = normalizeLeadText(body.cidade, 80);
    let estado = normalizeLeadText(body.estado, 32).toUpperCase();
    const cidadeEstado = normalizeLeadText(
        body.cidadeEstado || body.cidade_estado, 120,
    );
    if (cidadeEstado && (!cidade || !estado)) {
      const parts = cidadeEstado.split("/").map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        cidade = cidade || normalizeLeadText(parts.slice(0, -1).join("/"), 80);
        estado = estado || normalizeLeadText(parts[parts.length - 1], 32)
            .toUpperCase();
      } else if (parts.length === 1) {
        cidade = cidade || parts[0];
      }
    }
    const source = normalizeLeadText(
        body.source || body.origem || "cadastrovip", 80,
    );
    const utmSource = normalizeLeadText(body.utm_source, 120);
    const utmMedium = normalizeLeadText(body.utm_medium, 120);
    const utmCampaign = normalizeLeadText(body.utm_campaign, 160);
    const utmContent = normalizeLeadText(body.utm_content, 160);
    const utmTerm = normalizeLeadText(body.utm_term, 160);
    const gclid = normalizeLeadText(body.gclid, 160);
    const fbclid = normalizeLeadText(body.fbclid, 160);
    const landingUrl = normalizeLeadText(body.landing_url || body.landingUrl, 500);
    const consentimento = !!(body.consent || body.consentimento);

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
    if (!consentimento) {
      res.status(400).send({error: "missing_consent"});
      return;
    }

    // Honeypot / timing (espelha LP)
    const honeypot = normalizeLeadText(body.website, 80);
    if (honeypot) {
      res.send({ok: true, id: "ignored", created: false});
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
      telefoneWhatsappParceiro: telefoneWhatsappParceiro || null,
      cidade: cidade || null,
      estado: estado || null,
      cidadeEstado: cidadeEstado || null,
      source,
      origem: source,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      utm_content: utmContent || null,
      utm_term: utmTerm || null,
      gclid: gclid || null,
      fbclid: fbclid || null,
      landing_url: landingUrl || null,
      consentimento: true,
      consentimentoAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "novo",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      submissions: admin.firestore.FieldValue.increment(1),
    };

    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.set(payload, {merge: true});

    // Sync opcional com Sheets (secrets só no servidor)
    forwardToSheets({
      nome,
      email,
      whatsapp: telefoneWhatsapp,
      parceiro_nome: nomeParceiro,
      cidade_estado: cidadeEstado || [cidade, estado].filter(Boolean).join("/"),
      origem: source,
      consent: "sim",
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_content: utmContent,
      utm_term: utmTerm,
      gclid,
      fbclid,
      landing_url: landingUrl,
    }).catch((err) => {
      console.warn("joinWaitlist: sheets forward failed", err && err.message);
    });

    res.send({ok: true, id: docId, created: !snap.exists});
  } catch (err) {
    console.error("joinWaitlist: error", err);
    res.status(500).send({error: "join_waitlist_failed"});
  }
});

async function forwardToSheets(dados) {
  const endpoint = (process.env.LP_SHEETS_ENDPOINT || "").trim();
  const token = (process.env.LP_FORM_TOKEN || "").trim();
  if (!endpoint || !token) return;
  await fetch(endpoint, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({...dados, token}),
  });
}
