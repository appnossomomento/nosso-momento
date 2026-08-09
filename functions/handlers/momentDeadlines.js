/* eslint-disable require-jsdoc */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {admin} = require("../lib/config");
const {
  PENALIDADE_ATRASO_FOGUINHOS,
  isPastPenaltyGrace,
} = require("../lib/momentPrazo");

/**
 * Debita -5 foguinhos do executor quando Pendente passou dataLimite + 24h.
 * Idempotente via penalidadeAplicadaAt.
 */
exports.applyMomentDeadlinePenalties = onSchedule({
  schedule: "0 * * * *",
  timeZone: "America/Sao_Paulo",
  memory: "256MiB",
  cpu: 0.083,
  maxInstances: 1,
}, async () => {
  const db = admin.firestore();
  const now = new Date();
  const cutoff = admin.firestore.Timestamp.fromDate(
      new Date(now.getTime() - 24 * 60 * 60 * 1000),
  );

  const snap = await db.collection("tarefasMomentos")
      .where("status", "==", "Pendente")
      .where("dataLimite", "<=", cutoff)
      .limit(200)
      .get();

  let applied = 0;
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    if (data.penalidadeAplicadaAt) continue;
    if (!data.dataLimite || !isPastPenaltyGrace(data.dataLimite, now)) continue;
    const executorUid = data.executadoPorUid;
    if (!executorUid) continue;

    const tarefaRef = doc.ref;
    const pareamentoId = data.idPareamento || null;

    try {
      await db.runTransaction(async (tx) => {
        const tSnap = await tx.get(tarefaRef);
        if (!tSnap.exists) return;
        const t = tSnap.data() || {};
        if (t.status !== "Pendente") return;
        if (t.penalidadeAplicadaAt) return;
        if (!t.dataLimite || !isPastPenaltyGrace(t.dataLimite, now)) return;
        const execUid = t.executadoPorUid;
        if (!execUid) return;

        const uRef = db.collection("usuarios").doc(execUid);
        const uSnap = await tx.get(uRef);
        if (!uSnap.exists) return;
        const uData = uSnap.data() || {};
        const saldo = typeof uData.foguinhos === "number" ? uData.foguinhos : 0;
        const novoSaldo = Math.max(0, saldo - PENALIDADE_ATRASO_FOGUINHOS);

        tx.update(uRef, {foguinhos: novoSaldo});

        tx.update(tarefaRef, {
          penalidadeAplicadaAt:
            admin.firestore.FieldValue.serverTimestamp(),
          penalidadeValor: PENALIDADE_ATRASO_FOGUINHOS,
        });

        if (pareamentoId || t.idPareamento) {
          const pid = pareamentoId || t.idPareamento;
          const extratoRef = db.collection("pareamentos").doc(pid)
              .collection("extrato").doc();
          tx.set(extratoRef, {
            tipo: "penalidade_atraso_momento",
            descricao:
              // eslint-disable-next-line max-len
              `Penalidade: atraso em "${t.momentoNome || "momento"}" (−${PENALIDADE_ATRASO_FOGUINHOS})`,
            valor: -PENALIDADE_ATRASO_FOGUINHOS,
            beneficiarioUid: execUid,
            autorUid: "system",
            autorNome: "Sistema",
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            createdAtMs: Date.now(),
            tarefaId: doc.id,
          });
        }

        const nomeMomento = t.momentoNome || "momento";
        const notifExec = db.collection("notificacoes").doc();
        tx.set(notifExec, {
          userId: execUid,
          titulo: "Prazo estourado 😬",
          // eslint-disable-next-line max-len
          mensagem: `Você perdeu ${PENALIDADE_ATRASO_FOGUINHOS} foguinhos pelo atraso em "${nomeMomento}".`,
          icone: "fa-clock",
          tipo: "momento_penalidade",
          redirectTo: "momentos",
          lida: false,
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
        });

        const resgatanteUid = t.resgatadoPorUid;
        if (resgatanteUid && resgatanteUid !== execUid) {
          const notifRes = db.collection("notificacoes").doc();
          tx.set(notifRes, {
            userId: resgatanteUid,
            titulo: "Momento atrasado",
            // eslint-disable-next-line max-len
            mensagem: `${uData.nome || "Seu par"} perdeu ${PENALIDADE_ATRASO_FOGUINHOS} foguinhos pelo atraso em "${nomeMomento}".`,
            icone: "fa-clock",
            tipo: "momento_penalidade",
            redirectTo: "momentos",
            lida: false,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      });
      applied++;
    } catch (err) {
      console.error(
          "applyMomentDeadlinePenalties: erro",
          doc.id,
          err && err.message,
      );
    }
  }

  console.log(
      "applyMomentDeadlinePenalties: done",
      {scanned: snap.size, applied},
  );
});
