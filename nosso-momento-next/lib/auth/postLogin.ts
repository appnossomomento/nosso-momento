import type { User } from 'firebase/auth';
import type { DocumentSnapshot } from 'firebase/firestore';
import { useAppStore } from '@/lib/store/appStore';
import type { Pareamento, Usuario } from '@/lib/types';
import { restoreParceiroAtivo } from '@/lib/utils/setParceiroAtivo';

export function isUsuarioPareado(pareadoCom: string | null | undefined): boolean {
  return !!pareadoCom && !pareadoCom.startsWith('pending_') && pareadoCom !== 'none';
}

/** Hidrata o store antes da navegação — evita spinner extra após login. */
export function bootstrapUsuarioFromSnap(firebaseUser: User, snap: DocumentSnapshot): void {
  const rawData = snap.exists() ? snap.data() : null;
  const parceirosAtivos = (rawData?.pareamentosAtivos as Pareamento[] | undefined) ?? [];
  const baseUser = rawData
    ? ({
        ...(rawData as Omit<Usuario, 'uid'>),
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? rawData.email ?? '',
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
