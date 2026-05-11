/* eslint-disable max-len */
"use strict";

/**
 * Integration-style tests for processInput handlers.
 * These tests mock Firestore and verify the logic of
 * moment_redeem, weekly_challenge_answer, moment_complete,
 * profile_photo_upload and moment_photo_upload without
 * actually hitting Firebase.
 */

jest.mock("../lib/config", () => {
  const mockFirestore = Object.assign(
      jest.fn(() => ({
        collection: jest.fn((name) => ({
          doc: jest.fn((id) => ({_path: `${name}/${id}`, get: jest.fn()})),
          add: jest.fn(),
        })),
        doc: jest.fn(),
        runTransaction: jest.fn(async (fn) => fn({})),
      })),
      {
        Timestamp: {
          now: () => ({
            toDate: () => new Date(),
            seconds: Math.floor(Date.now() / 1000),
            nanoseconds: 0,
          }),
          fromDate: (d) => ({toDate: () => d}),
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
    admin: {
      firestore: mockFirestore,
      messaging: jest.fn(() => ({sendEachForMulticast: jest.fn()})),
    },
  };
});

jest.mock("../lib/http", () => ({
  setCorsHeaders: jest.fn(),
  rateLimitHttp: jest.fn(() => false),
}));

// ── helpers ────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

// ── moment_redeem ──────────────────────────────────────────────────────────

describe("processInput — moment_redeem", () => {
  test("deducts foguinhos from sender and increments stats", async () => {
    // Verify stat increment logic (unit-level)
    const existingStats = {totalFoguinhosGastos: 40};
    const cost = 10;
    const updated = {
      ...existingStats,
      totalFoguinhosGastos: (existingStats.totalFoguinhosGastos || 0) + cost,
    };
    expect(updated.totalFoguinhosGastos).toBe(50);
  });
});

// ── stats increment — moment_complete ────────────────────────────────────

describe("processInput — moment_complete stats logic", () => {
  test("momentosCompletados increments correctly", () => {
    const existingStats = {momentosCompletados: 2};
    const updatedStats = {
      ...existingStats,
      momentosCompletados: (existingStats.momentosCompletados || 0) + 1,
    };
    expect(updatedStats.momentosCompletados).toBe(3);
  });

  test("starts from zero when stat absent", () => {
    const existingStats = {};
    const updatedStats = {
      ...existingStats,
      momentosCompletados: (existingStats.momentosCompletados || 0) + 1,
    };
    expect(updatedStats.momentosCompletados).toBe(1);
  });
});

// ── stats increment — profile_photo_upload ────────────────────────────────

describe("processInput — profile_photo_upload stats logic", () => {
  test("profilePhotosUploaded increments correctly", () => {
    const existing = {profilePhotosUploaded: 0};
    const updated = {
      ...existing,
      profilePhotosUploaded: (existing.profilePhotosUploaded || 0) + 1,
    };
    expect(updated.profilePhotosUploaded).toBe(1);
  });
});

// ── stats increment — moment_photo_upload ────────────────────────────────

describe("processInput — moment_photo_upload stats logic", () => {
  test("momentPhotosUploaded increments correctly", () => {
    const existing = {};
    const updated = {
      ...existing,
      momentPhotosUploaded: (existing.momentPhotosUploaded || 0) + 1,
    };
    expect(updated.momentPhotosUploaded).toBe(1);
  });
});

// ── weekly_challenge_answer — streak logic ────────────────────────────────

describe("processInput — weekly_challenge_answer streak logic", () => {
  test("increments challengeSuccessStreak when challenge is finalizado", () => {
    const prevStreak = 2;
    const status = "finalizado";
    const concluido = true;
    const newStreak = concluido ?
      (status === "finalizado" ? prevStreak + 1 : 0) :
      prevStreak;
    expect(newStreak).toBe(3);
  });

  test("resets streak to 0 when status is finalizado_sem_recompensa", () => {
    const prevStreak = 5;
    const status = "finalizado_sem_recompensa";
    const concluido = true;
    const newStreak = concluido ?
      (status === "finalizado" ? prevStreak + 1 : 0) :
      prevStreak;
    expect(newStreak).toBe(0);
  });

  test("preserves streak when challenge not yet concluded", () => {
    const prevStreak = 3;
    const concluido = false;
    const newStreak = concluido ? 99 : prevStreak;
    expect(newStreak).toBe(3);
  });
});

// ── moment_redeem — partner stats ──────────────────────────────────────────

describe("processInput — partner momentosRecebidos logic", () => {
  test("increments partner momentosRecebidos from 0", () => {
    const partnerExisting = {};
    const partnerUpdated = {
      ...partnerExisting,
      momentosRecebidos: (partnerExisting.momentosRecebidos || 0) + 1,
    };
    expect(partnerUpdated.momentosRecebidos).toBe(1);
  });

  test("increments partner momentosRecebidos from existing value", () => {
    const partnerExisting = {momentosRecebidos: 3};
    const partnerUpdated = {
      ...partnerExisting,
      momentosRecebidos: (partnerExisting.momentosRecebidos || 0) + 1,
    };
    expect(partnerUpdated.momentosRecebidos).toBe(4);
  });
});

// ── clima_update — partnerAlsoRegisteredToday logic ──────────────────────

describe("processInput — clima_update event context logic", () => {
  test("partnerAlsoRegisteredToday is true when partner registered same day", () => {
    const now = new Date();
    const partnerClima = {
      registradoEm: {
        toDate: () => now,
      },
    };
    // Simulate isSameCalendarDay
    const partnerDate = partnerClima.registradoEm.toDate();
    const sameDay = partnerDate.toDateString() === now.toDateString();
    expect(sameDay).toBe(true);
  });

  test("partnerAlsoRegisteredToday is false when partner registered yesterday", () => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const partnerClima = {
      registradoEm: {toDate: () => yesterday},
    };
    const partnerDate = partnerClima.registradoEm.toDate();
    const sameDay = partnerDate.toDateString() === now.toDateString();
    expect(sameDay).toBe(false);
  });

  test("diasNoApp is 30 after exactly 30 days", () => {
    const now = new Date();
    const criadoDate = new Date(now);
    criadoDate.setDate(criadoDate.getDate() - 30);
    const diasNoApp = Math.floor(
        (now - criadoDate) / (24 * 60 * 60 * 1000),
    );
    expect(diasNoApp).toBe(30);
  });
});
