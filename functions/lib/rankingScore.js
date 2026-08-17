/* eslint-disable require-jsdoc, linebreak-style, max-len */
"use strict";

/**
 * Pontos de Conexão — critérios do ranking de casais.
 *
 * Os pesos são desacoplados do valor em foguinhos de propósito: foguinhos são
 * saldo gastável (resgate e penalidade debitam), então ranquear por saldo
 * premiaria o casal que menos usa o app. Aqui a pontuação vem dos eventos e
 * nunca decresce dentro do período.
 *
 * O clima tem o maior teto mensal, mas satura — todo casal no topo marca quase
 * todo dia, então ele funciona como piso de assiduidade. Quem desempata são os
 * critérios escassos, e por isso o momento com foto é o mais pesado.
 */

const PONTOS = {
  momentoComFoto: 60,
  momentoSemFoto: 35,
  desafioAcerto: 25,
  climaPorPessoaPorDia: 5,
};

/** Marcador gravado no extrato dos acertos de desafio. */
const RANKING_KEY_DESAFIO_ACERTO = "desafio_acerto";

/** São Paulo é UTC-3 fixo desde o fim do horário de verão (2019). */
const SP_OFFSET = "-03:00";
const MS_PER_DAY = 86400000;

function spDateStr(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * @param {string} dateStr
 * @return {number}
 */
function startOfSpDayMs(dateStr) {
  return Date.parse(`${dateStr}T00:00:00.000${SP_OFFSET}`);
}

/**
 * @param {string} dateStr
 * @return {number}
 */
function endOfSpDayMs(dateStr) {
  return Date.parse(`${dateStr}T23:59:59.999${SP_OFFSET}`);
}

/**
 * Data civil como Date em UTC, usada só para aritmética de calendário.
 * @param {string} dateStr
 * @return {Date}
 */
function civilToUtc(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * @param {Date} date
 * @return {string}
 */
function utcToCivil(date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Segunda = 0 … domingo = 6.
 * @param {string} dateStr
 * @return {number}
 */
function weekdayMon0(dateStr) {
  return (civilToUtc(dateStr).getUTCDay() + 6) % 7;
}

/**
 * ID ISO da semana que contém a data civil: "2026-W34".
 * @param {string} dateStr
 * @return {string}
 */
function isoWeekId(dateStr) {
  const thursday = civilToUtc(dateStr);
  thursday.setUTCDate(thursday.getUTCDate() - weekdayMon0(dateStr) + 3);
  const isoYear = thursday.getUTCFullYear();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const firstThursday = new Date(jan4);
  firstThursday.setUTCDate(
      jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3,
  );

  const week = 1 + Math.round((thursday - firstThursday) / (7 * MS_PER_DAY));
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

/**
 * Segunda-feira (data civil) da semana ISO informada.
 * @param {number} isoYear
 * @param {number} week
 * @return {Date}
 */
function isoWeekMonday(isoYear, week) {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const mondayW1 = new Date(jan4);
  mondayW1.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
  const monday = new Date(mondayW1);
  monday.setUTCDate(mondayW1.getUTCDate() + (week - 1) * 7);
  return monday;
}

/**
 * ID do período que contém a data, em fuso de São Paulo.
 * @param {"semanal"|"mensal"} period
 * @param {Date} [date]
 * @return {string} "2026-W34" ou "2026-08"
 */
function periodIdFor(period, date = new Date()) {
  const dateStr = spDateStr(date);
  if (period === "mensal") return dateStr.slice(0, 7);
  return isoWeekId(dateStr);
}

function isWeekPeriodId(periodId) {
  return /^\d{4}-W\d{2}$/.test(String(periodId));
}

/**
 * Limites do período em ms epoch e em datas civis SP (para range por ID de
 * documento no climaDiario, que é indexado por YYYY-MM-DD).
 * @param {string} periodId
 * @return {{period: string, startMs: number, endMs: number,
 *   startDateStr: string, endDateStr: string}}
 */
function periodBounds(periodId) {
  if (isWeekPeriodId(periodId)) {
    const [yearRaw, weekRaw] = String(periodId).split("-W");
    const monday = isoWeekMonday(Number(yearRaw), Number(weekRaw));
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const startDateStr = utcToCivil(monday);
    const endDateStr = utcToCivil(sunday);
    return {
      period: "semanal",
      startMs: startOfSpDayMs(startDateStr),
      endMs: endOfSpDayMs(endDateStr),
      startDateStr,
      endDateStr,
    };
  }

  const [y, m] = String(periodId).split("-").map(Number);
  const startDateStr = `${periodId}-01`;
  const endDateStr = utcToCivil(new Date(Date.UTC(y, m, 0)));
  return {
    period: "mensal",
    startMs: startOfSpDayMs(startDateStr),
    endMs: endOfSpDayMs(endDateStr),
    startDateStr,
    endDateStr,
  };
}

/**
 * Os dois períodos correntes, que o agregador recalcula a cada rodada.
 * @param {Date} [date]
 * @return {{semanal: string, mensal: string}}
 */
function currentPeriodIds(date = new Date()) {
  return {
    semanal: periodIdFor("semanal", date),
    mensal: periodIdFor("mensal", date),
  };
}

module.exports = {
  PONTOS,
  RANKING_KEY_DESAFIO_ACERTO,
  spDateStr,
  periodIdFor,
  periodBounds,
  currentPeriodIds,
  isWeekPeriodId,
};
