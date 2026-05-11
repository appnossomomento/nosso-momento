/* eslint-disable max-len */
"use strict";

jest.mock("./config", () => {
  const mockFirestore = Object.assign(
    () => ({collection: () => ({doc: () => ({})})}),
    {
      Timestamp: {
        now: () => ({
          toDate: () => new Date(),
          seconds: 0,
          nanoseconds: 0,
        }),
      },
      FieldValue: {
        increment: (n) => ({_increment: n}),
        serverTimestamp: () => ({_serverTimestamp: true}),
        delete: () => ({_delete: true}),
        arrayRemove: (...args) => ({_arrayRemove: args}),
      },
    },
  );
  return {
    admin: {firestore: mockFirestore},
  };
});

const {ACHIEVEMENTS, grantAchievementsInTransaction} =
  require("./achievements");

// ── helpers ────────────────────────────────────────────────────────────────

/** Build a minimal tx stub that records all writes. */
function makeTx() {
  const ops = [];
  return {
    _ops: ops,
    set: (ref, data, opts) => ops.push({op: "set", data, opts}),
    update: (ref, data) => ops.push({op: "update", data}),
    delete: (ref) => ops.push({op: "delete"}),
  };
}

/** Build a minimal userRef stub. */
function makeRef() {
  return {id: "uid-test"};
}

/** Run grantAchievementsInTransaction and return unlocked achievement ids. */
function grant({trigger, statsBefore = {}, statsAfter = {}, eventContext = {}, currentAchievements = {}}) {
  const tx = makeTx();
  grantAchievementsInTransaction({
    tx,
    userRef: makeRef(),
    userId: "uid-test",
    trigger,
    currentAchievements,
    statsBefore,
    statsAfter,
    eventContext,
  });
  // Extract which achievement ids were written
  return tx._ops
    .filter((o) => o.op === "set" || o.op === "update")
    .flatMap((o) => Object.keys(o.data || {}))
    .filter((k) => k.startsWith("conquistas."))
    .map((k) => k.replace("conquistas.", ""));
}

// ── ACHIEVEMENTS array sanity ──────────────────────────────────────────────

describe("ACHIEVEMENTS array", () => {
  test("contains 18 badges", () => {
    expect(ACHIEVEMENTS).toHaveLength(18);
  });

  test("every badge has required fields", () => {
    ACHIEVEMENTS.forEach((a) => {
      expect(a).toHaveProperty("id");
      expect(a).toHaveProperty("trigger");
      expect(a).toHaveProperty("categoria");
      expect(a).toHaveProperty("check");
      expect(typeof a.check).toBe("function");
    });
  });

  test("no duplicate ids", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("all categorias are valid", () => {
    const valid = new Set(["clima", "relacao", "engajamento", "individual"]);
    ACHIEVEMENTS.forEach((a) => {
      expect(valid.has(a.categoria)).toBe(true);
    });
  });
});

// ── check() functions ──────────────────────────────────────────────────────

describe("badge check() — clima", () => {
  test("first_check_in unlocks at totalCheckins >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "first_check_in");
    expect(def.check({stats: {totalCheckins: 0}})).toBe(false);
    expect(def.check({stats: {totalCheckins: 1}})).toBe(true);
  });

  test("checkin_streak_7 unlocks at bestDailyStreak >= 7", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "checkin_streak_7");
    expect(def.check({stats: {bestDailyStreak: 6}})).toBe(false);
    expect(def.check({stats: {bestDailyStreak: 7}})).toBe(true);
  });

  test("checkin_master unlocks at totalCheckins >= 30", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "checkin_master");
    expect(def.check({stats: {totalCheckins: 29}})).toBe(false);
    expect(def.check({stats: {totalCheckins: 30}})).toBe(true);
  });

  test("sou_fiel unlocks at totalCheckins >= 60", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "sou_fiel");
    expect(def.check({stats: {totalCheckins: 59}})).toBe(false);
    expect(def.check({stats: {totalCheckins: 60}})).toBe(true);
  });

  test("sintonia_clima requires partnerAlsoRegisteredToday", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "sintonia_clima");
    expect(def.check({event: null})).toBe(false);
    expect(def.check({event: {partnerAlsoRegisteredToday: false}})).toBe(false);
    expect(def.check({event: {partnerAlsoRegisteredToday: true}})).toBe(true);
  });

  test("relacao_saudavel unlocks at totalHumorOtimo >= 5", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "relacao_saudavel");
    expect(def.check({stats: {totalHumorOtimo: 4}})).toBe(false);
    expect(def.check({stats: {totalHumorOtimo: 5}})).toBe(true);
  });
});

describe("badge check() — relacao", () => {
  test("first_moment_redeem unlocks at momentsRedeemed.total >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "first_moment_redeem");
    expect(def.check({stats: {}})).toBe(false);
    expect(def.check({stats: {momentsRedeemed: {total: 1}}})).toBe(true);
  });

  test("moment_collector unlocks at momentsRedeemed.total >= 5", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "moment_collector");
    expect(def.check({stats: {momentsRedeemed: {total: 4}}})).toBe(false);
    expect(def.check({stats: {momentsRedeemed: {total: 5}}})).toBe(true);
  });

  test("to_amando requires 3+ distinct categories", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "to_amando");
    expect(def.check({stats: {momentsRedeemed: {porCategoria: {a: 1, b: 2}}}})).toBe(false);
    expect(def.check({stats: {momentsRedeemed: {porCategoria: {a: 1, b: 1, c: 1}}}})).toBe(true);
  });

  test("jornada_iniciada unlocks at momentosRecebidos >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "jornada_iniciada");
    expect(def.check({stats: {momentosRecebidos: 0}})).toBe(false);
    expect(def.check({stats: {momentosRecebidos: 1}})).toBe(true);
  });

  test("atitude unlocks at momentosCompletados >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "atitude");
    expect(def.check({stats: {momentosCompletados: 0}})).toBe(false);
    expect(def.check({stats: {momentosCompletados: 1}})).toBe(true);
  });
});

