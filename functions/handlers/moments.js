/* eslint-disable require-jsdoc */
const {onDocumentUpdated} = require("firebase-functions/v2/firestore");
const {admin} = require("../lib/config");

exports.handleMomentTaskUpdate = onDocumentUpdated(
    "tarefasMomentos/{taskId}",
    async (event) => {
      const beforeSnap = event.data && event.data.before;
      const afterSnap = event.data && event.data.after;

      if (!beforeSnap || !afterSnap) {
        console.log("handleMomentTaskUpdate: snapshots ausentes");
        return;
      }

      const beforeData = beforeSnap.data();
      const afterData = afterSnap.data();
      if (!beforeData || !afterData) {
        console.log("handleMomentTaskUpdate: dados ausentes");
        return;
      }

      if (beforeData.status === afterData.status) {
        return;
      }

      if (afterData.status !== "Realizado") {
        return;
      }

      const taskId = event.params && event.params.taskId;
      if (!taskId) {
        console.log("handleMomentTaskUpdate: taskId ausente");
        return;
      }

      const taskRef = admin
          .firestore()
          .collection("tarefasMomentos")
          .doc(taskId);

      try {
        await admin.firestore().runTransaction(async (tx) => {
          const taskSnap = await tx.get(taskRef);
          if (!taskSnap.exists) {
            return;
          }

          const taskData = taskSnap.data() || {};
          if (taskData.status !== "Realizado") {
            return;
          }

          // Recompensa agora gerenciada pelo processInput (moment_complete).
          // Se bonusGrantedAt já existe, o processInput já concedeu
          // — evita dupla contagem.
          if (taskData.bonusGrantedAt) {
            return;
          }

          const executeUid = taskData.executadoPorUid;
          // Sem recompensa por esta rota (fallback legacy sem foto).
          const rewardAmount = 0;

          if (!executeUid || rewardAmount <= 0) {
            tx.update(taskRef, {
              bonusGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
              bonusAmount: 0,
            });
            return;
          }

          const executeRef = admin
              .firestore()
              .collection("usuarios")
              .doc(executeUid);

          const nowTs = admin.firestore.Timestamp.now();

          tx.update(executeRef, {
            foguinhos: admin.firestore.FieldValue.increment(rewardAmount),
          });

          // --- Extrato: bônus de tarefa concluída ---
          const taskPareamentoId = taskData.idPareamento || null;
          if (taskPareamentoId) {
            const extratoRef = admin.firestore()
                .collection("pareamentos").doc(taskPareamentoId)
                .collection("extrato").doc();
            tx.set(extratoRef, {
              tipo: "bonus",
              descricao: `BÃ´nus: realizou "` +
                `${taskData.momentoNome || "momento"}"`,
              valor: rewardAmount,
              beneficiarioUid: executeUid,
              autorUid: executeUid,
              autorNome: taskData.executadoPorNome || "Parceiro",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              createdAtMs: Date.now(),
            });
          }

          const momentName = taskData.momentoNome || "momento";
          const messageParts = [
            `Você ganhou ${rewardAmount} foguinho(s)`,
            `ao realizar "${momentName}".`,
          ];
          const message = messageParts.join(" ");

          const notifRef = admin.firestore().collection("notificacoes").doc();
          tx.set(notifRef, {
            userId: executeUid,
            titulo: "Missão concluída!",
            mensagem: message,
            icone: "fa-fire",
            tipo: "moment_completion",
            lida: false,
            timestamp: nowTs,
          });

          tx.update(taskRef, {
            bonusGrantedAt: nowTs,
            bonusAmount: rewardAmount,
          });
        });
      } catch (error) {
        console.error("handleMomentTaskUpdate: erro ao conceder bÃ´nus", {
          taskId,
          error,
        });
      }
    },
);
