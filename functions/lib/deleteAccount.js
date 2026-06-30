/* eslint-disable require-jsdoc, max-len, valid-jsdoc, no-constant-condition */

/**
 * LGPD — helpers e orquestração de exclusão de conta.
 */

/**
 * @param {object|null|undefined} userData
 * @param {string} uid
 * @return {Array<{uid: string, telefone?: string, pareamentoId?: string}>}
 */
function collectPartnerEntries(userData, uid) {
  if (!userData) return [];

  const partners = [];
  const seen = new Set();
  const ativos = Array.isArray(userData.pareamentosAtivos) ?
    userData.pareamentosAtivos : [];

  for (const entry of ativos) {
    if (!entry || typeof entry.uid !== "string" || entry.uid === uid) continue;
    if (seen.has(entry.uid)) continue;
    seen.add(entry.uid);
    partners.push({
      uid: entry.uid,
      telefone: typeof entry.telefone === "string" ? entry.telefone : "",
      pareamentoId: typeof entry.pareamentoId === "string" ?
        entry.pareamentoId : undefined,
    });
  }

  if (typeof userData.pareadoUid === "string" &&
      userData.pareadoUid !== uid &&
      !seen.has(userData.pareadoUid)) {
    partners.push({
      uid: userData.pareadoUid,
      telefone: typeof userData.pareadoCom === "string" ?
        userData.pareadoCom : "",
    });
  }

  return partners;
}

/**
 * @param {object|null|undefined} partnerData
 * @param {string} removedUid
 * @param {object} FieldValue
 * @return {object}
 */
function buildPartnerUpdateAfterRemoval(partnerData, removedUid, FieldValue) {
  const ativos = partnerData && Array.isArray(partnerData.pareamentosAtivos) ?
    partnerData.pareamentosAtivos : [];
  const updated = ativos.filter((p) => p && p.uid !== removedUid);
  const update = {pareamentosAtivos: updated};

  if (updated.length === 0) {
    update.pareadoCom = FieldValue.delete();
    update.pareadoUid = FieldValue.delete();
    update.foguinhos = 0;
    update.lastCheckInDate = FieldValue.delete();
  } else {
    const first = updated[0];
    update.pareadoCom = first.telefone || null;
    update.pareadoUid = first.uid || null;
  }

  return update;
}

/**
 * @param {string} phoneA
 * @param {string} phoneB
 * @return {string|null}
 */
function pareamentoIdFromPhones(phoneA, phoneB) {
  const a = (phoneA || "").replace(/\D/g, "");
  const b = (phoneB || "").replace(/\D/g, "");
  if (!a || !b) return null;
  return [a, b].sort().join("_");
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {FirebaseFirestore.Query} query
 * @param {number} batchSize
 */
async function deleteQueryInBatches(db, query, batchSize = 200) {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

/**
 * @param {import('firebase-admin').firestore.Firestore} db
 * @param {string} pareamentoId
 */
async function deletePareamentoWithSubcollections(db, pareamentoId) {
  const ref = db.collection("pareamentos").doc(pareamentoId);
  for (const sub of ["extrato", "climaDiario"]) {
    await deleteQueryInBatches(db, ref.collection(sub));
  }
  await ref.delete();
}

/**
 * @param {import('firebase-admin').storage.Storage} storage
 * @param {string} prefix
 */
async function deleteStoragePrefix(storage, prefix) {
  const bucket = storage.bucket();
  const [files] = await bucket.getFiles({prefix});
  await Promise.all(
      files.map((file) => file.delete({ignoreNotFound: true})),
  );
  return files.length;
}

/**
 * Exclui todos os dados do usuário (LGPD) e a conta Auth.
 * @param {object} deps
 * @param {import('firebase-admin').firestore.Firestore} deps.db
 * @param {import('firebase-admin').auth.Auth} deps.auth
 * @param {import('firebase-admin').storage.Storage} deps.storage
 * @param {object} deps.FieldValue
 * @param {string} uid
 */
async function deleteUserAccount({db, auth, storage, FieldValue}, uid) {
  const userRef = db.collection("usuarios").doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() : null;
  const userPhone = (userData && userData.telefone) || "";

  const partners = collectPartnerEntries(userData, uid);
  const pareamentoIds = new Set();

  for (const entry of partners) {
    const partnerRef = db.collection("usuarios").doc(entry.uid);
    const partnerSnap = await partnerRef.get();
    if (partnerSnap.exists) {
      await partnerRef.update(
          buildPartnerUpdateAfterRemoval(
              partnerSnap.data(), uid, FieldValue,
          ),
      );
    }

    const pid = entry.pareamentoId ||
      pareamentoIdFromPhones(userPhone, entry.telefone);
    if (pid) pareamentoIds.add(pid);

    const pairKey = [uid, entry.uid].sort().join("_");
    await db.collection("weeklyChallenges")
        .doc(`alma_gemea_${pairKey}`).delete().catch(() => {});
    await db.collection("pairingRequests").doc(pairKey).delete().catch(() => {});
  }

  for (const field of ["pessoa1Uid", "pessoa2Uid"]) {
    const snap = await db.collection("pareamentos")
        .where(field, "==", uid).get();
    snap.docs.forEach((doc) => pareamentoIds.add(doc.id));
  }

  for (const pid of pareamentoIds) {
    await deletePareamentoWithSubcollections(db, pid);
  }

  await deleteQueryInBatches(
      db, db.collection("notificacoes").where("userId", "==", uid),
  );
  await db.collection("userNotificationTokens").doc(uid)
      .delete().catch(() => {});

  for (const field of ["resgatadoPorUid", "executadoPorUid", "autorUid"]) {
    await deleteQueryInBatches(
        db, db.collection("tarefasMomentos").where(field, "==", uid),
    );
    await deleteQueryInBatches(
        db, db.collection("memorias").where(field, "==", uid),
    );
  }

  await deleteQueryInBatches(
      db, db.collection("convites").where("senderUid", "==", uid),
  );
  await deleteQueryInBatches(
      db, db.collection("inputs").where("fromUid", "==", uid),
  );

  await deleteStoragePrefix(storage, `profile_pics/${uid}/`);

  const bucket = storage.bucket();
  const [customFiles] = await bucket.getFiles({prefix: "custom_momentos/"});
  await Promise.all(
      customFiles
          .filter((f) => f.name.split("/")[2] === uid)
          .map((f) => f.delete({ignoreNotFound: true})),
  );

  const [memoriaFiles] = await bucket.getFiles({prefix: "memorias/"});
  await Promise.all(
      memoriaFiles
          .filter((f) => f.name.split("/")[2] === uid)
          .map((f) => f.delete({ignoreNotFound: true})),
  );

  if (userSnap.exists) {
    await userRef.delete();
  }

  try {
    await auth.deleteUser(uid);
  } catch (err) {
    if (err && err.code !== "auth/user-not-found") throw err;
  }

  return {
    partnersUpdated: partners.length,
    pareamentosDeleted: pareamentoIds.size,
  };
}

module.exports = {
  collectPartnerEntries,
  buildPartnerUpdateAfterRemoval,
  pareamentoIdFromPhones,
  deleteUserAccount,
};
