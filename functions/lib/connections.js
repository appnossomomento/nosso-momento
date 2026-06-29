/* eslint-disable require-jsdoc */

/**
 * Conta conexões ativas (pareamentosAtivos ou fallback legado pareadoUid).
 * @param {object|null|undefined} userData
 * @return {number}
 */
function getActiveConnectionCount(userData) {
  const data = userData || {};
  const ativos = Array.isArray(data.pareamentosAtivos) ?
    data.pareamentosAtivos : [];
  if (ativos.length > 0) return ativos.length;
  return data.pareadoUid ? 1 : 0;
}

/**
 * @param {object|null|undefined} userData
 * @param {string|null|undefined} uid
 * @return {boolean}
 */
function hasConnectionToUid(userData, uid) {
  if (!userData || !uid) return false;
  const ativos = Array.isArray(userData.pareamentosAtivos) ?
    userData.pareamentosAtivos : [];
  if (ativos.some((p) => p && p.uid === uid)) return true;
  return userData.pareadoUid === uid;
}

/**
 * @param {object|null|undefined} userData
 * @param {string|null|undefined} targetUid
 * @param {number} maxConnections
 * @return {boolean}
 */
function wouldExceedConnectionLimit(userData, targetUid, maxConnections) {
  if (hasConnectionToUid(userData, targetUid)) return false;
  return getActiveConnectionCount(userData) >= maxConnections;
}

module.exports = {
  getActiveConnectionCount,
  hasConnectionToUid,
  wouldExceedConnectionLimit,
};
