const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({region: "southamerica-east1"});

// A definição da função foi quebrada em múltiplas linhas para o ESLint
exports.enviarNotificacaoPush = onDocumentCreated(
    "notificacoes/{notificacaoId}",
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) {
        console.log("Nenhum dado associado ao evento.");
        return;
      }
      const novaNotificacao = snapshot.data();

      const userId = novaNotificacao.userId;
      const titulo = novaNotificacao.titulo;
      const mensagem = novaNotificacao.mensagem;

      console.log(`Nova notificação para o usuário ${userId}: "${titulo}"`);

      // A busca no Firestore também foi quebrada para o ESLint
      const userDoc = await admin.firestore()
          .collection("usuarios").doc(userId).get();

      if (!userDoc.exists) {
        console.error(`Usuário ${userId} não encontrado no Firestore.`);
        return;
      }

      const fcmToken = userDoc.data().fcmToken;
      if (!fcmToken) {
        console.log(`Usuário ${userId} não tem token FCM para notificar.`);
        return;
      }

      const payload = {
        notification: {
          title: titulo,
          body: mensagem,
          icon: "/assets/icons/icon-192x192.png",
        },
        token: fcmToken,
      };

      try {
        const response = await admin.messaging().send(payload);
        console.log("Notificação Push enviada com sucesso:", response);
      } catch (error) {
        console.error("Erro ao enviar notificação Push:", error);
      }
    },
);
