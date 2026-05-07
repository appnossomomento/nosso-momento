/* eslint-disable require-jsdoc */
const {RATE_LIMIT_STORE, ALLOWED_ORIGINS} = require("./config");

function setCorsHeaders(req, res) {
  const origin = req.get("Origin") || req.get("origin") || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.set("Access-Control-Allow-Origin", origin);
  }
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set(
      "Access-Control-Allow-Headers",
      "Authorization, Content-Type",
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

module.exports = {setCorsHeaders, rateLimitHttp};
