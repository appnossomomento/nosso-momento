/**
 * Validação do cookie __session (Firebase Session Cookie).
 * Usado pelo proxy.ts em produção — requer Node.js runtime + Admin SDK.
 */
export async function isValidSessionCookie(rawValue: string): Promise<boolean> {
  if (!rawValue || rawValue.split('.').length !== 3 || rawValue.length < 50) {
    return false;
  }

  try {
    const { adminAuth } = await import('@/lib/firebase/admin');
    await adminAuth.verifySessionCookie(rawValue, false);
    return true;
  } catch {
    return false;
  }
}

export function hasAdminCredentials(): boolean {
  return !!(
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  );
}
