import { auth, appCheck } from './client';
import { getToken } from 'firebase/app-check';

const REMOTE_BASE = 'https://southamerica-east1-nosso-momento-app.cloudfunctions.net';

/** Em dev local usa proxy Next.js (/api/cf) para evitar CORS em portas != 3000. */
function cfUrl(path: string): string {
  if (process.env.NODE_ENV === 'development') {
    return `/api/cf/${path}`;
  }
  return `${REMOTE_BASE}/${path}`;
}

async function appCheckHeaders(): Promise<Record<string, string>> {
  if (!appCheck) return {};
  try {
    const result = await getToken(appCheck, false);
    return result.token ? { 'X-Firebase-AppCheck': result.token } : {};
  } catch {
    return {};
  }
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
  const appCheckHdr = await appCheckHeaders();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...appCheckHdr,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[${res.status}] ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
