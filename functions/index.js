/* eslint-disable require-jsdoc */
const firestore = require("firebase-functions/v2/firestore");
const {onDocumentCreated, onDocumentUpdated} = firestore;
const {setGlobalOptions} = require("firebase-functions/v2");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const RATE_LIMIT_STORE = new Map();

function getClientIp(req) {
  const forwarded = req.get("X-Forwarded-For") || req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function rateLimitHttp(req, res, {keyPrefix, limit, windowMs}) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const entry = RATE_LIMIT_STORE.get(key);

  if (!entry || (now - entry.start) > windowMs) {
    RATE_LIMIT_STORE.set(key, {start: now, count: 1});
  } else {
    entry.count += 1;
    if (entry.count > limit) {
      res.status(429).send({error: "rate_limited"});
      return true;
    }
  }

  if (RATE_LIMIT_STORE.size > 5000) {
    for (const [storedKey, storedEntry] of RATE_LIMIT_STORE.entries()) {
      if ((now - storedEntry.start) > windowMs * 2) {
        RATE_LIMIT_STORE.delete(storedKey);
      }
    }
  }

  return false;
}

setGlobalOptions({
  region: "southamerica-east1",
});

const WEEKLY_CHALLENGE_QUESTIONS = [
  "Qual é a música que representa vocês dois?",
  "Qual o local que nós demos o primeiro beijo?",
  "Qual foi o primeiro filme que vimos juntos?",
  "Qual é a nossa comida favorita para pedir juntos?",
];
const WEEKLY_CHALLENGE_CYCLE_MS = (3 * 24 + 23) * 60 * 60 * 1000;

function getChallengeQuestionForCycle(seed, cycleIndex) {
  const seedStr = `${seed || "alma_gemea"}:${cycleIndex || 0}`;
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % WEEKLY_CHALLENGE_QUESTIONS.length;
  return WEEKLY_CHALLENGE_QUESTIONS[index];
}

function normalizePhone(value) {
  if (!value) return null;
  return String(value).replace(/\D/g, "");
}

function normalizeLeadText(value, maxLen = 160) {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, maxLen);
}

function normalizeLeadEmail(value) {
  const raw = normalizeLeadText(value, 180).toLowerCase();
  if (!raw) return "";
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  return isValid ? raw : "";
}

