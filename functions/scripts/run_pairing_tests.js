/* eslint-disable require-jsdoc, max-len, linebreak-style, quotes */
const admin = require("firebase-admin");

// Usa as credenciais ADC (firebase deploy indicou que há acesso)
admin.initializeApp();

const db = admin.firestore();

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitFor(fn, timeout = 20000, interval = 1000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const v = await fn();
    if (v) return v;
    await sleep(interval);
  }
  throw new Error("timeout waiting for condition");
}

async function run() {
  console.log("Iniciando testes E2E de pareamento...");

  const uidA = "testUserA_" + Date.now();
  const uidB = "testUserB_" + Date.now();
  const phoneA = "11990000001";
  const phoneB = "11990000002";

  try {
    // 1) Criar usuários de teste
    await db.collection("usuarios").doc(uidA).set({
      nome: "Tester A",
      telefone: phoneA,
      email: "testA@example.com",
      sexo: "Masculino",
      foguinhos: 5,
      pareadoCom: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db.collection("usuarios").doc(uidB).set({
      nome: "Tester B",
      telefone: phoneB,
      email: "testB@example.com",
      sexo: "Feminino",
      foguinhos: 5,
      pareadoCom: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log("Usuários de teste criados:", uidA, uidB);

    // 2) Enviar pairing_request (A -> B)
    const inputReqRef = await db.collection("inputs").add({
      type: "pairing_request",
      fromUid: uidA,
      fromName: "Tester A",
      fromPhone: phoneA,
      toUid: uidB,
      toPhone: phoneB,
      toName: "Tester B",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    console.log("pairing_request criado, id:", inputReqRef.id);

    const requestId = [uidA, uidB].sort().join("_");
    const pairingReqDocRef = db.collection("pairingRequests").doc(requestId);

    // Aguarda criação do pairingRequests/{requestId} ou input marcado processado
    await waitFor(async () => {
      const snap = await pairingReqDocRef.get();
      if (snap.exists) return snap.data();
      const inSnap = await db.collection("inputs").doc(inputReqRef.id).get();
      if (inSnap.exists && inSnap.data().processed) return true;
      return false;
    }, 20000, 1000);

    console.log("pairingRequests criado ou input processado");

    // 3) Enviar pairing_response de rejeição (B rejeita)
    const inputRespRef = await db.collection("inputs").add({
      type: "pairing_response",
      fromUid: uidB,
      requestId: requestId,
      response: "rejected",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });

    console.log("pairing_response (rejected) criado, id:", inputRespRef.id);

    // Aguarda pairingRequests.status == 'rejected' e sender.pareadoCom removido
    await waitFor(async () => {
      const reqSnap = await pairingReqDocRef.get();
      if (!reqSnap.exists) return false;
      const req = reqSnap.data();
      if (req.status !== "rejected") return false;
      const senderSnap = await db.collection("usuarios").doc(uidA).get();
      if (!senderSnap.exists) return false;
      const sd = senderSnap.data();
      return !sd.pareadoCom;
    }, 20000, 1000);

    console.log("Rejeição processada e sender.pareadoCom limpo");

    // 4) Agora testa aceitar e depois desparear
    // Envia nova request
    const inputReq2Ref = await db.collection("inputs").add({
      type: "pairing_request",
      fromUid: uidA,
      fromName: "Tester A",
      fromPhone: phoneA,
      toUid: uidB,
      toPhone: phoneB,
      toName: "Tester B",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });
    console.log("pairing_request (2) criado, id:", inputReq2Ref.id);

    // Aguarda pending
    await waitFor(async () => {
      const reqSnap = await pairingReqDocRef.get();
      return reqSnap.exists && reqSnap.data().status === "pending";
    }, 20000, 1000);

    // Aceita (B aceita)
    const inputResp2Ref = await db.collection("inputs").add({
      type: "pairing_response",
      fromUid: uidB,
      requestId: requestId,
      response: "accepted",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });
    console.log("pairing_response (accepted) criado, id:", inputResp2Ref.id);

    // Aguarda status accepted e pareadoCom de ambos
    await waitFor(async () => {
      const reqSnap = await pairingReqDocRef.get();
      if (!reqSnap.exists) return false;
      if (reqSnap.data().status !== "accepted") return false;
      const aSnap = await db.collection("usuarios").doc(uidA).get();
      const bSnap = await db.collection("usuarios").doc(uidB).get();
      if (!aSnap.exists || !bSnap.exists) return false;
      const ad = aSnap.data();
      const bd = bSnap.data();
      return ad.pareadoCom && bd.pareadoCom && ad.pareadoCom === bd.telefone;
    }, 20000, 1000);

    console.log("Aceitação processada, usuários pareados");

    // 5) Enviar pairing_unpair (desparear)
    const inputUnpairRef = await db.collection("inputs").add({
      type: "pairing_unpair",
      fromUid: uidA,
      partnerUid: uidB,
      partnerPhone: phoneB,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      processed: false,
    });
    console.log("pairing_unpair criado, id:", inputUnpairRef.id);

    // Aguarda ambos sem pareadoCom e foguinhos resetados (0)
    await waitFor(async () => {
      const aSnap = await db.collection("usuarios").doc(uidA).get();
      const bSnap = await db.collection("usuarios").doc(uidB).get();
      if (!aSnap.exists || !bSnap.exists) return false;
      const ad = aSnap.data();
      const bd = bSnap.data();
      if ((ad.pareadoCom && ad.pareadoCom.startsWith("pending_")) || (bd.pareadoCom && bd.pareadoCom.startsWith("pending_"))) {
        return false;
      }
      return (!ad.pareadoCom) && (!bd.pareadoCom) && (ad.foguinhos === 0) && (bd.foguinhos === 0);
    }, 30000, 1000);

    console.log("pairing_unpair processado: pareado removido e foguinhos resetados");

    // 6) Cleanup (opcional): deletar docs de teste
    await db.collection("usuarios").doc(uidA).delete();
    await db.collection("usuarios").doc(uidB).delete();
    await pairingReqDocRef.delete().catch(() => {});

    console.log("Teste concluído com sucesso. Documentos de teste removidos.");
  } catch (err) {
    console.error("Erro durante testes E2E:", err);
    process.exitCode = 1;
  }
}

run().then(() => process.exit());
