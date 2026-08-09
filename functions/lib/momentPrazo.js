/* eslint-disable require-jsdoc */

/** Prazos permitidos no resgate / postergar (dias). */
const PRAZO_DIAS_ALLOWED = [1, 3, 7, 14, 30];
const PENALIDADE_ATRASO_FOGUINHOS = 5;
/** Horas após dataLimite antes da penalidade. */
const PENALIDADE_GRACE_HOURS = 24;
/** Janela "No limite" antes do vencimento (horas). */
const NO_LIMITE_HOURS = 24;

function isValidPrazoDias(n) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) && PRAZO_DIAS_ALLOWED.includes(v);
}

/**
 * Fim do dia America/Sao_Paulo (UTC-3 fixo) para hoje+N dias.
 * @param {number} prazoDias
 * @param {Date} [now]
 * @return {Date}
 */
function computeDataLimiteDate(prazoDias, now = new Date()) {
  const days = Math.floor(Number(prazoDias));
  // Instantâneo em SP: UTC-3
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = spNow.getUTCFullYear();
  const m = spNow.getUTCMonth();
  const d = spNow.getUTCDate();
  // Fim do dia SP = 23:59:59.999 SP = 02:59:59.999 UTC do dia seguinte
  const endSpUtc = Date.UTC(y, m, d + days + 1, 2, 59, 59, 999);
  return new Date(endSpUtc);
}

function timestampToMillis(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (typeof ts.toDate === "function") return ts.toDate().getTime();
  if (typeof ts.seconds === "number") return ts.seconds * 1000;
  if (ts instanceof Date) return ts.getTime();
  const n = Number(ts);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {*} dataLimiteTs
 * @param {Date} [now]
 * @return {"a_realizar"|"no_limite"|"atrasado"|null}
 */
function derivePrazoStatus(dataLimiteTs, now = new Date()) {
  const lim = timestampToMillis(dataLimiteTs);
  if (lim == null) return null;
  const t = now.getTime();
  if (t > lim) return "atrasado";
  if (t >= lim - NO_LIMITE_HOURS * 60 * 60 * 1000) return "no_limite";
  return "a_realizar";
}

function isPastPenaltyGrace(dataLimiteTs, now = new Date()) {
  const lim = timestampToMillis(dataLimiteTs);
  if (lim == null) return false;
  return now.getTime() > lim + PENALIDADE_GRACE_HOURS * 60 * 60 * 1000;
}

module.exports = {
  PRAZO_DIAS_ALLOWED,
  PENALIDADE_ATRASO_FOGUINHOS,
  PENALIDADE_GRACE_HOURS,
  NO_LIMITE_HOURS,
  isValidPrazoDias,
  computeDataLimiteDate,
  timestampToMillis,
  derivePrazoStatus,
  isPastPenaltyGrace,
};