describe("badge check() — engajamento", () => {
  test("foguinhos_investor unlocks at totalFoguinhosGastos >= 50", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "foguinhos_investor");
    expect(def.check({stats: {totalFoguinhosGastos: 49}})).toBe(false);
    expect(def.check({stats: {totalFoguinhosGastos: 50}})).toBe(true);
  });

  test("caliente unlocks at totalFoguinhosGastos >= 100", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "caliente");
    expect(def.check({stats: {totalFoguinhosGastos: 99}})).toBe(false);
    expect(def.check({stats: {totalFoguinhosGastos: 100}})).toBe(true);
  });

  test("em_sincronia unlocks at challengeSuccessStreak >= 3", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "em_sincronia");
    expect(def.check({stats: {challengeSuccessStreak: 2}})).toBe(false);
    expect(def.check({stats: {challengeSuccessStreak: 3}})).toBe(true);
  });

  test("ligeiro unlocks when answeredInMs > 0 and <= 3600000", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "ligeiro");
    expect(def.check({event: {answeredInMs: 0}})).toBe(false);
    expect(def.check({event: {answeredInMs: 3600001}})).toBe(false);
    expect(def.check({event: {answeredInMs: 1800000}})).toBe(true);
    expect(def.check({event: {answeredInMs: 3600000}})).toBe(true);
  });
});

describe("badge check() — individual", () => {
  test("primeiro_mes unlocks at diasNoApp >= 30", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "primeiro_mes");
    expect(def.check({event: {diasNoApp: 29}})).toBe(false);
    expect(def.check({event: {diasNoApp: 30}})).toBe(true);
  });

  test("com_cara unlocks at profilePhotosUploaded >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "com_cara");
    expect(def.check({stats: {profilePhotosUploaded: 0}})).toBe(false);
    expect(def.check({stats: {profilePhotosUploaded: 1}})).toBe(true);
  });

  test("criando_memorias unlocks at momentPhotosUploaded >= 1", () => {
    const def = ACHIEVEMENTS.find((a) => a.id === "criando_memorias");
    expect(def.check({stats: {momentPhotosUploaded: 0}})).toBe(false);
    expect(def.check({stats: {momentPhotosUploaded: 1}})).toBe(true);
  });
});

// ── grantAchievementsInTransaction ────────────────────────────────────────

describe("grantAchievementsInTransaction", () => {
  test("does not grant already-unlocked achievements", () => {
    const ids = grant({
      trigger: "daily_check_in",
      statsAfter: {totalCheckins: 1},
      currentAchievements: {first_check_in: {unlockedAt: {}}},
    });
    expect(ids).not.toContain("first_check_in");
  });

  test("grants first_check_in on first daily_check_in", () => {
    const ids = grant({
      trigger: "daily_check_in",
      statsAfter: {totalCheckins: 1},
    });
    expect(ids).toContain("first_check_in");
  });

  test("grants multiple badges in same trigger when conditions met", () => {
    const ids = grant({
      trigger: "daily_check_in",
      statsAfter: {totalCheckins: 60, bestDailyStreak: 7},
    });
    expect(ids).toContain("first_check_in");
    expect(ids).toContain("checkin_streak_7");
    expect(ids).toContain("checkin_master");
    expect(ids).toContain("sou_fiel");
  });

  test("ignores badges from different triggers", () => {
    const ids = grant({
      trigger: "daily_check_in",
      statsAfter: {momentsRedeemed: {total: 10}},
    });
    expect(ids).not.toContain("first_moment_redeem");
    expect(ids).not.toContain("moment_collector");
  });

  test("grants foguinhos_investor on moment_redeem", () => {
    const ids = grant({
      trigger: "moment_redeem",
      statsAfter: {totalFoguinhosGastos: 50},
    });
    expect(ids).toContain("foguinhos_investor");
  });

  test("grants ligeiro when answeredInMs <= 3600000", () => {
    const ids = grant({
      trigger: "weekly_challenge_answer",
      statsAfter: {},
      eventContext: {answeredInMs: 900000},
    });
    expect(ids).toContain("ligeiro");
  });

  test("does NOT grant ligeiro when answeredInMs > 3600000", () => {
    const ids = grant({
      trigger: "weekly_challenge_answer",
      statsAfter: {},
      eventContext: {answeredInMs: 7200000},
    });
    expect(ids).not.toContain("ligeiro");
  });

  test("writes a foguinhos increment when reward > 0", () => {
    const tx = makeTx();
    grantAchievementsInTransaction({
      tx,
      userRef: makeRef(),
      userId: "uid-test",
      trigger: "daily_check_in",
      currentAchievements: {},
      statsBefore: {},
      statsAfter: {totalCheckins: 1},
      eventContext: {},
    });
    const hasIncrement = tx._ops.some((o) =>
      o.op === "update" && o.data && o.data.foguinhos,
    );
    expect(hasIncrement).toBe(true);
  });

  test("writes a notificacao doc for each unlocked badge", () => {
    const tx = makeTx();
    grantAchievementsInTransaction({
      tx,
      userRef: makeRef(),
      userId: "uid-test",
      trigger: "daily_check_in",
      currentAchievements: {},
      statsBefore: {},
      statsAfter: {totalCheckins: 1},
      eventContext: {},
    });
    const notifOps = tx._ops.filter(
      (o) => o.op === "set" && o.data && o.data.tipo === "achievement",
    );
    expect(notifOps.length).toBeGreaterThanOrEqual(1);
  });
});
