import { ORIENTACAO_OPTIONS, TEMPO_RELACIONAMENTO_OPTIONS } from '@/lib/types/profileEnums';

const ORIENTACAO_LABELS: Record<string, string> = Object.fromEntries(
  ORIENTACAO_OPTIONS.map((o) => [o.value, o.label]),
);

const TEMPO_REL_LABELS: Record<string, string> = Object.fromEntries(
  TEMPO_RELACIONAMENTO_OPTIONS.map((o) => [o.value, o.label]),
);

export const TEMPO_REL_ORDER = [
  ...TEMPO_RELACIONAMENTO_OPTIONS.map((o) => o.label),
  'Não informado',
];

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

export function normalizeTempoRelacionamento(raw: unknown): string {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v) return 'Não informado';
  return TEMPO_REL_LABELS[v] ?? v.replace(/_/g, ' ');
}

export function sortByTempoRelOrder(items: { label: string; count: number }[]): { label: string; count: number }[] {
  const order = new Map(TEMPO_REL_ORDER.map((l, i) => [l, i]));
  return [...items].sort((a, b) => {
    const ia = order.get(a.label) ?? 999;
    const ib = order.get(b.label) ?? 999;
    return ia - ib || b.count - a.count;
  });
}
