import { initializeApp, getApps } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaV3Provider, getToken, type AppCheck } from 'firebase/app-check';
import type { FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const hasValidClientConfig = Object.values(firebaseConfig).every(
  (v) => typeof v === 'string' && v.trim() !== '' && v !== 'undefined',
);
const canInitializeFirebase = typeof window !== 'undefined' && hasValidClientConfig;

let app: FirebaseApp | null = null;
if (canInitializeFirebase) {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

// App Check — reCAPTCHA v3 (inicializar antes de Auth/Firestore para evitar corrida de token).
export let appCheck: AppCheck | null = null;
if (app && typeof window !== 'undefined') {
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const debugToken = process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  const injectedDebugToken =
    typeof window !== 'undefined'
      ? String((self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN ?? '').trim()
      : '';

  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const win = self as unknown as Record<string, unknown>;
    if (debugToken) {
      win.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
    } else if (!win.FIREBASE_APPCHECK_DEBUG_TOKEN) {
      win.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
  }

  const isDevWithDebugToken = isDev && (!!debugToken || (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN === true);
  const hasDebugToken = isDevWithDebugToken || injectedDebugToken.length > 0;
  const siteKey = recaptchaKey?.trim() ?? '';

  if (siteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(siteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (hasDebugToken || isDev) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('debug-placeholder'),
      isTokenAutoRefreshEnabled: true,
    });
  } else {
    console.error(
      '[AppCheck] NEXT_PUBLIC_RECAPTCHA_SITE_KEY ausente em produção. Cloud Functions com enforce falharão.',
    );
  }
}

export const auth = (app ? getAuth(app) : null) as Auth;
export const db = (app ? getFirestore(app) : null) as Firestore;
export const storage = (app ? getStorage(app) : null) as FirebaseStorage;

// Habilita persistência offline (silencia erros esperados)
if (app && typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('[Firestore] Offline persistence error:', err.code);
    }
  });
}

if (typeof window !== 'undefined' && !hasValidClientConfig) {
  console.error('[Firebase] Configuração NEXT_PUBLIC_FIREBASE_* ausente/inválida no ambiente.');
}

/** Garante token App Check antes de leituras Firestore (enforcement no Console). */
let inflightAppCheckToken: Promise<string | null> | null = null;
let cachedAppCheckToken: { value: string; expiresAt: number } | null = null;
/** Evita rajadas de exchangeRecaptchaV3Token após 400/throttle do Firebase. */
let appCheckBackoffUntil = 0;

const isDevEnv = process.env.NODE_ENV === 'development';
const APP_CHECK_WAIT_MS = isDevEnv ? 2500 : 6000;

function parseAppCheckBackoffMs(err: unknown): number {
  const message = String((err as { message?: string }).message ?? err ?? '');
  const match = message.match(/after\s+(\d+)m:(\d+)s/i);
  if (match) {
    return (Number(match[1]) * 60 + Number(match[2])) * 1000 + 500;
  }
  return isDevEnv ? 3_000 : 15_000;
}

function isAppCheckThrottleError(err: unknown): boolean {
  const code = String((err as { code?: string }).code ?? '');
  const message = String((err as { message?: string }).message ?? '');
  return (
    code.includes('throttled') ||
    code.includes('initial-throttle') ||
    message.includes('400 error') ||
    message.includes('exchangeRecaptchaV3Token')
  );
}

export async function getAppCheckToken(force = false): Promise<string | null> {
  if (!appCheck) return null;

  const now = Date.now();
  if (!force && now < appCheckBackoffUntil) {
    return cachedAppCheckToken?.value ?? null;
  }

  if (force) {
    cachedAppCheckToken = null;
  } else if (cachedAppCheckToken && cachedAppCheckToken.expiresAt > now) {
    return cachedAppCheckToken.value;
  }

  if (!force && inflightAppCheckToken) {
    return inflightAppCheckToken;
  }

  inflightAppCheckToken = (async () => {
    try {
      const result = await getToken(appCheck!, false);
      const token = result.token || null;
      if (token) {
        appCheckBackoffUntil = 0;
        cachedAppCheckToken = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
      }
      return token;
    } catch (err) {
      if (isAppCheckThrottleError(err)) {
        appCheckBackoffUntil = Date.now() + parseAppCheckBackoffMs(err);
      }
      if (!isDevEnv) {
        console.warn('[AppCheck] falha ao obter token:', err);
      }
      return null;
    }
  })();

  try {
    return await inflightAppCheckToken;
  } finally {
    inflightAppCheckToken = null;
  }
}

/** Aguarda token App Check por até maxMs (útil antes de CFs com enforce). */
export async function waitForAppCheckToken(maxMs = APP_CHECK_WAIT_MS): Promise<string | null> {
  const deadline = Date.now() + maxMs;
  const pollMs = isDevEnv ? 500 : 1500;
  while (Date.now() < deadline) {
    const token = await getAppCheckToken(false);
    if (token) return token;
    if (Date.now() < appCheckBackoffUntil) break;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  return cachedAppCheckToken?.value ?? null;
}

/** Best-effort — não bloqueia login/navegação. */
export async function ensureAppCheckReady(maxMs = isDevEnv ? 1500 : 2000): Promise<void> {
  await Promise.race([
    getAppCheckToken(false),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), maxMs)),
  ]);
}

export default app;
