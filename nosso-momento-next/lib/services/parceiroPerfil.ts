import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { useAppStore } from '@/lib/store/appStore';
import type { ParceiroData } from '@/lib/types';

export interface ParceiroPerfilResponse {
  uid: string;
  nome: string;
  telefone?: string;
  fotoUrl?: string;
  foguinhos?: number;
  sexo?: string;
  catalogoPersonalizado?: Record<string, { preco?: number; bloqueado?: boolean }>;
  pareamentoId?: string;
}

export async function fetchParceiroPerfil(partnerUid: string): Promise<ParceiroPerfilResponse> {
  return callFunction<ParceiroPerfilResponse>(FUNCTIONS.getParceiroPerfil, { partnerUid });
}

export function applyParceiroPerfilToStore(
  profile: ParceiroPerfilResponse,
  foguinhosFallback?: number,
): void {
  const { set } = useAppStore.getState();
  const parceiroData: ParceiroData = {
    uid: profile.uid,
    nome: profile.nome ?? '',
    telefone: profile.telefone,
    fotoUrl: profile.fotoUrl,
    foguinhos: profile.foguinhos ?? foguinhosFallback,
    sexo: profile.sexo,
    catalogoPersonalizado: profile.catalogoPersonalizado ?? {},
    pareamentoId: profile.pareamentoId,
  };

  set({
    pareado: true,
    pareadoUid: profile.uid,
    parceiroNome: profile.nome ?? null,
    parceiroTelefone: profile.telefone ?? null,
    idPareamentoAmigavel: profile.pareamentoId ?? null,
    parceiroData,
  });
}

/** Atualiza catálogo/sexo do parceiro ativo (ex.: ao abrir a loja). */
export async function refreshParceiroPerfil(partnerUid?: string | null): Promise<void> {
  const uid = partnerUid ?? useAppStore.getState().pareadoUid;
  if (!uid) return;

  const parEntry = useAppStore.getState().parceirosAtivos.find((p) => p.uid === uid);
  try {
    const profile = await fetchParceiroPerfil(uid);
    applyParceiroPerfilToStore(profile, parEntry?.foguinhos);
  } catch (err) {
    console.error('[refreshParceiroPerfil]', err);
  }
}
