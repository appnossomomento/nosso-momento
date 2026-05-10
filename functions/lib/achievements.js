/* eslint-disable require-jsdoc */
const {admin} = require("./config");

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

// TODO: mover para uma coleção de configurações
// se quisermos editar sem deploy.
const ACHIEVEMENTS = [
  // ── CLIMA ────────────────────────────────────────────────
  {
    id: "first_check_in",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Primeiro Passo",
    description: "Realize seu primeiro registro de clima.",
    hint: "Registre seu humor pela tela de clima.",
    icon: "fa-person-rays",
    accentColor: "#fbbf24",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Nova conquista!",
    notificationMessage: "Voc\u00ea desbloqueou: Primeiro Passo",
    check: ({stats}) => (stats.totalCheckins || 0) >= 1,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      currentDailyStreak: stats.currentDailyStreak || 0,
    }),
  },
  {
    id: "checkin_streak_7",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Foguinho Semanal",
    description: "Registre o clima 7 dias consecutivos.",
    hint: "Registre diariamente sem perder nenhum dia.",
    icon: "fa-calendar-week",
    accentColor: "#34d399",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Conquista de Foguinho!",
    notificationMessage: "Streak de 7 dias conclu\u00edda!",
    check: ({stats}) => (stats.bestDailyStreak || 0) >= 7,
    snapshot: ({stats}) => ({
      bestDailyStreak: stats.bestDailyStreak || 0,
      totalCheckins: stats.totalCheckins || 0,
    }),
  },
  {
    id: "checkin_master",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Mestre do Clima",
    description: "Registre o clima 30 vezes no total.",
    hint: "Consist\u00eancia \u00e9 tudo: registre seu humor frequentemente.",
    icon: "fa-stopwatch",
    accentColor: "#60a5fa",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Mestre do Clima!",
    notificationMessage: "30 registros de clima completados!",
    check: ({stats}) => (stats.totalCheckins || 0) >= 30,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      bestDailyStreak: stats.bestDailyStreak || 0,
    }),
  },
  {
    id: "sou_fiel",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Sou Fiel",
    description: "Registre o clima 60 vezes no total.",
    hint: "Mantenha o ritmo di\u00e1rio para mostrar compromisso.",
    icon: "fa-hand-holding-heart",
    accentColor: "#38bdf8",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Voc\u00ea \u00e9 pura const\u00e2ncia!",
    notificationMessage: "60 registros de clima completos!",
    check: ({stats}) => (stats.totalCheckins || 0) >= 60,
    snapshot: ({stats}) => ({
      totalCheckins: stats.totalCheckins || 0,
      bestDailyStreak: stats.bestDailyStreak || 0,
    }),
  },
  {
    id: "sintonia_clima",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Sintonia",
    description:
      "Registre o clima no mesmo dia que seu parceiro.",
    hint: "Voc\u00eas dois precisam registrar o humor no mesmo dia.",
    icon: "fa-heart-pulse",
    accentColor: "#f43f5e",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Sintonia desbloqueada!",
    notificationMessage:
      "Voc\u00eas dois registraram o clima no mesmo dia!",
    check: ({event}) => !!(event && event.partnerAlsoRegisteredToday),
    snapshot: ({stats}) => ({totalCheckins: stats.totalCheckins || 0}),
  },
  {
    id: "relacao_saudavel",
    trigger: "daily_check_in",
    categoria: "clima",
    title: "Rela\u00e7\u00e3o Saud\u00e1vel",
    description: "Registre o humor '\u00d3timo' 5 vezes.",
    hint: "Registre seu melhor humor 5 vezes para desbloquear.",
    icon: "fa-face-laugh-beam",
    accentColor: "#4ade80",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Rela\u00e7\u00e3o Saud\u00e1vel!",
    notificationMessage:
      "Voc\u00ea registrou humor \u00d3timo 5 vezes!",
    check: ({stats}) => (stats.totalHumorOtimo || 0) >= 5,
    snapshot: ({stats}) => ({
      totalHumorOtimo: stats.totalHumorOtimo || 0,
    }),
  },
  // ── RELAÇÃO ───────────────────────────────────────────────
  {
    id: "first_moment_redeem",
    trigger: "moment_redeem",
    categoria: "relacao",
    title: "Primeiro Momento",
    description: "Resgate o seu primeiro momento.",
    hint: "Escolha um momento e resgate com foguinhos.",
    icon: "fa-heart",
    accentColor: "#f472b6",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Momento especial desbloqueado!",
    notificationMessage: "Voc\u00ea resgatou o primeiro momento.",
    check: ({stats}) => getMomentsRedeemedTotal(stats) >= 1,
    snapshot: ({stats}) => ({
      momentsRedeemed: getMomentsRedeemedTotal(stats),
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
    }),
  },
  {
    id: "moment_collector",
    trigger: "moment_redeem",
    categoria: "relacao",
    title: "Colecionador de Momentos",
    description: "Resgate 5 momentos diferentes.",
    hint: "Continue resgatando momentos para o seu mural.",
    icon: "fa-gift",
    accentColor: "#c084fc",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Colecionador de Momentos!",
    notificationMessage: "Voc\u00ea resgatou 5 momentos!",
    check: ({stats}) => getMomentsRedeemedTotal(stats) >= 5,
    snapshot: ({stats}) => ({
      momentsRedeemed: getMomentsRedeemedTotal(stats),
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
    }),
  },
  {
    id: "to_amando",
    trigger: "moment_redeem",
    categoria: "relacao",
    title: "T\u00f4 Amando",
    description: "Resgate momentos de 3 categorias diferentes.",
    hint: "Explore diferentes categorias de momentos.",
    icon: "fa-stars",
    accentColor: "#e879f9",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 T\u00f4 Amando!",
    notificationMessage:
      "Voc\u00ea explorou 3 categorias de momentos!",
    check: ({stats}) => {
      const cats = (stats.momentsRedeemed &&
        stats.momentsRedeemed.porCategoria) || {};
      return Object.keys(cats).filter((k) => cats[k] > 0).length >= 3;
    },
    snapshot: ({stats}) => ({
      categorias: Object.keys(
          (stats.momentsRedeemed || {}).porCategoria || {},
      ).length,
    }),
  },
  {
    id: "jornada_iniciada",
    trigger: "moment_redeem_received",
    categoria: "relacao",
    title: "Jornada Iniciada",
    description: "Tenha um momento resgatado pelo seu parceiro.",
    hint: "Seu parceiro precisa resgatar um momento para voc\u00ea.",
    icon: "fa-envelope-open-text",
    accentColor: "#fb7185",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Jornada Iniciada!",
    notificationMessage:
      "Seu parceiro resgatou um momento para voc\u00ea!",
    check: ({stats}) => (stats.momentosRecebidos || 0) >= 1,
    snapshot: ({stats}) => ({
      momentosRecebidos: stats.momentosRecebidos || 0,
    }),
  },
  {
    id: "atitude",
    trigger: "moment_complete",
    categoria: "relacao",
    title: "Atitude",
    description: "Complete um momento marcando como realizado.",
    hint: "Marque um momento como realizado na aba de momentos.",
    icon: "fa-circle-check",
    accentColor: "#34d399",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Atitude!",
    notificationMessage: "Voc\u00ea completou seu primeiro momento!",
    check: ({stats}) => (stats.momentosCompletados || 0) >= 1,
    snapshot: ({stats}) => ({
      momentosCompletados: stats.momentosCompletados || 0,
    }),
  },
  // ── ENGAJAMENTO ──────────────────────────────────────────
  {
    id: "foguinhos_investor",
    trigger: "moment_redeem",
    categoria: "engajamento",
    title: "Investidor de Foguinhos",
    description: "Gaste 50 foguinhos em momentos.",
    hint: "Momentos incr\u00edveis custam foguinhos \u2013" +
      " continue investindo!",
    icon: "fa-coins",
    accentColor: "#facc15",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Investidor de Foguinhos!",
    notificationMessage:
      "Mais de 50 foguinhos investidos em momentos.",
    check: ({stats}) => (stats.totalFoguinhosGastos || 0) >= 50,
    snapshot: ({stats}) => ({
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
      momentsRedeemed: getMomentsRedeemedTotal(stats),
    }),
  },
  {
    id: "caliente",
    trigger: "moment_redeem",
    categoria: "engajamento",
    title: "Caliente",
    description: "Gaste 100 foguinhos em momentos.",
    hint: "Continue investindo para viver experi\u00eancias intensas.",
    icon: "fa-fire-flame-curved",
    accentColor: "#fb923c",
    notificationIcon: "fa-trophy",
    notificationTitle: "Modo Caliente ativado!",
    notificationMessage:
      "Voc\u00ea j\u00e1 investiu 100 foguinhos em momentos!",
    check: ({stats}) => (stats.totalFoguinhosGastos || 0) >= 100,
    snapshot: ({stats}) => ({
      totalFoguinhosGastos: stats.totalFoguinhosGastos || 0,
      momentsRedeemed: getMomentsRedeemedTotal(stats),
    }),
  },
  {
    id: "em_sincronia",
    trigger: "weekly_challenge_answer",
    categoria: "engajamento",
    title: "Em Sincronia",
    description: "Acerte o desafio 3 semanas seguidas.",
    hint: "Respondam juntos e certos por 3 semanas consecutivas.",
    icon: "fa-brain",
    accentColor: "#a78bfa",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Em Sincronia!",
    notificationMessage: "3 desafios seguidos acertados juntos!",
    check: ({stats}) => (stats.challengeSuccessStreak || 0) >= 3,
    snapshot: ({stats}) => ({
      challengeSuccessStreak: stats.challengeSuccessStreak || 0,
    }),
  },
  {
    id: "ligeiro",
    trigger: "weekly_challenge_answer",
    categoria: "engajamento",
    title: "Ligeiro",
    description: "Responda o desafio em menos de 1 hora.",
    hint: "Abra o desafio e responda rapidinho!",
    icon: "fa-bolt",
    accentColor: "#fbbf24",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Ligeiro!",
    notificationMessage: "Respondeu o desafio em menos de 1 hora!",
    check: ({event}) => {
      const ms = event && event.answeredInMs;
      return typeof ms === "number" && ms > 0 && ms <= 3600000;
    },
    snapshot: ({event}) => ({answeredInMs: event && event.answeredInMs}),
  },
  // ── INDIVIDUAL ───────────────────────────────────────────
  {
    id: "primeiro_mes",
    trigger: "daily_check_in",
    categoria: "individual",
    title: "Primeiro M\u00eas",
    description: "Complete 30 dias usando o Nosso Momento.",
    hint: "Continue usando o app por 30 dias.",
    icon: "fa-calendar-check",
    accentColor: "#67e8f9",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Primeiro M\u00eas!",
    notificationMessage:
      "Voc\u00ea est\u00e1 h\u00e1 30 dias no Nosso Momento!",
    check: ({event}) => !!(event && event.diasNoApp >= 30),
    snapshot: ({event}) => ({diasNoApp: event && event.diasNoApp}),
  },
  {
    id: "com_cara",
    trigger: "profile_photo_upload",
    categoria: "individual",
    title: "Com Cara",
    description: "Adicione uma foto de perfil.",
    hint: "V\u00e1 em Meu Perfil e envie uma foto.",
    icon: "fa-camera",
    accentColor: "#94a3b8",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Com Cara!",
    notificationMessage: "Voc\u00ea adicionou sua foto de perfil!",
    check: ({stats}) => (stats.profilePhotosUploaded || 0) >= 1,
    snapshot: ({stats}) => ({
      profilePhotosUploaded: stats.profilePhotosUploaded || 0,
    }),
  },
  {
    id: "criando_memorias",
    trigger: "moment_photo_upload",
    categoria: "individual",
    title: "Criando Mem\u00f3rias",
    description:
      "Envie uma foto ao registrar um momento realizado.",
    hint: "Ao marcar um momento como feito, adicione uma foto.",
    icon: "fa-images",
    accentColor: "#f472b6",
    notificationIcon: "fa-trophy",
    notificationTitle: "\uD83C\uDFC6 Criando Mem\u00f3rias!",
    notificationMessage:
      "Voc\u00ea registrou uma mem\u00f3ria com foto!",
    check: ({stats}) => (stats.momentPhotosUploaded || 0) >= 1,
    snapshot: ({stats}) => ({
      momentPhotosUploaded: stats.momentPhotosUploaded || 0,
    }),
  },
];

const ACHIEVEMENT_REWARDS = {
  first_check_in: 1,
  checkin_streak_7: 3,
  checkin_master: 10,
  sou_fiel: 20,
  sintonia_clima: 1,
  relacao_saudavel: 2,
  first_moment_redeem: 1,
  moment_collector: 3,
  to_amando: 2,
  jornada_iniciada: 1,
  atitude: 1,
  foguinhos_investor: 10,
  caliente: 20,
  em_sincronia: 5,
  ligeiro: 1,
  primeiro_mes: 3,
  com_cara: 1,
  criando_memorias: 1,
};

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

module.exports = {
  ACHIEVEMENTS,
  ACHIEVEMENT_REWARDS,
  getMomentsRedeemedTotal,
  summarizeStats,
  grantAchievementsInTransaction,
};
