/* eslint-disable require-jsdoc */
const {
  isValidPrazoDias,
  computeDataLimiteDate,
  derivePrazoStatus,
  isPastPenaltyGrace,
  PRAZO_DIAS_ALLOWED,
} = require("./momentPrazo");

describe("momentPrazo", () => {
  test("isValidPrazoDias only allows whitelist", () => {
    for (const d of PRAZO_DIAS_ALLOWED) {
      expect(isValidPrazoDias(d)).toBe(true);
    }
    expect(isValidPrazoDias(2)).toBe(false);
    expect(isValidPrazoDias(0)).toBe(false);
    expect(isValidPrazoDias("7")).toBe(true);
  });

  test("computeDataLimiteDate is after now for positive days", () => {
    const now = new Date("2026-08-09T15:00:00.000Z");
    const lim = computeDataLimiteDate(7, now);
    expect(lim.getTime()).toBeGreaterThan(now.getTime());
  });

  test("derivePrazoStatus windows", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const future = {seconds: Math.floor(now.getTime() / 1000) + 3 * 24 * 3600};
    const near = {seconds: Math.floor(now.getTime() / 1000) + 12 * 3600};
    const past = {seconds: Math.floor(now.getTime() / 1000) - 3600};
    expect(derivePrazoStatus(future, now)).toBe("a_realizar");
    expect(derivePrazoStatus(near, now)).toBe("no_limite");
    expect(derivePrazoStatus(past, now)).toBe("atrasado");
  });

  test("isPastPenaltyGrace after 24h", () => {
    const now = new Date("2026-08-09T12:00:00.000Z");
    const lim = {seconds: Math.floor(now.getTime() / 1000) - 25 * 3600};
    const limRecent = {seconds: Math.floor(now.getTime() / 1000) - 2 * 3600};
    expect(isPastPenaltyGrace(lim, now)).toBe(true);
    expect(isPastPenaltyGrace(limRecent, now)).toBe(false);
  });
});
