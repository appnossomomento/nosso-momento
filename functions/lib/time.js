/* eslint-disable require-jsdoc */

function timestampToDate(ts) {
  return ts && typeof ts.toDate === "function" ? ts.toDate() : null;
}

// Retorna a data no fuso de São Paulo (UTC-3) no formato YYYY-MM-DD
function toSaoPauloDateStr(date) {
  // UTC-3: subtrai 3 horas
  const sp = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return sp.toISOString().slice(0, 10);
}

function isSameCalendarDay(tsA, tsB) {
  const dateA = timestampToDate(tsA);
  const dateB = timestampToDate(tsB);
  if (!dateA || !dateB) return false;
  // Compara no fuso de São Paulo (UTC-3) para evitar virada de dia às 21h
  return toSaoPauloDateStr(dateA) === toSaoPauloDateStr(dateB);
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

module.exports = {
  timestampToDate,
  toSaoPauloDateStr,
  isSameCalendarDay,
  differenceInCalendarDays,
  isPreviousCalendarDay,
};
