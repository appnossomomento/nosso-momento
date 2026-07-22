import type { User } from 'firebase/auth';
import type { DocumentSnapshot } from 'firebase/firestore';
import { useAppStore } from '@/lib/store/appStore';
import type { Pareamento, Usuario } from '@/lib/types';
import { restoreParceiroAtivo } from '@/lib/utils/setParceiroAtivo';

type PareamentoCheck = {
  pareadoCom?: string | null;
  pareadoUid?: string | null;
  pareamentosAtivos?: unknown;
};

/**
 * Considera pareado se há conexão ativa (campo legado ou lista multi-conexão).
 * Ignora estados pending_/none em pareadoCom.
 */
export function isUsuarioPareado(
  pareadoComOrUser?: string | null | PareamentoCheck,
  maybeAtivos?: unknown,
): boolean {
  // Compat: isUsuarioPareado(pareadoCom)
  if (typeof pareadoComOrUser === 'string' || pareadoComOrUser == null) {
    const pareadoCom = pareadoComOrUser;
    if (Array.isArray(maybeAtivos) && maybeAtivos.length > 0) return true;
    return !!pareadoCom && !pareadoCom.startsWith('pending_') && pareadoCom !== 'none';
  }

  const u = pareadoComOrUser;
  if (u.pareadoUid) return true;
  if (Array.isArray(u.pareamentosAtivos) && u.pareamentosAtivos.length > 0) return true;
  const pc = u.pareadoCom;
  return !!pc && !pc.startsWith('pending_') && pc !== 'none';
}

/** Destino padrão ao iniciar sessão / abrir o app autenticado. */
export const SESSION_HOME = '/dashboard' as const;

/** Hidrata o store antes da navegação — evita spinner extra após login. */
export function bootstrapUsuarioFromSnap(firebaseUser: User, snap: DocumentSnapshot): void {
  const rawData = snap.exists() ? snap.data() : null;
  const parceirosAtivos = (rawData?.pareamentosAtivos as Pareamento[] | undefined) ?? [];
  const baseUser = rawData
    ? ({
        ...(rawData as Omit<Usuario, 'uid'>),
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? (typeof rawData.email === 'string' ? rawData.email : ''),
      } as Usuario)
    : ({
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? '',
        nome: '',
        telefone: '',
        sexo: '',
        foguinhos: 0,
        lastCheckInDate: null,
        pareadoCom: null,
        catalogoPersonalizado: {},
      } as Usuario);

  useAppStore.getState().set({ usuario: baseUser, parceirosAtivos, authInitialized: true });
  restoreParceiroAtivo(firebaseUser.uid, parceirosAtivos);
}


export async function createSessionCookie(idToken: string): Promise<void> {
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!res.ok) {
    const err = new Error('session_failed') as Error & { code: string };
    err.code = 'session_failed';
    throw err;
  }
}
