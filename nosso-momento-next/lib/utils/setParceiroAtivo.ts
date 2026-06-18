import { useAppStore } from '@/lib/store/appStore';
import type { ConexaoAtiva, Pareamento } from '@/lib/types';

/** Evita re-selecionar parceiro após desparear (antes do CF atualizar o Firestore). */
const restoreSuppressedFor = new Set<string>();

export function getConexaoAtivaUidKey(meuUid: string): string {
  return `conexaoAtivaUid:${meuUid}`;
}

export function clearRestoreSuppression(): void {
  restoreSuppressedFor.clear();
}

export function isRestoreSuppressed(meuUid: string): boolean {
  return restoreSuppressedFor.has(meuUid);
}

/**
 * Define o parceiro ativo global (switch de conexão).
 * Atualiza Zustand + usuario.pareadoUid (fonte do useParceiroData) + localStorage.
 */
export function setParceiroAtivo(partner: Pareamento): void {
  const { usuario, set } = useAppStore.getState();

  const novaConexao: ConexaoAtiva = {
    uid: partner.uid,
    nome: partner.nome,
    fotoUrl: partner.fotoUrl ?? '',
    pareamentoId: partner.pareamentoId,
    idAmigavel: partner.pareamentoId ?? '',
    foguinhos: partner.foguinhos ?? 0,
  };

  set({
    conexaoAtiva: novaConexao,
    pareadoUid: partner.uid,
    idPareamentoAmigavel: partner.pareamentoId,
    pareado: true,
    usuario: usuario ? { ...usuario, pareadoUid: partner.uid } : usuario,
  });

  if (usuario?.uid) {
    restoreSuppressedFor.delete(usuario.uid);
    try {
      localStorage.setItem(getConexaoAtivaUidKey(usuario.uid), partner.uid);
    } catch {
      // ignore quota / private mode
    }
  }
}

/**
 * Restaura parceiro ativo do localStorage ou usa o primeiro de parceirosAtivos.
 * Chamado apenas no boot (getDoc inicial), não a cada onSnapshot.
 */
export function restoreParceiroAtivo(meuUid: string, parceirosAtivos: Pareamento[]): void {
  if (restoreSuppressedFor.has(meuUid)) return;

  if (!parceirosAtivos.length) {
    const { usuario, set } = useAppStore.getState();
    set({
      pareado: false,
      pareadoUid: null,
      conexaoAtiva: null,
      idPareamentoAmigavel: null,
      usuario: usuario ? { ...usuario, pareadoUid: undefined } : usuario,
    });
    return;
  }

  const { pareadoUid, conexaoAtiva } = useAppStore.getState();
  const jaValido =
    pareadoUid &&
    parceirosAtivos.some((p) => p.uid === pareadoUid) &&
    conexaoAtiva?.uid === pareadoUid;

  if (jaValido) return;

  let savedUid: string | null = null;
  try {
    savedUid = localStorage.getItem(getConexaoAtivaUidKey(meuUid));
  } catch {
    // ignore
  }

  const partner =
    parceirosAtivos.find((p) => p.uid === savedUid) ?? parceirosAtivos[0];

  setParceiroAtivo(partner);
}

/**
 * Sincroniza store quando parceirosAtivos muda no Firestore (ex.: após desparear).
 */
export function syncParceiroAtivoComLista(
  meuUid: string,
  parceirosAtivos: Pareamento[],
): void {
  if (!parceirosAtivos.length) {
    restoreSuppressedFor.delete(meuUid);
    const { usuario, set } = useAppStore.getState();
    set({
      pareado: false,
      pareadoUid: null,
      conexaoAtiva: null,
      idPareamentoAmigavel: null,
      parceirosAtivos,
      usuario: usuario ? { ...usuario, pareadoUid: undefined, pareadoCom: undefined } : usuario,
    });
    try {
      localStorage.removeItem(getConexaoAtivaUidKey(meuUid));
    } catch {
      // ignore
    }
    return;
  }

  const { pareadoUid, conexaoAtiva } = useAppStore.getState();

  if (restoreSuppressedFor.has(meuUid)) {
    useAppStore.getState().set({ parceirosAtivos });
    return;
  }

  const ativoAindaExiste =
    pareadoUid && parceirosAtivos.some((p) => p.uid === pareadoUid);

  if (ativoAindaExiste) {
    if (conexaoAtiva?.uid !== pareadoUid) {
      const partner = parceirosAtivos.find((p) => p.uid === pareadoUid)!;
      setParceiroAtivo(partner);
    }
    return;
  }

  restoreParceiroAtivo(meuUid, parceirosAtivos);
}

export function clearParceiroAtivoPersistido(meuUid: string): void {
  restoreSuppressedFor.add(meuUid);
  try {
    localStorage.removeItem(getConexaoAtivaUidKey(meuUid));
  } catch {
    // ignore
  }
}
