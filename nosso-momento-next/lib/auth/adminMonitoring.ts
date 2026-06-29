/**
 * Auth do painel admin de monitoring — allowlist via ADMIN_MONITORING_EMAILS.
 * Cookie separado: __admin_monitoring
 */

const ADMIN_COOKIE = '__admin_monitoring';
const SESSION_MS = 8 * 60 * 60 * 1000; // 8h

export { ADMIN_COOKIE, SESSION_MS };

export function getAdminAllowlist(): string[] {
  return (process.env.ADMIN_MONITORING_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = getAdminAllowlist();
  if (!list.length) return false;
  return list.includes(email.trim().toLowerCase());
}

export type AdminSession = {
  uid: string;
  email: string;
};

export async function verifyAdminSessionCookie(
  rawValue: string | undefined | null,
): Promise<AdminSession | null> {
  if (!rawValue || rawValue.split('.').length !== 3 || rawValue.length < 50) {
    return null;
  }
  try {
    const { getAdminAuth } = await import('@/lib/firebase/admin');
    const decoded = await getAdminAuth().verifySessionCookie(rawValue, true);
    const email = decoded.email ?? '';
    if (!isAdminEmail(email)) return null;
    return { uid: decoded.uid, email };
  } catch {
    return null;
  }
}
