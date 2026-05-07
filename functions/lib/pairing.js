/* eslint-disable require-jsdoc */
const {normalizePhone} = require("./normalize");

function areUsersPaired(senderData, partnerData, senderUid, partnerUid) {
  if (!senderData || !partnerData) return false;

  // --- Multi-conexão: verifica via pareamentosAtivos (VIP) ---
  const senderAtivos = Array.isArray(senderData.pareamentosAtivos) ?
      senderData.pareamentosAtivos : [];
  const partnerAtivos = Array.isArray(partnerData.pareamentosAtivos) ?
      partnerData.pareamentosAtivos : [];
  const senderHasPartnerInList = senderAtivos.some(
      (p) => p.uid === partnerUid);
  const partnerHasSenderInList = partnerAtivos.some(
      (p) => p.uid === senderUid);
  if (senderHasPartnerInList && partnerHasSenderInList) return true;

  // --- Fallback monogâmico (backward compat) ---
  const senderMatchesUid = senderData.pareadoUid &&
    senderData.pareadoUid === partnerUid;
  const partnerMatchesUid = partnerData.pareadoUid &&
    partnerData.pareadoUid === senderUid;

  const senderPhoneTarget = normalizePhone(senderData.pareadoCom);
  const partnerPhoneSelf = normalizePhone(partnerData.telefone);
  const partnerPhoneTarget = normalizePhone(partnerData.pareadoCom);
  const senderPhoneSelf = normalizePhone(senderData.telefone);

  const senderPhonesMatch = senderPhoneTarget &&
    partnerPhoneSelf &&
    senderPhoneTarget === partnerPhoneSelf;
  const partnerPhonesMatch = partnerPhoneTarget &&
    senderPhoneSelf &&
    partnerPhoneTarget === senderPhoneSelf;

  return (senderMatchesUid || senderPhonesMatch) &&
    (partnerMatchesUid || partnerPhonesMatch);
}

module.exports = {areUsersPaired};
