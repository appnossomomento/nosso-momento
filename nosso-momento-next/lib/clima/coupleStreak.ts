/** Tipos e cálculo do streak de check-in do casal (ambos marcaram clima no dia). */

import { saoPauloDateString } from '@/lib/utils/saoPauloDate';

export type CoupleStreakState = 'alive' | 'at_risk' | 'ember' | 'cold';

export type CoupleStreakTier = 't0' | 't3' | 't10' | 't30' | 't100' | 't200';

export type ClimaDayForStreak = {
  data: string; // YYYY-MM-DD (America/Sao_Paulo)
  humor?: string | null;
  partnerHumor?: string | null;
};

export type CoupleStreak = {
  days: number;
  state: CoupleStreakState;
  tier: CoupleStreakTier;
  meDoneToday: boolean;
  partnerDoneToday: boolean;
  coupleDoneToday: boolean;
  /** Dias seguidos sem check-in do casal (ontem em diante; hoje aberto não conta). */
  missStreak: number;
  /** Já houve pelo menos 1 dia completo do casal no histórico. */
  everLit: boolean;
};

const TIER_THRESHOLDS: { min: number; tier: CoupleStreakTier }[] = [
  { min: 200, tier: 't200' },
  { min: 100, tier: 't100' },
  { min: 30, tier: 't30' },
  { min: 10, tier: 't10' },
  { min: 3, tier: 't3' },
  { min: 0, tier: 't0' },
];


export function streakTierFromDays(days: number): CoupleStreakTier {
  for (const t of TIER_THRESHOLDS) {
    if (days >= t.min) return t.tier;
  }
  return 't0';
}

export function isCoupleDayComplete(day: ClimaDayForStreak | undefined): boolean {
  if (!day) return false;
  return Boolean(day.humor) && Boolean(day.partnerHumor);
}

/**
 * Data YYYY-MM-DD no calendário de São Paulo.
 * offsetDays: 0 = hoje, -1 = ontem, etc. (meia-noite SP + offset).
 */
export function spDateString(offsetDays = 0): string {
  if (offsetDays === 0) return saoPauloDateString();
  // Meia-noite “hoje” em SP ≈ agora em SP truncado; soma offset em ms de dia civil.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  // Usa UTC noon + offset para evitar ambiguidade de DST ao derivar YYYY-MM-DD
  const utcNoon = Date.UTC(y, m - 1, d, 12, 0, 0) + offsetDays * 86400000;
  return saoPauloDateString(new Date(utcNoon));
}

/**
 * Jornada da chama:
 * - Dia 1: casal marca → alive
 * - Dia 2: não marca → at_risk (ainda mostra a sequência)
 * - Dia 3: missStreak=1 → ember (push "A chama está apagando!")
 * - Dia 4: missStreak>=2 → cold (reset cinza)
 */
export function computeCoupleStreak(
  history: ClimaDayForStreak[],
  todayStr = spDateString(0),
): CoupleStreak {
  const byDate = new Map(history.map((d) => [d.data, d]));
  const today = byDate.get(todayStr);
  const meDoneToday = Boolean(today?.humor);
  const partnerDoneToday = Boolean(today?.partnerHumor);
  const coupleDoneToday = isCoupleDayComplete(today);

  let everLit = coupleDoneToday;
  for (const d of history) {
    if (isCoupleDayComplete(d)) {
      everLit = true;
      break;
    }
  }

  let missStreak = 0;
  for (let i = 0; i < 60; i++) {
    const key = spDateString(-i);
    if (isCoupleDayComplete(byDate.get(key))) break;
    // Hoje incompleto não conta como miss definitivo enquanto o dia está aberto
    if (i === 0 && !coupleDoneToday) continue;
    missStreak += 1;
  }

  let days = 0;
  const startOffset = coupleDoneToday ? 0 : 1;
  for (let i = startOffset; i < 400; i++) {
    const key = spDateString(-i);
    if (!isCoupleDayComplete(byDate.get(key))) break;
    days += 1;
  }

  if (coupleDoneToday && days === 0) {
    days = 1;
  }

  let state: CoupleStreakState;
  if (days > 0 && coupleDoneToday) {
    state = 'alive';
  } else if (days > 0 && !coupleDoneToday) {
    // Dia 2: ainda conta a sequência de ontem
    state = 'at_risk';
  } else if (everLit && missStreak === 1) {
    // Dia 3: um dia civil perdido — brasa (push às 00:01)
    state = 'ember';
  } else {
    // Dia 4+: reset cinza
    state = 'cold';
  }

  return {
    days,
    state,
    tier: streakTierFromDays(days),
    meDoneToday,
    partnerDoneToday,
    coupleDoneToday,
    missStreak,
    everLit,
  };
}
