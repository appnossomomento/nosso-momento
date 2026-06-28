/* eslint-disable require-jsdoc, linebreak-style, max-len, valid-jsdoc */

const PRICE_MULTIPLIER = 2;
const MAX_ITEMS = 4;
const MAX_PRICE = 1000;
const CUSTOM_ID_PREFIX = "custom_";

/**
 * Sanitiza itens do carrinho preservando ids para resolução server-side.
 * @param {unknown} rawItems
 * @return {Array<object>}
 */
function sanitizeMomentRedeemItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const sanitized = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;

    const nome = typeof raw.nome === "string" ? raw.nome.trim() : "";
    const id = typeof raw.id === "string" ? raw.id.trim() : "";
    const momentoMestreId = typeof raw.momentoMestreId === "string" ?
      raw.momentoMestreId.trim() : "";
    const resolvedId = id || momentoMestreId;

    if (!nome && !resolvedId) continue;

    sanitized.push({
      id: resolvedId,
      nome,
      emoji: typeof raw.emoji === "string" ? raw.emoji : "",
      categoria: typeof raw.categoria === "string" ? raw.categoria : "",
      img: typeof raw.img === "string" ? raw.img : "",
    });

    if (sanitized.length >= MAX_ITEMS) break;
  }

  return sanitized;
}

function isCustomMomentId(id) {
  return typeof id === "string" && id.startsWith(CUSTOM_ID_PREFIX);
}

function getCatalogCfg(catalogoPersonalizado, nome) {
  if (!catalogoPersonalizado || typeof catalogoPersonalizado !== "object") {
    return {};
  }
  const cfg = catalogoPersonalizado[nome];
  if (!cfg || typeof cfg !== "object") return {};
  return cfg;
}

function computeMasterPrice(mestreData, catalogCfg) {
  const intensidade = Number(
      mestreData.intensidade != null ? mestreData.intensidade : 1,
  );
  const defaultPrice = Math.floor(intensidade * PRICE_MULTIPLIER);
  if (catalogCfg.preco !== undefined && catalogCfg.preco !== null) {
    const custom = Math.floor(Number(catalogCfg.preco));
    if (Number.isFinite(custom) && custom > 0 && custom <= MAX_PRICE) {
      return custom;
    }
  }
  return defaultPrice > 0 && defaultPrice <= MAX_PRICE ? defaultPrice : 0;
}

function normalizeCatalogGender(value) {
  if (!value || typeof value !== "string") return "unisex";
  const v = value.trim().toLowerCase();
  if (v === "masculino" || v === "m") return "masculino";
  if (v === "feminino" || v === "f") return "feminino";
  if (v === "unisex") return "unisex";
  return v;
}

function getPartnerCatalogGender(partnerData) {
  const raw = (partnerData && partnerData.anatomia) ||
    (partnerData && partnerData.sexo) ||
    "unisex";
  return normalizeCatalogGender(raw);
}

function momentMatchesPartnerGender(mestreData, partnerSexo) {
  const target = normalizeCatalogGender(
      mestreData.targetGender || "Unisex",
  );
  if (target === "unisex") return true;
  const receptor = getPartnerCatalogGender({sexo: partnerSexo, anatomia: partnerSexo});
  if (receptor === "unisex") return true;
  return target === receptor;
}

/**
 * Resolve preço de um momento mestre (espelha a lógica da loja).
 * @param {object} item
 * @param {object} mestreData
 * @param {object} partnerData
 * @return {{ok: true, item: object}|{ok: false, error: string}}
 */
function resolveMasterMomentItem(item, mestreData, partnerData) {
  const nome = mestreData.nome || item.nome;
  if (!nome) return {ok: false, error: "momento_invalido"};

  if (!momentMatchesPartnerGender(mestreData, partnerData.anatomia || partnerData.sexo)) {
    return {ok: false, error: "momento_genero_invalido"};
  }

  const catalogCfg = getCatalogCfg(partnerData.catalogoPersonalizado, nome);
  if (catalogCfg.bloqueado === true) {
    return {ok: false, error: "momento_bloqueado"};
  }

  const custoFoguinhos = computeMasterPrice(mestreData, catalogCfg);
  if (custoFoguinhos <= 0) {
    return {ok: false, error: "momento_preco_invalido"};
  }

  return {
    ok: true,
    item: {
      id: item.id || mestreData.id || "",
      nome,
      custoFoguinhos,
      emoji: item.emoji || mestreData.emoji || "",
      categoria: item.categoria || mestreData.categoria || "",
      img: item.img || mestreData.img || "",
      momentoMestreId: mestreData.id || item.id || "",
    },
  };
}

/**
 * Stub para momentos custom VIP (L1.5). Falha fechado até implementação.
 */
function resolveCustomMomentItem() {
  return {ok: false, error: "custom_not_available"};
}

/**
 * Busca documento mestre por id ou nome.
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} id
 * @param {string} nome
 */
async function fetchMomentoMestre(db, id, nome) {
  if (id && !isCustomMomentId(id)) {
    const byId = await db.collection("momentosMestres").doc(id).get();
    if (byId.exists) {
      return {id: byId.id, ...byId.data()};
    }
  }

  if (nome) {
    const byNome = await db.collection("momentosMestres")
        .where("nome", "==", nome)
        .limit(1)
        .get();
    if (!byNome.empty) {
      const doc = byNome.docs[0];
      return {id: doc.id, ...doc.data()};
    }
  }

  return null;
}

/**
 * Resolve todos os itens do resgate com preços server-side.
 * @param {Array<object>} sanitizedItems
 * @param {object|null} partnerData
 * @param {string|null} pareamentoId
 * @param {import('firebase-admin').firestore.Firestore} db
 */
async function resolveRedeemItems(sanitizedItems, partnerData, pareamentoId, db) {
  if (!partnerData) {
    return {ok: false, error: "usuario_nao_encontrado"};
  }
  if (!Array.isArray(sanitizedItems) || sanitizedItems.length === 0) {
    return {ok: false, error: "missing_redeem_info"};
  }

  const resolved = [];
  let totalCost = 0;

  for (const item of sanitizedItems) {
    if (isCustomMomentId(item.id)) {
      const customResult = resolveCustomMomentItem();
      if (!customResult.ok) return {ok: false, error: customResult.error};
    }

    const mestreData = await fetchMomentoMestre(db, item.id, item.nome);
    if (!mestreData) {
      return {ok: false, error: "momento_nao_encontrado"};
    }

    const masterResult = resolveMasterMomentItem(item, mestreData, partnerData);
    if (!masterResult.ok) {
      return {ok: false, error: masterResult.error};
    }

    resolved.push(masterResult.item);
    totalCost += masterResult.item.custoFoguinhos;
  }

  if (totalCost <= 0) {
    return {ok: false, error: "missing_redeem_info"};
  }

  return {ok: true, items: resolved, totalCost};
}

module.exports = {
  PRICE_MULTIPLIER,
  sanitizeMomentRedeemItems,
  isCustomMomentId,
  getCatalogCfg,
  computeMasterPrice,
  momentMatchesPartnerGender,
  resolveMasterMomentItem,
  resolveCustomMomentItem,
  fetchMomentoMestre,
  resolveRedeemItems,
};
