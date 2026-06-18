/* eslint-disable require-jsdoc */
const {RATE_LIMIT_STORE, ALLOWED_ORIGINS} = require("./config");
const admin = require("firebase-admin");

function setCorsHeaders(req, res) {
  const origin = req.get("Origin") || req.get("origin") || "";
  const isLocalDev =
    /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (ALLOWED_ORIGINS.includes(origin) || isLocalDev) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type, X-Firebase-AppCheck",
  );
  res.set("Vary", "Origin");
}

function getClientIp(req) {
  const forwarded = req.get("X-Forwarded-For") || req.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function rateLimitHttp(req, res, {keyPrefix, limit, windowMs}) {
  const now = Date.now();
  const ip = getClientIp(req);
  const key = `${keyPrefix}:${ip}`;
  const entry = RATE_LIMIT_STORE.get(key);

  if (!entry || (now - entry.start) > windowMs) {
    RATE_LIMIT_STORE.set(key, {start: now, count: 1});
  } else {
    entry.count += 1;
    if (entry.count > limit) {
      res.status(429).send({error: "rate_limited"});
      return true;
    }
  }

  if (RATE_LIMIT_STORE.size > 5000) {
    for (const [storedKey, storedEntry] of RATE_LIMIT_STORE.entries()) {
      if ((now - storedEntry.start) > windowMs * 2) {
        RATE_LIMIT_STORE.delete(storedKey);
      }
    }
  }

  return false;
}

module.exports = {setCorsHeaders, rateLimitHttp, rateLimitFirestore};

/**
 * Rate limit centralizado usando Firestore (sobrevive a cold starts
 * e múltiplas instâncias).
 *
 * Uso: await rateLimitFirestore(req, res, { keyPrefix, limit, windowMs })
 * retorna true e envia 429 se o limite foi excedido.
 *
 * Estrategia: documento `rateLimits/{key}` com campos `count` e `windowStart`.
 * Usa transacao para incremento atomico. Se o documento nao existir ou a janela
 * expirou, reseta o contador. Retorna true (429) se o limite
 * foi excedido.
 *
 * Custo: 1 leitura + 1 escrita por requisicao — aceitavel para
 * endpoints de alto risco (login, pareamento, verificacao).
 * Para throughput muito alto,
 * migrar para Cloud Armor ou Memorystore (Redis).
 *
 * @param {object} req
 * @param {object} res
 * @param {{keyPrefix: string, limit: number, windowMs: number}} options
 * @return {Promise<boolean>} true se a requisicao foi bloqueada.
 */
async function rateLimitFirestore(req, res, {keyPrefix, limit, windowMs}) {
  const ip = getClientIp(req);
  // Sanitiza a key para ser um ID valido de documento Firestore.
  const safeIp = ip.replace(/[^a-zA-Z0-9._-]/g, "_");
  const docKey = `${keyPrefix}__${safeIp}`;
  const db = admin.firestore();
  const ref = db.collection("rateLimits").doc(docKey);
  const now = Date.now();

  let blocked = false;
  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists || (now - (snap.data().windowStart || 0)) > windowMs) {
        tx.set(ref, {count: 1, windowStart: now, ip, keyPrefix});
      } else {
        const current = snap.data().count || 0;
        if (current >= limit) {
          blocked = true;
          return;
        }
        tx.update(ref, {count: admin.firestore.FieldValue.increment(1)});
      }
    });
  } catch (err) {
    // Falha no Firestore: fail-open (nao bloqueia) para nao derrubar o servico.
    // Registra o erro para monitoramento.
    console.error("[rateLimitFirestore] erro na transacao:", err.message);
    return false;
  }

  if (blocked) {
    res.status(429).send({error: "rate_limited"});
    return true;
  }
  return false;
}
