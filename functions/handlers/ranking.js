/* eslint-disable require-jsdoc, linebreak-style, max-len */
"use strict";

const {onSchedule} = require("firebase-functions/v2/scheduler");
const {onRequest} = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitFirestore} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");
const {signReadUrl, pathFromFirebaseDownloadUrl} =
  require("../lib/storageSignedUrl");
const {
  PONTOS,
  RANKING_KEY_DESAFIO_ACERTO,
  spDateStr,
  periodIdFor,
  periodBounds,
  currentPeriodIds,
} = require("../lib/rankingScore");

const TOP_N = 10;
const SUB = "rankingPeriodos";

// =========================================================
// AGREGADOR
// =========================================================

function nomeParaCard(data, fallback) {
  const apelido = typeof data.apelidoReal === "string" ?
    data.apelidoReal.trim() : "";
  if (apelido) return apelido;
  const nome = typeof data.nome === "string" ? data.nome.trim() : "";
  const primeiro = nome ? nome.split(/\s+/)[0] : "";
  return primeiro || fallback;
}

function fotoPathDe(data) {
  if (typeof data.fotoPath === "string" && data.fotoPath.trim()) {
    return data.fotoPath.trim();
  }
  if (typeof data.fotoUrl === "string" && data.fotoUrl) {
    return pathFromFirebaseDownloadUrl(data.fotoUrl);
  }
  return null;
}

/**
 * Momentos realizados no período, agrupados por pareamento.
 *
 * Filtra por `bonusGrantedAt` porque é o único carimbo presente nos dois
 * caminhos de conclusão (processInput e o trigger legado de moments.js);
 * `dataConclusao` só existe no primeiro. O status é conferido em memória para
 * a query precisar apenas do índice de campo único.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {number} startMs
 * @param {number} endMs
 * @return {Promise<Map<string, {pontos: number, ultimoMs: number}>>}
 */
async function momentosPorPareamento(db, startMs, endMs) {
  const snap = await db.collection("tarefasMomentos")
      .where("bonusGrantedAt", ">=", admin.firestore.Timestamp.fromMillis(startMs))
      .get();

  const porPareamento = new Map();
  for (const doc of snap.docs) {
    const t = doc.data() || {};
    if (t.status !== "Realizado") continue;

    const pid = t.idPareamento || null;
    if (!pid) continue;

    const ms = t.bonusGrantedAt && typeof t.bonusGrantedAt.toMillis === "function" ?
      t.bonusGrantedAt.toMillis() : 0;
    if (!ms || ms > endMs) continue;

    const pontos = t.comFoto === true ?
      PONTOS.momentoComFoto : PONTOS.momentoSemFoto;

    const atual = porPareamento.get(pid) || {pontos: 0, ultimoMs: 0};
    atual.pontos += pontos;
    atual.ultimoMs = Math.max(atual.ultimoMs, ms);
    porPareamento.set(pid, atual);
  }
  return porPareamento;
}

/**
 * Pontos de clima: 5 por pessoa por dia. Lê `climaDiario`, não o extrato — o
 * extrato só registra quando o humor altera foguinhos (`delta !== 0`), então
 * quem marca "Normal" fez o check-in e não apareceria lá.
 * @param {FirebaseFirestore.DocumentReference} pareamentoRef
 * @param {{startDateStr: string, endDateStr: string}} bounds
 * @param {string[]} membros
 * @return {Promise<{pontos: number, ultimoMs: number}>}
 */
async function pontosClima(pareamentoRef, bounds, membros) {
  const snap = await pareamentoRef.collection("climaDiario")
      .where(admin.firestore.FieldPath.documentId(), ">=", bounds.startDateStr)
      .where(admin.firestore.FieldPath.documentId(), "<=", bounds.endDateStr)
      .get();

  let pontos = 0;
  let ultimoMs = 0;
  for (const doc of snap.docs) {
    const dia = doc.data() || {};
    for (const uid of membros) {
      const registro = dia[uid];
      if (!registro) continue;
      pontos += PONTOS.climaPorPessoaPorDia;
      const ms = registro.registradoEm &&
        typeof registro.registradoEm.toMillis === "function" ?
        registro.registradoEm.toMillis() : 0;
      ultimoMs = Math.max(ultimoMs, ms);
    }
  }
  return {pontos, ultimoMs};
}

/**
 * Acertos de desafio no período. Cada acerto grava duas entradas de extrato
 * (uma por pessoa) com o mesmo `rankingEventoId`, então contamos eventos
 * distintos, não lançamentos.
 * @param {FirebaseFirestore.DocumentReference} pareamentoRef
 * @param {number} startMs
 * @param {number} endMs
 * @return {Promise<{pontos: number, ultimoMs: number}>}
 */
