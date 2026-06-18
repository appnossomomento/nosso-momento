/* eslint-disable require-jsdoc, linebreak-style, max-len, valid-jsdoc */
const {admin} = require("./config");

function getAppCheckMode() {
  const raw = (process.env.ENFORCE_APP_CHECK || "off").toLowerCase();
  if (raw === "true" || raw === "enforce" || raw === "enforced") return "enforce";
  if (raw === "monitor") return "monitor";
  return "off";
}

/**
 * App Check rollout gradual:
 * - off: ignora
 * - monitor: loga ausência/token inválido, não bloqueia
 * - enforce/true: bloqueia com 401
 *
 * @return {Promise<boolean>} true se a requisição foi bloqueada.
 */
async function requireAppCheck(req, res) {
  const mode = getAppCheckMode();
  if (mode === "off") return false;

  const token =
    req.get("X-Firebase-AppCheck") ||
    req.get("x-firebase-appcheck") ||
    "";

  const fn = req.path ? req.path.split("/").pop() : "unknown";

  if (!token) {
    console.warn(`[appCheck:${mode}] missing token fn=${fn}`);
    if (mode !== "enforce") return false;
    res.status(401).send({error: "missing_app_check"});
    return true;
  }

  try {
    await admin.appCheck().verifyToken(token);
    return false;
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    console.warn(`[appCheck:${mode}] invalid token fn=${fn}:`, msg);
    if (mode !== "enforce") return false;
    res.status(401).send({error: "invalid_app_check"});
    return true;
  }
}

module.exports = {requireAppCheck, getAppCheckMode};
