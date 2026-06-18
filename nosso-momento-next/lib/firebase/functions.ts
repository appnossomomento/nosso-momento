import { auth, getAppCheckToken } from './client';

const REMOTE_BASE = 'https://southamerica-east1-nosso-momento-app.cloudfunctions.net';

/** Em dev local usa proxy Next.js (/api/cf) para evitar CORS em portas != 3000. */
function cfUrl(path: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `/api/cf/${path}`;
  }
  return `${REMOTE_BASE}/${path}`;
}

async function appCheckHeaders(force = false): Promise<Record<string, string>> {
  const token = await getAppCheckToken(force);
  return token ? { 'X-Firebase-AppCheck': token } : {};
}

export const FUNCTIONS = {
  createInput: cfUrl('createInput'),
  setNotificationToken: cfUrl('setNotificationToken'),
  getMemorias: cfUrl('getMemorias'),
  createMemoriaPhoto: cfUrl('createMemoriaPhoto'),
  deleteMemoria: cfUrl('deleteMemoria'),
  getExtrato: cfUrl('getExtrato'),
  getParceiroPerfil: cfUrl('getParceiroPerfil'),
  gerarConvite: cfUrl('gerarConvite'),
  verificarTelefone: cfUrl('verificarTelefone'),
} as const;

/**
 * Envia um input para o backend via createInput.
 * Equivalente ao safeAddInput() do HTML original.
 * Wraps automaticamente em { input: { type, fromUid, ...fields } }.
 */
export async function sendInput(
  type: string,
  fields: Record<string, unknown> = {}
): Promise<{ ok: boolean; id: string }> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');
  return callFunction<{ ok: boolean; id: string }>(FUNCTIONS.createInput, {
    input: { type, fromUid: user.uid, ...fields },
  });
}

/**
 * Wrapper autenticado para chamadas HTTP às Cloud Functions.
 * Equivalente ao safeFetchBackend() do HTML original.
 */
export async function callFunction<T = unknown>(
  url: string,
  body: Record<string, unknown> = {}
): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('Usuário não autenticado');

  const token = await user.getIdToken();
  let appCheckHdr = await appCheckHeaders(false);

  const doFetch = (headers: Record<string, string>) =>
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body: JSON.stringify(body),
    });

  let res = await doFetch(appCheckHdr);

  if (!res.ok && res.status === 401) {
    const text = await res.text().catch(() => '');
    if (text.includes('missing_app_check') || text.includes('invalid_app_check')) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      appCheckHdr = await appCheckHeaders(true);
      res = await doFetch(appCheckHdr);
      if (!res.ok) {
        const retryText = await res.text().catch(() => '');
        throw new Error(`[${res.status}] ${retryText || res.statusText}`);
      }
      return res.json() as Promise<T>;
    }
    throw new Error(`[${res.status}] ${text || res.statusText}`);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[${res.status}] ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
