/* eslint-disable require-jsdoc */
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {admin} = require("../lib/config");

// =========================================================
// MILESTONE MENSAL – a cada mês completo juntos:
//   +5 foguinhos para cada um + notificação comemorativa
// Roda diariamente às 10h (horário de Brasília)
// =========================================================
exports.checkMonthlyMilestones = onSchedule({
  schedule: "0 10 * * *",
  timeZone: "America/Sao_Paulo",
}, async () => {
  const db = admin.firestore();
  const nowDate = new Date();
  let awarded = 0;

  const pareamentosSnap = await db.collection("pareamentos").get();

  for (const doc of pareamentosSnap.docs) {
    const data = doc.data() || {};
    const uidA = data.pessoa1Uid || null;
    const uidB = data.pessoa2Uid || null;
    const dataPareamento = data.dataPareamento;

    if (!uidA || !uidB || !dataPareamento) continue;

    // Converte Timestamp Firestore para Date
    let startDate;
    if (dataPareamento && typeof dataPareamento.toDate === "function") {
      startDate = dataPareamento.toDate();
    } else {
      startDate = new Date(dataPareamento);
    }
    if (isNaN(startDate.getTime())) continue;

    // Calcula meses completos considerando o dia do mês
    const yearsDiff =
      nowDate.getFullYear() - startDate.getFullYear();
    const rawMonths =
      yearsDiff * 12 + (nowDate.getMonth() - startDate.getMonth());
    const totalMonths = nowDate.getDate() >= startDate.getDate() ?
      rawMonths :
      rawMonths - 1;

    if (totalMonths < 1) continue;

    // Milestones já premiados neste pareamento
    const awardedMonths = Array.isArray(data.milestonesMeses) ?
      data.milestonesMeses : [];

    const newMonths = [];
    for (let m = 1; m <= totalMonths; m++) {
      if (!awardedMonths.includes(m)) newMonths.push(m);
    }
    if (newMonths.length === 0) continue;

    for (const mes of newMonths) {
      const mesLabel = mes === 1 ?
        "1 mês juntos" :
        `${mes} meses juntos`;
      const nowMsLocal = Date.now();

      const extA = doc.ref.collection("extrato").doc();
      const extB = doc.ref.collection("extrato").doc();
      const notifA = db.collection("notificacoes").doc();
      const notifB = db.collection("notificacoes").doc();
      const nowTs = admin.firestore.FieldValue.serverTimestamp();

      try {
        await db.runTransaction(async (tx) => {
          // Idempotência: relê o doc dentro da transação
          const pairSnap = await tx.get(doc.ref);
          if (!pairSnap.exists) return;
          const latestAwarded =
            Array.isArray(pairSnap.data().milestonesMeses) ?
              pairSnap.data().milestonesMeses : [];
          if (latestAwarded.includes(mes)) return;

          // ++ Foguinhos nos docs de usuário
          tx.update(db.collection("usuarios").doc(uidA), {
            foguinhos: admin.firestore.FieldValue.increment(5),
          });
          tx.update(db.collection("usuarios").doc(uidB), {
            foguinhos: admin.firestore.FieldValue.increment(5),
          });

          // ++ Foguinhos no doc de pareamento (saldo por conexão)
          tx.update(doc.ref, {
            foguinhos_pessoa1:
              admin.firestore.FieldValue.increment(5),
            foguinhos_pessoa2:
              admin.firestore.FieldValue.increment(5),
            milestonesMeses:
              admin.firestore.FieldValue.arrayUnion(mes),
          });

          // Extrato para cada um
          const descricao =
            `ðŸŽ‰ ${mesLabel} juntos! BÃ´nus comemorativo`;
          tx.set(extA, {
            tipo: "bonus",
            descricao,
            valor: 5,
            beneficiarioUid: uidA,
            autorUid: "system",
            autorNome: "Nosso Momento",
            timestamp: nowTs,
            createdAtMs: nowMsLocal,
          });
          tx.set(extB, {
            tipo: "bonus",
            descricao,
            valor: 5,
            beneficiarioUid: uidB,
            autorUid: "system",
            autorNome: "Nosso Momento",
            timestamp: nowTs,
            createdAtMs: nowMsLocal + 1,
          });

          // Notificações – disparam push via enviarNotificacaoPush
          const titulo = `${mesLabel} juntos!`;
          const mensagem =
            "Parabens! Mais um mes de uniao. " +
            "Os dois ganharam 5 foguinhos como presente.";
          tx.set(notifA, {
            userId: uidA,
            titulo,
            mensagem,
            icone: "fa-heart",
            tipo: "milestone",
            lida: false,
            timestamp: nowTs,
          });
          tx.set(notifB, {
            userId: uidB,
            titulo,
            mensagem,
            icone: "fa-heart",
            tipo: "milestone",
            lida: false,
            timestamp: nowTs,
          });
        });

        awarded++;
        console.log(
            "checkMonthlyMilestones: premiado",
            mes, "mes(es) - pareamento", doc.id,
        );
      } catch (err) {
        console.error(
            "checkMonthlyMilestones: erro no pareamento",
            doc.id, "mês", mes, err,
        );
      }
    }
  }

  console.log(
      "checkMonthlyMilestones: concluido -",
      awarded, "milestone(s) premiado(s)",
  );
});
