/* eslint-disable require-jsdoc, linebreak-style, max-len */
"use strict";

/**
 * Data civil YYYY-MM-DD em America/Sao_Paulo.
 * @param {Date} [date]
 * @return {string}
 */
function saoPauloDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Dia civil SP com offset (0=hoje, -1=ontem, -2=anteontem…).
 * @param {number} offsetDays
 * @param {Date} [now]
 * @return {string}
 */
function saoPauloOffsetDateString(offsetDays, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year").value);
  const m = Number(parts.find((p) => p.type === "month").value);
  const d = Number(parts.find((p) => p.type === "day").value);
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0) + offsetDays * 86400000;
  return saoPauloDateString(new Date(utcNoon));
}

function saoPauloYesterdayString(now = new Date()) {
  return saoPauloOffsetDateString(-1, now);
}

function saoPauloAnteontemString(now = new Date()) {
  return saoPauloOffsetDateString(-2, now);
}

/**
 * Converte Timestamp/Date → YYYY-MM-DD em SP.
 * @param {*} ts
 * @return {string|null}
 */
function toSaoPauloDateKey(ts) {
  if (!ts) return null;
  const d = (ts && typeof ts.toDate === "function") ?
    ts.toDate() : new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return saoPauloDateString(d);
}

/**
 * Dia 3 00:01 — casal marcou no Dia 1 (anteontem), pulou o Dia 2 (ontem).
 * → dispara push "A chama está apagando!".
 *
 * @param {Object} climaHoje
 * @param {string} uidA
 * @param {string} uidB
 * @param {string} anteontemKey - Dia 1 da jornada
 * @param {string} yesterdayKey - Dia 2 (não pode ter sido o último check-in)
 * @return {boolean}
 */
function casalEmRiscoDeChama(
    climaHoje, uidA, uidB, anteontemKey, yesterdayKey,
) {
  const a = (climaHoje && climaHoje[uidA]) || null;
  const b = (climaHoje && climaHoje[uidB]) || null;
  if (!a || !b) return false;
  const aDay = toSaoPauloDateKey(a.registradoEm);
  const bDay = toSaoPauloDateKey(b.registradoEm);
  // Último check-in de ambos = anteontem (Dia 1)
  if (aDay !== anteontemKey || bDay !== anteontemKey) return false;
  // Se alguém tivesse marcado ontem, aDay seria yesterday — já coberto acima.
  // Guarda explícita:
  if (aDay === yesterdayKey || bDay === yesterdayKey) return false;
  return true;
}

module.exports = {
  saoPauloDateString,
  saoPauloYesterdayString,
  saoPauloAnteontemString,
  saoPauloOffsetDateString,
  toSaoPauloDateKey,
  casalEmRiscoDeChama,
};
