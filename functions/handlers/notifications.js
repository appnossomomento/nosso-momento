/* eslint-disable require-jsdoc */
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const https = require("firebase-functions/v2/https");
const {admin} = require("../lib/config");
const {setCorsHeaders, rateLimitHttp} = require("../lib/http");
const {requireAppCheck} = require("../lib/appCheck");

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

      console.log("Nova notificação para o usuário:", userId, titulo);

      const db = admin.firestore();
      const userDoc = await db.collection("usuarios").doc(userId).get();

      if (!userDoc.exists) {
        console.error(`Usuário ${userId} não encontrado no Firestore.`);
        return;
      }

      const tokensDoc = await db
          .collection("userNotificationTokens")
          .doc(userId)
          .get();

      let tokens = [];
      if (tokensDoc.exists) {
        const docData = tokensDoc.data() || {};
        if (Array.isArray(docData.tokens)) {
          tokens = docData.tokens.filter((token) =>
            typeof token === "string" && token.length > 0,
          );
        } else if (
          typeof docData.token === "string" &&
          docData.token.length > 0
        ) {
          tokens = [docData.token];
        }
      }

      if (!tokens.length) {
        const userData = userDoc.data() || {};
        if (
          typeof userData.fcmToken === "string" &&
          userData.fcmToken.length > 0
        ) {
          tokens = [userData.fcmToken];
          console.log(
              `Usuário ${userId} usando fcmToken legado.`,
          );
        }
      }

      if (!tokens.length) {
        console.log(
            `Usuário ${userId} não possui tokens de notificação válidos.`,
        );
        return;
      }

      const dataPayload = {
        title: titulo || "",
        body: mensagem || "",
        icon: "/assets/icons/favicon.png",
      };

      if (novaNotificacao.tipo) {
        dataPayload.type = String(novaNotificacao.tipo);
      }
      if (novaNotificacao.achievementId) {
        dataPayload.achievementId = String(novaNotificacao.achievementId);
      }
      if (novaNotificacao.icone) {
        dataPayload.iconClass = String(novaNotificacao.icone);
      }
      if (novaNotificacao.redirectTo) {
        dataPayload.redirectTo = String(novaNotificacao.redirectTo);
      }

      const message = {
        tokens,
        data: dataPayload,
      };

      try {
        const response = await admin.messaging().sendEachForMulticast(message);
        console.log("Notificação Push enviada:", {
          successCount: response.successCount,
          failureCount: response.failureCount,
        });

        const invalidTokens = [];
        response.responses.forEach((resp, index) => {
          if (!resp.success) {
            const errorCode = resp.error && resp.error.code;
            console.error("Erro ao enviar push:", errorCode, resp.error);
            if (errorCode === "messaging/registration-token-not-registered" ||
                errorCode === "messaging/invalid-registration-token") {
              invalidTokens.push(tokens[index]);
            }
          }
        });

        if (invalidTokens.length) {
          if (tokensDoc.exists) {
            await tokensDoc.ref.update({
              tokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }).catch((updateErr) => {
              console.error("Falha ao remover tokens inválidos:", updateErr);
            });
          }

          const userData = userDoc.data() || {};
          if (
            typeof userData.fcmToken === "string" &&
            invalidTokens.includes(userData.fcmToken)
          ) {
            await userDoc.ref.update({
              fcmToken: admin.firestore.FieldValue.delete(),
              notificationsEnabled: false,
            }).catch((updateErr) => {
              console.error("Falha ao limpar fcmToken legado:", updateErr);
            });
          }
        }
      } catch (error) {
        console.error("Erro ao enviar notificação Push:", error);
      }
    },
);

exports.setNotificationToken = https.onRequest(async (req, res) => {
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

  if (rateLimitHttp(req, res, {
    keyPrefix: "setNotificationToken",
    limit: 30,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") ||
    req.get("authorization") ||
    "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const body = req.body || {};
  const rawToken = typeof body.token === "string" ?
    body.token.trim() :
    "";
  const revoke = body.revoke === true;

  if (!revoke && rawToken.length < 10) {
    res.status(400).send({error: "invalid_token_value"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const userRef = db.collection("usuarios").doc(uid);
    const tokensRef = db.collection("userNotificationTokens").doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        throw new Error("user_not_found");
      }

      const tokensSnap = await tx.get(tokensRef);
      let tokens = [];
      if (tokensSnap.exists) {
        const data = tokensSnap.data() || {};
        if (Array.isArray(data.tokens)) {
          tokens = data.tokens.filter((token) =>
            typeof token === "string" && token.length > 0,
          );
        } else if (
          typeof data.token === "string" &&
          data.token.length > 0
        ) {
          tokens = [data.token];
        }
      }

      const hadLegacyToken = Object.prototype.hasOwnProperty.call(
          userSnap.data() || {},
          "fcmToken",
      );

      if (revoke) {
        let updatedTokens = tokens;
        if (rawToken) {
          updatedTokens = tokens.filter((token) => token !== rawToken);
        } else {
          updatedTokens = [];
        }

        if (updatedTokens.length) {
          tx.set(tokensRef, {
            tokens: updatedTokens,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, {merge: true});
        } else if (tokensSnap.exists) {
          tx.delete(tokensRef);
        }

        const userUpdates = {
          notificationsEnabled: updatedTokens.length > 0,
        };
        if (!updatedTokens.length && hadLegacyToken) {
          userUpdates.fcmToken = admin.firestore.FieldValue.delete();
        }
        tx.set(userRef, userUpdates, {merge: true});
      } else {
        const updatedSet = new Set(tokens);
        updatedSet.add(rawToken);

        if (updatedSet.size > 10) {
          throw new Error("too_many_tokens");
        }

        tx.set(tokensRef, {
          tokens: Array.from(updatedSet),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, {merge: true});
        const userUpdates = {
          notificationsEnabled: true,
        };
        if (hadLegacyToken) {
          userUpdates.fcmToken = admin.firestore.FieldValue.delete();
        }
        tx.set(userRef, userUpdates, {merge: true});
      }
    });

    res.send({ok: true});
  } catch (err) {
    console.error("setNotificationToken error:", err);
    if (err.message === "user_not_found") {
      res.status(404).send({error: "user_not_found"});
      return;
    }
    if (err.message === "too_many_tokens") {
      res.status(400).send({error: "too_many_tokens"});
      return;
    }
    if (err.code === "auth/argument-error") {
      res.status(401).send({error: "invalid_token"});
      return;
    }
    res.status(500).send({error: "internal_error"});
  }
});
