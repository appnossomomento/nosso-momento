/* eslint-disable require-jsdoc */
"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {admin} = require("../lib/config");

// =========================================================
// LEMBRETE DIÁRIO DE HUMOR
// Roda às 23h30 (horário de Brasília).
// Para cada pareamento ativo, envia notificação push para
// os membros que ainda não registraram o humor hoje.
// Usa o pipeline existente: cria doc em `notificacoes/`
// e o trigger enviarNotificacaoPush entrega o push.
// =========================================================

const TITULO = "Como foi o seu dia? 💛";
const MENSAGEM = "Não esqueça de registrar seu humor antes de dormir.";

/**
 * Retorna true se dois Timestamps/Dates são o mesmo dia calendário
 * no fuso America/Sao_Paulo.
 * @param {*} tsA - Firestore Timestamp ou Date
 * @param {*} tsB - Firestore Timestamp ou Date
 * @return {boolean}
 */
function isSameCalendarDay(tsA, tsB) {
  const toSPDate = (ts) => {
    const d = (ts && typeof ts.toDate === "function") ?
      ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });
  };
  return toSPDate(tsA) === toSPDate(tsB);
}

exports.lembreteHumorDiario = onSchedule(
    {
      schedule: "30 23 * * *",
      timeZone: "America/Sao_Paulo",
      region: "southamerica-east1",
      memory: "256MiB",
      timeoutSeconds: 300,
    },
    async () => {
      const db = admin.firestore();
      const now = admin.firestore.Timestamp.now();
      const FS = admin.firestore.FieldValue;

      const pareamentosSnap = await db.collection("pareamentos").get();

      let enviados = 0;
      let semToken = 0;
      let jaRegistrou = 0;

      for (const doc of pareamentosSnap.docs) {
        const data = doc.data() || {};
        const uidA = data.pessoa1Uid || null;
        const uidB = data.pessoa2Uid || null;

        if (!uidA || !uidB) continue;

        const climaHoje = data.climaHoje || {};

        const pendentes = [uidA, uidB].filter((uid) => {
          const registro = climaHoje[uid];
          if (!registro || !registro.registradoEm) return true;
          const jaHoje = isSameCalendarDay(registro.registradoEm, now);
          if (jaHoje) jaRegistrou += 1;
          return !jaHoje;
        });

        for (const uid of pendentes) {
          // Verifica se o usuário tem tokens antes de criar o doc
          const tokensDoc = await db
              .collection("userNotificationTokens")
              .doc(uid)
              .get();

          const docData = tokensDoc.exists ? (tokensDoc.data() || {}) : {};
          const tokens = Array.isArray(docData.tokens) ?
            docData.tokens.filter((t) => typeof t === "string" && t.length) :
            [];

          if (!tokens.length) {
            semToken += 1;
            continue;
          }

          // Cria documento em notificacoes/ → aciona enviarNotificacaoPush
          await db.collection("notificacoes").add({
            userId: uid,
            titulo: TITULO,
            mensagem: MENSAGEM,
            tipo: "lembrete_humor",
            criadoEm: FS.serverTimestamp(),
          });

          enviados += 1;
        }
      }

      console.log("lembreteHumorDiario:concluido", {
        pareamentos: pareamentosSnap.size,
        enviados,
        jaRegistrou,
        semToken,
      });
    },
);
