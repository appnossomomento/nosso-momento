import { useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';

/**
 * Escuta o documento do parceiro no Firestore em tempo real.
 * Deve ser chamado quando `usuario.pareadoCom` estiver definido.
 */
export function useParceiroData() {
  const { usuario, set } = useAppStore();
  const pareadoUid = usuario?.pareadoUid ?? null;

  useEffect(() => {
    if (!pareadoUid) {
      set({ parceiroData: null, parceiroNome: null, pareado: false, idPareamentoAmigavel: null });
      return;
    }

    const unsub = onSnapshot(
      doc(db, 'usuarios', pareadoUid),
      (snap) => {
        if (!snap.exists()) {
          set({ parceiroData: null, parceiroNome: null, pareado: false, idPareamentoAmigavel: null });
          return;
        }
        const data = snap.data();

        // Busca o pareamentoId e idAmigavel dentro de pareamentosAtivos do store (doc próprio)
        const meusAtivos = (useAppStore.getState().usuario as Record<string, unknown>)
          ?.pareamentosAtivos as Array<Record<string, unknown>> | undefined;
        const entrada = meusAtivos?.find((e) => e.uid === pareadoUid);
        const pareamentoId = (entrada?.pareamentoId as string | undefined) ?? null;
        const idAmigavel = (entrada?.idAmigavel as string | undefined) ?? null;

        set({
          pareado: true,
          pareadoUid: pareadoUid,
          parceiroNome: data.nome ?? null,
          parceiroApelido: data.apelido ?? null,
          parceiroTelefone: data.telefone ?? null,
          idPareamentoAmigavel: pareamentoId ?? idAmigavel,
          parceiroData: {
            uid: pareadoUid,
            nome: data.nome ?? '',
            telefone: data.telefone,
            email: data.email,
            foguinhos: data.foguinhos,
            fotoUrl: data.fotoUrl,
            apelido: data.apelido,
            pareadoCom: data.pareadoCom,
            catalogoPersonalizado: data.catalogoPersonalizado ?? {},
            pareamentoId: pareamentoId,
          },
        });
      },
      (err) => {
        console.error('[useParceiroData] erro ao escutar parceiro:', err);
      }
    );

    return () => unsub();
  }, [pareadoUid, set]);
}
