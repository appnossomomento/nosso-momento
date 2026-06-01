'use client';

import { useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import type { Pareamento, Usuario } from '@/lib/types';

/**
 * Inicializa o listener de autenticação Firebase.
 * Deve ser chamado no layout raiz (client component).
 */
export function useAuth() {
  const { set, reset } = useAppStore();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        // Usuário deslogado — destroi o cookie de sessão server-side e limpa state.
        await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        reset();
        return;
      }

      try {
        // Obtém o idToken atual (renovado automaticamente pelo SDK se expirado).
        const idToken = await firebaseUser.getIdToken();

        // Envia o idToken para a API Route que emite o cookie HttpOnly seguro.
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (err) {
        console.error('[useAuth] falha ao criar sessão server-side:', err);
      }

      // Ouvinte em tempo real do documento do usuário no Firestore
      const userRef = doc(db, 'usuarios', firebaseUser.uid);
      const unsubscribeUser = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const rawData = snap.data();
          const data = rawData as Omit<Usuario, 'uid'>;
          const parceirosAtivos = (rawData.pareamentosAtivos as Pareamento[] | undefined) ?? [];
          set({
            usuario: {
              ...data,
              uid: firebaseUser.uid,
              email: firebaseUser.email ?? data.email ?? '',
            },
            parceirosAtivos,
          });
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
      });

      // Limpa o listener do usuário quando o auth muda
      return () => unsubscribeUser();
    });

    return () => unsubscribeAuth();
  }, [set, reset]);
}
