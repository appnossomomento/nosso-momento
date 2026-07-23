'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import clsx from 'clsx';
import type { CoupleStreakState, CoupleStreakTier } from '@/lib/clima/coupleStreak';
import {
  resolveStreakLottieSrc,
  tintMascoteLottie,
} from '@/lib/clima/streakAssets';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

type Props = {
  state: CoupleStreakState;
  tier: CoupleStreakTier;
  /** Parceiro marcou triste — mascote fica mais frio/úmido. */
  softMood?: boolean;
  className?: string;
};

/** Viewport do bloco do meio; o Lottie é ampliado por dentro pra cortar a margem do canvas. */
const VIEW_W = 104;
const VIEW_H = 112;
const INNER = 168;

const TIER_SCALE: Record<CoupleStreakTier, number> = {
  t0: 0.96,
  t3: 1,
  t10: 1.04,
  t30: 1.1,
  t100: 1.16,
  t200: 1.22,
};

/** Fallback CSS até o Lottie carregar — chama com flicker/glow. */
function CssFlameFallback({
  state,
  tier,
  softMood,
}: {
  state: CoupleStreakState;
  tier: CoupleStreakTier;
  softMood?: boolean;
}) {
  const scale = TIER_SCALE[tier];
  const ember = state === 'ember' || state === 'cold';
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: VIEW_W, height: VIEW_H, transform: `scale(${scale})` }}
      aria-hidden
    >
      <div
        className={clsx(
          'nm-streak-flame',
          state === 'at_risk' && 'nm-streak-flame--risk',
          ember && 'nm-streak-flame--ember',
          state === 'cold' && 'nm-streak-flame--cold',
          softMood && 'nm-streak-flame--triste',
        )}
      />
      <div className="nm-streak-flame-glow" data-state={softMood ? 'triste' : state} />
    </div>
  );
}

let mascoteCache: object | null = null;

export default function StreakFlame({ state, tier, softMood = false, className }: Props) {
  const src = resolveStreakLottieSrc(state, tier);
  const [baseData, setBaseData] = useState<object | null>(mascoteCache);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [failed, setFailed] = useState(false);
  const mood = softMood ? 'triste' : 'default';

  useEffect(() => {
    if (!src) {
      setBaseData(null);
      setFailed(false);
      return;
    }
    if (mascoteCache) {
      setBaseData(mascoteCache);
      setFailed(false);
      return;
    }
    let cancelled = false;
    setFailed(false);
    void fetch(src)
      .then((r) => {
        if (!r.ok) throw new Error('lottie_missing');
        return r.json();
      })
      .then((json: object) => {
        if (cancelled) return;
        mascoteCache = json;
        setBaseData(json);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [src]);

  useEffect(() => {
    if (!baseData) {
      setAnimationData(null);
      return;
    }
    setAnimationData(tintMascoteLottie(baseData, state, tier, mood));
  }, [baseData, state, tier, mood]);

  const showLottie = Boolean(src && animationData && !failed);
  const scale = TIER_SCALE[tier];

  return (
    <div
      className={clsx(
        'relative flex items-center justify-center',
        state === 'at_risk' && !softMood && 'nm-streak-mascote--risk',
        softMood && 'nm-streak-mascote--triste',
        className,
      )}
      style={{ transform: `scale(${scale})` }}
    >
      {showLottie ? (
        <div
          className="relative overflow-hidden"
          style={{ width: VIEW_W, height: VIEW_H }}
          aria-hidden
        >
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: INNER,
              height: INNER,
              transform: 'translate(-50%, -52%)',
            }}
          >
            <Lottie
              animationData={animationData}
              loop
              autoplay
              style={{ width: '100%', height: '100%' }}
            />
          </div>
        </div>
      ) : (
        <CssFlameFallback state={state} tier={tier} softMood={softMood} />
      )}
    </div>
  );
}
