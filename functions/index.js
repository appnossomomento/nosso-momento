/* eslint-disable require-jsdoc */
const firestore = require("firebase-functions/v2/firestore");
const {onDocumentCreated, onDocumentUpdated} = firestore;
const {setGlobalOptions} = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({region: "southamerica-east1"});

function normalizePhone(value) {
  if (!value) return null;
  return String(value).replace(/\D/g, "");
}

function timestampToDate(ts) {
  return ts && typeof ts.toDate === "function" ? ts.toDate() : null;
}

function isSameCalendarDay(tsA, tsB) {
  const dateA = timestampToDate(tsA);
  const dateB = timestampToDate(tsB);
  if (!dateA || !dateB) return false;
  return dateA.getUTCFullYear() === dateB.getUTCFullYear() &&
    dateA.getUTCMonth() === dateB.getUTCMonth() &&
    dateA.getUTCDate() === dateB.getUTCDate();
}

function areUsersPaired(senderData, partnerData, senderUid, partnerUid) {
  if (!senderData || !partnerData) return false;

  const senderMatchesUid = senderData.pareadoUid &&
    senderData.pareadoUid === partnerUid;
  const partnerMatchesUid = partnerData.pareadoUid &&
    partnerData.pareadoUid === senderUid;

  const senderPhoneTarget = normalizePhone(senderData.pareadoCom);
  const partnerPhoneSelf = normalizePhone(partnerData.telefone);
  const partnerPhoneTarget = normalizePhone(partnerData.pareadoCom);
  const senderPhoneSelf = normalizePhone(senderData.telefone);

  const senderPhonesMatch = senderPhoneTarget &&
    partnerPhoneSelf &&
    senderPhoneTarget === partnerPhoneSelf;
  const partnerPhonesMatch = partnerPhoneTarget &&
    senderPhoneSelf &&
    partnerPhoneTarget === senderPhoneSelf;

  return (senderMatchesUid || senderPhonesMatch) &&
    (partnerMatchesUid || partnerPhonesMatch);
}

function sanitizeMomentItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const sanitized = [];
  const MAX_ITEMS = 4;

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;

    const nome = typeof raw.nome === "string" ? raw.nome.trim() : "";
    const custo = Number(raw.custoFoguinhos);
    if (!nome || !Number.isFinite(custo)) continue;

    const custoInt = Math.floor(custo);
    if (custoInt <= 0 || custoInt > 1000) continue;

    sanitized.push({
      nome,
      custoFoguinhos: custoInt,
      emoji: typeof raw.emoji === "string" ? raw.emoji : "",
      categoria: typeof raw.categoria === "string" ? raw.categoria : "",
      img: typeof raw.img === "string" ? raw.img : "",
    });

    if (sanitized.length >= MAX_ITEMS) break;
  }

  return sanitized;
}

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

      const userDoc = await admin
          .firestore()
          .collection("usuarios")
          .doc(userId)
          .get();

      if (!userDoc.exists) {
        console.error(`Usuário ${userId} não encontrado no Firestore.`);
        return;
      }

      const fcmToken = userDoc.data().fcmToken;
      if (!fcmToken) {
        console.log(`Usuário ${userId} não tem token FCM para notificar.`);
        return;
      }

      // ===== AQUI ESTÁ A CORREÇÃO =====
      const payload = {
        data: {
          title: titulo,
          body: mensagem,
          icon: "/assets/icons/favicon.png",
        },
        token: fcmToken,
      };
      // =================================

      try {
        const response = await admin.messaging().send(payload);
        console.log("Notificação Push enviada com sucesso:", response);
      } catch (error) {
        console.error("Erro ao enviar notificação Push:", error);
      }
    },
);

