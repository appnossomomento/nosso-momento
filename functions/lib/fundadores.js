/**
 * Cohort dos primeiros casais que ativam pareamento.
 * Conta por par aceito (não por signup); flag fica no usuário para sempre.
 */

const MAX_FUNDADOR_COUPLES = 100;
const FUNDADORES_DOC = "fundadores";

/**
 * Planeja grant de fundador na transaction do pairing_response.
 * Ambos recebem a flag + o mesmo fundadorNumero (1-100) do casal.
 *
 * @param {FirebaseFirestore.DocumentSnapshot} fundadorSnap
 * @param {object} senderData
 * @param {object} receiverData
 * @return {object} plano de grant (flags + nextCount/fundadorNumero)
 */
function planFundadorGrant(fundadorSnap, senderData, receiverData) {
  const senderIs = senderData && senderData.fundador === true;
  const receiverIs = receiverData && receiverData.fundador === true;
  if (senderIs && receiverIs) {
    return {
      grantSender: false,
      grantReceiver: false,
      nextCount: null,
      fundadorNumero: null,
    };
  }

  const existingNum = (() => {
    const s = Number(senderData && senderData.fundadorNumero);
    if (Number.isFinite(s) && s > 0) return s;
    const r = Number(receiverData && receiverData.fundadorNumero);
    if (Number.isFinite(r) && r > 0) return r;
    return null;
  })();

  // Um já é fundador: o parceiro herda o mesmo número, sem consumir slot.
  if (existingNum != null && (senderIs || receiverIs)) {
    return {
      grantSender: !senderIs,
      grantReceiver: !receiverIs,
      nextCount: null,
      fundadorNumero: existingNum,
    };
  }

  const raw = fundadorSnap && fundadorSnap.exists ?
    Number((fundadorSnap.data() || {}).couplesGranted) :
    0;
  const usados = Number.isFinite(raw) ? raw : 0;
  if (usados >= MAX_FUNDADOR_COUPLES) {
    return {
      grantSender: false,
      grantReceiver: false,
      nextCount: null,
      fundadorNumero: null,
    };
  }

  const fundadorNumero = usados + 1;
  return {
    grantSender: !senderIs,
    grantReceiver: !receiverIs,
    nextCount: fundadorNumero,
    fundadorNumero,
  };
}

module.exports = {
  MAX_FUNDADOR_COUPLES,
  FUNDADORES_DOC,
  planFundadorGrant,
};
