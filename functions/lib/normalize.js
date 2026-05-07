/* eslint-disable require-jsdoc */

function normalizePhone(value) {
  if (!value) return null;
  return String(value).replace(/\D/g, "");
}

function normalizeLeadText(value, maxLen = 160) {
  if (value === null || value === undefined) return "";
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.slice(0, maxLen);
}

function normalizeLeadEmail(value) {
  const raw = normalizeLeadText(value, 180).toLowerCase();
  if (!raw) return "";
  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  return isValid ? raw : "";
}

function normalizeLeadPhone(value) {
  const digits = normalizePhone(value) || "";
  if (!digits) return "";
  if (digits.length < 10 || digits.length > 13) return "";
  return digits;
}

function normalizeChallengeAnswer(value) {
  if (!value) return "";
  return String(value)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
}

function buildMemoriaDescricao(executado, resgatado, momentoNome) {
  const executadoFinal = executado || "Alguém";
  const resgatadoFinal = resgatado || "seu par";
  const momentoFinal = momentoNome || "um momento especial";
  return `${executadoFinal} realizou ${momentoFinal} para ${resgatadoFinal}` +
    " e esse foi o registro desse momento especial";
}

function parsePayloadJson(input) {
  if (!input || typeof input.payloadJson !== "string") return null;
  try {
    return JSON.parse(input.payloadJson);
  } catch (err) {
    console.error("weekly_challenge: payloadJson inválido", err);
    return null;
  }
}

function sanitizeMomentItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const sanitized = [];
  const MAX_ITEMS = 4;

  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;

    const nome = typeof raw.nome === "string" ? raw.nome.trim() : "";
    const custo = Number(raw.custoFoguinhos);
    if (!nome || !Number.isFinite(custo)) continue;

    const custoInt = Math.floor(custo);
    if (custoInt <= 0 || custoInt > 1000) continue;

    sanitized.push({
      nome,
      custoFoguinhos: custoInt,
      emoji: typeof raw.emoji === "string" ? raw.emoji : "",
      categoria: typeof raw.categoria === "string" ? raw.categoria : "",
      img: typeof raw.img === "string" ? raw.img : "",
    });

    if (sanitized.length >= MAX_ITEMS) break;
  }

  return sanitized;
}

module.exports = {
  normalizePhone,
  normalizeLeadText,
  normalizeLeadEmail,
  normalizeLeadPhone,
  normalizeChallengeAnswer,
  buildMemoriaDescricao,
  parsePayloadJson,
  sanitizeMomentItems,
};
