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
  if (recaptchaKey || hasDebugToken || isDev) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey || 'debug-placeholder'),
      isTokenAutoRefreshEnabled: true,
    });
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn('[AppCheck] NEXT_PUBLIC_RECAPTCHA_SITE_KEY não configurada. App Check desativado.');
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

export async function getAppCheckToken(force = false): Promise<string | null> {
  if (!appCheck) return null;

  if (force) {
    cachedAppCheckToken = null;
  } else if (cachedAppCheckToken && cachedAppCheckToken.expiresAt > Date.now()) {
    return cachedAppCheckToken.value;
  }

  if (!force && inflightAppCheckToken) {
    return inflightAppCheckToken;
  }

  inflightAppCheckToken = (async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const result = await getToken(appCheck!, force || attempt > 0);
        const token = result.token || null;
        if (token) {
          cachedAppCheckToken = { value: token, expiresAt: Date.now() + 50 * 60 * 1000 };
        }
        return token;
      } catch (err) {
        const code = String((err as { code?: string }).code ?? '');
        const throttled = code.includes('throttled') || code.includes('initial-throttle');
        if (throttled && attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 2500 * (attempt + 1)));
          continue;
        }
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        console.warn('[AppCheck] falha ao obter token:', err);
        return null;
      }
    }
    return null;
  })();

  try {
    return await inflightAppCheckToken;
  } finally {
    inflightAppCheckToken = null;
  }
}

/** Aguarda token App Check por até maxMs (útil antes de CFs com enforce). */
export async function waitForAppCheckToken(maxMs = 10000): Promise<string | null> {
  const deadline = Date.now() + maxMs;
  let force = false;
  while (Date.now() < deadline) {
    const token = await getAppCheckToken(force);
    if (token) return token;
    force = true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return null;
}

export async function ensureAppCheckReady(): Promise<void> {
  await getAppCheckToken(false);
}

export default app;
