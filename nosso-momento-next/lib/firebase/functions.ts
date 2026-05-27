import { auth } from './client';

const BASE = 'https://southamerica-east1-nosso-momento-app.cloudfunctions.net';

export const FUNCTIONS = {
  createInput: `${BASE}/createInput`,
  setNotificationToken: `${BASE}/setNotificationToken`,
  getMemorias: `${BASE}/getMemorias`,
  createMemoriaPhoto: `${BASE}/createMemoriaPhoto`,
  deleteMemoria: `${BASE}/deleteMemoria`,
  getExtrato: `${BASE}/getExtrato`,
  gerarConvite: `${BASE}/gerarConvite`,
  verificarTelefone: `${BASE}/verificarTelefone`,
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

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`[${res.status}] ${text || res.statusText}`);
  }

  return res.json() as Promise<T>;
}
