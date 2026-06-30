'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { Pareamento, Usuario } from '@/lib/types';
import { syncParceiroAtivoComLista, clearRestoreSuppression, isRestoreSuppressed } from '@/lib/utils/setParceiroAtivo';
import { bootstrapUsuarioFromSnap, createSessionCookie } from '@/lib/auth/postLogin';
import { recordDailyAppOpen } from '@/lib/auth/recordDailyAppOpen';

/**
 * Inicializa o listener de autenticação Firebase.
 * Deve ser chamado no layout raiz (client component).
 */
export function useAuth() {
  const { set, reset } = useAppStore();

  useEffect(() => {
    let unsubscribeUser: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeUser) {
        unsubscribeUser();
        unsubscribeUser = null;
      }

      if (!firebaseUser) {
        // Usuário deslogado — destroi o cookie de sessão server-side e limpa state.
        await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        clearRestoreSuppression();
        reset();
        set({ authInitialized: true });
        return;
      }

      const userRef = doc(db, 'usuarios', firebaseUser.uid);

      const authReadyTimeout = window.setTimeout(() => {
        const state = useAppStore.getState();
        if (!state.authInitialized) {
          set({
            authInitialized: true,
            usuario: {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              nome: '',
              telefone: '',
              sexo: '',
              foguinhos: 0,
              lastCheckInDate: null,
              pareadoCom: null,
              catalogoPersonalizado: {},
            },
          });
        }
      }, 8000);

      try {
        let idToken = await firebaseUser.getIdToken();
        try {
          await createSessionCookie(idToken);
        } catch {
          idToken = await firebaseUser.getIdToken(true);
          await createSessionCookie(idToken);
        }
        recordDailyAppOpen();
      } catch (err) {
        console.error('[useAuth] falha ao criar sessão server-side:', err);
      }

      try {
        const snap = await getDoc(userRef);
        window.clearTimeout(authReadyTimeout);
        bootstrapUsuarioFromSnap(firebaseUser, snap);
      } catch {
        window.clearTimeout(authReadyTimeout);
        set({
          authInitialized: true,
          usuario: {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            nome: '',
            telefone: '',
            sexo: '',
            foguinhos: 0,
            lastCheckInDate: null,
            pareadoCom: null,
            catalogoPersonalizado: {},
          },
        });
      }

      unsubscribeUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const rawData = snap.data();
          const data = rawData as Omit<Usuario, 'uid'>;
          const parceirosAtivos = (rawData.pareamentosAtivos as Pareamento[] | undefined) ?? [];
          const storeState = useAppStore.getState();
          const manterDespareado =
            isRestoreSuppressed(firebaseUser.uid) && storeState.pareadoUid === null;
          set({
            usuario: {
              ...data,
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? (typeof data.email === 'string' ? data.email : ''),
              ...(manterDespareado ? { pareadoUid: undefined, pareadoCom: undefined } : {}),
            },
            parceirosAtivos,
          });
          syncParceiroAtivoComLista(firebaseUser.uid, parceirosAtivos);
        } else {
          // Documento não existe no Firestore
          set({
            usuario: {
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? '',
              nome: '',
              telefone: '',
              sexo: '',
              foguinhos: 0,
              lastCheckInDate: null,
              pareadoCom: null,
              catalogoPersonalizado: {},
            },
          });
        }
      }, (err) => {
        console.error('[useAuth] erro no onSnapshot do usuário:', err);
        // Fallback: seta usuario com dados mínimos para não travar o app
        set({
          authInitialized: true,
          usuario: {
            uid: firebaseUser.uid,
            email: firebaseUser.email ?? '',
            nome: '',
            telefone: '',
            sexo: '',
            foguinhos: 0,
            lastCheckInDate: null,
            pareadoCom: null,
            catalogoPersonalizado: {},
          },
        });
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUser) unsubscribeUser();
    };
  }, [set, reset]);
}
