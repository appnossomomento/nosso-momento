/** Alinhado a functions/lib/config.js — visual usa fatias iguais. */
export const ROULETTE_OPTIONS = [
  { valor: 1, prob: 0.16167, label: '+1' },
  { valor: 2, prob: 0.16167, label: '+2' },
  { valor: -1, prob: 0.16167, label: '-1' },
  { valor: -2, prob: 0.16167, label: '-2' },
  { valor: 4, prob: 0.16166, label: '+4' },
  { valor: -3, prob: 0.16166, label: '-3' },
  { valor: 10, prob: 0.03, label: '+10' },
] as const;

export type RouletteSegment = {
  path: string;
  lx: number;
  ly: number;
  rot: number;
  label: string;
  valor: number;
  startAngle: number;
  endAngle: number;
  tone: 'a' | 'b';
};

const CX = 100;
const CY = 100;
/** Quase até a borda do viewBox — evita “aro preto” largo no disco */
const R = 99.2;

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

/** Fatias iguais no visual (a probabilidade real continua no backend). */
const SEG_DEG = 360 / ROULETTE_OPTIONS.length;
let cumAngle = -90;

export const ROULETTE_SEGMENTS: RouletteSegment[] = ROULETTE_OPTIONS.map((opt, i) => {
  const deg = SEG_DEG;
  const sa = cumAngle;
  cumAngle += deg;
  const ea = cumAngle;
  const x1 = CX + R * Math.cos(toRad(sa));
  const y1 = CY + R * Math.sin(toRad(sa));
  const x2 = CX + R * Math.cos(toRad(ea));
  const y2 = CY + R * Math.sin(toRad(ea));
  const mid = (sa + ea) / 2;
  const midRad = toRad(mid);
  const lr = R * 0.62;
  return {
    path: `M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${deg > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
    lx: CX + lr * Math.cos(midRad),
    ly: CY + lr * Math.sin(midRad),
    rot: mid + 90,
    label: opt.label,
    valor: opt.valor,
    startAngle: sa,
    endAngle: ea,
    tone: i % 2 === 0 ? 'a' : 'b',
  };
});

function norm360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Ponteiro no topo (-90°). Após rotação CW, qual segmento fica sob o ponteiro. */
export function getSegmentAtPointer(totalRotation: number): RouletteSegment {
  const r = norm360(totalRotation);
  const origAngle = norm360(-90 - r);
  for (const seg of ROULETTE_SEGMENTS) {
    const s = norm360(seg.startAngle);
    const e = norm360(seg.endAngle);
    if (s < e) {
      if (origAngle >= s && origAngle < e) return seg;
    } else if (origAngle >= s || origAngle < e) {
      return seg;
    }
  }
  return ROULETTE_SEGMENTS[0];
}

/**
 * Próxima rotação (CW) para o meio do segmento de `valor` cair no ponteiro.
 * Mantém voltas extras para a animação parecer natural.
 */
export function rotationToLandOnValor(
  currentRotation: number,
  valor: number,
  spins = 5,
): number {
  const seg =
    ROULETTE_SEGMENTS.find((s) => s.valor === valor) ?? ROULETTE_SEGMENTS[0];
  const mid = (seg.startAngle + seg.endAngle) / 2;
  // origAngle no ponteiro = -90 - r  ⇒  r = -90 - mid
  const targetMod = norm360(-90 - mid);
  const currentMod = norm360(currentRotation);
  let delta = targetMod - currentMod;
  if (delta <= 0) delta += 360;
  return currentRotation + spins * 360 + delta;
}
