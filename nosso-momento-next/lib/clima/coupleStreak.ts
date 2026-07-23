/** Tipos e cálculo do streak de check-in do casal (ambos marcaram clima no dia). */

export type CoupleStreakState = 'alive' | 'at_risk' | 'ember' | 'cold';

export type CoupleStreakTier = 't0' | 't3' | 't10' | 't30' | 't100' | 't200';

export type ClimaDayForStreak = {
  data: string; // YYYY-MM-DD (UTC-3 calendar)
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

/** Data YYYY-MM-DD no calendário de São Paulo (UTC-3). */
export function spDateString(offsetDays = 0): string {
  const sp = new Date(Date.now() - 3 * 60 * 60 * 1000 + offsetDays * 86400000);
  return sp.toISOString().slice(0, 10);
}

/**
 * Conta streak do casal: dia vale só se ambos marcaram humor.
 * Se hoje ainda não fechou, mantém a sequência a partir de ontem (estilo Duolingo).
 * Brasa (ember) só aparece se o casal já acendeu a sequência antes — casal novo fica em cold.
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
    state = 'at_risk';
  } else if (everLit && missStreak >= 2) {
    // Só brasa se já tiveram sequência antes
    state = 'ember';
  } else {
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