function normalizeLeadPhone(value) {
  const digits = normalizePhone(value) || "";
  if (!digits) return "";
  if (digits.length < 10 || digits.length > 13) return "";
  return digits;
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

  // --- Multi-conexão: verifica via pareamentosAtivos (VIP) ---
  const senderAtivos = Array.isArray(senderData.pareamentosAtivos) ?
      senderData.pareamentosAtivos : [];
  const partnerAtivos = Array.isArray(partnerData.pareamentosAtivos) ?
      partnerData.pareamentosAtivos : [];
  const senderHasPartnerInList = senderAtivos.some(
      (p) => p.uid === partnerUid);
  const partnerHasSenderInList = partnerAtivos.some(
      (p) => p.uid === senderUid);
  if (senderHasPartnerInList && partnerHasSenderInList) return true;

  // --- Fallback monogâmico (backward compat) ---
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

function normalizeChallengeAnswer(value) {
  if (!value) return "";
  return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
}

function buildMemoriaDescricao(executado, resgatado, momentoNome) {
  const executadoFinal = executado || "Alguém";
  const resgatadoFinal = resgatado || "seu par";
  const momentoFinal = momentoNome || "um momento especial";
  return `${executadoFinal} realizou ${momentoFinal} para ${resgatadoFinal}` +
    " e esse foi o registro desse momento especial";
}

function parsePayloadJson(input) {
  if (!input || typeof input.payloadJson !== "string") return null;
  try {
    return JSON.parse(input.payloadJson);
  } catch (err) {
    console.error("weekly_challenge: payloadJson inválido", err);
    return null;
  }
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

function differenceInCalendarDays(tsA, tsB) {
  const dateA = timestampToDate(tsA);
  const dateB = timestampToDate(tsB);
  if (!dateA || !dateB) return null;

  const utcA = Date.UTC(
      dateA.getUTCFullYear(),
      dateA.getUTCMonth(),
      dateA.getUTCDate(),
  );
  const utcB = Date.UTC(
      dateB.getUTCFullYear(),
      dateB.getUTCMonth(),
      dateB.getUTCDate(),
  );

  const diffMs = utcB - utcA;
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}

function isPreviousCalendarDay(tsA, tsB) {
  const diff = differenceInCalendarDays(tsA, tsB);
  return diff === 1;
}

// TODO: mover para uma coleção de configurações se quisermos editar sem deploy.
const ACHIEVEMENTS = [
  {
    id: "first_check_in",
    trigger: "daily_check_in",
    title: "Primeiro Passo",
    description: "Realize seu primeiro check-in diário com o seu par.",
    hint: "Envie um foguinho pela tela de check-in.",
    icon: "fa-person-rays",
    accentColor: "#fbbf24",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Nova conquista!",
    notificationMessage: "Você desbloqueou: Primeiro Passo",
    check: ({stats}) => (stats.totalCheckins || 0) >= 1,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      currentDailyStreak: stats.currentDailyStreak || 0,
    }),
  },
  {
    id: "checkin_streak_7",
    trigger: "daily_check_in",
    title: "Foguinho Semanal",
    description: "Complete 7 check-ins em dias consecutivos.",
    hint: "Faça check-ins diários sem perder nenhum dia.",
    icon: "fa-calendar-week",
    accentColor: "#34d399",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Conquista de Foguinho!",
    notificationMessage: "Streak de 7 dias concluída!",
    check: ({stats}) => (stats.bestDailyStreak || 0) >= 7,
    snapshot: ({stats}) => ({
      bestDailyStreak: stats.bestDailyStreak || 0,
      totalCheckins: stats.totalCheckins || 0,
    }),
  },
  {
    id: "checkin_master",
    trigger: "daily_check_in",
    title: "Mestre do Check-in",
    description: "Realize 30 check-ins no total.",
    hint: "Consistência é tudo: presenteie seu par frequentemente.",
    icon: "fa-stopwatch",
    accentColor: "#60a5fa",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Mestre do Check-in!",
    notificationMessage: "30 check-ins completados!",
    check: ({stats}) => (stats.totalCheckins || 0) >= 30,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      bestDailyStreak: stats.bestDailyStreak || 0,
    }),
  },
  {
    id: "sou_fiel",
    trigger: "daily_check_in",
    title: "Sou Fiel",
    description: "Realize 60 check-ins no total.",
    hint: "Mantenha o ritmo diário para mostrar compromisso.",
    icon: "fa-hand-holding-heart",
    accentColor: "#38bdf8",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Você é pura constância!",
    notificationMessage: "60 check-ins completos — fidelidade em alta!",
    check: ({stats}) => (stats.totalCheckins || 0) >= 60,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      bestDailyStreak: stats.bestDailyStreak || 0,
    }),
  },
  {
    id: "first_moment_redeem",
    trigger: "moment_redeem",
    title: "Primeiro Momento",
    description: "Resgate o seu primeiro momento.",
    hint: "Escolha um momento e resgate com foguinhos.",
    icon: "fa-heart",
    accentColor: "#f472b6",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Momento especial desbloqueado!",
    notificationMessage: "Você resgatou o primeiro momento.",
    check: ({stats}) => getMomentsRedeemedTotal(stats) >= 1,
    snapshot: ({stats}) => ({
      momentsRedeemed: getMomentsRedeemedTotal(stats),
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
    }),
  },
  {
    id: "moment_collector",
    trigger: "moment_redeem",
    title: "Colecionador de Momentos",
    description: "Resgate 5 momentos diferentes.",
    hint: "Continue resgatando momentos para o seu mural.",
    icon: "fa-gift",
    accentColor: "#c084fc",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Colecionador de Momentos!",
    notificationMessage: "Você resgatou 5 momentos!",
    check: ({stats}) => getMomentsRedeemedTotal(stats) >= 5,
    snapshot: ({stats}) => ({
      momentsRedeemed: getMomentsRedeemedTotal(stats),
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
    }),
  },
  {
    id: "foguinhos_investor",
    trigger: "moment_redeem",
    title: "Investidor de Foguinhos",
    description: "Gaste 50 foguinhos em momentos.",
    hint: "Momentos incríveis custam foguinhos – continue investindo!",
    icon: "fa-coins",
    accentColor: "#facc15",
    notificationIcon: "fa-trophy",
    notificationTitle: "🏆 Investidor de Foguinhos!",
    notificationMessage: "Mais de 50 foguinhos investidos em momentos.",
    check: ({stats}) => (stats.totalFoguinhosGastos || 0) >= 50,
    snapshot: ({stats}) => ({
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
      momentsRedeemed: getMomentsRedeemedTotal(stats),
    }),
  },
  {
    id: "caliente",
    trigger: "moment_redeem",
    title: "Caliente",
    description: "Gaste 100 foguinhos em momentos.",
    hint: "Continue investindo para viver experiências intensas.",
    icon: "fa-fire-flame-curved",
    accentColor: "#fb923c",
    notificationIcon: "fa-trophy",
    notificationTitle: "🔥 Modo Caliente ativado!",
    notificationMessage: "Você já investiu 100 foguinhos em momentos!",
    check: ({stats}) => (stats.totalFoguinhosGastos || 0) >= 100,
    snapshot: ({stats}) => ({
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
      momentsRedeemed: getMomentsRedeemedTotal(stats),
    }),
  },
];

const ACHIEVEMENT_REWARDS = {
  first_check_in: 1,
  checkin_streak_7: 3,
  checkin_master: 10,
  sou_fiel: 20,
  first_moment_redeem: 1,
  moment_collector: 3,
  foguinhos_investor: 10,
  caliente: 20,
};

function getMomentsRedeemedTotal(stats) {
  if (!stats || !stats.momentsRedeemed) {
    return 0;
  }
  return stats.momentsRedeemed.total || 0;
}

function summarizeStats(stats) {
  if (!stats) {
    return {
      totalCheckins: 0,
      currentDailyStreak: 0,
      bestDailyStreak: 0,
      totalFoguinhosGastos: 0,
      momentsRedeemedTotal: 0,
    };
  }

  return {
    totalCheckins: stats.totalCheckins || 0,
    currentDailyStreak: stats.currentDailyStreak || 0,
    bestDailyStreak: stats.bestDailyStreak || 0,
    totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
    momentsRedeemedTotal: getMomentsRedeemedTotal(stats),
  };
}

