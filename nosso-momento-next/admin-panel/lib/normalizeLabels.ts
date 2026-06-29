import { ORIENTACAO_OPTIONS } from '@/lib/types/profileEnums';

const ORIENTACAO_LABELS: Record<string, string> = Object.fromEntries(
  ORIENTACAO_OPTIONS.map((o) => [o.value, o.label]),
);

/** Anatomia do catálogo — apenas Masculino | Feminino */
export function normalizeAnatomia(raw: unknown): 'Masculino' | 'Feminino' | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (v === 'masculino' || v === 'm' || v === 'homem') return 'Masculino';
  if (v === 'feminino' || v === 'f' || v === 'mulher') return 'Feminino';
  return null;
}

export function normalizeOrientacao(raw: unknown, outro?: unknown): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return 'Não informado';
  if (v === 'outro') {
    const custom = String(outro ?? '').trim();
    return custom ? `Outra: ${custom}` : 'Outra';
  }
  return ORIENTACAO_LABELS[v] ?? v.charAt(0).toUpperCase() + v.slice(1);
}

export function mergeAnatomiaCounts(
  map: Record<string, number>,
  rawAnatomia: unknown,
  rawSexo?: unknown,
): void {
  const fromAnatomia = normalizeAnatomia(rawAnatomia);
  const fromSexo = normalizeAnatomia(rawSexo);
  const label = fromAnatomia ?? fromSexo;
  if (!label) return;
  map[label] = (map[label] ?? 0) + 1;
}
