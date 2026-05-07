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
  {
    id: "first_check_in",
    trigger: "daily_check_in",
    title: "Primeiro Passo",
    description: "Realize seu primeiro check-in diário com o seu par.",
    hint: "Envie um foguinho pela tela de check-in.",
    icon: "fa-person-rays",
    accentColor: "#fbbf24",
    notificationIcon: "fa-trophy",
    notificationTitle: "ðŸ† Nova conquista!",
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
    notificationTitle: "ðŸ† Conquista de Foguinho!",
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
    notificationTitle: "ðŸ† Mestre do Check-in!",
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
    notificationTitle: "ðŸ† Você é pura constÃ¢ncia!",
    notificationMessage: "60 check-ins completos - fidelidade em alta!",
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
    notificationTitle: "ðŸ† Momento especial desbloqueado!",
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
    notificationTitle: "ðŸ† Colecionador de Momentos!",
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
    hint: "Momentos incriveis custam foguinhos - continue investindo!",
    icon: "fa-coins",
    accentColor: "#facc15",
    notificationIcon: "fa-trophy",
    notificationTitle: "ðŸ† Investidor de Foguinhos!",
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
    notificationTitle: "Modo Caliente ativado!",
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