async function pontosDesafios(pareamentoRef, startMs, endMs) {
  // Só igualdade na query: acertos são poucos (2 por semana no máximo), então
  // recortar o período em memória evita exigir um índice composto.
  const snap = await pareamentoRef.collection("extrato")
      .where("rankingKey", "==", RANKING_KEY_DESAFIO_ACERTO)
      .get();

  const eventos = new Set();
  let ultimoMs = 0;
  snap.docs.forEach((doc, i) => {
    const e = doc.data() || {};
    const ms = Number(e.createdAtMs) || 0;
    if (ms < startMs || ms > endMs) return;
    eventos.add(e.rankingEventoId || `${doc.id}_${i}`);
    ultimoMs = Math.max(ultimoMs, ms);
  });

  return {pontos: eventos.size * PONTOS.desafioAcerto, ultimoMs};
}

async function agregarPeriodo(db, period, periodId, momentos, hoje) {
  const bounds = periodBounds(periodId);
  const pareamentosSnap = await db.collection("pareamentos").get();

  const linhas = [];
  for (const doc of pareamentosSnap.docs) {
    const p = doc.data() || {};
    const uidA = p.pessoa1Uid || null;
    const uidB = p.pessoa2Uid || null;
    if (!uidA || !uidB) continue;

    const membros = [uidA, uidB];
    const doMomento = momentos.get(doc.id) || {pontos: 0, ultimoMs: 0};

    let clima = {pontos: 0, ultimoMs: 0};
    let desafios = {pontos: 0, ultimoMs: 0};
    try {
      [clima, desafios] = await Promise.all([
        pontosClima(doc.ref, bounds, membros),
        pontosDesafios(doc.ref, bounds.startMs, bounds.endMs),
      ]);
    } catch (err) {
      console.error("aggregateRanking: falha ao somar", doc.id, err);
      continue;
    }

    const pontos = doMomento.pontos + clima.pontos + desafios.pontos;
    if (pontos <= 0) continue;

    linhas.push({
      ref: doc.ref.collection(SUB).doc(periodId),
      pareamentoId: doc.id,
      uidA,
      uidB,
      pontos,
      ultimoPontoEmMs: Math.max(
          doMomento.ultimoMs, clima.ultimoMs, desafios.ultimoMs,
      ),
    });
  }

  // Ordenação canônica: o `pos` gravado aqui é o que o getRanking consulta,
  // então o desempate fica resolvido de uma vez só.
  linhas.sort((a, b) => {
    if (b.pontos !== a.pontos) return b.pontos - a.pontos;
    if (a.ultimoPontoEmMs !== b.ultimoPontoEmMs) {
      return a.ultimoPontoEmMs - b.ultimoPontoEmMs;
    }
    return a.pareamentoId < b.pareamentoId ? -1 : 1;
  });

  if (!linhas.length) return 0;

  const perfis = await carregarPerfis(db, linhas);
  const anteriores = await db.getAll(...linhas.map((l) => l.ref));
  const escritasPendentes = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const pos = i + 1;
    const anterior = anteriores[i];
    const dadosAnteriores = anterior && anterior.exists ? anterior.data() : {};

    // Snapshot diário de posição: alimenta o deltaPos da tela.
    const virouODia = dadosAnteriores.snapshotDate !== hoje;
    const posAnterior = virouODia ?
      (Number.isFinite(dadosAnteriores.pos) ? dadosAnteriores.pos : null) :
      (Number.isFinite(dadosAnteriores.posAnterior) ?
        dadosAnteriores.posAnterior : null);

    const perfilA = perfis.get(linha.uidA) || {};
    const perfilB = perfis.get(linha.uidB) || {};

    escritasPendentes.push({
      ref: linha.ref,
      data: {
        periodId,
        period,
        pareamentoId: linha.pareamentoId,
        pontos: linha.pontos,
        pos,
        posAnterior,
        snapshotDate: hoje,
        ultimoPontoEmMs: linha.ultimoPontoEmMs,
        leftUid: linha.uidA,
        rightUid: linha.uidB,
        leftLabel: perfilA.label || "Parceiro",
        rightLabel: perfilB.label || "Parceiro",
        leftFotoPath: perfilA.fotoPath || null,
        rightFotoPath: perfilB.fotoPath || null,
        atualizadoEm: admin.firestore.FieldValue.serverTimestamp(),
      },
    });
  }

  // Batch do Firestore aceita no máximo 500 operações.
  for (let i = 0; i < escritasPendentes.length; i += 400) {
    const batch = db.batch();
    escritasPendentes.slice(i, i + 400).forEach((w) => {
      batch.set(w.ref, w.data, {merge: true});
    });
    await batch.commit();
  }

  return escritasPendentes.length;
}

