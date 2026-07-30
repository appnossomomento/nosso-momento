/* eslint-disable require-jsdoc, linebreak-style */
"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {admin} = require("../lib/config");
const {
  saoPauloDateString,
  saoPauloYesterdayString,
  saoPauloAnteontemString,
  casalEmRiscoDeChama,
} = require("../lib/chamaRisk");

// =========================================================
// FUNIL DE LEMBRETES DIÁRIOS DE HUMOR
//
// Três disparos por dia (horário de Brasília):
//   08h00 — lembreteHumorManha
//   13h00 — lembreteHumorAlmoco
//   23h30 — lembreteHumorNoite
//
// Cada um só notifica usuários que ainda não registraram
// o humor hoje. Quem registrou após o lembrete da manhã
// não recebe os seguintes.
//
// Pipeline: cria doc em `notificacoes/` →
//           trigger enviarNotificacaoPush → FCM push.
// =========================================================

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

/**
 * Lógica central: itera pareamentos e envia notificação push
 * para cada usuário que ainda não registrou o humor hoje.
 * @param {string} titulo - Título da notificação
 * @param {string} mensagem - Corpo da notificação
 * @param {string} logTag - Tag para identificar o disparo no log
 * @return {Promise<void>}
 */
async function enviarLembretes(titulo, mensagem, logTag) {
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

      await db.collection("notificacoes").add({
        userId: uid,
        titulo,
        mensagem,
        tipo: "lembrete_humor",
        icone: "fa-thermometer-half",
        lida: false,
        timestamp: FS.serverTimestamp(),
        criadoEm: FS.serverTimestamp(),
      });

      enviados += 1;
    }
  }

  console.log(`${logTag}:concluido`, {
    pareamentos: pareamentosSnap.size,
    enviados,
    jaRegistrou,
    semToken,
  });
}

const SCHEDULE_OPTS = {
  timeZone: "America/Sao_Paulo",
  region: "southamerica-east1",
  memory: "256MiB",
  timeoutSeconds: 300,
};

// ── 08h00 BRT ────────────────────────────────────────────
exports.lembreteHumorManha = onSchedule(
    {...SCHEDULE_OPTS, schedule: "0 8 * * *"},
    () => enviarLembretes(
        "Como você acordou hoje? ☀️",
        "Registre seu humor agora e comece o dia.",
        "lembreteHumorManha",
    ),
);

// ── 13h00 BRT ────────────────────────────────────────────
exports.lembreteHumorAlmoco = onSchedule(
    {...SCHEDULE_OPTS, schedule: "0 13 * * *"},
    () => enviarLembretes(
        "Hora do almoço! 🍽️",
        "Aproveite a pausa para registrar como está seu humor.",
        "lembreteHumorAlmoco",
    ),
);

// ── 23h30 BRT ────────────────────────────────────────────
exports.lembreteHumorNoite = onSchedule(
    {...SCHEDULE_OPTS, schedule: "30 23 * * *"},
    () => enviarLembretes(
        "Como foi o seu dia? 💛",
        "Não esqueça de registrar seu humor antes de dormir.",
        "lembreteHumorNoite",
    ),
);

/**
 * 00:01 BRT — Dia 3 da jornada: casal marcou no Dia 1, pulou o Dia 2.
 * Push "A chama está apagando!". Reset cinza só no Dia 4 (client).
 * @return {Promise<void>}
 */
async function enviarAlertaChamaApagando() {
  const db = admin.firestore();
  const FS = admin.firestore.FieldValue;
  const todayKey = saoPauloDateString();
  const yesterdayKey = saoPauloYesterdayString();
  const anteontemKey = saoPauloAnteontemString();
  const logTag = "alertaChamaApagando";

  const pareamentosSnap = await db.collection("pareamentos").get();
  let enviados = 0;
  let casaisEmRisco = 0;
  let semToken = 0;
  let ignorados = 0;

  for (const doc of pareamentosSnap.docs) {
    const data = doc.data() || {};
    const uidA = data.pessoa1Uid || null;
    const uidB = data.pessoa2Uid || null;
    if (!uidA || !uidB) {
      ignorados += 1;
      continue;
    }

    const climaHoje = data.climaHoje || {};
    if (!casalEmRiscoDeChama(
        climaHoje, uidA, uidB, anteontemKey, yesterdayKey,
    )) {
      ignorados += 1;
      continue;
    }

    casaisEmRisco += 1;

    for (const uid of [uidA, uidB]) {
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

      await db.collection("notificacoes").add({
        userId: uid,
        titulo: "A chama está apagando!",
        mensagem: "Marquem o humor hoje para manter a sequência acesa.",
        tipo: "chama_apagando",
        icone: "fa-fire",
        redirectTo: "perfilParceiro",
        lida: false,
        timestamp: FS.serverTimestamp(),
        criadoEm: FS.serverTimestamp(),
      });
      enviados += 1;
    }
  }

  console.log(`${logTag}:concluido`, {
    todayKey,
    yesterdayKey,
    anteontemKey,
    pareamentos: pareamentosSnap.size,
    casaisEmRisco,
    enviados,
    semToken,
    ignorados,
  });
}

// ── 00:01 BRT — risco da sequência do casal ──────────────
exports.alertaChamaApagando = onSchedule(
    {...SCHEDULE_OPTS, schedule: "1 0 * * *"},
    () => enviarAlertaChamaApagando(),
);
