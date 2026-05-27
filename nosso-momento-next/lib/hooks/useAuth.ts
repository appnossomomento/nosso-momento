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
        // Usuário deslogado — limpa cookie e reset state
        document.cookie = 'auth-session=; path=/; max-age=0; SameSite=Lax';
        reset();
        return;
      }

      // Seta cookie de sessão para o middleware poder verificar auth
      document.cookie = 'auth-session=1; path=/; max-age=86400; SameSite=Lax';

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
