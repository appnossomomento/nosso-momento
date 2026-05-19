/* eslint-disable max-len */
"use strict";

// ── Testes da lógica pura de isSameCalendarDay e filtragem de pendentes ──

function isSameCalendarDay(tsA, tsB) {
  const toSPDate = (ts) => {
    const d = (ts && typeof ts.toDate === "function") ?
      ts.toDate() : new Date(ts);
    return d.toLocaleDateString("pt-BR", {timeZone: "America/Sao_Paulo"});
  };
  return toSPDate(tsA) === toSPDate(tsB);
}

function makeTs(date) {
  return {toDate: () => date};
}

// ── isSameCalendarDay ─────────────────────────────────────────────────────

describe("isSameCalendarDay", () => {
  test("retorna true para o mesmo dia", () => {
    const now = new Date("2026-05-18T23:00:00-03:00"); // 23h BRT
    expect(isSameCalendarDay(makeTs(now), makeTs(now))).toBe(true);
  });

  test("retorna false para dias diferentes", () => {
    const hoje = new Date("2026-05-18T10:00:00-03:00");
    const ontem = new Date("2026-05-17T10:00:00-03:00");
    expect(isSameCalendarDay(makeTs(hoje), makeTs(ontem))).toBe(false);
  });

  test("retorna true para mesmo dia em horários diferentes", () => {
    const manha = new Date("2026-05-18T08:00:00-03:00");
    const noite = new Date("2026-05-18T23:29:00-03:00");
    expect(isSameCalendarDay(makeTs(manha), makeTs(noite))).toBe(true);
  });

  test("trata corretamente UTC vs BRT (mesmo dia BRT)", () => {
    // 01:00 UTC do dia 19 = 22:00 BRT do dia 18
    const brt22h = new Date("2026-05-19T01:00:00Z");
    // 23:00 BRT do dia 18
    const brt23h = new Date("2026-05-19T02:00:00Z");
    expect(isSameCalendarDay(makeTs(brt22h), makeTs(brt23h))).toBe(true);
  });

  test("trata corretamente virada de meia-noite UTC vs BRT", () => {
    // 03:01 UTC do dia 19 = 00:01 BRT do dia 19 (dia seguinte)
    const brtDia19 = new Date("2026-05-19T03:01:00Z");
    // 02:59 UTC do dia 19 = 23:59 BRT do dia 18
    const brtDia18 = new Date("2026-05-19T02:59:00Z");
    expect(isSameCalendarDay(makeTs(brtDia19), makeTs(brtDia18))).toBe(false);
  });
});

// ── Lógica de filtragem de pendentes ─────────────────────────────────────

describe("filtragem de pendentes (quem não registrou hoje)", () => {
  const now = makeTs(new Date("2026-05-18T23:30:00-03:00"));

  test("ambos pendentes quando climaHoje está vazio", () => {
    const climaHoje = {};
    const uids = ["uidA", "uidB"];
    const pendentes = uids.filter((uid) => {
      const r = climaHoje[uid];
      if (!r || !r.registradoEm) return true;
      return !isSameCalendarDay(r.registradoEm, now);
    });
    expect(pendentes).toEqual(["uidA", "uidB"]);
  });

  test("apenas um pendente quando o outro já registrou hoje", () => {
    const climaHoje = {
      uidA: {registradoEm: makeTs(new Date("2026-05-18T20:00:00-03:00"))},
    };
    const uids = ["uidA", "uidB"];
    const pendentes = uids.filter((uid) => {
      const r = climaHoje[uid];
      if (!r || !r.registradoEm) return true;
      return !isSameCalendarDay(r.registradoEm, now);
    });
    expect(pendentes).toEqual(["uidB"]);
  });

  test("nenhum pendente quando ambos já registraram hoje", () => {
    const climaHoje = {
      uidA: {registradoEm: makeTs(new Date("2026-05-18T18:00:00-03:00"))},
      uidB: {registradoEm: makeTs(new Date("2026-05-18T22:00:00-03:00"))},
    };
    const uids = ["uidA", "uidB"];
    const pendentes = uids.filter((uid) => {
      const r = climaHoje[uid];
      if (!r || !r.registradoEm) return true;
      return !isSameCalendarDay(r.registradoEm, now);
    });
    expect(pendentes).toEqual([]);
  });

  test("registro de ontem não isenta o usuário", () => {
    const climaHoje = {
      uidA: {registradoEm: makeTs(new Date("2026-05-17T23:00:00-03:00"))},
    };
    const uids = ["uidA"];
    const pendentes = uids.filter((uid) => {
      const r = climaHoje[uid];
      if (!r || !r.registradoEm) return true;
      return !isSameCalendarDay(r.registradoEm, now);
    });
    expect(pendentes).toEqual(["uidA"]);
  });

  test("uid sem pessoa1Uid/pessoa2Uid é ignorado", () => {
    const uidA = null;
    const uidB = "uidB";
    const uids = [uidA, uidB].filter(Boolean);
    expect(uids).toEqual(["uidB"]);
  });
});