async function carregarPerfis(db, linhas) {
  const uids = new Set();
  linhas.forEach((l) => {
    uids.add(l.uidA);
    uids.add(l.uidB);
  });
  if (!uids.size) return new Map();

  const refs = [...uids].map((uid) => db.collection("usuarios").doc(uid));
  const snaps = await db.getAll(...refs);

  const perfis = new Map();
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const data = snap.data() || {};
    perfis.set(snap.id, {
      label: nomeParaCard(data, "Parceiro"),
      fotoPath: fotoPathDe(data),
    });
  });
  return perfis;
}

async function runAggregation() {
  const db = admin.firestore();
  const hoje = spDateStr();
  const periodos = currentPeriodIds();

  let total = 0;
  for (const period of ["semanal", "mensal"]) {
    const periodId = periodos[period];
    const {startMs, endMs} = periodBounds(periodId);
    const momentos = await momentosPorPareamento(db, startMs, endMs);
    total += await agregarPeriodo(db, period, periodId, momentos, hoje);
  }

  console.log("aggregateRanking: concluido -", total, "casal(is) pontuado(s)");
  return total;
}

exports.aggregateRanking = onSchedule({
  schedule: "*/30 * * * *",
  timeZone: "America/Sao_Paulo",
  memory: "512MiB",
  maxInstances: 1,
}, async () => {
  await runAggregation();
});

// =========================================================
// LEITURA — getRanking
// =========================================================

async function montarEntrada(doc, pos, isCaller) {
  const d = doc.data() || {};
  const [leftFotoUrl, rightFotoUrl] = await Promise.all([
    d.leftFotoPath ? signReadUrl(d.leftFotoPath) : null,
    d.rightFotoPath ? signReadUrl(d.rightFotoPath) : null,
  ]);

  const deltaPos = Number.isFinite(d.posAnterior) ?
    d.posAnterior - pos : null;

  return {
    pos,
    pontos: Number(d.pontos) || 0,
    deltaPos,
    leftLabel: d.leftLabel || "Parceiro",
    rightLabel: d.rightLabel || "Parceiro",
    leftFotoUrl,
    rightFotoUrl,
    isCaller,
  };
}

async function resolverPareamentoDoCaller(db, uid, pedido) {
  const userSnap = await db.collection("usuarios").doc(uid).get();
  if (!userSnap.exists) return null;

  const ativos = Array.isArray(userSnap.data().pareamentosAtivos) ?
    userSnap.data().pareamentosAtivos : [];
  const ids = ativos
      .map((e) => (e && typeof e.pareamentoId === "string" ?
        e.pareamentoId : null))
      .filter(Boolean);

  if (pedido && ids.includes(pedido)) return pedido;
  return ids[0] || null;
}

exports.getRanking = onRequest(async (req, res) => {
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
    keyPrefix: "getRanking",
    limit: 60,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ?
    authHeader.split("Bearer ")[1] : null;
  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const period = req.body && req.body.period === "mensal" ?
    "mensal" : "semanal";
  const pareamentoPedido = req.body &&
    typeof req.body.pareamentoId === "string" ?
    req.body.pareamentoId.trim() : null;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();

    const periodId = periodIdFor(period);
    const {endMs} = periodBounds(periodId);
    const pareamentoId =
      await resolverPareamentoDoCaller(db, uid, pareamentoPedido);

    const topSnap = await db.collectionGroup(SUB)
        .where("periodId", "==", periodId)
        .orderBy("pos", "asc")
        .limit(TOP_N)
        .get();

    const entries = await Promise.all(topSnap.docs.map((doc, i) => {
      const ehDoCaller = Boolean(pareamentoId) &&
        doc.data().pareamentoId === pareamentoId;
      return montarEntrada(doc, i + 1, ehDoCaller);
    }));

    // O casal precisa se enxergar mesmo fora do top 10.
    let caller = null;
    if (pareamentoId) {
      const noTop = entries.find((e) => e.isCaller);
      if (noTop) {
        caller = noTop;
      } else {
        const proprio = await db.collection("pareamentos").doc(pareamentoId)
            .collection(SUB).doc(periodId).get();
        if (proprio.exists) {
          caller = await montarEntrada(
              proprio, Number(proprio.data().pos) || 0, true,
          );
        }
      }
    }

    res.status(200).send({
      period,
      periodId,
      periodEndsAt: endMs,
      entries,
      caller,
    });
  } catch (err) {
    console.error("getRanking error:", err);
    res.status(500).send({error: "get_ranking_failed"});
  }
});

exports.runRankingAggregation = runAggregation;
