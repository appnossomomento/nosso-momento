'use client';

import { useState } from 'react';
import PremiumRouletteWheel from '@/components/desafios/PremiumRouletteWheel';
import {
  ROULETTE_OPTIONS,
  rotationToLandOnValor,
} from '@/lib/desafios/rouletteSegments';

/**
 * Preview visual da roleta premium — sem auth.
 * Abra: http://localhost:3000/dev/roleta
 */
export default function RoletaPreviewPage() {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);

  function handleSpin() {
    if (spinning || result !== null) return;
    setResult(null);
    setSpinning(true);
    // Simula backend: escolhe um valor e gira exatamente até esse segmento
    const pick = ROULETTE_OPTIONS[Math.floor(Math.random() * ROULETTE_OPTIONS.length)];
    const next = rotationToLandOnValor(rotation, pick.valor, 5);
    setRotation(next);
    window.setTimeout(() => {
      setResult(pick.valor);
      setSpinning(false);
      window.setTimeout(() => setResult(null), 5000);
    }, 3600);
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(120% 80% at 50% 18%, #1c0a10 0%, #080406 48%, #000 100%)',
      }}
    >
      <div
        className="relative w-full max-w-[360px] rounded-[26px] px-5 pt-7 pb-6"
        style={{
          background:
            'radial-gradient(110% 70% at 50% 0%, #14080c 0%, #080406 60%, #040203 100%)',
          border: '1px solid rgba(255,70,95,0.22)',
          boxShadow: [
            '0 0 0 1px rgba(255,80,100,0.06)',
            '0 0 28px rgba(244,63,94,0.12)',
            '0 20px 48px rgba(0,0,0,0.55)',
          ].join(', '),
        }}
      >
        <div className="flex justify-center">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10px] font-medium tracking-wide text-white/90"
            style={{
              background: 'rgba(190,18,60,0.22)',
              border: '1px solid rgba(255,80,100,0.22)',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/icons/icon-192x192.png"
              alt=""
              width={22}
              height={22}
              className="object-contain shrink-0"
              aria-hidden
            />
            <span className="relative top-[1.5px]">Desafio Semanal</span>
          </span>
        </div>

        <h1 className="mt-3.5 text-center text-[23px] font-semibold leading-[1.2] tracking-tight text-white">
          A conexão está em dia?
          <br />
          <span style={{ color: '#f43f5e' }}>Gire a roleta!</span>
        </h1>
        <p className="mt-1.5 text-center text-[13px] font-normal text-white/55 px-1">
          Gire junto com a Ana e ganhe... ou perca!
        </p>

        <div className="mt-5 mb-5">
          <PremiumRouletteWheel
            rotationDeg={rotation}
            spinning={spinning}
            size={286}
          />
        </div>

        {result !== null ? (
          <div className="mb-1 flex flex-col items-center gap-1">
            <p
              className="text-[28px] font-bold tracking-tight"
              style={{ color: '#f43f5e' }}
            >
              {result > 0 ? `+${result}` : result} Foguinhos
            </p>
            <p className="text-center text-[13px] font-bold text-white">
              Some com o resultado da Ana
            </p>
          </div>
        ) : !spinning ? (
          <button
            type="button"
            onClick={handleSpin}
            className="mt-3 w-full rounded-2xl py-3 text-[14px] font-semibold tracking-[0.04em] text-white"
            style={{
              background: 'linear-gradient(180deg, #fb7185 0%, #e11d48 52%, #be123c 100%)',
              boxShadow: [
                '0 0 0 1px rgba(255,140,160,0.15)',
                '0 6px 20px rgba(244,63,94,0.28)',
                'inset 0 1px 0 rgba(255,255,255,0.18)',
              ].join(', '),
            }}
          >
            GIRAR ROLETA
          </button>
        ) : null}
      </div>
    </div>
  );
}
