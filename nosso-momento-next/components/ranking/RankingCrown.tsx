'use client';

import type { CoupleAvatarRing } from '@/components/ranking/CoupleAvatar';

const PALETTE: Record<
  'gold' | 'silver' | 'bronze',
  { fill: string; shine: string; tip: string }
> = {
  gold: { fill: '#f59e0b', shine: '#fde68a', tip: '#fbbf24' },
  silver: { fill: '#94a3b8', shine: '#e2e8f0', tip: '#cbd5e1' },
  bronze: { fill: '#c2410c', shine: '#fdba74', tip: '#d97706' },
};

type Props = {
  metal: 'gold' | 'silver' | 'bronze';
  size?: number;
  className?: string;
};

/** Coroa vetorial — ouro / prata / bronze no pódio. */
export default function RankingCrown({ metal, size = 28, className }: Props) {
  const c = PALETTE[metal];
  const id = `crown-${metal}`;
  return (
    <svg
      width={size}
      height={size * 0.72}
      viewBox="0 0 64 46"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c.shine} />
          <stop offset="55%" stopColor={c.tip} />
          <stop offset="100%" stopColor={c.fill} />
        </linearGradient>
        <filter id={`${id}-glow`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor={c.fill} floodOpacity="0.65" />
        </filter>
      </defs>
      <path
        filter={`url(#${id}-glow)`}
        fill={`url(#${id})`}
        d="M6 38 L8 16 L20 28 L32 6 L44 28 L56 16 L58 38 Z"
      />
      <rect x="6" y="36" width="52" height="7" rx="2.5" fill={`url(#${id})`} />
      <circle cx="8" cy="15" r="3.2" fill={c.shine} />
      <circle cx="32" cy="6" r="3.6" fill={c.shine} />
      <circle cx="56" cy="15" r="3.2" fill={c.shine} />
    </svg>
  );
}

export function metalFromRing(ring: CoupleAvatarRing): 'gold' | 'silver' | 'bronze' | null {
  if (ring === 'gold' || ring === 'silver' || ring === 'bronze') return ring;
  return null;
}
