/* eslint-disable require-jsdoc */
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitFirestore} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {deleteUserAccount} = require("../lib/deleteAccount");

// =========================================================
// Propaga alteração de nome/foto do usuário para
// pareamentosAtivos dos parceiros
// Nome: só atualiza se o parceiro NÃO definiu apelido
// Foto: atualiza sempre
// =========================================================
exports.propagateProfileChange = onDocumentUpdated(
    "usuarios/{userId}",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();
      if (!before || !after) return;

      const nameChanged = before.nome !== after.nome;
      const photoChanged = (before.fotoUrl || "") !== (after.fotoUrl || "");
      if (!nameChanged && !photoChanged) return;

      const userId = event.params.userId;
      const newName = after.nome || "";
      const newPhoto = after.fotoUrl || "";
      const db = admin.firestore();

      const ativos = Array.isArray(after.pareamentosAtivos) ?
        after.pareamentosAtivos : [];
      if (!ativos.length) return;

      const partnerUids = ativos
          .map((p) => p.uid)
          .filter((uid) => uid && uid !== userId);

      let updated = 0;
      for (const partnerUid of partnerUids) {
        try {
          const partnerRef = db.collection("usuarios").doc(partnerUid);
          const partnerDoc = await partnerRef.get();
          if (!partnerDoc.exists) continue;

          const partnerData = partnerDoc.data();
          const partnerAtivos = Array.isArray(partnerData.pareamentosAtivos) ?
            partnerData.pareamentosAtivos : [];

          let changed = false;
          const updatedAtivos = partnerAtivos.map((entry) => {
            if (entry.uid !== userId) return entry;
            const updates = {};
            // Foto: atualiza sempre
            if (photoChanged && (entry.fotoUrl || "") !== newPhoto) {
              updates.fotoUrl = newPhoto;
            }
            // Nome: só se não tiver apelido
            if (nameChanged &&
                !(entry.apelido && entry.apelido.trim()) &&
                entry.nome !== newName) {
              updates.nome = newName;
            }
            if (!Object.keys(updates).length) return entry;
            changed = true;
            return {...entry, ...updates};
          });

          if (changed) {
            await partnerRef.update({pareamentosAtivos: updatedAtivos});
            updated++;
          }
        } catch (err) {
          console.error(
              "propagateProfileChange: erro ao atualizar parceiro",
              partnerUid, err,
          );
        }
      }

      if (updated) {
        console.log(
            "propagateProfileChange:", userId,
            nameChanged ? "nome=" + JSON.stringify(newName) : "",
            photoChanged ? "foto alterada" : "",
            "-", updated, "parceiro(s) atualizado(s)",
        );
      }
    },
);

/**
 * LGPD Art. 18 — exclusão completa da conta via Admin SDK.
 * POST /excluirConta  Authorization: Bearer <idToken>
 */
exports.excluirConta = https.onRequest(async (req, res) => {
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

  if (await rateLimitFirestore(req, res, {
    keyPrefix: "excluirConta",
    limit: 3,
    windowMs: 60 * 60 * 1000,
  })) {
    return;
  }

  const authHeader =
    req.get("Authorization") || req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ?
    authHeader.split("Bearer ")[1] :
    null;

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const summary = await deleteUserAccount({
      db: admin.firestore(),
      auth: admin.auth(),
      storage: admin.storage(),
      FieldValue: admin.firestore.FieldValue,
    }, uid);

    console.log("excluirConta: conta removida", uid, summary);
    res.status(200).json({ok: true, ...summary});
  } catch (err) {
    console.error("excluirConta: erro", err);
    res.status(500).send({error: "delete_account_failed"});
  }
});

/**
 * LGPD Art. 18 — portabilidade: export JSON dos dados do usuário.
 * POST /exportarMeusDados
 */
exports.exportarMeusDados = https.onRequest({
  region: "southamerica-east1",
  memory: "256MiB",
  maxInstances: 5,
  cpu: 0.5,
}, async (req, res) => {
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
    keyPrefix: "exportarMeusDados",
    limit: 5,
    windowMs: 60 * 60 * 1000,
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
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();

    const userSnap = await db.collection("usuarios").doc(uid).get();
    const perfil = userSnap.exists ? userSnap.data() : null;
    // Não exportar tokens sensíveis
    if (perfil) {
      delete perfil.fcmTokens;
    }

    const memoriasSnap = await db.collection("memorias")
        .where("pairUids", "array-contains", uid).limit(500).get();
    const memorias = memoriasSnap.docs.map((d) => {
      const data = d.data() || {};
      return {
        id: d.id,
        momentoNome: data.momentoNome || null,
        fotoPath: data.fotoPath || null,
        createdAtMs: data.createdAtMs || null,
        pareamentoId: data.pareamentoId || null,
        descricao: data.descricao || null,
      };
    });

    const email = perfil && typeof perfil.email === "string" ?
      perfil.email.trim().toLowerCase() : "";
    const phone = perfil && typeof perfil.telefone === "string" ?
      String(perfil.telefone).replace(/\D/g, "") : "";

    let waitlist = [];
    if (email) {
      const w = await db.collection("lista-de-espera")
          .where("email", "==", email).limit(20).get();
      waitlist = w.docs.map((d) => ({id: d.id, ...d.data()}));
    }
    if (!waitlist.length && phone) {
      const w = await db.collection("lista-de-espera")
          .where("telefoneWhatsapp", "==", phone).limit(20).get();
      waitlist = w.docs.map((d) => ({id: d.id, ...d.data()}));
    }

    const surveysSnap = await db.collection("surveyResponses")
        .where("userId", "==", uid).limit(100).get();
    const surveys = surveysSnap.docs.map((d) => ({id: d.id, ...d.data()}));

    res.send({
      exportedAt: new Date().toISOString(),
      uid,
      perfil,
      pareamentosAtivos: Array.isArray(perfil && perfil.pareamentosAtivos) ?
        perfil.pareamentosAtivos : [],
      memorias,
      waitlist,
      surveys,
      note: "Arquivos de mídia não são embutidos; paths estão em memorias[].fotoPath.",
    });
  } catch (err) {
    console.error("exportarMeusDados: erro", err);
    res.status(500).send({error: "export_failed"});
  }
});
