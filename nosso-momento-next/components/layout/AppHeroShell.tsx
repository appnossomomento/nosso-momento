'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import { softBack } from '@/components/layout/softRouteNav';

/**
 * Cores do CTA LP "Seja um Casal Fundador":
 * Tailwind `from-red-500 to-rose-500` → #ef4444 → #f43f5e
 */
export const LP_RED = '#ef4444';
export const LP_ROSE = '#f43f5e';
export const ACCENT = LP_ROSE;
export const ACCENT_SOFT = '#fb7185';
export const PANEL = '#101010';
export const TILE = '#141414';

/** Mesmas cores da LP, lavadas verticalmente até o preto. */
export const PAGE_BG: CSSProperties = {
  backgroundImage: [
    `linear-gradient(180deg, ${LP_RED} 0%, ${LP_ROSE} 12%, #9f1239 26%, #4c0519 40%, #1a050c 54%, #0a0408 68%, #030206 100%)`,
    `radial-gradient(100% 55% at 50% 0%, rgba(239, 68, 68, 0.35) 0%, rgba(244, 63, 94, 0.2) 35%, transparent 55%)`,
  ].join(', '),
  backgroundColor: '#030206',
};

/**
 * Altura do hero do Início (pt-14 + avatar 118 + mb-5 + título + subtítulo + pb-5).
 * Mantém o sheet alinhado nas telas com ícone menor.
 */
export const HERO_MIN_HEIGHT = 268;

const PANEL_STYLE: CSSProperties = {
  background: PANEL,
  border: '1px solid rgba(255, 255, 255, 0.08)',
  boxShadow: [
    '0 24px 60px rgba(0,0,0,0.55)',
    '0 0 0 1px rgba(244, 63, 94, 0.05)',
    'inset 0 1px 0 rgba(255,255,255,0.04)',
  ].join(', '),
};

type Props = {
  hero: ReactNode;
  children: ReactNode;
  sheetClassName?: string;
  /** Seta top-left para voltar. Default true; desligar no Início. */
  showBack?: boolean;
};

export default function AppHeroShell({
  hero,
  children,
  sheetClassName = 'space-y-3',
  showBack = true,
}: Props) {
  const router = useRouter();

  function handleBack() {
    softBack(router, '/dashboard');
  }

  return (
    <div
      className="relative screen screen-pad text-white"
      style={{ backgroundColor: '#030206' }}
    >
      {/* Gradiente preso à viewport — não estica quando a lista muda de altura */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0"
        style={{ ...PAGE_BG, zIndex: 0 }}
      />

      <div className="relative" style={{ zIndex: 1 }}>
        <section
          className="relative flex flex-col items-center justify-center px-5 pt-14 pb-5"
          style={{ minHeight: HERO_MIN_HEIGHT }}
        >
          {showBack && (
            <button
              type="button"
              onClick={handleBack}
              className="absolute left-3.5 z-10 flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95"
              style={{
                top: 'max(12px, env(safe-area-inset-top))',
                background: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
              aria-label="Voltar"
            >
              <i className="fas fa-arrow-left text-white text-sm" />
            </button>
          )}
          <div className="flex w-full flex-col items-center text-center">{hero}</div>
        </section>

        <section className="px-3.5 pb-8">
          <div
            className={clsx('rounded-[36px] p-3.5', sheetClassName)}
            style={PANEL_STYLE}
          >
            {children}
          </div>
        </section>
      </div>
    </div>
  );
}
