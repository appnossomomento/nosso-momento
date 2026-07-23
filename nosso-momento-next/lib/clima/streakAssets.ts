/**
 * Mascote Lottie do streak (1 asset + recolor por estado/tier).
 * Arquivo: `public/lottie/streak-mascote.json`
 */
import type { CoupleStreakState, CoupleStreakTier } from '@/lib/clima/coupleStreak';

export const STREAK_MASCOTE_SRC = '/lottie/streak-mascote.json';

/** Mantido por compatibilidade — tudo aponta pro mesmo mascote. */
export const STREAK_LOTTIE: Partial<
  Record<CoupleStreakState | CoupleStreakTier, string | null>
> = {
  alive: STREAK_MASCOTE_SRC,
  at_risk: STREAK_MASCOTE_SRC,
  ember: STREAK_MASCOTE_SRC,
  cold: STREAK_MASCOTE_SRC,
  t3: STREAK_MASCOTE_SRC,
  t10: STREAK_MASCOTE_SRC,
  t30: STREAK_MASCOTE_SRC,
  t100: STREAK_MASCOTE_SRC,
  t200: STREAK_MASCOTE_SRC,
};

export function resolveStreakLottieSrc(
  state: CoupleStreakState,
  _tier: CoupleStreakTier,
): string | null {
  void _tier;
  return STREAK_LOTTIE[state] || STREAK_MASCOTE_SRC;
}

type RGB = [number, number, number];

type FlamePalette = {
  outer: RGB;
  stroke: RGB;
  inner: RGB;
};

/** Cores originais do JSON (mint) — usadas só como chave de match. */
const SRC_OUTER: RGB = [0.1882, 1, 0.6549];
const SRC_STROKE: RGB = [0.4392, 1, 0.4196];
const SRC_INNER: RGB = [1, 1, 1];

const TIER_PALETTE: Record<CoupleStreakTier, FlamePalette> = {
  t0: {
    outer: [1, 0.72, 0.28],
    stroke: [1, 0.85, 0.45],
    inner: [1, 0.97, 0.9],
  },
  t3: {
    outer: [1, 0.55, 0.12],
    stroke: [1, 0.72, 0.28],
    inner: [1, 0.95, 0.82],
  },
  t10: {
    outer: [1, 0.38, 0.08],
    stroke: [1, 0.58, 0.18],
    inner: [1, 0.92, 0.72],
  },
  t30: {
    outer: [0.95, 0.22, 0.08],
    stroke: [1, 0.45, 0.12],
    inner: [1, 0.88, 0.6],
  },
  t100: {
    outer: [0.92, 0.12, 0.22],
    stroke: [1, 0.35, 0.18],
    inner: [1, 0.82, 0.55],
  },
  t200: {
    outer: [0.88, 0.08, 0.35],
    stroke: [1, 0.28, 0.28],
    inner: [1, 0.78, 0.62],
  },
};

const COLD_PALETTE: FlamePalette = {
  outer: [0.62, 0.64, 0.68],
  stroke: [0.72, 0.74, 0.78],
  inner: [0.92, 0.93, 0.95],
};

const EMBER_PALETTE: FlamePalette = {
  outer: [0.52, 0.34, 0.28],
  stroke: [0.62, 0.42, 0.32],
  inner: [0.88, 0.82, 0.76],
};

/** Tom “úmido” / azulado quando o parceiro marcou triste (não apaga a streak). */
const TRISTE_PALETTE: FlamePalette = {
  outer: [0.28, 0.48, 0.92],
  stroke: [0.45, 0.68, 1],
  inner: [0.82, 0.9, 1],
};

export function paletteForStreak(
  state: CoupleStreakState,
  tier: CoupleStreakTier,
  mood: 'default' | 'triste' = 'default',
): FlamePalette {
  if (mood === 'triste') {
    if (state === 'cold') {
      return {
        outer: [0.45, 0.52, 0.68],
        stroke: [0.55, 0.62, 0.78],
        inner: [0.88, 0.9, 0.96],
      };
    }
    if (state === 'ember') {
      return {
        outer: [0.32, 0.38, 0.62],
        stroke: [0.42, 0.5, 0.75],
        inner: [0.78, 0.82, 0.95],
      };
    }
    return TRISTE_PALETTE;
  }
  if (state === 'cold') return COLD_PALETTE;
  if (state === 'ember') return EMBER_PALETTE;
  const base = TIER_PALETTE[tier];
  if (state === 'at_risk') {
    return {
      outer: [base.outer[0] * 0.85, base.outer[1] * 0.75, base.outer[2] * 0.7],
      stroke: [base.stroke[0] * 0.9, base.stroke[1] * 0.8, base.stroke[2] * 0.75],
      inner: base.inner,
    };
  }
  return base;
}

function approxColor(a: number[], b: RGB, eps = 0.03): boolean {
  return (
    a.length >= 3 &&
    Math.abs(a[0] - b[0]) < eps &&
    Math.abs(a[1] - b[1]) < eps &&
    Math.abs(a[2] - b[2]) < eps
  );
}

function replaceColor(k: number[], from: RGB, to: RGB): boolean {
  if (!approxColor(k, from)) return false;
  k[0] = to[0];
  k[1] = to[1];
  k[2] = to[2];
  return true;
}

/** Recolore só o fogo (outer/stroke/inner); olhos marrons ficam intactos. */
export function tintMascoteLottie(
  data: object,
  state: CoupleStreakState,
  tier: CoupleStreakTier,
  mood: 'default' | 'triste' = 'default',
): object {
  const palette = paletteForStreak(state, tier, mood);
  const clone = structuredClone(data) as unknown;

  const walk = (node: unknown): void => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    const obj = node as Record<string, unknown>;
    const c = obj.c;
    if (c && typeof c === 'object' && !Array.isArray(c)) {
      const color = c as { a?: number; k?: unknown };
      if (color.a === 0 && Array.isArray(color.k) && typeof color.k[0] === 'number') {
        const k = color.k as number[];
        if (!replaceColor(k, SRC_OUTER, palette.outer)) {
          if (!replaceColor(k, SRC_STROKE, palette.stroke)) {
            replaceColor(k, SRC_INNER, palette.inner);
          }
        }
      }
    }
    for (const value of Object.values(obj)) walk(value);
  };

  walk(clone);
  return clone as object;
}
