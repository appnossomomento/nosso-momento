'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { Pareamento, Usuario } from '@/lib/types';
import { restoreParceiroAtivo, syncParceiroAtivoComLista, clearRestoreSuppression, isRestoreSuppressed } from '@/lib/utils/setParceiroAtivo';

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

      // Sessão server-side e App Check em paralelo — não bloqueiam leitura do usuário.
      void (async () => {
        try {
          const idToken = await firebaseUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
        } catch (err) {
          console.error('[useAuth] falha ao criar sessão server-side:', err);
        }
      })();

      // Ouvinte em tempo real do documento do usuário no Firestore
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

      // getDoc como bootstrap imediato — seta usuario e authInitialized juntos (atomicamente)
      // para evitar que o layout redirecione para /login enquanto usuario ainda é null.
      getDoc(userRef).then((snap) => {
        window.clearTimeout(authReadyTimeout);
        const rawData = snap.exists() ? snap.data() : null;
        const parceirosAtivos = (rawData?.pareamentosAtivos as Pareamento[] | undefined) ?? [];
        const baseUser = rawData
          ? ({ ...(rawData as Omit<Usuario, 'uid'>), uid: firebaseUser.uid, email: firebaseUser.email ?? rawData.email ?? '' } as Usuario)
          : ({ uid: firebaseUser.uid, email: firebaseUser.email ?? '', nome: '', telefone: '', sexo: '', foguinhos: 0, lastCheckInDate: null, pareadoCom: null, catalogoPersonalizado: {} } as Usuario);
        set({ usuario: baseUser, parceirosAtivos, authInitialized: true });
        restoreParceiroAtivo(firebaseUser.uid, parceirosAtivos);
      }).catch(() => {
        window.clearTimeout(authReadyTimeout);
        // Se getDoc falhar, ainda marca auth pronto com usuario mínimo (evita redirect indevido)
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
              email: firebaseUser.email ?? data.email ?? '',
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