function grantAchievementsInTransaction({
  tx,
  userRef,
  userId,
  trigger,
  currentAchievements = {},
  statsBefore = {},
  statsAfter = {},
  eventContext = {},
}) {
  const unlocked = [];
  const achievementUpdates = {};
  const now = admin.firestore.Timestamp.now();
  let totalAchievementReward = 0;

  const knownAchievements = {...currentAchievements};

  console.log("grantAchievementsInTransaction:start", {
    trigger,
    userId,
    before: summarizeStats(statsBefore),
    after: summarizeStats(statsAfter),
    alreadyUnlocked: Object.keys(currentAchievements || {}),
  });

  for (const definition of ACHIEVEMENTS) {
    if (definition.trigger !== trigger && definition.trigger !== "any") {
      continue;
    }
    if (knownAchievements && knownAchievements[definition.id]) {
      continue;
    }

    const meetsRequirement = definition.check({
      stats: statsAfter,
      previousStats: statsBefore,
      event: eventContext,
      trigger,
      userId,
    });

    if (!meetsRequirement) {
      if (definition.id === "first_check_in" ||
        definition.id === "first_moment_redeem") {
        console.log("grantAchievementsInTransaction:requisito_nao_atendido", {
          trigger,
          userId,
          achievementId: definition.id,
          stats: summarizeStats(statsAfter),
        });
      }
      continue;
    }

    unlocked.push(definition);
    knownAchievements[definition.id] = {
      unlockedAt: now,
    };

    console.log("grantAchievementsInTransaction:desbloqueado", {
      trigger,
      userId,
      achievementId: definition.id,
    });

    const snapshot = definition.snapshot ? definition.snapshot({
      stats: statsAfter,
      previousStats: statsBefore,
      event: eventContext,
      trigger,
    }) : null;

    const achievementPayload = {
      unlockedAt: now,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      accentColor: definition.accentColor,
      trigger,
    };
    if (snapshot) {
      achievementPayload.progressSnapshot = snapshot;
    }

    const rewardAmount = ACHIEVEMENT_REWARDS[definition.id] || 0;
    if (rewardAmount > 0) {
      totalAchievementReward += rewardAmount;
      achievementPayload.reward = {
        amount: rewardAmount,
        grantedAt: now,
      };
    }

    achievementUpdates[`conquistas.${definition.id}`] = achievementPayload;

    const notifRef = admin.firestore().collection("notificacoes").doc();
    tx.set(notifRef, {
      userId,
      titulo: definition.notificationTitle || "Nova conquista desbloqueada!",
      mensagem: definition.notificationMessage ||
        `Você desbloqueou: ${definition.title}`,
      icone: definition.notificationIcon || "fa-trophy",
      tipo: "achievement",
      achievementId: definition.id,
      lida: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  if (Object.keys(achievementUpdates).length) {
    if (totalAchievementReward > 0) {
      achievementUpdates.foguinhos = admin.firestore.FieldValue.increment(
          totalAchievementReward,
      );
    }
    tx.update(userRef, achievementUpdates);
  } else if (totalAchievementReward > 0) {
    tx.update(userRef, {
      foguinhos: admin.firestore.FieldValue.increment(totalAchievementReward),
    });
  }

  return unlocked;
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
          await tokensDoc.ref.update({
            tokens: admin.firestore.FieldValue.arrayRemove(...invalidTokens),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }).catch((updateErr) => {
            console.error("Falha ao remover tokens inválidos:", updateErr);
          });
        }
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
            // Limpa o pending do sender para não ficar preso em estado fantasma
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
              partnerNickname: input.partnerNickname || null,
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

              // Atualiza campos legados (pareadoCom/pareadoUid) — sempre
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
              // O sender escolheu o apelido, então "apelido" é o nome carinhoso
              // que o sender deu ao receiver
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
              mensagem: `${giverName} te presenteou com 1 foguinho 🔥.`,
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

            // --- Multi-conexão: lê pareamento para saldo per-conexão ---
            let pareamentoRef = null;
            let pareamentoSnap = null;
            let pData = null;
            let isSenderPessoa1 = false;
            let foguinhosField = "";
            let saldoAtual = senderData.foguinhos || 0;

            if (pareamentoId) {
              pareamentoRef = admin.firestore()
                  .collection("pareamentos").doc(pareamentoId);
              pareamentoSnap = await tx.get(pareamentoRef);
              if (pareamentoSnap.exists) {
                pData = pareamentoSnap.data();
                isSenderPessoa1 = pData.pessoa1Uid === fromUid;
                foguinhosField = isSenderPessoa1 ?
                    "foguinhos_pessoa1" : "foguinhos_pessoa2";
                // Usa saldo per-conexão como fonte de verdade
                saldoAtual = pData[foguinhosField] || 0;
              }
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

            // --- Multi-conexão: deduz foguinhos do doc de pareamento ---
            if (pareamentoRef && pareamentoSnap && pareamentoSnap.exists) {
              tx.update(pareamentoRef, {
                [foguinhosField]:
                  admin.firestore.FieldValue.increment(-totalCost),
              });

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

          await admin.firestore().runTransaction(async (tx) => {
            const inSnap = await tx.get(inputRef);
            if (!inSnap.exists) throw new Error("input não existe");
            if (inSnap.data().processed) return;

            const responderSnap = await tx.get(responderRef);
            if (!responderSnap.exists) {
              tx.update(inputRef, {
                error: "responder_not_found",
                processed: false,
              });
              return;
            }

            const responderData = responderSnap.data();
            const partnerUid = responderData.pareadoUid || null;
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
              if (answerA === answerB) {
                status = "finalizado";
                if (!rewarded) {
                  const reward = Number(challengeData.reward || 1);
                  if (reward > 0) {
                    tx.update(responderRef, {
                      foguinhos: admin.firestore.FieldValue.increment(reward),
                    });
                    tx.update(partnerRef, {
                      foguinhos: admin.firestore.FieldValue.increment(reward),
                    });

                    // --- Multi-conexão: credita no doc de pareamento ---
                    const challengePareamentoId =
                      input.pareamentoId || null;
                    if (challengePareamentoId) {
                      const cpRef = admin.firestore()
                          .collection("pareamentos")
                          .doc(challengePareamentoId);
                      const cpSnap = await tx.get(cpRef);
                      if (cpSnap.exists) {
                        const cpData = cpSnap.data();
                        const field1 = cpData.pessoa1Uid === responderUid ?
                            "foguinhos_pessoa1" : "foguinhos_pessoa2";
                        const field2 = cpData.pessoa1Uid === partnerUid ?
                            "foguinhos_pessoa1" : "foguinhos_pessoa2";
                        tx.update(cpRef, {
                          [field1]: admin.firestore.FieldValue.increment(
                              reward),
                          [field2]: admin.firestore.FieldValue.increment(
                              reward),
                          desafiosConcluidos:
                            admin.firestore.FieldValue.increment(1),
                        });

                        // --- Extrato: desafio semanal ---
                        const extratoRef1 = cpRef
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
                        const extratoRef2 = cpRef
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
                  }
                  rewarded = true;
                }
              } else {
                status = "finalizado_sem_recompensa";
                rewarded = false;
              }
              completedAt = nowTs;
            }

            // --- Notificações do desafio ---
            const responderName = input.responderName || "Seu parceiro";
            if (concluido) {
              if (status === "finalizado") {
                const rewardN = Number(challengeData.reward || 1);
                const notifR = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifR, {
                  userId: responderUid,
                  titulo: "Desafio concluído! 🎉",
                  mensagem: `Vocês responderam igual no desafio` +
                    ` — ganharam ${rewardN} foguinho(s) cada!`,
                  icone: "fa-trophy",
                  tipo: "desafio",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
                const notifP = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifP, {
                  userId: partnerUid,
                  titulo: "Desafio concluído! 🎉",
                  mensagem: `Vocês responderam igual no desafio` +
                    ` — ganharam ${rewardN} foguinho(s) cada!`,
                  icone: "fa-trophy",
                  tipo: "desafio",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
              } else {
                const notifR2 = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifR2, {
                  userId: responderUid,
                  titulo: "Desafio finalizado",
                  mensagem: "As respostas foram diferentes" +
                    " desta vez. Na próxima vocês acertam!",
                  icone: "fa-trophy",
                  tipo: "desafio",
                  lida: false,
                  timestamp:
                    admin.firestore.FieldValue.serverTimestamp(),
                });
                const notifP2 = admin.firestore()
                    .collection("notificacoes").doc();
                tx.set(notifP2, {
                  userId: partnerUid,
                  titulo: "Desafio finalizado",
                  mensagem: "As respostas foram diferentes" +
                    " desta vez. Na próxima vocês acertam!",
                  icone: "fa-trophy",
                  tipo: "desafio",
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
                titulo: "Desafio da semana 🧩",
                mensagem: `${responderName} já respondeu` +
                  ` o desafio. Agora é a sua vez!`,
                icone: "fa-trophy",
                tipo: "desafio",
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
              const senderAtivos = Array.isArray(senderData.pareamentosAtivos) ?
                  senderData.pareamentosAtivos : [];
              const senderUpdatedAtivos = senderAtivos.filter(
                  (p) => p.uid !== partnerUid);
              const hasOtherConnections = senderUpdatedAtivos.length > 0;

              // Sender update
              const senderUpdate = {
                pareamentosAtivos: senderUpdatedAtivos,
              };
              if (!hasOtherConnections) {
                // Última conexão removida — limpa campos legados
                senderUpdate.pareadoCom =
                  admin.firestore.FieldValue.delete();
                senderUpdate.pareadoUid =
                  admin.firestore.FieldValue.delete();
                senderUpdate.foguinhos = 0;
                senderUpdate.lastCheckInDate =
                  admin.firestore.FieldValue.delete();
              } else {
                // Ainda tem conexões — atualiza legados para o primeiro
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
            const todayStr = nowTs.toDate().toISOString().slice(0, 10);
            const climaDiarioRef = pareamentoRef
                .collection("climaDiario").doc(todayStr);
            tx.set(climaDiarioRef, {
              [fromUid]: {humor: humor, registradoEm: nowTs},
            }, {merge: true});

            // --- Cria entrada no extrato ---
            const HUMOR_LABELS = {
              muito_feliz: "Muito Feliz ❤️‍🔥",
              feliz: "Feliz 🔥",
              normal: "Normal 😊",
              triste: "Triste 😢",
            };
            if (delta !== 0) {
              const extratoRef = pareamentoRef
                  .collection("extrato").doc();
              tx.set(extratoRef, {
                tipo: "clima",
                descricao: `Termômetro: ${HUMOR_LABELS[humor]}`,
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
            };

            tx.update(senderRef, {
              lastCheckInDate: nowTs,
              achievementStats: updatedStats,
            });

            // --- Notificação para o parceiro ---
            const notifRef = admin.firestore()
                .collection("notificacoes").doc();
            const giverName = senderData.nome || "Seu parceiro";
            let notifMsg;
            if (delta > 0) {
              notifMsg = `${giverName} marcou "` +
                `${HUMOR_LABELS[humor]}" — ` +
                `você ganhou ${delta} foguinho(s)! 🔥`;
            } else if (delta < 0) {
              notifMsg = `${giverName} marcou "` +
                `${HUMOR_LABELS[humor]}" — ` +
                `${Math.abs(delta)} foguinho(s) removidos.`;
            } else {
              notifMsg = `${giverName} marcou "` +
                `${HUMOR_LABELS[humor]}" hoje.`;
            }

            tx.set(notifRef, {
              userId: partnerUid,
              titulo: "Termômetro do Dia",
              mensagem: notifMsg,
              icone: "fa-thermometer-half",
              lida: false,
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
            });

            // --- Achievements ---
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

          const executeUid = taskData.executadoPorUid;
          const rawIntensity = Number(taskData.custoFoguinhos);
          const intensity = Number.isFinite(rawIntensity) ? rawIntensity : 0;
          const baseReward = Math.round(intensity * 0.5);
          const rewardAmount = intensity > 0 ? Math.max(1, baseReward) : 0;

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
              descricao: `Bônus: realizou "` +
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
        console.error("handleMomentTaskUpdate: erro ao conceder bônus", {
          taskId,
          error,
        });
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

            const senderData = senderSnap.data() || {};
            const receiverData = receiverSnap.data() || {};
            const MIN_FOGUINHOS = 10;

            // Atualiza campo pareadoCom para ambos — feita com privilégios
            // do Admin
            const senderUpdate = {
              pareadoCom: receiverPhone,
              pareadoUid: receiverUid,
            };
            const receiverUpdate = {
              pareadoCom: senderPhone,
              pareadoUid: senderUid,
            };

            const senderFoguinhos = Number(senderData.foguinhos);
            const senderNeedsTopUp = !Number.isFinite(senderFoguinhos) ||
              senderFoguinhos < MIN_FOGUINHOS;
            if (senderNeedsTopUp) {
              senderUpdate.foguinhos = MIN_FOGUINHOS;
            }

            const receiverFoguinhos = Number(receiverData.foguinhos);
            const receiverNeedsTopUp = !Number.isFinite(receiverFoguinhos) ||
              receiverFoguinhos < MIN_FOGUINHOS;
            if (receiverNeedsTopUp) {
              receiverUpdate.foguinhos = MIN_FOGUINHOS;
            }

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
              // Campos isolados por conexão (multi-conexão)
              foguinhos_pessoa1: 10,
              foguinhos_pessoa2: 10,
              streak_pessoa1: {
                currentDailyStreak: 0,
                bestDailyStreak: 0,
                lastCheckInDate: null,
              },
              streak_pessoa2: {
                currentDailyStreak: 0,
                bestDailyStreak: 0,
                lastCheckInDate: null,
              },
              desafiosConcluidos: 0,
            };

            tx.set(
                pareamentoRef,
                pareamentoData,
                {merge: true},
            );

            // pareamentosAtivos é gerenciado exclusivamente pelo
            // handler pairing_response em processInput para evitar
            // duplicatas (ambos os triggers rodam na mesma transição).

            tx.update(senderRef, senderUpdate);
            tx.update(receiverRef, receiverUpdate);

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
  if (rateLimitHttp(req, res, {
    keyPrefix: "runPairingTests",
    limit: 5,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }
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

exports.setNotificationToken = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "*";
  const allowOrigin = originHeader === "null" ? "*" : originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
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

exports.getMemorias = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "*";
  const allowOrigin = originHeader === "null" ? "*" : originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "getMemorias",
    limit: 120,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const rawLimit = req.body && req.body.limit;
  const limitNum = Number(rawLimit);
  const limit = Number.isFinite(limitNum) ?
    Math.min(Math.max(limitNum, 1), 200) :
    50;

  const rawStartMs = req.body && req.body.startMs;
  const rawEndMs = req.body && req.body.endMs;
  const startMs = Number(rawStartMs);
  const endMs = Number(rawEndMs);
  const useRange = Number.isFinite(startMs) && Number.isFinite(endMs);

  const pareamentoId = req.body && typeof req.body.pareamentoId === "string" ?
    req.body.pareamentoId :
    "";
  const usePareamento = !!pareamentoId;

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    const db = admin.firestore();
    let query = db
        .collection("memorias")
        .where("pairUids", "array-contains", uid);

    if (usePareamento) {
      query = query.where("pareamentoId", "==", pareamentoId);
    }

    if (useRange) {
      query = query
          .where("createdAtMs", ">=", startMs)
          .where("createdAtMs", "<=", endMs)
          .orderBy("createdAtMs", "desc");
    } else {
      query = query.orderBy("createdAtMs", "desc");
    }

    let snapshot = null;
    try {
      snapshot = await query.limit(limit + 1).get();
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      const code = err && err.code ? err.code : null;
      const shouldFallback = code === 9 ||
        code === "FAILED_PRECONDITION" ||
        msg.toLowerCase().includes("index");

      if (!shouldFallback) {
        throw err;
      }

      let fallbackQuery = db
          .collection("memorias")
          .where("pairUids", "array-contains", uid);

      if (usePareamento) {
        fallbackQuery = fallbackQuery.where("pareamentoId", "==", pareamentoId);
      }

      snapshot = await fallbackQuery.limit(limit + 1).get();
    }

    let docs = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    if (useRange) {
      docs = docs.filter((doc) =>
        (doc.createdAtMs || 0) >= startMs && (doc.createdAtMs || 0) <= endMs,
      );
    }

    docs.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit);

    res.send({items, hasMore});
  } catch (err) {
    console.error("getMemorias error:", err);
    res.status(500).send({error: "get_memorias_failed"});
  }
});

// ============================================================
// getExtrato — Busca extrato de foguinhos de um pareamento
// ============================================================
exports.getExtrato = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "*";
  const allowOrigin = originHeader === "null" ? "*" : originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "getExtrato",
    limit: 120,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }
  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const pareamentoId = req.body && typeof req.body.pareamentoId === "string" ?
    req.body.pareamentoId : "";
  if (!pareamentoId) {
    res.status(400).send({error: "missing_pareamento_id"});
    return;
  }

  const rawLimit = req.body && req.body.limit;
  const limitNum = Number(rawLimit);
  const limit = Number.isFinite(limitNum) ?
    Math.min(Math.max(limitNum, 1), 100) : 20;

  const rawStartAfter = req.body && req.body.startAfterMs;
  const startAfterMs = Number(rawStartAfter);
  const useStartAfter = Number.isFinite(startAfterMs);

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;

    // Verifica que o user pertence ao pareamento
    const pareamentoSnap = await admin.firestore()
        .collection("pareamentos").doc(pareamentoId).get();
    if (!pareamentoSnap.exists) {
      res.status(404).send({error: "pareamento_not_found"});
      return;
    }
    const pData = pareamentoSnap.data();
    if (pData.pessoa1Uid !== uid && pData.pessoa2Uid !== uid) {
      res.status(403).send({error: "not_authorized"});
      return;
    }

    let query = admin.firestore()
        .collection("pareamentos").doc(pareamentoId)
        .collection("extrato")
        .orderBy("createdAtMs", "desc");

    if (useStartAfter) {
      query = query.where("createdAtMs", "<", startAfterMs);
    }

    const snapshot = await query.limit(limit + 1).get();
    const docs = snapshot.docs.map((doc) => ({id: doc.id, ...doc.data()}));
    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit);

    // Converte timestamps do Firestore para millis para o frontend
    items.forEach((item) => {
      if (item.timestamp && typeof item.timestamp.toMillis === "function") {
        item.timestampMs = item.timestamp.toMillis();
      }
      delete item.timestamp;
    });

    res.send({items, hasMore});
  } catch (err) {
    console.error("getExtrato error:", err);
    res.status(500).send({error: "get_extrato_failed"});
  }
});

exports.createMemoriaPhoto = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "*";
  const allowOrigin = originHeader === "null" ? "*" : originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "createMemoriaPhoto",
    limit: 10,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const body = req.body || {};
  const tarefaId = typeof body.tarefaId === "string" ? body.tarefaId : "";
  const fileName = typeof body.fileName === "string" ?
    body.fileName :
    "memoria";
  const contentType = typeof body.contentType === "string" ?
    body.contentType :
    "image/jpeg";
  const base64 = typeof body.base64 === "string" ? body.base64 : "";

  if (!tarefaId || !base64) {
    res.status(400).send({error: "invalid_payload"});
    return;
  }

  if (!contentType.startsWith("image/")) {
    res.status(400).send({error: "invalid_content_type"});
    return;
  }

  let buffer = null;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch (err) {
    res.status(400).send({error: "invalid_base64"});
    return;
  }

  const maxBytes = 5 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    res.status(400).send({error: "image_too_large"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const tarefaRef = db.collection("tarefasMomentos").doc(tarefaId);
    const tarefaSnap = await tarefaRef.get();

    if (!tarefaSnap.exists) {
      res.status(404).send({error: "tarefa_not_found"});
      return;
    }

    const tarefa = tarefaSnap.data() || {};
    const executadoUid = tarefa.executadoPorUid || null;
    const resgatadoUid = tarefa.resgatadoPorUid || null;

    if (uid !== executadoUid && uid !== resgatadoUid) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const pareamentoId = tarefa.idPareamento ||
      tarefa.pareamentoId ||
      tarefa.pareamentoAmigavelId ||
      "";
    const pairUids = [executadoUid, resgatadoUid].filter(Boolean).sort();

    const safeName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `memorias/${pareamentoId}/${uid}/${tarefaId}/` +
      `${Date.now()}_${safeName}`;

    const bucket = admin.storage().bucket();
    const token = crypto.randomUUID();
    await bucket.file(filePath).save(buffer, {
      metadata: {
        contentType,
        metadata: {
          firebaseStorageDownloadTokens: token,
        },
      },
    });

    const encodedPath = encodeURIComponent(filePath);
    const downloadURL =
      `https://firebasestorage.googleapis.com/v0/b/${bucket.name}` +
      `/o/${encodedPath}?alt=media&token=${token}`;

    let executadoNome = tarefa.executadoPorNome || "";
    let resgatadoNome = tarefa.resgatadoPorNome || "";

    if (!executadoNome && executadoUid) {
      const snap = await db
          .collection("usuarios")
          .doc(executadoUid)
          .get();
      executadoNome = snap.exists ? (snap.data().nome || "") : "";
    }

    if (!resgatadoNome && resgatadoUid) {
      const snap = await db
          .collection("usuarios")
          .doc(resgatadoUid)
          .get();
      resgatadoNome = snap.exists ? (snap.data().nome || "") : "";
    }

    const descricao = buildMemoriaDescricao(
        executadoNome,
        resgatadoNome,
        tarefa.momentoNome || null,
    );

    const momentoCategoria = tarefa.momentoCategoria ||
      tarefa.categoria ||
      null;
    const memoriaSchemaVersion = 2;
    const payload = {
      tarefaId,
      momentoNome: tarefa.momentoNome || null,
      momentoCategoria,
      categoria: momentoCategoria,
      memoriaSchemaVersion,
      custoFoguinhos: Number.isFinite(Number(tarefa.custoFoguinhos)) ?
        Number(tarefa.custoFoguinhos) :
        0,
      fotoUrl: downloadURL,
      fotoPath: filePath,
      pareamentoId: pareamentoId || null,
      pairUids,
      executadoPorUid: executadoUid,
      resgatadoPorUid: resgatadoUid,
      executadoPorNome: executadoNome || null,
      resgatadoPorNome: resgatadoNome || null,
      descricao,
      autorUid: uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    };

    const memoriaRef = await db.collection("memorias").add(payload);
    res.send({item: {id: memoriaRef.id, ...payload}});
  } catch (err) {
    console.error("createMemoriaPhoto error:", err);
    res.status(500).send({error: "create_memoria_failed"});
  }
});

exports.deleteMemoria = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "*";
  const allowOrigin = originHeader === "null" ? "*" : originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "deleteMemoria",
    limit: 20,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") || req.get("authorization") || "";
  let idToken = null;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  if (!idToken) {
    res.status(401).send({error: "missing_id_token"});
    return;
  }

  const body = req.body || {};
  const memoriaId = typeof body.memoriaId === "string" ? body.memoriaId : "";

  if (!memoriaId) {
    res.status(400).send({error: "invalid_payload"});
    return;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const db = admin.firestore();
    const memoriaRef = db.collection("memorias").doc(memoriaId);
    const memoriaSnap = await memoriaRef.get();

    if (!memoriaSnap.exists) {
      res.status(404).send({error: "memoria_not_found"});
      return;
    }

    const memoria = memoriaSnap.data() || {};
    const pairUids = Array.isArray(memoria.pairUids) ? memoria.pairUids : [];
    const isAllowed = pairUids.includes(uid) || memoria.autorUid === uid;

    if (!isAllowed) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const bucket = admin.storage().bucket();
    const fotoPath = memoria.fotoPath || null;
    if (fotoPath) {
      try {
        await bucket.file(fotoPath).delete({ignoreNotFound: true});
      } catch (err) {
        console.warn("deleteMemoria: falha ao remover arquivo", err);
      }
    }

    await memoriaRef.delete();
    res.send({ok: true});
  } catch (err) {
    console.error("deleteMemoria error:", err);
    res.status(500).send({error: "delete_memoria_failed"});
  }
});

// HTTP endpoint seguro para criar um `input` via Admin SDK.
// O cliente envia um idToken (Authorization: Bearer <token>) e o objeto
// `input` no body. A função verifica o token, valida fromUid e cria o
// documento em `inputs` com privilégios admin.
exports.joinWaitlist = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "";
  const allowOrigin = (originHeader === "null" || !originHeader) ?
    "*" :
    originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "joinWaitlist",
    limit: 30,
    windowMs: 60 * 1000,
  })) {
    return;
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    const nome = normalizeLeadText(body.nome, 120);
    const email = normalizeLeadEmail(body.email);
    const telefoneWhatsapp = normalizeLeadPhone(body.telefoneWhatsapp);
    const nomeParceiro = normalizeLeadText(body.nomeParceiro, 120);
    const telefoneWhatsappParceiro = normalizeLeadPhone(
        body.telefoneWhatsappParceiro,
    );
    const cidade = normalizeLeadText(body.cidade, 80);
    const estado = normalizeLeadText(body.estado, 32).toUpperCase();
    const source = normalizeLeadText(body.source || "cadastrovip", 80);
    const utmSource = normalizeLeadText(body.utm_source, 120);
    const utmMedium = normalizeLeadText(body.utm_medium, 120);
    const utmCampaign = normalizeLeadText(body.utm_campaign, 160);

    if (!nome) {
      res.status(400).send({error: "missing_nome"});
      return;
    }
    if (!email) {
      res.status(400).send({error: "invalid_email"});
      return;
    }
    if (!telefoneWhatsapp) {
      res.status(400).send({error: "invalid_telefone_whatsapp"});
      return;
    }
    if (!nomeParceiro) {
      res.status(400).send({error: "missing_nome_parceiro"});
      return;
    }
    if (!telefoneWhatsappParceiro) {
      res.status(400).send({error: "invalid_telefone_whatsapp_parceiro"});
      return;
    }

    const db = admin.firestore();
    const dedupKey = `${email}|${telefoneWhatsapp}`;
    const leadHash = crypto.createHash("sha256")
        .update(dedupKey)
        .digest("hex")
        .slice(0, 32);
    const docId = `lead_${leadHash}`;
    const ref = db.collection("lista-de-espera").doc(docId);
    const snap = await ref.get();

    const payload = {
      nome,
      email,
      telefoneWhatsapp,
      nomeParceiro,
      telefoneWhatsappParceiro,
      cidade: cidade || null,
      estado: estado || null,
      source,
      utm_source: utmSource || null,
      utm_medium: utmMedium || null,
      utm_campaign: utmCampaign || null,
      status: "novo",
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      submissions: admin.firestore.FieldValue.increment(1),
    };

    if (!snap.exists) {
      payload.createdAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ref.set(payload, {merge: true});
    res.send({ok: true, id: docId, created: !snap.exists});
  } catch (err) {
    console.error("joinWaitlist: error", err);
    res.status(500).send({error: "join_waitlist_failed"});
  }
});

exports.createInput = https.onRequest(async (req, res) => {
  // CORS: permitir chamadas do browser (preflight OPTIONS + POST)
  const originHeader = req.get("Origin") || req.get("origin") || "";
  const allowOrigin = (
      originHeader === "null" || !originHeader ? "*" : originHeader
  );
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    // Preflight request
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "createInput",
    limit: 60,
    windowMs: 60 * 1000,
  })) {
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
      "clima_update",
      "weekly_challenge_seed",
      "weekly_challenge_start",
      "weekly_challenge_upsert",
      "weekly_challenge_answer",
      "weekly_challenge_timeout",
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

async function deleteCollectionInBatches(db, collectionPath, batchSize = 200) {
  let deleted = 0;
  let hasMore = true;
  while (hasMore) {
    const snapshot = await db.collection(collectionPath)
        .limit(batchSize)
        .get();
    if (snapshot.empty) {
      break;
    }
    const batch = db.batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snapshot.size;
    hasMore = snapshot.size >= batchSize;
  }
  return deleted;
}

async function deleteWeeklyChallengeInputs(db, batchSize = 200) {
  const types = [
    "weekly_challenge_seed",
    "weekly_challenge_start",
    "weekly_challenge_upsert",
    "weekly_challenge_answer",
    "weekly_challenge_timeout",
  ];
  let deleted = 0;
  for (const type of types) {
    let hasMore = true;
    while (hasMore) {
      const snapshot = await db.collection("inputs")
          .where("type", "==", type)
          .limit(batchSize)
          .get();
      if (snapshot.empty) {
        break;
      }
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += snapshot.size;
      hasMore = snapshot.size >= batchSize;
    }
  }
  return deleted;
}

async function upsertWeeklyChallengeForPair({
  db,
  pairUids,
  pareamentoId,
  nowMs,
  forceReset = false,
}) {
  const sortedUids = [...pairUids].sort();
  const pairKey = sortedUids.join("_");
  const challengeDocId = `alma_gemea_${pairKey}`;
  const challengeRef = db.collection("weeklyChallenges").doc(challengeDocId);
  const snap = await challengeRef.get();
  const nowTs = admin.firestore.Timestamp.fromMillis(nowMs);

  if (!snap.exists) {
    const pergunta = getChallengeQuestionForCycle(pairKey, 0);
    await challengeRef.set({
      id: challengeDocId,
      challengeId: "alma_gemea",
      titulo: "Alma Gêmea",
      descricao: "Respondam a mesma pergunta para ganhar 1 foguinho.",
      pergunta,
      reward: 1,
      status: "pendente",
      pairUids: sortedUids,
      pareamentoId: pareamentoId || null,
      cycleIndex: 0,
      respostas: {},
      respondeuEm: {},
      respondeuNome: {},
      concluido: false,
      rewarded: false,
      createdAtMs: nowMs,
      criadoEm: nowTs,
      startedAtMs: nowMs,
      startedAt: nowTs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return "created";
  }

  const data = snap.data() || {};
  const startedAtMs = Number(data.startedAtMs || data.createdAtMs || 0) || 0;
  const cycleIndex = Number.isFinite(Number(data.cycleIndex)) ?
    Number(data.cycleIndex) :
    0;
  const isExpired = !startedAtMs || (nowMs - startedAtMs) >=
    WEEKLY_CHALLENGE_CYCLE_MS;
  const shouldReset = forceReset || isExpired;

  if (!shouldReset) {
    return "skipped";
  }

  const nextIndex = cycleIndex + 1;
  const pergunta = getChallengeQuestionForCycle(pairKey, nextIndex);
  await challengeRef.set({
    id: challengeDocId,
    challengeId: data.challengeId || "alma_gemea",
    titulo: data.titulo || "Alma Gêmea",
    descricao: data.descricao ||
      "Respondam a mesma pergunta para ganhar 1 foguinho.",
    pergunta,
    reward: Number.isFinite(Number(data.reward)) ? Number(data.reward) : 1,
    status: "pendente",
    pairUids: sortedUids,
    pareamentoId: pareamentoId || data.pareamentoId || null,
    cycleIndex: nextIndex,
    respostas: {},
    respondeuEm: {},
    respondeuNome: {},
    respostaUsuario: null,
    respostaParceiro: null,
    parceiroNomeResposta: null,
    concluido: false,
    rewarded: false,
    completedAt: null,
    completedAtMs: null,
    createdAtMs: nowMs,
    criadoEm: nowTs,
    startedAtMs: nowMs,
    startedAt: nowTs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});

  return forceReset ? "reset" : "rotated";
}

exports.rotateWeeklyChallenges = onSchedule({
  schedule: "every 6 hours",
  timeZone: "America/Sao_Paulo",
}, async () => {
  const db = admin.firestore();
  const nowMs = Date.now();
  const pareamentosSnap = await db.collection("pareamentos").get();
  let created = 0;
  let rotated = 0;
  let skipped = 0;

  for (const doc of pareamentosSnap.docs) {
    const data = doc.data() || {};
    const uidA = data.pessoa1Uid || null;
    const uidB = data.pessoa2Uid || null;
    if (!uidA || !uidB) {
      continue;
    }

    const result = await upsertWeeklyChallengeForPair({
      db,
      pairUids: [uidA, uidB],
      pareamentoId: doc.id,
      nowMs,
    });

    if (result === "created") {
      created += 1;
    } else if (result === "rotated") {
      rotated += 1;
    } else {
      skipped += 1;
    }
  }

  console.log("rotateWeeklyChallenges: done", {
    total: pareamentosSnap.size,
    created,
    rotated,
    skipped,
  });
});

exports.resetWeeklyChallengesAdmin = https.onRequest(async (req, res) => {
  const originHeader = req.get("Origin") || req.get("origin") || "";
  const allowOrigin = (originHeader === "null" || !originHeader) ?
    "*" :
    originHeader;
  const requestedHeaders = req.get("Access-Control-Request-Headers");

  res.set("Access-Control-Allow-Origin", allowOrigin);
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      requestedHeaders || "Authorization, Content-Type",
  );
  res.set("Vary", "Origin");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).send({error: "method_not_allowed"});
    return;
  }

  if (rateLimitHttp(req, res, {
    keyPrefix: "resetWeeklyChallengesAdmin",
    limit: 10,
    windowMs: 5 * 60 * 1000,
  })) {
    return;
  }

  const authHeader = req.get("Authorization") ||
    req.get("authorization") || "";
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
    const adminClaim = decoded && decoded.admin === true;
    let isAllowed = adminClaim;
    if (!isAllowed) {
      const adminDoc = await admin.firestore()
          .collection("adminUsers")
          .doc(decoded.uid)
          .get();
      isAllowed = adminDoc.exists;
    }
    if (!isAllowed) {
      res.status(403).send({error: "forbidden"});
      return;
    }

    const db = admin.firestore();
    const weeklyChallengesDeleted = await deleteCollectionInBatches(
        db,
        "weeklyChallenges",
    );
    const inputsDeleted = await deleteWeeklyChallengeInputs(db);

    res.send({
      ok: true,
      weeklyChallengesDeleted,
      inputsDeleted,
    });
  } catch (err) {
    console.error("resetWeeklyChallengesAdmin: error", err);
    if (err && err.code === "auth/argument-error") {
      res.status(401).send({error: "invalid_token"});
    } else {
      res.status(500).send({error: "internal_error"});
    }
  }
});
