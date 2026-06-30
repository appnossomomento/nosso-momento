/* eslint-disable require-jsdoc, max-len */

const {MAX_CUSTOM_MOMENTS} = require("./constants");

const CUSTOM_ID_PREFIX = "custom_";
const MAX_CUSTOM_PRICE = 999;
const MIN_CUSTOM_PRICE = 1;

/**
 * Gera id público para momento custom no carrinho/resgate.
 * @param {string} pareamentoId
 * @param {string} itemId
 * @return {string}
 */
function buildCustomMomentId(pareamentoId, itemId) {
  return `${CUSTOM_ID_PREFIX}${pareamentoId}_${itemId}`;
}

/**
 * Extrai pareamentoId e itemId de um id custom.
 * itemId não contém underscores; pareamentoId pode conter.
 * @param {string} id
 * @return {{pareamentoId: string, itemId: string}|null}
 */
function parseCustomMomentId(id) {
  if (typeof id !== "string" || !id.startsWith(CUSTOM_ID_PREFIX)) {
    return null;
  }
  const rest = id.slice(CUSTOM_ID_PREFIX.length);
  const sep = rest.lastIndexOf("_");
  if (sep <= 0 || sep >= rest.length - 1) return null;
  return {
    pareamentoId: rest.slice(0, sep),
    itemId: rest.slice(sep + 1),
  };
}

/**
 * @param {string} id
 * @return {boolean}
 */
function isCustomMomentId(id) {
  return parseCustomMomentId(id) !== null;
}

/**
 * @param {object|null|undefined} pareamentoData
 * @param {string} uid
 * @return {boolean}
 */
function isUserPareamentoMember(pareamentoData, uid) {
  if (!pareamentoData || !uid) return false;
  return pareamentoData.pessoa1Uid === uid ||
    pareamentoData.pessoa2Uid === uid;
}

/**
 * @param {object|null|undefined} momentosCustom
 * @param {string} ownerUid
 * @param {string} itemId
 * @return {object|null}
 */
function findCustomMoment(momentosCustom, ownerUid, itemId) {
  if (!momentosCustom || typeof momentosCustom !== "object") return null;
  const list = momentosCustom[ownerUid];
  if (!Array.isArray(list)) return null;
  return list.find((item) =>
    item && item.id === itemId && item.ativo !== false,
  ) || null;
}

/**
 * @param {unknown} rawCatalogo
 * @param {boolean} isVip
 * @return {{ok: true, catalogo: object}|{ok: false, error: string}}
 */
function sanitizeCatalogoPersonalizado(rawCatalogo, isVip) {
  if (!rawCatalogo || typeof rawCatalogo !== "object" || Array.isArray(rawCatalogo)) {
    return {ok: true, catalogo: {}};
  }

  const catalogo = {};
  for (const [nome, rawCfg] of Object.entries(rawCatalogo)) {
    if (!nome || typeof nome !== "string") continue;
    if (!rawCfg || typeof rawCfg !== "object" || Array.isArray(rawCfg)) continue;

    const cfg = {};
    if (rawCfg.bloqueado === true) cfg.bloqueado = true;
    if (rawCfg.excluido === true) {
      if (!isVip) return {ok: false, error: "vip_required"};
      cfg.excluido = true;
    }
    if (rawCfg.preco !== undefined && rawCfg.preco !== null) {
      const preco = Math.floor(Number(rawCfg.preco));
      if (Number.isFinite(preco) && preco >= MIN_CUSTOM_PRICE && preco <= 1000) {
        cfg.preco = preco;
      }
    }
    if (Object.keys(cfg).length > 0) {
      catalogo[nome.trim()] = cfg;
    }
  }

  return {ok: true, catalogo};
}

/**
 * @param {object} input
 * @return {{ok: true, item: object}|{ok: false, error: string}}
 */
function validateCustomMomentCreateInput(input) {
  const nome = typeof input.nome === "string" ? input.nome.trim() : "";
  const preco = Math.floor(Number(input.preco));
  if (!nome || nome.length > 80) {
    return {ok: false, error: "invalid_custom_moment"};
  }
  if (!Number.isFinite(preco) || preco < MIN_CUSTOM_PRICE || preco > MAX_CUSTOM_PRICE) {
    return {ok: false, error: "invalid_custom_price"};
  }
  const emoji = typeof input.emoji === "string" ? input.emoji.slice(0, 8) : "✨";
  const img = typeof input.img === "string" ? input.img.slice(0, 500) : "";
  return {
    ok: true,
    item: {nome, preco, emoji, img, categoria: "Custom"},
  };
}

/**
 * @param {Array<object>|undefined} existing
 * @return {boolean}
 */
function canAddCustomMoment(existing) {
  const active = Array.isArray(existing) ?
    existing.filter((i) => i && i.ativo !== false) : [];
  return active.length < MAX_CUSTOM_MOMENTS;
}

/**
 * Gera id curto sem underscores para parsing estável.
 * @return {string}
 */
function generateCustomItemId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * UIDs de parceiros ativos do usuário (multi-conexão + legado monogâmico).
 * @param {object|null|undefined} senderData
 * @param {string} fromUid
 * @return {string[]}
 */
function getPartnerUidsFromSender(senderData, fromUid) {
  const uids = new Set();
  if (!senderData || !fromUid) return [];

  const ativos = Array.isArray(senderData.pareamentosAtivos) ?
    senderData.pareamentosAtivos : [];
  for (const entry of ativos) {
    if (entry && typeof entry.uid === "string" && entry.uid !== fromUid) {
      uids.add(entry.uid);
    }
  }
  if (typeof senderData.pareadoUid === "string" &&
      senderData.pareadoUid !== fromUid) {
    uids.add(senderData.pareadoUid);
  }
  return [...uids];
}

module.exports = {
  CUSTOM_ID_PREFIX,
  MAX_CUSTOM_PRICE,
  MIN_CUSTOM_PRICE,
  buildCustomMomentId,
  parseCustomMomentId,
  isCustomMomentId,
  isUserPareamentoMember,
  findCustomMoment,
  sanitizeCatalogoPersonalizado,
  validateCustomMomentCreateInput,
  canAddCustomMoment,
  generateCustomItemId,
  getPartnerUidsFromSender,
};
