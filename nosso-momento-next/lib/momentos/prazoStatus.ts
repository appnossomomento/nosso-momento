import { ACCENT, LP_RED } from '@/components/layout/AppHeroShell';

export const PRAZO_DIAS_OPTIONS = [1, 3, 7, 14, 30] as const;
export type PrazoDiasOption = (typeof PRAZO_DIAS_OPTIONS)[number];

export const PRAZO_DIAS_DEFAULT: PrazoDiasOption = 1;
export const PENALIDADE_ATRASO_FOGUINHOS = 5;
const NO_LIMITE_MS = 24 * 60 * 60 * 1000;

export type PrazoStatusKey = 'a_realizar' | 'no_limite' | 'atrasado';

type TsLike =
  | { seconds: number; nanoseconds?: number }
  | { toDate: () => Date }
  | Date
  | number
  | null
  | undefined;

export function prazoDiasToMillis(dataLimite: TsLike): number | null {
  if (dataLimite == null) return null;
  if (typeof dataLimite === 'number') return dataLimite;
  if (dataLimite instanceof Date) return dataLimite.getTime();
  if (typeof (dataLimite as { toDate?: () => Date }).toDate === 'function') {
    return (dataLimite as { toDate: () => Date }).toDate().getTime();
  }
  const sec = (dataLimite as { seconds?: number }).seconds;
  if (typeof sec === 'number') return sec * 1000;
  return null;
}

/** Fim do dia SP (UTC-3) de hoje+N — espelha functions/lib/momentPrazo.js */
export function computeDataLimite(prazoDias: number, now = new Date()): Date {
  const days = Math.floor(Number(prazoDias));
  const spNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const y = spNow.getUTCFullYear();
  const m = spNow.getUTCMonth();
  const d = spNow.getUTCDate();
  return new Date(Date.UTC(y, m, d + days + 1, 2, 59, 59, 999));
}

export function derivePrazoStatus(
  dataLimite: TsLike,
  now = new Date(),
): PrazoStatusKey | null {
  const lim = prazoDiasToMillis(dataLimite);
  if (lim == null) return null;
  const t = now.getTime();
  if (t > lim) return 'atrasado';
  if (t >= lim - NO_LIMITE_MS) return 'no_limite';
  return 'a_realizar';
}

export function prazoStatusLabel(key: PrazoStatusKey): string {
  if (key === 'a_realizar') return 'À realizar';
  if (key === 'no_limite') return 'No limite';
  return 'Atrasado';
}

export function prazoStatusStyle(key: PrazoStatusKey): {
  background: string;
  color: string;
} {
  if (key === 'a_realizar') {
    return { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.55)' };
  }
  if (key === 'no_limite') {
    return { background: 'rgba(244,63,94,0.18)', color: ACCENT };
  }
  return { background: 'rgba(239,68,68,0.2)', color: LP_RED };
}

export function formatDataLimiteShort(dataLimite: TsLike): string | null {
  const ms = prazoDiasToMillis(dataLimite);
  if (ms == null) return null;
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(ms));
}
