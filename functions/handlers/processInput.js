/* eslint-disable require-jsdoc, max-len */
const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const {admin} = require("../lib/config");
const {areUsersPaired} = require("../lib/pairing");
const {grantAchievementsInTransaction} = require("../lib/achievements");
const {
  isSameCalendarDay,
  isPreviousCalendarDay,
  toSaoPauloDateStr,
} = require("../lib/time");
const {
  normalizeChallengeAnswer,
  parsePayloadJson,
} = require("../lib/normalize");
const {
  sanitizeMomentRedeemItems,
  resolveRedeemItems,
} = require("../lib/momentPricing");
const {
  upsertWeeklyChallengeForPair,
  pickRouletteValue,
  ROULETTE_OPTIONS,
} = require("../lib/challenges");

// Processa documentos criados em 'inputs/{inputId}'
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

            // --- Extrato: gift ---
            const giftPareamentoId = input.pareamentoId || null;
            if (giftPareamentoId) {
              const extratoRef = admin.firestore()
                  .collection("pareamentos").doc(giftPareamentoId)
                  .collection("extrato").doc();
              tx.set(extratoRef, {
                tipo: "gift",
                descricao: `Presente de ${input.fromName || "parceiro"}`,
                valor: amount,
                beneficiarioUid: toUid,
                autorUid: fromUid,
                autorNome: input.fromName || "Parceiro",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now(),
              });
            }

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
          // VIP-gated: free users só podem ter 1 conexão
          const senderIsVip = !!senderData.vip;
          if (!senderIsVip && senderData.pareadoUid &&
              senderData.pareadoUid !== toUid) {
            // Limpa pending do sender se foi setado pelo frontend
            try {
              if (toPhone) {
                const pendingVal = `pending_${toPhone}`;
                if (senderData.pareadoCom === pendingVal) {
                  const sRef = admin.firestore()
                      .collection("usuarios")
                      .doc(fromUid);
                  const restoreVal =
                    senderData.pareadoUid ?
                      senderData.pareadoCom :
                      admin.firestore.FieldValue.delete();
                  await sRef.update(
                      {pareadoCom: restoreVal},
                  );
                }
              }
            } catch (cleanErr) {
              console.error(
                  "Erro limpando sender pending:",
                  cleanErr,
              );
            }
            await inputRef.update({
              error: "sender_already_paired",
              processed: true,
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

          // VIP-gated: free receivers só podem ter 1 conexão
          const receiverIsVip = !!receiverData.vip;
          if (!receiverIsVip && receiverData.pareadoUid &&
              receiverData.pareadoUid !== fromUid) {
            // Limpa pending do sender p/ não ficar preso
            try {
              if (toPhone) {
                const pendingVal = `pending_${toPhone}`;
                const senderRef = admin.firestore()
                    .collection("usuarios")
                    .doc(fromUid);
                const freshSender = await senderRef.get();
                if (freshSender.exists) {
                  const sd = freshSender.data() || {};
                  if (sd.pareadoCom === pendingVal) {
                    await senderRef.update({
                      pareadoCom:
                        admin.firestore.FieldValue.delete(),
                    });
                  }
                }
              }
            } catch (cleanErr) {
              console.error(
                  "Erro limpando sender pending:",
                  cleanErr,
              );
            }
            await inputRef.update({
              error: "receiver_already_paired",
              processed: true,
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
              // já existe uma request pendente; apenas marca input processado
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
              partnerNickname: input.partnerNickname || null,
              status: "pending",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            };

            tx.set(reqRef, reqData, {merge: true});

            // Atualiza o documento do sender para marcar o estado como
            // pending_<telefone> – isso ajuda a manter o cliente e o banco
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
              // – logamos e seguimos (a consistência eventual pode ser
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
          let acceptedPairUids = null;

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

              // Atualiza campos legados (pareadoCom/pareadoUid) – sempre
              // apontam para o parceiro mais recente
              const MIN_FOGUINHOS = 10;
              const senderLegacy = {
                pareadoCom: resolvedReceiverPhone,
                pareadoUid: fromUid,
              };
              const receiverLegacy = {
                pareadoCom: resolvedSenderPhone,
                pareadoUid: senderUid,
              };
              // Top-up global foguinhos se abaixo do mínimo
              const sFog = Number(senderData.foguinhos);
              if (!Number.isFinite(sFog) || sFog < MIN_FOGUINHOS) {
                senderLegacy.foguinhos = MIN_FOGUINHOS;
              }
              const rFog = Number(receiverData.foguinhos);
              if (!Number.isFinite(rFog) || rFog < MIN_FOGUINHOS) {
                receiverLegacy.foguinhos = MIN_FOGUINHOS;
              }
              tx.update(senderRef, senderLegacy);
              tx.update(receiverRef, receiverLegacy);

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

              const nowAccepted = admin.firestore.FieldValue.serverTimestamp();
              const emptyStreak = {
                currentDailyStreak: 0,
                bestDailyStreak: 0,
                lastCheckInDate: null,
              };

              tx.set(
                  pareamentoRef,
                  {
                    pessoa1: telefones[0],
                    pessoa2: telefones[1],
                    pessoa1Uid: senderUid,
                    pessoa2Uid: fromUid,
                    dataPareamento: nowAccepted,
                    idAmigavel: idAmigavel,
                    // Campos isolados por conexão (multi-conexão)
                    foguinhos_pessoa1: 10,
                    foguinhos_pessoa2: 10,
                    streak_pessoa1: emptyStreak,
                    streak_pessoa2: emptyStreak,
                    desafiosConcluidos: 0,
                  },
                  {merge: true},
              );

              // Adiciona à lista pareamentosAtivos de ambos (multi-conexão)
              const nowISO = new Date().toISOString();
              const senderNickname = req.partnerNickname || "";
              // Entry que vai no array do SENDER (dados do parceiro)
              // O sender escolheu o apelido, então
              // "apelido" é o nome carinhoso que deu ao receiver
              const entryForSender = {
                uid: fromUid,
                nome: receiverData.nome || req.receiverName || "",
                apelido: senderNickname,
                telefone: resolvedReceiverPhone,
                fotoUrl: receiverData.fotoUrl || "",
                pareamentoId: idPareamento,
                idAmigavel: idAmigavel,
                foguinhos: 10,
                pareadoDesde: nowISO,
              };
              // Entry que vai no array do RECEIVER (dados do sender)
              const entryForReceiver = {
                uid: senderUid,
                nome: senderData.nome || req.senderName || "",
                telefone: resolvedSenderPhone,
                fotoUrl: senderData.fotoUrl || "",
                pareamentoId: idPareamento,
                idAmigavel: idAmigavel,
                foguinhos: 10,
                pareadoDesde: nowISO,
              };
              tx.update(senderRef, {
                pareamentosAtivos: admin.firestore.FieldValue.arrayUnion(
                    entryForSender),
              });
              tx.update(receiverRef, {
                pareamentosAtivos: admin.firestore.FieldValue.arrayUnion(
                    entryForReceiver),
              });

              // --- Extrato: pareamento inicial ---
              const pareamentoRefExtrato = admin.firestore()
                  .collection("pareamentos").doc(idPareamento);
              const extRef1 = pareamentoRefExtrato
                  .collection("extrato").doc();
              tx.set(extRef1, {
                tipo: "pareamento",
                descricao: "Saldo inicial do pareamento",
                valor: 10,
                beneficiarioUid: senderUid,
                autorUid: "system",
                autorNome: "Sistema",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now(),
              });
              const extRef2 = pareamentoRefExtrato
                  .collection("extrato").doc();
              tx.set(extRef2, {
                tipo: "pareamento",
                descricao: "Saldo inicial do pareamento",
                valor: 10,
                beneficiarioUid: fromUid,
                autorUid: "system",
                autorNome: "Sistema",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now() + 1,
              });

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
              acceptedPairUids = [senderUid, fromUid];
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
          if (response === "accepted" && Array.isArray(acceptedPairUids)) {
            try {
              await upsertWeeklyChallengeForPair({
                db: admin.firestore(),
                pairUids: acceptedPairUids,
                pareamentoId: null,
                nowMs: Date.now(),
                forceReset: true,
              });
            } catch (err) {
              console.error(
                  "pairing_response: falha ao resetar desafio semanal",
                  err,
              );
            }
          }
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
        } else if (input.type === "convite_aceitar") {
          // Aceita um convite gerado via gerarConvite (link compartilhável).
          // Valida o token, cria o pareamento e marca o convite como usado.
          const token = input.token;
          const fromUid = input.fromUid;
          if (!token || !fromUid) {
            await inputRef.update({
              error: "missing_convite_fields",
              processed: false,
            });
            return;
          }

          let conviteAcceptedUids = null;

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const conviteRef = admin.firestore()
                .collection("convites").doc(token);
            const conviteSnap = await tx.get(conviteRef);

            if (!conviteSnap.exists) {
              tx.update(inputRef, {
                error: "convite_not_found",
                processed: false,
              });
              return;
            }

            const convite = conviteSnap.data();
            if (convite.usado) {
              tx.update(inputRef, {
                error: "convite_already_used",
                processed: false,
              });
              return;
            }

            const expiraEm = convite.expiraEm ?
              convite.expiraEm.toDate() : new Date(0);
            if (expiraEm < new Date()) {
              tx.update(inputRef, {
                error: "convite_expired",
                processed: false,
              });
              return;
            }

            const senderUid = convite.senderUid;
            if (senderUid === fromUid) {
              tx.update(inputRef, {
                error: "convite_self_invite",
                processed: false,
              });
              return;
            }

            const senderRef = admin.firestore()
                .collection("usuarios").doc(senderUid);
            const receiverRef = admin.firestore()
                .collection("usuarios").doc(fromUid);

            const senderSnap = await tx.get(senderRef);
            const receiverSnap = await tx.get(receiverRef);

            if (!senderSnap.exists || !receiverSnap.exists) {
              tx.update(inputRef, {
                error: "usuario_nao_encontrado",
                processed: false,
              });
              return;
            }

            const senderData = senderSnap.data();
            const receiverData = receiverSnap.data();
            const senderPhone = senderData.telefone || null;
            const receiverPhone = receiverData.telefone || null;

            // Campos legados + top-up de foguinhos
            const MIN_FOGUINHOS = 10;
            const senderLegacy = {
              pareadoCom: receiverPhone,
              pareadoUid: fromUid,
            };
            const receiverLegacy = {
              pareadoCom: senderPhone,
              pareadoUid: senderUid,
            };
            const sFog = Number(senderData.foguinhos);
            if (!Number.isFinite(sFog) || sFog < MIN_FOGUINHOS) {
              senderLegacy.foguinhos = MIN_FOGUINHOS;
            }
            const rFog = Number(receiverData.foguinhos);
            if (!Number.isFinite(rFog) || rFog < MIN_FOGUINHOS) {
              receiverLegacy.foguinhos = MIN_FOGUINHOS;
            }
            tx.update(senderRef, senderLegacy);
            tx.update(receiverRef, receiverLegacy);

            // Cria documento de pareamento
            const telefones = [senderPhone, receiverPhone]
                .map((t) => (t || "").replace(/\D/g, ""));
            telefones.sort();
            const idPareamento = telefones.join("_");
            const sp4 = (senderPhone || "").slice(-4);
            const rp4 = (receiverPhone || "").slice(-4);
            const idAmigavel = sp4 + rp4;
            const pareamentoRef = admin.firestore()
                .collection("pareamentos").doc(idPareamento);
            const nowISO = new Date().toISOString();
            const emptyStreak = {
              currentDailyStreak: 0,
              bestDailyStreak: 0,
              lastCheckInDate: null,
            };
            tx.set(pareamentoRef, {
              pessoa1: telefones[0],
              pessoa2: telefones[1],
              pessoa1Uid: senderUid,
              pessoa2Uid: fromUid,
              dataPareamento: admin.firestore.FieldValue.serverTimestamp(),
              idAmigavel,
              foguinhos_pessoa1: 10,
              foguinhos_pessoa2: 10,
              streak_pessoa1: emptyStreak,
              streak_pessoa2: emptyStreak,
              desafiosConcluidos: 0,
            }, {merge: true});

            // pareamentosAtivos de ambos
            const entryForSender = {
              uid: fromUid,
              nome: receiverData.nome || "",
              apelido: receiverData.nome || "",
              telefone: receiverPhone,
              fotoUrl: receiverData.fotoUrl || "",
              pareamentoId: idPareamento,
              idAmigavel,
              foguinhos: 10,
              pareadoDesde: nowISO,
            };
            const entryForReceiver = {
              uid: senderUid,
              nome: senderData.nome || "",
              apelido: senderData.nome || "",
              telefone: senderPhone,
              fotoUrl: senderData.fotoUrl || "",
              pareamentoId: idPareamento,
              idAmigavel,
              foguinhos: 10,
              pareadoDesde: nowISO,
            };
            tx.update(senderRef, {
              pareamentosAtivos: admin.firestore.FieldValue.arrayUnion(
                  entryForSender,
              ),
            });
            tx.update(receiverRef, {
              pareamentosAtivos: admin.firestore.FieldValue.arrayUnion(
                  entryForReceiver,
              ),
            });

            // Extrato de saldo inicial
            const extRef1 = pareamentoRef.collection("extrato").doc();
            tx.set(extRef1, {
              tipo: "pareamento",
              descricao: "Saldo inicial do pareamento",
              valor: 10,
              beneficiarioUid: senderUid,
              autorUid: "system",
              autorNome: "Sistema",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              createdAtMs: Date.now(),
            });
            const extRef2 = pareamentoRef.collection("extrato").doc();
            tx.set(extRef2, {
              tipo: "pareamento",
              descricao: "Saldo inicial do pareamento",
              valor: 10,
              beneficiarioUid: fromUid,
              autorUid: "system",
              autorNome: "Sistema",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              createdAtMs: Date.now() + 1,
            });

            // Marca convite como usado
            tx.update(conviteRef, {usado: true});

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });

            conviteAcceptedUids = [senderUid, fromUid];
          });

          console.log("processInput: convite_aceitar processado", inputId);

          if (Array.isArray(conviteAcceptedUids)) {
            try {
              await upsertWeeklyChallengeForPair({
                db: admin.firestore(),
                pairUids: conviteAcceptedUids,
                pareamentoId: null,
                nowMs: Date.now(),
                forceReset: true,
              });
            } catch (err) {
              console.error(
                  "convite_aceitar: falha ao criar desafio semanal",
                  err,
              );
            }
          }
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

            const existingStats = senderData.achievementStats || {};
            const totalCheckinsBefore = existingStats.totalCheckins || 0;
            const previousStreak = existingStats.currentDailyStreak || 0;
            const bestStreakBefore = existingStats.bestDailyStreak || 0;

            let currentStreak = 1;
            if (senderData.lastCheckInDate &&
              isPreviousCalendarDay(senderData.lastCheckInDate, nowTs)) {
              currentStreak = previousStreak + 1;
            }

            const bestStreak = Math.max(bestStreakBefore, currentStreak);

            const updatedStats = {
              ...existingStats,
              totalCheckins: totalCheckinsBefore + 1,
              currentDailyStreak: currentStreak,
              bestDailyStreak: bestStreak,
              lastCheckInAt: nowTs,
            };

            tx.update(senderRef, {
              lastCheckInDate: nowTs,
              achievementStats: updatedStats,
            });

            tx.update(partnerRef, {
              foguinhos: admin.firestore.FieldValue.increment(1),
            });

            // --- Multi-conexão: atualiza foguinhos no doc de pareamento ---
            const pareamentoIdInput = input.pareamentoId || null;
            if (pareamentoIdInput) {
              const pareamentoRef = admin.firestore()
                  .collection("pareamentos").doc(pareamentoIdInput);
              const pareamentoSnap = await tx.get(pareamentoRef);
              if (pareamentoSnap.exists) {
                const pData = pareamentoSnap.data();
                const isSenderPessoa1 = pData.pessoa1Uid === fromUid;
                // Parceiro ganha 1 foguinho nesta conexão
                const foguinhosField = isSenderPessoa1 ?
                    "foguinhos_pessoa2" : "foguinhos_pessoa1";
                tx.update(pareamentoRef, {
                  [foguinhosField]:
                    admin.firestore.FieldValue.increment(1),
                });
              }
            }

            const notifRef = admin.firestore().collection("notificacoes").doc();
            const giverName = senderData.nome || "Seu parceiro";
            tx.set(notifRef, {
              userId: partnerUid,
              titulo: "Você ganhou um presente!",
              mensagem: `${giverName} te presenteou com 1 foguinho!`,
              icone: "fa-gift",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            const granted = await grantAchievementsInTransaction({
              tx,
              userRef: senderRef,
              userId: fromUid,
              trigger: "daily_check_in",
              currentAchievements: senderData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {
                streak: currentStreak,
                totalCheckins: updatedStats.totalCheckins,
              },
            });

            if (granted.length) {
              console.log(
                  "processInput: conquistas concedidas (daily_check_in)",
                  granted.map((ach) => ach.id),
              );
            }

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
          const sanitizedRaw = sanitizeMomentRedeemItems(input.items);

          if (!fromUid || !partnerUid || sanitizedRaw.length === 0) {
            await inputRef.update({
              error: "missing_redeem_info",
              processed: false,
            });
            return;
          }

          const partnerSnap = await admin
              .firestore()
              .collection("usuarios")
              .doc(partnerUid)
              .get();
          const priced = await resolveRedeemItems(
              sanitizedRaw,
              partnerSnap.exists ? partnerSnap.data() : null,
              pareamentoId,
              admin.firestore(),
          );

          if (!priced.ok) {
            await inputRef.update({
              error: priced.error,
              processed: false,
            });
            return;
          }

          const sanitizedItems = priced.items;
          const totalCostPrecalculated = priced.totalCost;

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

            const totalCost = totalCostPrecalculated;

            // Usa usuario.foguinhos como única fonte de verdade para validação.
            // Os campos foguinhos_pessoaX do pareamento não são mantidos em
            // sincronia com achievement rewards e não são usados na UI.
            const saldoAtual = senderData.foguinhos || 0;

            // Ainda precisa de pareamentoRef para criar o extrato de resgate.
            let pareamentoRef = null;
            let pareamentoSnap = null;
            if (pareamentoId) {
              pareamentoRef = admin.firestore()
                  .collection("pareamentos").doc(pareamentoId);
              pareamentoSnap = await tx.get(pareamentoRef);
            }

            if (totalCost <= 0 || totalCost > saldoAtual) {
              tx.update(inputRef, {
                error: "saldo_insuficiente",
                processed: false,
              });
              return;
            }

            const nowRedeemTs = admin.firestore.Timestamp.now();
            const existingStats = senderData.achievementStats || {};
            const previousMomentsStats = existingStats.momentsRedeemed || {};
            const previousCategoryCounts =
              previousMomentsStats.porCategoria || {};
            const updatedCategoryCounts = {...previousCategoryCounts};

            sanitizedItems.forEach((item) => {
              const rawCategory = item.categoria || "Outros";
              const normalizedCategory = rawCategory.toLowerCase();
              updatedCategoryCounts[normalizedCategory] =
                (updatedCategoryCounts[normalizedCategory] || 0) + 1;
            });

            const updatedMomentsStats = {
              total: (previousMomentsStats.total || 0) + sanitizedItems.length,
              porCategoria: updatedCategoryCounts,
              lastRedeemAt: nowRedeemTs,
            };

            const updatedStats = {
              ...existingStats,
              momentsRedeemed: updatedMomentsStats,
              totalFoguinhosGastos:
                (existingStats.totalFoguinhosGastos || 0) + totalCost,
              lastMomentRedeemAt: nowRedeemTs,
            };

            tx.update(senderRef, {
              foguinhos: admin.firestore.FieldValue.increment(-totalCost),
              achievementStats: updatedStats,
            });

            if (pareamentoRef && pareamentoSnap && pareamentoSnap.exists) {
              // --- Extrato: resgate de momento ---
              const itensNomes = sanitizedItems
                  .map((i) => i.nome).slice(0, 2).join(", ");
              const extratoRef = pareamentoRef
                  .collection("extrato").doc();
              tx.set(extratoRef, {
                tipo: "resgate",
                descricao: `Resgatou: ${itensNomes}`,
                valor: -totalCost,
                beneficiarioUid: fromUid,
                autorUid: fromUid,
                autorNome: senderData.nome || "Parceiro",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now(),
              });
            }

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
                momentoEmoji: item.emoji || "",
                momentoImg: item.img || "",
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
            const primeiroItem = sanitizedItems[0] || {};
            const categoria = (primeiroItem.categoria || "").toLowerCase();
            let momentoTitulo;
            let momentoMensagem;
            if (categoria === "quentes" || categoria === "quente") {
              momentoTitulo = `${giverName} resgatou um momento! 🔥`;
              momentoMensagem = "Agora você tem uma missão...😈";
            } else if (categoria === "lovezin" || categoria === "lovezinho") {
              momentoTitulo = `${giverName} resgatou um momento! ❤️`;
              momentoMensagem = "Faça com amor e carinho. 🥰";
            } else {
              momentoTitulo = `${giverName} resgatou um momento! 👀`;
              momentoMensagem = "Nada de rotina nessa relação. 🤪";
            }
            tx.set(notifRef, {
              userId: partnerUid,
              titulo: momentoTitulo,
              mensagem: momentoMensagem,
              icone: "fa-shopping-bag",
              tipo: "momento_resgatado",
              redirectTo: "momentos",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });

            const granted = await grantAchievementsInTransaction({
              tx,
              userRef: senderRef,
              userId: fromUid,
              trigger: "moment_redeem",
              currentAchievements: senderData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {
                items: sanitizedItems,
                totalCost,
                totalRedeemed: updatedMomentsStats.total,
              },
            });

            if (granted.length) {
              console.log(
                  "processInput: conquistas concedidas (moment_redeem)",
                  granted.map((ach) => ach.id),
              );
            }

            // --- Conquistas do parceiro (momento recebido) ---
            const partnerExistingStats = partnerData.achievementStats || {};
            const partnerUpdatedStats = {
              ...partnerExistingStats,
              momentosRecebidos:
                (partnerExistingStats.momentosRecebidos || 0) + 1,
            };
            tx.update(partnerRef, {achievementStats: partnerUpdatedStats});
            const grantedPartner = await grantAchievementsInTransaction({
              tx,
              userRef: partnerRef,
              userId: partnerUid,
              trigger: "moment_redeem_received",
              currentAchievements: partnerData.conquistas || {},
              statsBefore: partnerExistingStats,
              statsAfter: partnerUpdatedStats,
              eventContext: {},
            });
            if (grantedPartner.length) {
              console.log(
                  "processInput: conquistas (moment_redeem_received)",
                  grantedPartner.map((ach) => ach.id),
              );
            }
          });

          console.log("processInput: moment_redeem processado", inputId);
        } else if (input.type === "weekly_challenge_seed") {
          const challengeDocId = input.challengeDocId || null;
          if (!challengeDocId) {
            await inputRef.update({
              error: "missing_challenge_doc",
              processed: false,
            });
            return;
          }

          const payload = parsePayloadJson(input) || {};
          const challengeRef = admin
              .firestore()
              .collection("weeklyChallenges")
              .doc(challengeDocId);

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const challengeSnap = await tx.get(challengeRef);
            if (!challengeSnap.exists) {
              const createdAtMs = Number(
                  payload.createdAtMs || payload.createdAt ||
                  input.createdAtMs || input.createdAt || 0,
              ) || Date.now();
              const base = {
                id: challengeDocId,
                challengeId: input.challengeId ||
                  payload.challengeId || "alma_gemea",
                titulo: input.titulo || payload.titulo || "Alma Gêmea",
                pergunta: input.pergunta || payload.pergunta || null,
                reward: Number(input.reward || payload.reward || 1),
                status: input.status || payload.status || "pendente",
                criadoEm: admin.firestore.Timestamp.fromMillis(createdAtMs),
                createdAtMs,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              };
              tx.set(challengeRef, base, {merge: true});
            }

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: weekly_challenge_seed processado",
              inputId,
          );
        } else if (input.type === "weekly_challenge_upsert") {
          const challengeDocId = input.challengeDocId || null;
          if (!challengeDocId) {
            await inputRef.update({
              error: "missing_challenge_doc",
              processed: false,
            });
            return;
          }

          const payload = parsePayloadJson(input) || {};
          const challengeRef = admin
              .firestore()
              .collection("weeklyChallenges")
              .doc(challengeDocId);

          const toTimestamp = (value) => {
            const ms = Number(value || 0);
            return Number.isFinite(ms) && ms > 0 ?
              admin.firestore.Timestamp.fromMillis(ms) :
              null;
          };

          const startedAtMs =
            Number(
                payload.startedAt || payload.startedEm ||
                payload.prazoInicio || input.startedAtMs || 0,
            ) || null;
          const completedAtMs =
            Number(
                payload.completedAt || payload.concluidoEm ||
                input.completedAtMs || 0,
            ) || null;

          const updates = {
            id: challengeDocId,
            challengeId: input.challengeId ||
              payload.challengeId || "alma_gemea",
            titulo: input.titulo || payload.titulo || undefined,
            pergunta: input.pergunta || payload.pergunta || undefined,
            reward: Number(input.reward || payload.reward || 1),
            status: input.status || payload.status || undefined,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          if (startedAtMs) {
            updates.startedAt = toTimestamp(startedAtMs);
            updates.startedAtMs = startedAtMs;
          }
          if (completedAtMs) {
            updates.completedAt = toTimestamp(completedAtMs);
            updates.completedAtMs = completedAtMs;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            tx.set(challengeRef, updates, {merge: true});
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: weekly_challenge_upsert processado",
              inputId,
          );
        } else if (input.type === "weekly_challenge_start") {
          const challengeDocId = input.challengeDocId || null;
          if (!challengeDocId) {
            await inputRef.update({
              error: "missing_challenge_doc",
              processed: false,
            });
            return;
          }

          const challengeRef = admin
              .firestore()
              .collection("weeklyChallenges")
              .doc(challengeDocId);

          const startedAtMs = Number(input.startedAt || 0) || Date.now();
          const startedAt = admin.firestore.Timestamp.fromMillis(startedAtMs);

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            tx.set(challengeRef, {
              id: challengeDocId,
              challengeId: input.challengeId || "alma_gemea",
              startedAt,
              startedAtMs,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: weekly_challenge_start processado",
              inputId,
          );
        } else if (input.type === "weekly_challenge_timeout") {
          const challengeDocId = input.challengeDocId || null;
          if (!challengeDocId) {
            await inputRef.update({
              error: "missing_challenge_doc",
              processed: false,
            });
            return;
          }

          const challengeRef = admin
              .firestore()
              .collection("weeklyChallenges")
              .doc(challengeDocId);

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            tx.set(challengeRef, {
              id: challengeDocId,
              challengeId: input.challengeId || "alma_gemea",
              status: "finalizado_sem_recompensa",
              concluido: true,
              rewarded: false,
              completedAt: admin.firestore.FieldValue.serverTimestamp(),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, {merge: true});

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: weekly_challenge_timeout processado",
              inputId,
          );
        } else if (input.type === "weekly_challenge_answer") {
          const challengeDocId = input.challengeDocId || null;
          const responderUid = input.responderUid || input.fromUid || null;
          const challengePareamentoId = input.pareamentoId ?
            String(input.pareamentoId) : null;
          if (!challengeDocId || !responderUid) {
            await inputRef.update({
              error: "missing_challenge_answer_info",
              processed: false,
            });
            return;
          }

          const challengeRef = admin
              .firestore()
              .collection("weeklyChallenges")
              .doc(challengeDocId);
          const responderRef = admin
              .firestore()
              .collection("usuarios")
              .doc(responderUid);
          const challengePareamentoRef = challengePareamentoId ?
            admin.firestore()
                .collection("pareamentos")
                .doc(challengePareamentoId) : null;

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            let challengePareamentoData = null;
            if (challengePareamentoRef) {
              const cpSnap = await tx.get(challengePareamentoRef);
              if (cpSnap.exists) {
                challengePareamentoData = cpSnap.data();
              }
            }

            const responderSnap = await tx.get(responderRef);
            if (!responderSnap.exists) {
              tx.update(inputRef, {
                error: "responder_not_found",
                processed: false,
              });
              return;
            }

            const responderData = responderSnap.data();
            let partnerUid = responderData.pareadoUid || null;

            // Fallback multi-conexão: resolve via pareamentoId
            if (!partnerUid && challengePareamentoData) {
              partnerUid = challengePareamentoData.pessoa1Uid === responderUid ?
                challengePareamentoData.pessoa2Uid :
                challengePareamentoData.pessoa1Uid;
            }

            if (!partnerUid) {
              tx.update(inputRef, {
                error: "partner_not_found",
                processed: false,
              });
              return;
            }

            const partnerRef = admin
                .firestore()
                .collection("usuarios")
                .doc(partnerUid);
            const partnerSnap = await tx.get(partnerRef);
            if (!partnerSnap.exists) {
              tx.update(inputRef, {
                error: "partner_not_found",
                processed: false,
              });
              return;
            }

            if (!areUsersPaired(
                responderData,
                partnerSnap.data(),
                responderUid,
                partnerUid,
            )) {
              tx.update(inputRef, {
                error: "usuarios_nao_pareados",
                processed: false,
              });
              return;
            }

            const challengeSnap = await tx.get(challengeRef);
            const nowTs = admin.firestore.Timestamp.now();
            const normalizedAnswer = normalizeChallengeAnswer(input.answer);

            const challengeData = challengeSnap.exists ?
              challengeSnap.data() : {};

            const pairUids = Array.isArray(challengeData.pairUids) &&
              challengeData.pairUids.length === 2 ?
              [...challengeData.pairUids] :
              [responderUid, partnerUid].sort();

            const respostas = Object.assign({}, challengeData.respostas || {});
            respostas[responderUid] = normalizedAnswer;
            const respondeuEm = Object.assign(
                {},
                challengeData.respondeuEm || {},
            );
            respondeuEm[responderUid] = nowTs;
            const respondeuNome = Object.assign(
                {},
                challengeData.respondeuNome || {},
            );
            if (input.responderName) {
              respondeuNome[responderUid] = String(input.responderName);
            }

            let status = challengeData.status || "pendente";
            let concluido = false;
            let rewarded = !!challengeData.rewarded;
            let completedAt = challengeData.completedAt || null;

            const answerA = respostas[pairUids[0]] || "";
            const answerB = respostas[pairUids[1]] || "";
            if (answerA && answerB) {
              concluido = true;
              const TIMEOUT_SENTINEL = "__timeout__";
              const bothTimeout =
                answerA === TIMEOUT_SENTINEL && answerB === TIMEOUT_SENTINEL;
              if (answerA === answerB && !bothTimeout) {
                status = "finalizado";
                if (!rewarded) {
                  const reward = Number(challengeData.reward || 2);
                  if (reward > 0) {
                    tx.update(responderRef, {
                      foguinhos: admin.firestore.FieldValue.increment(reward),
                    });
                    tx.update(partnerRef, {
                      foguinhos: admin.firestore.FieldValue.increment(reward),
                    });

                    // --- Multi-conexão: credita no doc de pareamento ---
                    if (challengePareamentoRef && challengePareamentoData) {
                      const field1 =
                        challengePareamentoData.pessoa1Uid === responderUid ?
                            "foguinhos_pessoa1" : "foguinhos_pessoa2";
                      const field2 =
                        challengePareamentoData.pessoa1Uid === partnerUid ?
                            "foguinhos_pessoa1" : "foguinhos_pessoa2";
                      tx.update(challengePareamentoRef, {
                        [field1]: admin.firestore.FieldValue.increment(reward),
                        [field2]: admin.firestore.FieldValue.increment(reward),
                        desafiosConcluidos:
                          admin.firestore.FieldValue.increment(1),
                      });

                      // --- Extrato: desafio semanal ---
                      const extratoRef1 = challengePareamentoRef
                          .collection("extrato").doc();
                      tx.set(extratoRef1, {
                        tipo: "desafio",
                        descricao: "Desafio semanal: respostas iguais!",
                        valor: reward,
                        beneficiarioUid: responderUid,
                        autorUid: responderUid,
                        autorNome: input.responderName || "Parceiro",
                        timestamp:
                          admin.firestore.FieldValue.serverTimestamp(),
                        createdAtMs: Date.now(),
                      });
                      const extratoRef2 = challengePareamentoRef
                          .collection("extrato").doc();
                      tx.set(extratoRef2, {
                        tipo: "desafio",
                        descricao: "Desafio semanal: respostas iguais!",
                        valor: reward,
                        beneficiarioUid: partnerUid,
                        autorUid: partnerUid,
                        autorNome: "",
                        timestamp:
                          admin.firestore.FieldValue.serverTimestamp(),
                        createdAtMs: Date.now(),
                      });
                    }
                  }
                  rewarded = true;
                }
              } else {
                status = "finalizado_sem_recompensa";
                // -1 de penalidade (respostas diferentes ou timeout)
                tx.update(responderRef, {
                  foguinhos: admin.firestore.FieldValue.increment(-1),
                });
                tx.update(partnerRef, {
                  foguinhos: admin.firestore.FieldValue.increment(-1),
                });
                rewarded = false;
              }
              completedAt = nowTs;
            }

            // --- Notificações do desafio ---
            const responderName = input.responderName || "Seu parceiro";
            if (concluido) {
              if (status === "finalizado") {
                const rewardN = Number(challengeData.reward || 2);
                const notifR = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifR, {
                  userId: responderUid,
                  titulo: "Vocês acertaram juntos! 🏆",
                  mensagem: `+${rewardN} foguinho(s) para` +
                    ` cada um. Continuem assim! 🔥`,
                  icone: "fa-trophy",
                  tipo: "desafio",
                  redirectTo: "achievementsPopup",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
                const notifP = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifP, {
                  userId: partnerUid,
                  titulo: "Voc\u00eas acertaram juntos! \uD83C\uDFC6",
                  mensagem: `+${rewardN} foguinho(s) para` +
                    ` cada um. Continuem assim! 🔥`,
                  icone: "fa-trophy",
                  tipo: "desafio",
                  redirectTo: "achievementsPopup",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
              } else {
                const notifR2 = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifR2, {
                  userId: responderUid,
                  titulo: "Quase lá... 😅",
                  mensagem: "As respostas foram diferentes" +
                    " desta vez. Na próxima vocês acertam!",
                  icone: "fa-trophy",
                  tipo: "desafio",
                  redirectTo: "achievementsPopup",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
                const notifP2 = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifP2, {
                  userId: partnerUid,
                  titulo: "Quase lá... 😅",
                  mensagem: "As respostas foram diferentes" +
                    " desta vez. Na próxima vocês acertam!",
                  icone: "fa-trophy",
                  tipo: "desafio",
                  redirectTo: "achievementsPopup",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
              }
            } else {
              const notifWait = admin.firestore()
                  .collection("notificacoes").doc();
              tx.set(notifWait, {
                userId: partnerUid,
                titulo: `${responderName} respondeu o desafio! ⏳`,
                mensagem: "Agora só falta você. Corre lá!",
                icone: "fa-trophy",
                tipo: "desafio",
                redirectTo: "achievementsPopup",
                lida: false,
                timestamp:
                  admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            const base = {
              id: challengeDocId,
              challengeId: input.challengeId ||
                challengeData.challengeId || "alma_gemea",
              pairUids,
              respostas,
              respondeuEm,
              respondeuNome,
              status,
              concluido,
              rewarded,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (completedAt) {
              base.completedAt = completedAt;
            }
            tx.set(challengeRef, base, {merge: true});

            // --- Achievements do desafio ---
            const answeredInMs = challengeData.startedAtMs ?
              Date.now() - challengeData.startedAtMs : 0;
            const responderExistingStats =
              responderData.achievementStats || {};
            const prevStreak =
              responderExistingStats.challengeSuccessStreak || 0;
            const newStreak = concluido ?
              (status === "finalizado" ? prevStreak + 1 : 0) :
              prevStreak;
            const responderUpdatedStats = {
              ...responderExistingStats,
              challengeSuccessStreak: newStreak,
            };
            tx.update(responderRef, {
              achievementStats: responderUpdatedStats,
            });
            const grantedChallenge = await grantAchievementsInTransaction({
              tx,
              userRef: responderRef,
              userId: responderUid,
              trigger: "weekly_challenge_answer",
              currentAchievements: responderData.conquistas || {},
              statsBefore: responderExistingStats,
              statsAfter: responderUpdatedStats,
              eventContext: {answeredInMs},
            });
            if (grantedChallenge.length) {
              console.log(
                  "processInput: conquistas (weekly_challenge_answer)",
                  grantedChallenge.map((ach) => ach.id),
              );
            }

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: weekly_challenge_answer processado",
              inputId,
          );
        } else if (input.type === "moment_complete") {
          const fromUid = input.fromUid;
          const tarefaId = typeof input.tarefaId === "string" ?
            input.tarefaId.trim() : "";
          const comFoto = input.comFoto === true;
          const FOTO_REWARD = 2; // foguinhos concedidos por completar com foto

          if (!fromUid) {
            await inputRef.update({error: "missing_uid", processed: false});
            return;
          }
          if (!tarefaId) {
            await inputRef.update({
              error: "missing_tarefaId", processed: false,
            });
            return;
          }

          const mcUserRef = admin.firestore()
              .collection("usuarios").doc(fromUid);
          const tarefaRef = admin.firestore()
              .collection("tarefasMomentos").doc(tarefaId);

          await admin.firestore().runTransaction(async (tx) => {
            // Todos os reads devem ocorrer ANTES de qualquer write.
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const userSnap = await tx.get(mcUserRef);
            const tarefaSnap = await tx.get(tarefaRef);

            if (!userSnap.exists) {
              tx.update(inputRef, {
                error: "user_not_found", processed: false,
              });
              return;
            }

            // Valida que a tarefa existe e pertence ao usuário
            if (!tarefaSnap.exists) {
              tx.update(inputRef, {
                error: "tarefa_not_found", processed: false,
              });
              return;
            }
            const tarefaData = tarefaSnap.data();
            // Quem marca como feito é quem resgatou (resgatadoPorUid = User A),
            // não o executor (executadoPorUid = User B).
            if (tarefaData.resgatadoPorUid !== fromUid) {
              tx.update(inputRef, {
                error: "tarefa_wrong_user", processed: false,
              });
              return;
            }
            if (tarefaData.status !== "Pendente") {
              // Já foi concluída — idempotente
              tx.update(inputRef, {processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedBy: "functions.processInput"});
              return;
            }

            // Atualiza a tarefa para "Realizado".
            // bonusGrantedAt sinaliza ao handleMomentTaskUpdate que o bônus
            // já foi (ou não será) concedido, evitando dupla contagem.
            tx.update(tarefaRef, {
              status: "Realizado",
              dataConclusao: admin.firestore.FieldValue.serverTimestamp(),
              comFoto,
              bonusGrantedAt: admin.firestore.FieldValue.serverTimestamp(),
              bonusAmount: comFoto ? FOTO_REWARD : 0,
            });

            // Concede 2 foguinhos apenas se o momento foi realizado com foto
            if (comFoto) {
              const userData = userSnap.data();
              const pareamentoId = input.pareamentoId || null;

              tx.update(mcUserRef, {
                foguinhos: admin.firestore.FieldValue.increment(FOTO_REWARD),
              });

              // Extrato
              if (pareamentoId) {
                const extratoRef = admin.firestore()
                    .collection("pareamentos").doc(pareamentoId)
                    .collection("extrato").doc();
                tx.set(extratoRef, {
                  tipo: "bonus",
                  // eslint-disable-next-line max-len
                  descricao: `Bônus: realizou "${tarefaData.momentoNome || "momento"}" com foto`,
                  valor: FOTO_REWARD,
                  beneficiarioUid: fromUid,
                  autorUid: fromUid,
                  autorNome: userData.nome || "Parceiro",
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  createdAtMs: Date.now(),
                });
              }

              // Notificação
              // eslint-disable-next-line max-len
              const notifRef = admin.firestore().collection("notificacoes").doc();
              tx.set(notifRef, {
                userId: fromUid,
                titulo: "Momento realizado! 🔥",
                // eslint-disable-next-line max-len
                mensagem: `Você ganhou ${FOTO_REWARD} foguinhos por registrar "${tarefaData.momentoNome || "o momento"}" com foto!`,
                icone: "fa-fire",
                tipo: "moment_completion",
                lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            // Atualiza achievementStats independente de foto
            const userData = userSnap.data();
            const existingStats = userData.achievementStats || {};
            const updatedStats = {
              ...existingStats,
              momentosCompletados:
                (existingStats.momentosCompletados || 0) + 1,
            };
            tx.update(mcUserRef, {achievementStats: updatedStats});
            await grantAchievementsInTransaction({
              tx,
              userRef: mcUserRef,
              userId: fromUid,
              trigger: "moment_complete",
              currentAchievements: userData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {},
            });
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });
          console.log("processInput: moment_complete processado", inputId,
              comFoto ? `(+${2} foguinhos com foto)` : "(sem foto, sem bônus)");
        } else if (input.type === "profile_photo_upload") {
          const fromUid = input.fromUid;
          if (!fromUid) {
            await inputRef.update({error: "missing_uid", processed: false});
            return;
          }
          const ppuUserRef = admin.firestore()
              .collection("usuarios").doc(fromUid);
          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;
            const userSnap = await tx.get(ppuUserRef);
            if (!userSnap.exists) {
              tx.update(inputRef, {
                error: "user_not_found", processed: false,
              });
              return;
            }
            const userData = userSnap.data();
            const existingStats = userData.achievementStats || {};
            const updatedStats = {
              ...existingStats,
              profilePhotosUploaded:
                (existingStats.profilePhotosUploaded || 0) + 1,
            };
            tx.update(ppuUserRef, {achievementStats: updatedStats});
            await grantAchievementsInTransaction({
              tx,
              userRef: ppuUserRef,
              userId: fromUid,
              trigger: "profile_photo_upload",
              currentAchievements: userData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {},
            });
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });
          console.log(
              "processInput: profile_photo_upload processado", inputId,
          );
        } else if (input.type === "moment_photo_upload") {
          const fromUid = input.fromUid;
          if (!fromUid) {
            await inputRef.update({error: "missing_uid", processed: false});
            return;
          }
          const mpuUserRef = admin.firestore()
              .collection("usuarios").doc(fromUid);
          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;
            const userSnap = await tx.get(mpuUserRef);
            if (!userSnap.exists) {
              tx.update(inputRef, {
                error: "user_not_found", processed: false,
              });
              return;
            }
            const userData = userSnap.data();
            const existingStats = userData.achievementStats || {};
            const updatedStats = {
              ...existingStats,
              momentPhotosUploaded:
                (existingStats.momentPhotosUploaded || 0) + 1,
            };
            tx.update(mpuUserRef, {achievementStats: updatedStats});
            await grantAchievementsInTransaction({
              tx,
              userRef: mpuUserRef,
              userId: fromUid,
              trigger: "moment_photo_upload",
              currentAchievements: userData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {},
            });
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });
          console.log(
              "processInput: moment_photo_upload processado", inputId,
          );
        } else if (input.type === "catalog_update") {
          const fromUid = input.fromUid;
          const partnerUids = Array.isArray(input.partnerUids) ?
            input.partnerUids.filter(
                (u) => typeof u === "string" && u.length > 0,
            ) :
            [];

          if (!fromUid || partnerUids.length === 0) {
            await inputRef.update({
              error: "missing_catalog_update_info",
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
            const senderSnap = await tx.get(senderRef);
            if (!senderSnap.exists) {
              tx.update(inputRef, {
                error: "sender_not_found",
                processed: false,
              });
              return;
            }

            const meuNome = senderSnap.data().nome || "Seu parceiro";
            const senderData = senderSnap.data();

            for (const partnerUid of partnerUids) {
              if (partnerUid === fromUid) continue;

              const partnerRef = admin
                  .firestore()
                  .collection("usuarios")
                  .doc(partnerUid);
              const partnerSnap = await tx.get(partnerRef);
              if (!partnerSnap.exists) continue;

              if (!areUsersPaired(
                  senderData,
                  partnerSnap.data(),
                  fromUid,
                  partnerUid,
              )) {
                continue;
              }

              const notifRef = admin
                  .firestore()
                  .collection("notificacoes")
                  .doc();
              tx.set(notifRef, {
                userId: partnerUid,
                titulo: `${meuNome} fez mudanças na lojinha! 👀`,
                mensagem:
                  "Corre lá... vai que tem promoção hahaha 🤭",
                icone: "fa-store",
                tipo: "catalog_update",
                redirectTo: "main",
                lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
            }

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log(
              "processInput: catalog_update processado",
              inputId,
          );
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

              const senderData = senderSnap.data();
              let partnerRef = null;
              let partnerSnap = null;
              let partnerData = null;
              if (partnerUid) {
                partnerRef = admin
                    .firestore()
                    .collection("usuarios")
                    .doc(partnerUid);
                partnerSnap = await tx.get(partnerRef);
                partnerData = partnerSnap && partnerSnap.exists ?
                    partnerSnap.data() : null;
              }

              // --- Multi-conexão: remove da lista pareamentosAtivos ---
              const senderAtivos =
                Array.isArray(senderData.pareamentosAtivos) ?
                    senderData.pareamentosAtivos : [];
              const senderUpdatedAtivos = senderAtivos.filter(
                  (p) => p.uid !== partnerUid);
              const hasOtherConnections = senderUpdatedAtivos.length > 0;

              // Sender update
              const senderUpdate = {
                pareamentosAtivos: senderUpdatedAtivos,
              };
              if (!hasOtherConnections) {
                // Última conexão removida – limpa campos legados
                senderUpdate.pareadoCom =
                  admin.firestore.FieldValue.delete();
                senderUpdate.pareadoUid =
                  admin.firestore.FieldValue.delete();
                senderUpdate.foguinhos = 0;
                senderUpdate.lastCheckInDate =
                  admin.firestore.FieldValue.delete();
              } else {
                // Ainda tem conexões – atualiza legados para o primeiro
                const first = senderUpdatedAtivos[0];
                senderUpdate.pareadoCom = first.telefone || null;
                senderUpdate.pareadoUid = first.uid || null;
              }
              tx.update(senderRef, senderUpdate);

              // Partner update
              if (partnerRef && partnerData) {
                const partnerAtivos = Array.isArray(
                    partnerData.pareamentosAtivos) ?
                    partnerData.pareamentosAtivos : [];
                const partnerUpdatedAtivos = partnerAtivos.filter(
                    (p) => p.uid !== fromUid);
                const partnerHasOther = partnerUpdatedAtivos.length > 0;

                const partnerUpdate = {
                  pareamentosAtivos: partnerUpdatedAtivos,
                };
                if (!partnerHasOther) {
                  partnerUpdate.pareadoCom =
                    admin.firestore.FieldValue.delete();
                  partnerUpdate.pareadoUid =
                    admin.firestore.FieldValue.delete();
                  partnerUpdate.foguinhos = 0;
                  partnerUpdate.lastCheckInDate =
                    admin.firestore.FieldValue.delete();
                } else {
                  const first = partnerUpdatedAtivos[0];
                  partnerUpdate.pareadoCom = first.telefone || null;
                  partnerUpdate.pareadoUid = first.uid || null;
                }
                tx.update(partnerRef, partnerUpdate);
              }

              // Remove pareamentos doc if we can determine phones
              const senderPhone = senderData.telefone || null;
              const phoneA = (senderPhone || "").replace(/\D/g, "");
              let partnerPhoneFromSnap = "";
              if (partnerData && partnerData.telefone) {
                partnerPhoneFromSnap = partnerData.telefone;
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
            if (partnerUid) {
              const pairKey = [fromUid, partnerUid].sort().join("_");
              const challengeDocId = `alma_gemea_${pairKey}`;
              try {
                await admin.firestore()
                    .collection("weeklyChallenges")
                    .doc(challengeDocId)
                    .delete();
              } catch (err) {
                console.error(
                    "pairing_unpair: falha ao apagar desafio semanal",
                    err,
                );
              }
            }
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
        } else if (input.type === "clima_update") {
          // ===== TERMÔMETRO DE CLIMA =====
          const fromUid = input.fromUid;
          const partnerUid = input.partnerUid;
          const pareamentoId = input.pareamentoId || null;
          const humor = input.humor; // muito_feliz | feliz | normal | triste

          const HUMOR_DELTA = {
            muito_feliz: 2,
            feliz: 1,
            normal: 0,
            triste: -1,
          };

          if (!fromUid || !partnerUid || !pareamentoId ||
              !humor || !(humor in HUMOR_DELTA)) {
            await inputRef.update({
              error: "missing_clima_info",
              processed: false,
            });
            return;
          }

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const senderRef = admin.firestore()
                .collection("usuarios").doc(fromUid);
            const partnerRef = admin.firestore()
                .collection("usuarios").doc(partnerUid);
            const pareamentoRef = admin.firestore()
                .collection("pareamentos").doc(pareamentoId);

            const [senderSnap, partnerSnap, pareamentoSnap] =
              await Promise.all([
                tx.get(senderRef),
                tx.get(partnerRef),
                tx.get(pareamentoRef),
              ]);

            if (!senderSnap.exists || !partnerSnap.exists) {
              tx.update(inputRef, {
                error: "usuario_nao_encontrado", processed: false,
              });
              return;
            }
            if (!pareamentoSnap.exists) {
              tx.update(inputRef, {
                error: "pareamento_nao_encontrado", processed: false,
              });
              return;
            }

            const senderData = senderSnap.data();
            const partnerData = partnerSnap.data();
            if (!areUsersPaired(senderData, partnerData, fromUid, partnerUid)) {
              tx.update(inputRef, {
                error: "usuarios_nao_pareados", processed: false,
              });
              return;
            }

            // --- Verifica se já registrou clima hoje ---
            const pData = pareamentoSnap.data();
            const climaHoje = pData.climaHoje || {};
            const meuClima = climaHoje[fromUid] || null;
            const nowTs = admin.firestore.Timestamp.now();

            if (meuClima && meuClima.registradoEm &&
                isSameCalendarDay(meuClima.registradoEm, nowTs)) {
              tx.update(inputRef, {
                processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedBy: "functions.processInput",
                error: "clima_duplicate",
              });
              return;
            }

            const delta = HUMOR_DELTA[humor];
            const isSenderPessoa1 = pData.pessoa1Uid === fromUid;

            // --- Atualiza foguinhos do PARCEIRO se delta != 0 ---
            if (delta !== 0) {
              tx.update(partnerRef, {
                foguinhos: admin.firestore.FieldValue.increment(delta),
              });
              const foguinhosField = isSenderPessoa1 ?
                  "foguinhos_pessoa2" : "foguinhos_pessoa1";
              tx.update(pareamentoRef, {
                [foguinhosField]:
                  admin.firestore.FieldValue.increment(delta),
              });
            }

            // --- Salva climaHoje denormalizado no pareamento ---
            tx.update(pareamentoRef, {
              [`climaHoje.${fromUid}`]: {
                humor: humor,
                registradoEm: nowTs,
              },
            });

            // --- Salva no subcol climaDiario ---
            // Fuso SP (UTC-3): evita gravar no dia seguinte após 21h
            const todayStr = toSaoPauloDateStr(nowTs.toDate());
            const climaDiarioRef = pareamentoRef
                .collection("climaDiario").doc(todayStr);
            tx.set(climaDiarioRef, {
              [fromUid]: {humor: humor, registradoEm: nowTs},
            }, {merge: true});

            // --- Cria entrada no extrato ---
            const HUMOR_LABELS = {
              muito_feliz: "Muito Feliz",
              feliz: "Feliz",
              normal: "Normal",
              triste: "Triste",
            };
            if (delta !== 0) {
              const extratoRef = pareamentoRef
                  .collection("extrato").doc();
              tx.set(extratoRef, {
                tipo: "clima",
                descricao: `Termometro: ${HUMOR_LABELS[humor]}`,
                valor: delta,
                beneficiarioUid: partnerUid,
                autorUid: fromUid,
                autorNome: senderData.nome || "Parceiro",
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                createdAtMs: Date.now(),
              });
            }

            // --- Atualiza streaks e achievementStats ---
            const existingStats = senderData.achievementStats || {};
            const totalCheckinsBefore = existingStats.totalCheckins || 0;
            const previousStreak = existingStats.currentDailyStreak || 0;
            const bestStreakBefore = existingStats.bestDailyStreak || 0;

            let currentStreak = 1;
            if (senderData.lastCheckInDate &&
              isPreviousCalendarDay(senderData.lastCheckInDate, nowTs)) {
              currentStreak = previousStreak + 1;
            }
            const bestStreak = Math.max(bestStreakBefore, currentStreak);

            const updatedStats = {
              ...existingStats,
              totalCheckins: totalCheckinsBefore + 1,
              currentDailyStreak: currentStreak,
              bestDailyStreak: bestStreak,
              lastCheckInAt: nowTs,
              totalHumorOtimo: humor === "muito_feliz" ?
                (existingStats.totalHumorOtimo || 0) + 1 :
                (existingStats.totalHumorOtimo || 0),
            };

            tx.update(senderRef, {
              lastCheckInDate: nowTs,
              achievementStats: updatedStats,
            });

            // --- Notificação para o parceiro ---
            const notifRef = admin.firestore()
                .collection("notificacoes").doc();
            const senderName = senderData.nome || "Seu parceiro";
            const HUMOR_EMOJI_MAP = {
              muito_feliz: "😄",
              feliz: "😊",
              normal: "😐",
              triste: "😢",
            };
            const HUMOR_TITULO_MAP = {
              muito_feliz: `${senderName} está` +
                ` ${HUMOR_LABELS["muito_feliz"]} hoje!` +
                ` ${HUMOR_EMOJI_MAP["muito_feliz"]}`,
              feliz: `${senderName} está` +
                ` ${HUMOR_LABELS["feliz"]} hoje!` +
                ` ${HUMOR_EMOJI_MAP["feliz"]}`,
              normal: `${senderName} está` +
                ` ${HUMOR_LABELS["normal"]} hoje!` +
                ` ${HUMOR_EMOJI_MAP["normal"]}`,
              triste: `${senderName} está` +
                ` ${HUMOR_LABELS["triste"]} hoje!` +
                ` ${HUMOR_EMOJI_MAP["triste"]}`,
            };
            const HUMOR_CORPO_MAP = {
              muito_feliz: "Aproveite para apimentar a relação.",
              feliz: "Aproveite para apimentar a relação.",
              normal: "Ótima oportunidade para melhorar o dia.",
              triste: "Não acha que deve dar um pouco de atenção?",
            };
            tx.set(notifRef, {
              userId: partnerUid,
              titulo: HUMOR_TITULO_MAP[humor] ||
                `${senderName} registrou o humor hoje.`,
              mensagem: HUMOR_CORPO_MAP[humor] || "",
              icone: "fa-thermometer-half",
              tipo: "clima",
              redirectTo: "perfilParceiro",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            // --- Achievements ---
            const partnerClima = climaHoje[partnerUid] || null;
            const partnerAlsoRegisteredToday = !!(partnerClima &&
              partnerClima.registradoEm &&
              isSameCalendarDay(partnerClima.registradoEm, nowTs));

            const criadoEm = senderData.criadoEm || null;
            let diasNoApp = 0;
            if (criadoEm) {
              const criadoDate = typeof criadoEm.toDate === "function" ?
                criadoEm.toDate() : new Date(criadoEm);
              diasNoApp = Math.floor(
                  (nowTs.toDate() - criadoDate) / (24 * 60 * 60 * 1000),
              );
            }

            const granted = await grantAchievementsInTransaction({
              tx,
              userRef: senderRef,
              userId: fromUid,
              trigger: "daily_check_in",
              currentAchievements: senderData.conquistas || {},
              statsBefore: existingStats,
              statsAfter: updatedStats,
              eventContext: {
                streak: currentStreak,
                totalCheckins: updatedStats.totalCheckins,
                partnerAlsoRegisteredToday,
                diasNoApp,
              },
            });
            if (granted.length) {
              console.log(
                  "processInput: conquistas concedidas (clima_update)",
                  granted.map((ach) => ach.id),
              );
            }

            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });

          console.log("processInput: clima_update processado", inputId);
        } else if (input.type === "preference_challenge_answer") {
          const pChDocId = input.challengeDocId || null;
          const pChUid = input.responderUid || input.fromUid || null;
          const pChPareamentoId = input.pareamentoId ?
            String(input.pareamentoId) : null;
          if (!pChDocId || !pChUid) {
            await inputRef.update({
              error: "missing_challenge_answer_info", processed: false,
            });
            return;
          }
          const pChRef = admin.firestore()
              .collection("weeklyChallenges").doc(pChDocId);
          const pChUserRef = admin.firestore()
              .collection("usuarios").doc(pChUid);
          const pChPareamentoRef = pChPareamentoId ?
            admin.firestore()
                .collection("pareamentos")
                .doc(pChPareamentoId) : null;
          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            let pChPareamentoData = null;
            if (pChPareamentoRef) {
              const cpS = await tx.get(pChPareamentoRef);
              if (cpS.exists) {
                pChPareamentoData = cpS.data();
              }
            }

            /* eslint-disable max-len */
            const pChUserSnap = await tx.get(pChUserRef);
            if (!pChUserSnap.exists) {
              tx.update(inputRef, {error: "responder_not_found", processed: false});
              return;
            }
            const pChUserData = pChUserSnap.data();
            let pChPartnerUid = pChUserData.pareadoUid || null;
            if (!pChPartnerUid && pChPareamentoData) {
              pChPartnerUid = pChPareamentoData.pessoa1Uid === pChUid ?
                pChPareamentoData.pessoa2Uid : pChPareamentoData.pessoa1Uid;
            }
            if (!pChPartnerUid) {
              tx.update(inputRef, {error: "partner_not_found", processed: false});
              return;
            }
            const pChPartnerRef = admin.firestore()
                .collection("usuarios").doc(pChPartnerUid);
            const pChPartnerSnap = await tx.get(pChPartnerRef);
            if (!pChPartnerSnap.exists) {
              tx.update(inputRef, {error: "partner_not_found", processed: false});
              return;
            }
            if (!areUsersPaired(pChUserData, pChPartnerSnap.data(),
                pChUid, pChPartnerUid)) {
              tx.update(inputRef, {error: "usuarios_nao_pareados", processed: false});
              return;
            }
            const pChSnap = await tx.get(pChRef);
            const nowTs = admin.firestore.Timestamp.now();
            const pChData = pChSnap.exists ? pChSnap.data() : {};
            const pChPairUids = Array.isArray(pChData.pairUids) &&
              pChData.pairUids.length === 2 ?
              [...pChData.pairUids] : [pChUid, pChPartnerUid].sort();
            const pChRespostas = Object.assign({}, pChData.respostas || {});
            pChRespostas[pChUid] = String(input.answer || "").trim().toUpperCase();
            const pChRespondeuEm = Object.assign({}, pChData.respondeuEm || {});
            pChRespondeuEm[pChUid] = nowTs;
            let pChStatus = pChData.status || "pendente";
            let pChConcluido = false;
            let pChRewarded = !!pChData.rewarded;
            let pChCompletedAt = pChData.completedAt || null;
            const pChA = pChRespostas[pChPairUids[0]] || "";
            const pChB = pChRespostas[pChPairUids[1]] || "";
            if (pChA && pChB) {
              pChConcluido = true;
              const PCH_TIMEOUT = "__TIMEOUT__";
              const pChBothTimeout =
                pChA === PCH_TIMEOUT && pChB === PCH_TIMEOUT;
              const pChReward = Number(pChData.reward || 2);
              if (pChA === pChB && !pChBothTimeout) {
                pChStatus = "finalizado";
                if (!pChRewarded) {
                  tx.update(pChUserRef, {
                    foguinhos: admin.firestore.FieldValue.increment(pChReward),
                  });
                  tx.update(pChPartnerRef, {
                    foguinhos: admin.firestore.FieldValue.increment(pChReward),
                  });
                  if (pChPareamentoRef && pChPareamentoData) {
                    const f1 = pChPareamentoData.pessoa1Uid === pChUid ?
                      "foguinhos_pessoa1" : "foguinhos_pessoa2";
                    const f2 = pChPareamentoData.pessoa1Uid === pChPartnerUid ?
                      "foguinhos_pessoa1" : "foguinhos_pessoa2";
                    tx.update(pChPareamentoRef, {
                      [f1]: admin.firestore.FieldValue.increment(pChReward),
                      [f2]: admin.firestore.FieldValue.increment(pChReward),
                      desafiosConcluidos: admin.firestore.FieldValue.increment(1),
                    });
                    tx.set(pChPareamentoRef.collection("extrato").doc(), {
                      tipo: "desafio",
                      descricao: "Prefer\u00eancias: escolha igual!",
                      valor: pChReward, beneficiarioUid: pChUid,
                      autorUid: pChUid,
                      autorNome: input.responderName || "Parceiro",
                      timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      createdAtMs: Date.now(),
                    });
                    tx.set(pChPareamentoRef.collection("extrato").doc(), {
                      tipo: "desafio",
                      descricao: "Prefer\u00eancias: escolha igual!",
                      valor: pChReward, beneficiarioUid: pChPartnerUid,
                      autorUid: pChPartnerUid, autorNome: "",
                      timestamp: admin.firestore.FieldValue.serverTimestamp(),
                      createdAtMs: Date.now(),
                    });
                  }
                  pChRewarded = true;
                }
              } else {
                // Respostas diferentes ou timeout — sem prêmio
                pChStatus = "finalizado_sem_recompensa";
                pChRewarded = false;
              }
              if (pChA === pChB && !pChBothTimeout) {
                tx.set(admin.firestore().collection("notificacoes").doc(), {
                  userId: pChUid, titulo: "Mesma prefer\u00eancia! \uD83C\uDF89",
                  mensagem: `+${pChReward} foguinho(s)! Sintonia total!`,
                  icone: "fa-trophy", tipo: "desafio",
                  redirectTo: "achievementsPopup", lida: false,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.set(admin.firestore().collection("notificacoes").doc(), {
                  userId: pChPartnerUid, titulo: "Mesma prefer\u00eancia! \uD83C\uDF89",
                  mensagem: `+${pChReward} foguinho(s)! Sintonia total!`,
                  icone: "fa-trophy", tipo: "desafio",
                  redirectTo: "achievementsPopup", lida: false,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
              } else {
                pChStatus = "finalizado_sem_recompensa";
                tx.update(pChUserRef, {
                  foguinhos: admin.firestore.FieldValue.increment(-1),
                });
                tx.update(pChPartnerRef, {
                  foguinhos: admin.firestore.FieldValue.increment(-1),
                });
                pChRewarded = false;
                tx.set(admin.firestore().collection("notificacoes").doc(), {
                  userId: pChUid, titulo: "Prefer\u00eancias diferentes \uD83D\uDE05",
                  mensagem: "Escolhas diferentes. -1 foguinho para cada um.",
                  icone: "fa-trophy", tipo: "desafio",
                  redirectTo: "achievementsPopup", lida: false,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
                tx.set(admin.firestore().collection("notificacoes").doc(), {
                  userId: pChPartnerUid, titulo: "Prefer\u00eancias diferentes \uD83D\uDE05",
                  mensagem: "Escolhas diferentes. -1 foguinho para cada um.",
                  icone: "fa-trophy", tipo: "desafio",
                  redirectTo: "achievementsPopup", lida: false,
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                });
              }
              pChCompletedAt = nowTs;
            } else {
              tx.set(admin.firestore().collection("notificacoes").doc(), {
                userId: pChPartnerUid,
                titulo: `${input.responderName || "Seu parceiro"} j\u00e1 escolheu! \u23F3`,
                mensagem: "Agora s\u00f3 falta voc\u00ea. Corre l\u00e1!",
                icone: "fa-trophy", tipo: "desafio",
                redirectTo: "achievementsPopup", lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
            const pChBase = {
              id: pChDocId,
              challengeId: pChData.challengeId || "preferencias",
              pairUids: pChPairUids, respostas: pChRespostas,
              respondeuEm: pChRespondeuEm, status: pChStatus,
              concluido: pChConcluido, rewarded: pChRewarded,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (pChCompletedAt) pChBase.completedAt = pChCompletedAt;
            tx.set(pChRef, pChBase, {merge: true});
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });
          console.log("processInput: preference_challenge_answer processado", inputId);
        } else if (input.type === "roulette_spin") {
          const rolDocId = input.challengeDocId || null;
          const spinnerUid = input.responderUid || input.fromUid || null;
          if (!rolDocId || !spinnerUid) {
            await inputRef.update({
              error: "missing_roulette_spin_info", processed: false,
            });
            return;
          }
          const rolRef = admin.firestore()
              .collection("weeklyChallenges").doc(rolDocId);
          const rolSpinnerRef = admin.firestore()
              .collection("usuarios").doc(spinnerUid);
          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            // Lê o doc da roleta logo no início — usado como fallback
            // para resolução de parceiro e verificação de pareamento
            const rolSnap = await tx.get(rolRef);
            const nowTs = admin.firestore.Timestamp.now();
            const rolData = rolSnap.exists ? rolSnap.data() : {};

            // Se já foi concluído, marca como processado e encerra
            if (rolData.status === "concluido" || rolData.rewarded) {
              tx.update(inputRef, {processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedBy: "functions.processInput"});
              return;
            }

            const rolSpinnerSnap = await tx.get(rolSpinnerRef);
            if (!rolSpinnerSnap.exists) {
              console.error("roulette_spin: spinner_not_found", spinnerUid, rolDocId);
              tx.update(inputRef, {error: "spinner_not_found", processed: false});
              return;
            }
            const rolSpinnerData = rolSpinnerSnap.data();

            // Resolução do parceiro: pareadoUid → pareamentos → pairUids do doc
            let rolPartnerUid = rolSpinnerData.pareadoUid || null;
            if (!rolPartnerUid && input.pareamentoId) {
              const cpR = admin.firestore()
                  .collection("pareamentos").doc(String(input.pareamentoId));
              const cpS = await tx.get(cpR);
              if (cpS.exists) {
                const cpD = cpS.data();
                rolPartnerUid = cpD.pessoa1Uid === spinnerUid ?
                    cpD.pessoa2Uid : cpD.pessoa1Uid;
              }
            }
            // Fallback: usa pairUids do doc da roleta (o primeiro giro já validou)
            if (!rolPartnerUid && Array.isArray(rolData.pairUids) &&
                rolData.pairUids.length === 2) {
              rolPartnerUid = rolData.pairUids.find((u) => u !== spinnerUid) || null;
              if (rolPartnerUid) {
                console.warn("roulette_spin: parceiro resolvido via pairUids do doc",
                    {spinnerUid, rolPartnerUid, rolDocId});
              }
            }
            if (!rolPartnerUid) {
              console.error("roulette_spin: partner_not_found", {spinnerUid, rolDocId,
                pareadoUid: rolSpinnerData.pareadoUid, pareamentoId: input.pareamentoId});
              tx.update(inputRef, {error: "partner_not_found", processed: false});
              return;
            }

            const rolPartnerRef = admin.firestore()
                .collection("usuarios").doc(rolPartnerUid);
            const rolPartnerSnap = await tx.get(rolPartnerRef);
            if (!rolPartnerSnap.exists) {
              console.error("roulette_spin: partner doc not_found", rolPartnerUid);
              tx.update(inputRef, {error: "partner_not_found", processed: false});
              return;
            }

            // Verifica pareamento — pula checagem se o parceiro já girou (o primeiro
            // giro já passou por areUsersPaired; confiamos no doc existente)
            const respostasExistentes = Object.assign({}, rolData.respostas || {});
            const parceirojáGirou = Object.keys(respostasExistentes)
                .some((u) => u !== spinnerUid);
            if (!parceirojáGirou &&
                !areUsersPaired(rolSpinnerData, rolPartnerSnap.data(),
                    spinnerUid, rolPartnerUid)) {
              console.error("roulette_spin: usuarios_nao_pareados", {spinnerUid, rolPartnerUid});
              tx.update(inputRef, {error: "usuarios_nao_pareados", processed: false});
              return;
            }

            const rolPairUids = Array.isArray(rolData.pairUids) &&
              rolData.pairUids.length === 2 ?
              [...rolData.pairUids] : [spinnerUid, rolPartnerUid].sort();
            const rolRespostas = Object.assign({}, rolData.respostas || {});
            if (rolRespostas[spinnerUid] !== undefined) {
              tx.update(inputRef, {processed: true,
                processedAt: admin.firestore.FieldValue.serverTimestamp(),
                processedBy: "functions.processInput"});
              return;
            }
            const spinResult = pickRouletteValue(ROULETTE_OPTIONS);
            rolRespostas[spinnerUid] = spinResult;
            const rolRespondeuEm = Object.assign({}, rolData.respondeuEm || {});
            rolRespondeuEm[spinnerUid] = nowTs;
            const valorA = rolRespostas[rolPairUids[0]];
            const valorB = rolRespostas[rolPairUids[1]];
            const bothSpun = valorA !== undefined && valorB !== undefined;
            let rolStatus = "pendente";
            let rolConcluido = false;
            let rolRewarded = false;
            if (bothSpun) {
              const soma = Number(valorA) + Number(valorB);
              let cpR3 = null;
              let cpD3 = null;
              if (input.pareamentoId) {
                cpR3 = admin.firestore()
                    .collection("pareamentos").doc(String(input.pareamentoId));
                const cpS3 = await tx.get(cpR3);
                if (cpS3.exists) cpD3 = cpS3.data();
              }
              rolStatus = "concluido";
              rolConcluido = true;
              rolRewarded = true;
              if (soma !== 0) {
                tx.update(rolSpinnerRef, {
                  foguinhos: admin.firestore.FieldValue.increment(soma),
                });
                tx.update(rolPartnerRef, {
                  foguinhos: admin.firestore.FieldValue.increment(soma),
                });
              }
              if (cpR3 && cpD3) {
                if (soma !== 0) {
                  const f1 = cpD3.pessoa1Uid === spinnerUid ?
                      "foguinhos_pessoa1" : "foguinhos_pessoa2";
                  const f2 = cpD3.pessoa1Uid === rolPartnerUid ?
                      "foguinhos_pessoa1" : "foguinhos_pessoa2";
                  tx.update(cpR3, {
                    [f1]: admin.firestore.FieldValue.increment(soma),
                    [f2]: admin.firestore.FieldValue.increment(soma),
                  });
                }
                const somaLabel = soma >= 0 ? `+${soma}` : `${soma}`;
                tx.set(cpR3.collection("extrato").doc(), {
                  tipo: "desafio",
                  descricao: `Roleta \uD83C\uDFB0: ${somaLabel} foguinho(s) para cada um`,
                  valor: soma, beneficiarioUid: spinnerUid,
                  autorUid: spinnerUid, autorNome: "Roleta",
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  createdAtMs: Date.now(),
                });
                tx.set(cpR3.collection("extrato").doc(), {
                  tipo: "desafio",
                  descricao: `Roleta \uD83C\uDFB0: ${somaLabel} foguinho(s) para cada um`,
                  valor: soma, beneficiarioUid: rolPartnerUid,
                  autorUid: rolPartnerUid, autorNome: "Roleta",
                  timestamp: admin.firestore.FieldValue.serverTimestamp(),
                  createdAtMs: Date.now(),
                });
              }
              const somaLabel = soma >= 0 ? `+${soma}` : `${soma}`;
              tx.set(admin.firestore().collection("notificacoes").doc(), {
                userId: spinnerUid, titulo: "Roleta conclu\u00edda! \uD83C\uDFB0",
                mensagem: `${somaLabel} foguinho(s) para cada um!`,
                icone: "fa-dice", tipo: "desafio",
                redirectTo: "achievementsPopup", lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
              tx.set(admin.firestore().collection("notificacoes").doc(), {
                userId: rolPartnerUid, titulo: "Roleta conclu\u00edda! \uD83C\uDFB0",
                mensagem: `${somaLabel} foguinho(s) para cada um!`,
                icone: "fa-dice", tipo: "desafio",
                redirectTo: "achievementsPopup", lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
            } else {
              tx.set(admin.firestore().collection("notificacoes").doc(), {
                userId: rolPartnerUid,
                titulo: "Seu parceiro girou a roleta! \uD83C\uDFB0",
                mensagem: "Agora \u00e9 a sua vez. Gire e descubra!",
                icone: "fa-dice", tipo: "desafio",
                redirectTo: "achievementsPopup", lida: false,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
            tx.set(rolRef, {
              id: rolDocId, pairUids: rolPairUids,
              respostas: rolRespostas, respondeuEm: rolRespondeuEm,
              status: rolStatus, concluido: rolConcluido, rewarded: rolRewarded,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              ...(bothSpun ? {completedAt: nowTs} : {}),
            }, {merge: true});
            tx.update(inputRef, {
              processed: true,
              processedAt: admin.firestore.FieldValue.serverTimestamp(),
              processedBy: "functions.processInput",
            });
          });
          /* eslint-enable max-len */
          console.log("processInput: roulette_spin processado", inputId);
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