// Processa documentos criados em 'inputs/{inputId]'
// e aplica a ação no usuário destino
exports.processInput = onDocumentCreated(
    "inputs/{inputId}",
    async (event) => {
      const snapshot = event.data;
      if (!snapshot) {
        console.log("processInput: sem snapshot");
        return;
      }

      const input = snapshot.data();
      const inputId = snapshot.id || (event.params && event.params.inputId);
      const inputRef = admin
          .firestore()
          .collection("inputs")
          .doc(inputId);

      if (!input || !input.type) {
        console.log("processInput: input inválido", inputId, input);
        return;
      }

      try {
        if (input.type === "gift") {
          const rawAmount = Number(input.amount);
          const amount = Number.isFinite(rawAmount) ?
            Math.floor(rawAmount) :
            NaN;
          const fromUid = input.fromUid;
          const toUid = input.toUid;

          if (!fromUid || !toUid) {
            console.log("processInput: fromUid ou toUid ausente", inputId);
            await inputRef.update({
              error: "missing_uids",
              processed: false,
            });
            return;
          }

          if (!Number.isInteger(amount) || amount <= 0 || amount > 50) {
            console.log("processInput: amount inválido", amount, inputId);
            await inputRef.update({
              error: "invalid_amount",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inputSnap = await tx.get(inputRef);
            if (!inputSnap.exists) throw new Error("input não existe");
            const inputData = inputSnap.data();
            if (inputData.processed) {
              console.log("processInput: input já processado", inputId);
              return;
            }

            const senderRef = admin
                .firestore()
                .collection("usuarios")
                .doc(fromUid);
            const userRef = admin
                .firestore()
                .collection("usuarios")
                .doc(toUid);
            const senderSnap = await tx.get(senderRef);
            const userSnap = await tx.get(userRef);
            if (!senderSnap.exists) {
              throw new Error("Usuario origem não encontrado: " + fromUid);
            }
            if (!userSnap.exists) {
              throw new Error("Usuario destino não encontrado: " + toUid);
            }

            const senderData = senderSnap.data();
            const receiverData = userSnap.data();
            if (!areUsersPaired(senderData, receiverData, fromUid, toUid)) {
              throw new Error("usuarios_nao_pareados");
            }

            tx.update(userRef, {
              foguinhos: admin.firestore.FieldValue.increment(amount),
            });

            const notifRef = admin.firestore().collection("notificacoes").doc();
            const fromName = input.fromName || "Seu Parceiro";
            tx.set(notifRef, {
              userId: toUid,
              titulo: "Você ganhou um presente!",
              mensagem: `${fromName} te presenteou com ${amount} foguinho(s)!`,
              icone: "fa-gift",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log("processInput: gift processado", inputId);
        } else if (input.type === "pairing_request") {
          // Cria uma pairingRequest e atualiza o estado do sender para pending.
          const fromUid = input.fromUid;
          let toUid = input.toUid;
          let toPhone = input.toPhone || null;
          const fromPhone = input.fromPhone || null;
          const fromName = input.fromName || null;
          let toName = input.toName || null;

          if (!fromUid || (!toUid && !toPhone)) {
            await inputRef.update({
              error: "missing_pairing_info",
              processed: false,
            });
            return;
          }

          let receiverData = null;
          if (!toUid && toPhone) {
            const targetQuery = await admin
                .firestore()
                .collection("usuarios")
                .where("telefone", "==", toPhone)
                .limit(1)
                .get();
            if (!targetQuery.empty) {
              const doc = targetQuery.docs[0];
              toUid = doc.id;
              receiverData = doc.data();
              toPhone = receiverData.telefone || toPhone;
              toName = receiverData.nome || toName;
            }
          }

          if (!toUid) {
            await inputRef.update({
              error: "receiver_not_found",
              processed: false,
            });
            return;
          }

          const senderDoc = await admin
              .firestore()
              .collection("usuarios")
              .doc(fromUid)
              .get();
          if (!senderDoc.exists) {
            await inputRef.update({
              error: "sender_not_found",
              processed: false,
            });
            return;
          }

          const senderData = senderDoc.data();
          if (senderData.pareadoUid && senderData.pareadoUid !== toUid) {
            await inputRef.update({
              error: "sender_already_paired",
              processed: false,
            });
            return;
          }

          if (!receiverData) {
            const receiverDoc = await admin
                .firestore()
                .collection("usuarios")
                .doc(toUid)
                .get();
            if (!receiverDoc.exists) {
              await inputRef.update({
                error: "receiver_not_found",
                processed: false,
              });
              return;
            }
            receiverData = receiverDoc.data();
            toPhone = receiverData.telefone || toPhone;
            toName = receiverData.nome || toName;
          }

          if (receiverData.pareadoUid && receiverData.pareadoUid !== fromUid) {
            await inputRef.update({
              error: "receiver_already_paired",
              processed: false,
            });
            return;
          }

          const requestIdParts = [fromUid, toUid || ""].sort();
          const requestId = requestIdParts.join("_");

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const reqRef = admin
                .firestore()
                .collection("pairingRequests")
                .doc(requestId);
            const reqSnap = await tx.get(reqRef);
            if (reqSnap.exists && reqSnap.data().status === "pending") {
              // já existe uma request pendente; apenas marca input
              // processado
              tx.update(
                  inputRef,
                  {
                    processed: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
              );
              return;
            }

            const reqData = {
              senderUid: fromUid,
              senderName: fromName,
              senderPhone: fromPhone,
              receiverUid: toUid || null,
              receiverPhone: toPhone || null,
              receiverName: toName || null,
              status: "pending",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(reqRef, reqData, {merge: true});

            // Atualiza o documento do sender para marcar o estado como
            // pending_<telefone> — isso ajuda a manter o cliente e o banco
            // consistentes e permite que cancelamentos / rejeições limpem
            // corretamente o campo pareadoCom.
            try {
              const senderRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(fromUid);
              const senderSnap = await tx.get(senderRef);
              if (senderSnap.exists && toPhone) {
                const pendingValue = `pending_${toPhone}`;
                const sd = senderSnap.data() || {};
                // Só escreve se não estiver pareado com outra pessoa
                if (!sd.pareadoCom || sd.pareadoCom !== pendingValue) {
                  tx.update(senderRef, {pareadoCom: pendingValue});
                }
              }
            } catch (e) {
              // Não queremos que uma falha aqui quebre toda a transação
              // — logamos e seguimos (a consistência eventual pode ser
              // resolvida pelo processPairingRequest depois).
              console.error("processInput: erro atualizando senderRef:", e);
            }

            // marca input processado
            tx.update(
                inputRef,
                {
                  processed: true,
                  processedAt: admin.firestore.FieldValue.serverTimestamp(),
                  processedBy: "functions.processInput",
                },
            );
          });

          const pairingReqMsg = "processInput: pairing_request processado";
          console.log(pairingReqMsg, inputId);
        } else if (input.type === "pairing_response") {
          // input de resposta (accepted/rejected) do receiver
          const requestId = input.requestId;
          const response = input.response; // 'accepted' | 'rejected'
          const fromUid = input.fromUid;

          if (!requestId || !response || !fromUid) {
            await inputRef.update({
              error: "missing_response_info",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const reqRef = admin
                .firestore()
                .collection("pairingRequests")
                .doc(requestId);
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists) {
              // marca como erro e baila
              tx.update(
                  inputRef,
                  {
                    error: "request_not_found",
                    processed: false,
                  },
              );
              return;
            }

            const req = reqSnap.data();
            // apenas processe se ainda estiver pendente
            if (req.status !== "pending") {
              tx.update(
                  inputRef,
                  {
                    processed: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
              );
              return;
            }

            if (response === "accepted") {
              // atualiza ambos usuários e registra o vínculo de pareamento
              const senderUid = req.senderUid;
              const senderPhone = req.senderPhone;
              const receiverPhone = req.receiverPhone;

              const senderRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(senderUid);
              const receiverRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(fromUid);

              const senderSnap = await tx.get(senderRef);
              const receiverSnap = await tx.get(receiverRef);
              if (!senderSnap.exists || !receiverSnap.exists) {
                tx.update(
                    inputRef,
                    {
                      error: "usuario_nao_encontrado",
                      processed: false,
                    },
                );
                return;
              }

              const senderData = senderSnap.data();
              const receiverData = receiverSnap.data();
              const resolvedReceiverPhone =
                receiverPhone ||
                receiverData.telefone ||
                null;
              const resolvedSenderPhone =
                senderPhone ||
                senderData.telefone ||
                null;

              tx.update(senderRef, {
                pareadoCom: resolvedReceiverPhone,
                pareadoUid: fromUid,
              });
              tx.update(receiverRef, {
                pareadoCom: resolvedSenderPhone,
                pareadoUid: senderUid,
              });

              const telefones = [resolvedSenderPhone, resolvedReceiverPhone]
                  .map((t) => (t || "").replace(/\D/g, ""));
              telefones.sort();
              const idPareamento = telefones.join("_");
              const sp4 = (resolvedSenderPhone || "").slice(-4);
              const rp4 = (resolvedReceiverPhone || "").slice(-4);
              const idAmigavel = sp4 + rp4;
              const pareamentoRef = admin
                  .firestore()
                  .collection("pareamentos")
                  .doc(idPareamento);

              tx.set(
                  pareamentoRef,
                  {
                    pessoa1: telefones[0],
                    pessoa2: telefones[1],
                    pessoa1Uid: senderUid,
                    pessoa2Uid: fromUid,
                    dataPareamento:
                      admin.firestore.FieldValue.serverTimestamp(),
                    idAmigavel: idAmigavel,
                  },
                  {merge: true},
              );

              tx.update(reqRef, {status: "accepted"});
              tx.update(reqRef, {
                receiverUid: fromUid,
                receiverPhone: resolvedReceiverPhone,
                senderPhone: resolvedSenderPhone,
              });

              tx.update(
                  inputRef,
                  {
                    processed: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                    processedBy: "functions.processInput",
                  },
              );
              return;
            }

            if (response === "rejected") {
              // marca a request como rejected e remove pending do sender
              const senderUid = req.senderUid;
              const senderRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(senderUid);
              const senderSnap = await tx.get(senderRef);
              if (senderSnap.exists) {
                const receiverPhoneVal = req.receiverPhone || "";
                const pendingValue = `pending_${receiverPhoneVal}`;
                const sd = senderSnap.data() || {};
                if (sd.pareadoCom && sd.pareadoCom === pendingValue) {
                  tx.update(senderRef, {
                    pareadoCom: admin.firestore.FieldValue.delete(),
                  });
                }
              }

              tx.update(reqRef, {status: "rejected"});
              tx.update(
                  inputRef,
                  {
                    processed: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
              );
              return;
            }
          });

          const pairingRespMsg =
            "processInput: pairing_response processado";
          console.log(pairingRespMsg, inputId);
        } else if (input.type === "pairing_cancel") {
          const requestId = input.requestId;
          const fromUid = input.fromUid;
          const partnerUidFromInput = input.partnerUid || null;
          const partnerPhoneFromInput = input.partnerPhone || null;
          const missingRequestInfo = !requestId &&
            !partnerUidFromInput &&
            !partnerPhoneFromInput;
          if (!fromUid || missingRequestInfo) {
            await inputRef.update({
              error: "missing_cancel_info",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            let effectiveRequestId = requestId;
            if (!effectiveRequestId) {
              let partnerUid = partnerUidFromInput;
              if (!partnerUid && partnerPhoneFromInput) {
                const partnerQuery = await admin
                    .firestore()
                    .collection("usuarios")
                    .where("telefone", "==", partnerPhoneFromInput)
                    .limit(1)
                    .get();
                if (!partnerQuery.empty) {
                  partnerUid = partnerQuery.docs[0].id;
                }
              }
              if (partnerUid) {
                const parts = [fromUid, partnerUid].sort();
                effectiveRequestId = parts.join("_");
              }
            }

            if (!effectiveRequestId) {
              tx.update(inputRef, {
                processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                error: "request_not_found",
              });
              return;
            }

            const reqRef = admin
                .firestore()
                .collection("pairingRequests")
                .doc(effectiveRequestId);
            const reqSnap = await tx.get(reqRef);
            if (!reqSnap.exists) {
              tx.update(
                  inputRef,
                  {processed: true},
              );
              return;
            }

            const req = reqSnap.data();
            if (req.status === "pending") {
              tx.delete(reqRef);
              // limpa pending no sender se necessário
              const senderRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(req.senderUid);
              const senderSnap = await tx.get(senderRef);
              if (senderSnap.exists) {
                const receiverPhoneVal = req.receiverPhone || "";
                const pendingValue = `pending_${receiverPhoneVal}`;
                const sd = senderSnap.data() || {};
                if (sd.pareadoCom && sd.pareadoCom === pendingValue) {
                  tx.update(
                      senderRef,
                      {
                        pareadoCom: admin.firestore.FieldValue.delete(),
                      },
                  );
                }
              }
            }

            tx.update(
                inputRef,
                {
                  processed: true,
                  processedAt: admin.firestore.FieldValue.serverTimestamp(),
                },
            );
          });

          const pairingCancelMsg =
        "processInput: pairing_cancel processado";
          console.log(pairingCancelMsg, inputId);
        } else if (input.type === "daily_check_in") {
          const fromUid = input.fromUid;
          const partnerUid = input.partnerUid;

          if (!fromUid || !partnerUid) {
            await inputRef.update({
              error: "missing_checkin_info",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const senderRef = admin
                .firestore()
                .collection("usuarios")
                .doc(fromUid);
            const partnerRef = admin
                .firestore()
                .collection("usuarios")
                .doc(partnerUid);

            const senderSnap = await tx.get(senderRef);
            const partnerSnap = await tx.get(partnerRef);

            if (!senderSnap.exists || !partnerSnap.exists) {
              tx.update(inputRef, {
                error: "usuario_nao_encontrado",
                processed: false,
              });
              return;
            }

            const senderData = senderSnap.data();
            const partnerData = partnerSnap.data();
            if (!areUsersPaired(senderData, partnerData, fromUid, partnerUid)) {
              tx.update(inputRef, {
                error: "usuarios_nao_pareados",
                processed: false,
              });
              return;
            }

            const nowTs = admin.firestore.Timestamp.now();
            if (isSameCalendarDay(senderData.lastCheckInDate, nowTs)) {
              tx.update(inputRef, {
                processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedBy: "functions.processInput",
                error: "checkin_duplicate",
              });
              return;
            }

            tx.update(senderRef, {
              lastCheckInDate: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(partnerRef, {
              foguinhos: admin.firestore.FieldValue.increment(1),
            });

            const notifRef = admin.firestore().collection("notificacoes").doc();
            const giverName = senderData.nome || "Seu parceiro";
            tx.set(notifRef, {
              userId: partnerUid,
              titulo: "Você ganhou um presente!",
              mensagem: `${giverName} te presenteou com 1 foguinho 🔥.`,
              icone: "fa-gift",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log("processInput: daily_check_in processado", inputId);
        } else if (input.type === "moment_redeem") {
          const fromUid = input.fromUid;
          const partnerUid = input.partnerUid;
          const pareamentoId = input.pareamentoId || null;
          const sanitizedItems = sanitizeMomentItems(input.items);

          if (!fromUid || !partnerUid || sanitizedItems.length === 0) {
            await inputRef.update({
              error: "missing_redeem_info",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const senderRef = admin
                .firestore()
                .collection("usuarios")
                .doc(fromUid);
            const partnerRef = admin
                .firestore()
                .collection("usuarios")
                .doc(partnerUid);

            const senderSnap = await tx.get(senderRef);
            const partnerSnap = await tx.get(partnerRef);

            if (!senderSnap.exists || !partnerSnap.exists) {
              tx.update(inputRef, {
                error: "usuario_nao_encontrado",
                processed: false,
              });
              return;
            }

            const senderData = senderSnap.data();
            const partnerData = partnerSnap.data();
            if (!areUsersPaired(senderData, partnerData, fromUid, partnerUid)) {
              tx.update(inputRef, {
                error: "usuarios_nao_pareados",
                processed: false,
              });
              return;
            }

            const totalCost = sanitizedItems.reduce(
                (sum, item) => sum + item.custoFoguinhos, 0);
            const saldoAtual = senderData.foguinhos || 0;
            if (totalCost <= 0 || totalCost > saldoAtual) {
              tx.update(inputRef, {
                error: "saldo_insuficiente",
                processed: false,
              });
              return;
            }

            tx.update(senderRef, {
              foguinhos: admin.firestore.FieldValue.increment(-totalCost),
            });

            let effectivePareamentoId = pareamentoId;
            if (!effectivePareamentoId) {
              const senderPhone = senderData.telefone || "";
              const partnerPhone = partnerData.telefone || "";
              effectivePareamentoId =
                  senderPhone.slice(-4) + partnerPhone.slice(-4);
            }

            sanitizedItems.forEach((item) => {
              const tarefaRef = admin
                  .firestore()
                  .collection("tarefasMomentos")
                  .doc();
              tx.set(tarefaRef, {
                momentoNome: item.nome,
                momentoEmoji: item.emoji || "🛍️",
                momentoCategoria: item.categoria || "Geral",
                custoFoguinhos: item.custoFoguinhos,
                status: "Pendente",
                dataResgate: admin.firestore.FieldValue.serverTimestamp(),
                dataConclusao: null,
                idPareamento: effectivePareamentoId,
                resgatadoPorUid: fromUid,
                resgatadoPorNome: senderData.nome || "",
                executadoPorUid: partnerUid,
                executadoPorNome: partnerData.nome || "",
              });
            });

            const notifRef = admin
                .firestore()
                .collection("notificacoes")
                .doc();
            const giverName = senderData.nome || "Seu parceiro";
            const itensResumo = sanitizedItems
                .map((item) => item.nome)
                .slice(0, 2)
                .join(", ");
            const plural = sanitizedItems.length > 1 ? "s" : "";
            const mensagemResumoParts = [
              `${giverName} resgatou `,
              `${sanitizedItems.length} momento${plural}: `,
              `${itensResumo}.`,
            ];
            const mensagemResumo = mensagemResumoParts.join("");
            tx.set(notifRef, {
              userId: partnerUid,
              titulo: "Momento resgatado!",
              mensagem: mensagemResumo,
              icone: "fa-shopping-bag",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log("processInput: moment_redeem processado", inputId);
        } else if (input.type === "pairing_unpair") {
          const fromUid = input.fromUid;
          const partnerUidInput = input.partnerUid || null;
          const partnerPhoneInput = input.partnerPhone || null;

          if (!fromUid || (!partnerUidInput && !partnerPhoneInput)) {
            await inputRef.update({
              error: "missing_unpair_info",
              processed: false,
            });
            return;
          }

          try {
            // If we only have phone, try to resolve partnerUid first.
            let partnerUid = partnerUidInput;
            let partnerPhone = partnerPhoneInput;
            if (!partnerUid && partnerPhone) {
              const q = await admin
                  .firestore()
                  .collection("usuarios")
                  .where("telefone", "==", partnerPhone)
                  .limit(1)
                  .get();
              if (!q.empty) {
                partnerUid = q.docs[0].id;
                partnerPhone = q.docs[0].data().telefone || partnerPhone;
              }
            }

            await admin.firestore().runTransaction(async (tx) => {
              const inSnap = await tx.get(inputRef);
              if (!inSnap.exists) throw new Error("input não existe");
              if (inSnap.data().processed) return;

              const senderRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(fromUid);
              const senderSnap = await tx.get(senderRef);
              if (!senderSnap.exists) {
                tx.update(
                    inputRef,
                    {error: "sender_not_found", processed: false},
                );
                return;
              }

              let partnerRef = null;
              let partnerSnap = null;
              if (partnerUid) {
                partnerRef = admin
                    .firestore()
                    .collection("usuarios")
                    .doc(partnerUid);
                partnerSnap = await tx.get(partnerRef);
              }

              // Reset sender
              tx.update(senderRef, {
                pareadoCom: admin.firestore.FieldValue.delete(),
                pareadoUid: admin.firestore.FieldValue.delete(),
                foguinhos: 0,
                lastCheckInDate: admin.firestore.FieldValue.delete(),
              });

              // Reset partner if exists
              if (partnerRef && partnerSnap && partnerSnap.exists) {
                tx.update(partnerRef, {
                  pareadoCom: admin.firestore.FieldValue.delete(),
                  pareadoUid: admin.firestore.FieldValue.delete(),
                  foguinhos: 0,
                  lastCheckInDate: admin.firestore.FieldValue.delete(),
                });
              }

              // Remove pareamentos doc if we can determine phones
              const senderPhone = senderSnap.data().telefone || null;
              const phoneA = (senderPhone || "").replace(/\D/g, "");
              let partnerPhoneFromSnap = "";
              if (partnerSnap && partnerSnap.data() &&
                  partnerSnap.data().telefone) {
                partnerPhoneFromSnap = partnerSnap.data().telefone;
              }
              const phoneB = (partnerPhone ||
                  partnerPhoneFromSnap).replace(/\D/g, "");
              if (phoneA && phoneB) {
                const ids = [phoneA, phoneB].sort();
                const idPareamento = ids.join("_");
                const pareamentoRef = admin
                    .firestore()
                    .collection("pareamentos")
                    .doc(idPareamento);
                tx.delete(pareamentoRef);
              }

              // Remove pairingRequests doc between them if exists
              if (partnerUid) {
                const reqId = [fromUid, partnerUid].sort().join("_");
                const reqRef = admin
                    .firestore()
                    .collection("pairingRequests")
                    .doc(reqId);
                tx.delete(reqRef);
              }
              tx.update(
                  inputRef,
                  {
                    processed: true,
                    processedAt: admin.firestore.FieldValue.serverTimestamp(),
                  },
              );
            });

            console.log(
                "processInput: pairing_unpair processed",
                inputId,
            );
          } catch (err) {
            console.error(
                "processInput: erro processando pairing_unpair",
                inputId,
                err,
            );
            try {
              await inputRef.update({error: String(err), processed: false});
            } catch (e) {
              console.error(
                  "processInput: erro marcando input pairing_unpair com erro",
                  e,
              );
            }
          }
        } else {
          console.log("processInput: tipo não suportado", input.type);
          await inputRef.update({error: "unsupported_type", processed: false});
        }
      } catch (err) {
        console.error("processInput: erro processando input", inputId, err);
        try {
          await inputRef.update({
            error: String(err),
            processed: false,
            retryCount: admin.firestore.FieldValue.increment(1),
          });
        } catch (e) {
          console.error("processInput: erro marcando input com erro", e);
        }
      }
    },
);

// Processa atualizações em pairingRequests — quando o receiver aceita,
// o backend realiza as atualizações necessárias nos documentos
// `usuarios` e cria o documento em `pareamentos`.
exports.processPairingRequest = onDocumentUpdated(
    "pairingRequests/{requestId}",
    async (event) => {
      let before = null;
      if (event.data && event.data.before) {
        before = event.data.before;
      }
      let after = null;
      if (event.data && event.data.after) {
        after = event.data.after;
      }
      if (!after) {
        console.log("processPairingRequest: sem snapshot after");
        return;
      }

      const beforeData = before ? before.data() : null;
      const afterData = after.data();
      const requestId = event.params && event.params.requestId;

      try {
        // Processa transição para 'accepted'
        if (afterData.status === "accepted") {
          if (beforeData && beforeData.status === "accepted") {
            // já processado anteriormente
            console.log(
                "processPairingRequest: já aceito anteriormente",
                requestId,
            );
            return;
          }

          const senderUid = afterData.senderUid;
          const receiverUid = afterData.receiverUid;
          const senderPhone = afterData.senderPhone;
          const receiverPhone = afterData.receiverPhone;

          if (!senderUid || !receiverUid) {
            console.error("processPairingRequest: UIDs ausentes", requestId);
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const senderRef = admin
                .firestore()
                .collection("usuarios")
                .doc(senderUid);
            const receiverRef = admin
                .firestore()
                .collection("usuarios")
                .doc(receiverUid);

            const senderSnap = await tx.get(senderRef);
            const receiverSnap = await tx.get(receiverRef);

            if (!senderSnap.exists || !receiverSnap.exists) {
              throw new Error("Usuário(s) do pareamento não encontrado(s)");
            }

            // Atualiza campo pareadoCom para ambos — feita com privilégios
            // do Admin
            tx.update(senderRef, {
              pareadoCom: receiverPhone,
              pareadoUid: receiverUid,
            });
            tx.update(receiverRef, {
              pareadoCom: senderPhone,
              pareadoUid: senderUid,
            });

            // Cria documento em `pareamentos` com id consistente
            const telefones = [senderPhone, receiverPhone]
                .map((t) => (t || "").replace(/\D/g, ""));
            telefones.sort();
            const idPareamento = telefones.join("_");
            const idAmigavel = (senderPhone || "").slice(-4) +
                (receiverPhone || "").slice(-4);
            const pareamentoRef = admin
                .firestore()
                .collection("pareamentos")
                .doc(idPareamento);

            const pareamentoData = {
              pessoa1: telefones[0],
              pessoa2: telefones[1],
              pessoa1Uid: senderUid,
              pessoa2Uid: receiverUid,
              dataPareamento: admin.firestore.FieldValue.serverTimestamp(),
              idAmigavel: idAmigavel,
            };

            tx.set(
                pareamentoRef,
                pareamentoData,
                {merge: true},
            );

            // Marca pairingRequests como processed pelo backend
            const requestRef = admin
                .firestore()
                .collection("pairingRequests")
                .doc(requestId);
            tx.update(requestRef, {
              processedBy: "functions.processPairingRequest",
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          console.log(
              "processPairingRequest: pareamento processado",
              requestId,
          );
          return;
        }

        // Processa transição para 'rejected' — limpa pending no sender
        if (afterData.status === "rejected") {
          if (beforeData && beforeData.status === "rejected") {
            // já processado anteriormente
            console.log(
                "processPairingRequest: já rejeitado anteriormente",
                requestId,
            );
            return;
          }

          const senderUid = afterData.senderUid;
          const receiverPhone = afterData.receiverPhone;
          if (!senderUid) {
            console.error(
                "processPairingRequest: senderUid ausente",
                requestId,
            );
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const senderRef = admin
                .firestore()
                .collection("usuarios")
                .doc(senderUid);
            const senderSnap = await tx.get(senderRef);
            if (!senderSnap.exists) {
              throw new Error("Usuário sender não encontrado: " + senderUid);
            }

            const pendingValue = `pending_${receiverPhone || ""}`;
            const senderData = senderSnap.data() || {};
            if (
              senderData.pareadoCom &&
                senderData.pareadoCom === pendingValue
            ) {
              tx.update(
                  senderRef,
                  {
                    pareadoCom: admin.firestore.FieldValue.delete(),
                    pareadoUid: admin.firestore.FieldValue.delete(),
                  },
              );
            }

            // Marca pairingRequests como processed pelo backend
            const requestRef = admin
                .firestore()
                .collection("pairingRequests")
                .doc(requestId);
            tx.update(requestRef, {
              processedBy: "functions.processPairingRequest",
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
          });

          console.log(
              "processPairingRequest: rejeição processada",
              requestId,
          );
          return;
        }
      } catch (err) {
        console.error("processPairingRequest: erro", err);
      }
    },
);

// ------- Função HTTP temporária para executar testes E2E de pareamento -------
const https = require("firebase-functions/v2/https");

exports.runPairingTests = https.onRequest(async (req, res) => {
  // Proteção simples: exigir ?key=run-tests-please
  const key = req.query && req.query.key;
  if (key !== "run-tests-please") {
    res.status(403).send({error: "forbidden"});
    return;
  }

  const db = admin.firestore();
  const now = Date.now();
  const uidA = `httpTestA_${now}`;
  const uidB = `httpTestB_${now}`;
  const phoneA = "11990000001";
  const phoneB = "11990000002";

  try {
    await db.collection("usuarios").doc(uidA).set({
      nome: "HTTP Tester A",
      telefone: phoneA,
      email: `httpA+${now}@example.com`,
      sexo: "Masculino",
      foguinhos: 5,
      pareadoCom: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("usuarios").doc(uidB).set({
      nome: "HTTP Tester B",
      telefone: phoneB,
      email: `httpB+${now}@example.com`,
      sexo: "Feminino",
      foguinhos: 5,
      pareadoCom: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // 1) criar pairing_request
    const inputReq = await db.collection("inputs").add({
      type: "pairing_request",
      fromUid: uidA,
      fromName: "HTTP Tester A",
      fromPhone: phoneA,
      toUid: uidB,
      toPhone: phoneB,
      toName: "HTTP Tester B",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    const requestId = [uidA, uidB].sort().join("_");
    const reqRef = db.collection("pairingRequests").doc(requestId);

    // Espera curta para processamento (função processInput deve reagir)
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    let processed = false;
    for (let i = 0; i < 20; i++) {
      const reqSnap = await reqRef.get();
      if (reqSnap.exists && reqSnap.data().status === "pending") {
        processed = true;
        break;
      }
      const inSnap = await db.collection("inputs").doc(inputReq.id).get();
      if (inSnap.exists && inSnap.data().processed) {
        processed = true;
        break;
      }
      await wait(1000);
    }

    if (!processed) {
      throw new Error("pairing_request not processed in time");
    }

    // 2) enviar pairing_response rejected (B rejeita)
    await db.collection("inputs").add({
      type: "pairing_response",
      fromUid: uidB,
      requestId: requestId,
      response: "rejected",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    // aguardar status rejected
    for (let i = 0; i < 20; i++) {
      const reqSnap = await reqRef.get();
      if (reqSnap.exists && reqSnap.data().status === "rejected") break;
      await wait(1000);
    }

    // 3) reenviar request e aceitar
    await db.collection("inputs").add({
      type: "pairing_request",
      fromUid: uidA,
      fromName: "HTTP Tester A",
      fromPhone: phoneA,
      toUid: uidB,
      toPhone: phoneB,
      toName: "HTTP Tester B",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    // aguardar pending
    for (let i = 0; i < 20; i++) {
      const reqSnap = await reqRef.get();
      if (reqSnap.exists && reqSnap.data().status === "pending") break;
      await wait(1000);
    }

    await db.collection("inputs").add({
      type: "pairing_response",
      fromUid: uidB,
      requestId: requestId,
      response: "accepted",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    // aguardar accepted
    for (let i = 0; i < 20; i++) {
      const reqSnap = await reqRef.get();
      if (reqSnap.exists && reqSnap.data().status === "accepted") break;
      await wait(1000);
    }

    // 4) enviar pairing_unpair
    await db.collection("inputs").add({
      type: "pairing_unpair",
      fromUid: uidA,
      partnerUid: uidB,
      partnerPhone: phoneB,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    // aguardar remoção de pareadoCom e reset de foguinhos
    for (let i = 0; i < 30; i++) {
      const aSnap = await db.collection("usuarios").doc(uidA).get();
      const bSnap = await db.collection("usuarios").doc(uidB).get();
      const ad = aSnap.data();
      const bd = bSnap.data();
      if (
        (!ad.pareadoCom) &&
        (!bd.pareadoCom) &&
        ad.foguinhos === 0 &&
        bd.foguinhos === 0
      ) {
        // sucesso
        await reqRef.delete().catch(() => {});
        await db.collection("usuarios").doc(uidA).delete().catch(() => {});
        await db.collection("usuarios").doc(uidB).delete().catch(() => {});
        res.send({ok: true, message: "E2E pairing tests completed"});
        return;
      }
      await wait(1000);
    }

    throw new Error("pairing_unpair did not complete in time");
  } catch (err) {
    console.error("runPairingTests error:", err);
    res.status(500).send({error: String(err)});
  }
});

// HTTP endpoint seguro para criar um `input` via Admin SDK.
// O cliente envia um idToken (Authorization: Bearer <token>) e o objeto
// `input` no body. A função verifica o token, valida fromUid e cria o
// documento em `inputs` com privilégios admin.
exports.createInput = https.onRequest(async (req, res) => {
  // CORS: permitir chamadas do browser (preflight OPTIONS + POST)
  const origin = req.get("Origin") || req.get("origin") || "*";
  res.set("Access-Control-Allow-Origin", origin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  // Opcional: permitir credenciais se necessário
  // res.set('Access-Control-Allow-Credentials', 'true');

  if (req.method === "OPTIONS") {
    // Preflight request
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }
  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  } else if (req.body && req.body.idToken) {
    idToken = req.body.idToken;
  }

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const input = req.body && req.body.input;
    if (!input || typeof input !== "object") {
      res.status(400).send({error: "missing_input"});
      return;
    }

    // Basic validation: ensure fromUid matches token uid
    if (!input.fromUid || input.fromUid !== decoded.uid) {
      res.status(403).send({error: "fromUid_mismatch"});
      return;
    }

    // Validate allowed types roughly (same as firestore.rules)
    const allowedTypes = [
      "pairing_request",
      "pairing_response",
      "pairing_cancel",
      "pairing_unpair",
      "gift",
      "daily_check_in",
      "moment_redeem",
    ];
    if (!input.type || !allowedTypes.includes(input.type)) {
      res.status(400).send({error: "unsupported_type"});
      return;
    }

    // Normalize/ensure minimal fields
    const toWrite = Object.assign({}, input);
    toWrite.processed = false;
    toWrite.timestamp = admin.firestore.FieldValue.serverTimestamp();

    const ref = await admin.firestore().collection("inputs").add(toWrite);
    res.send({ok: true, id: ref.id});
  } catch (err) {
    console.error("createInput: error", err);
    // map common auth errors
    if (err && err.code === "auth/argument-error") {
      res.status(401).send({error: "invalid_token"});
    } else {
      res.status(500).send({error: String(err)});
    }
  }
});
