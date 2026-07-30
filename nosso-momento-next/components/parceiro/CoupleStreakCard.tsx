'use client';

import type { CSSProperties } from 'react';
import Image from 'next/image';
import clsx from 'clsx';
import type { CoupleStreak } from '@/lib/clima/coupleStreak';
import StreakFlame from '@/components/parceiro/StreakFlame';

const STATE_COPY: Record<CoupleStreak['state'], string> = {
  alive: 'Sequência acesa',
  at_risk: 'Ainda dá tempo hoje',
  ember: 'A chama está apagando!',
  cold: 'Marquem juntos',
};

type Props = {
  streak: CoupleStreak;
  partnerName: string;
  meFoto?: string | null;
  partnerFoto?: string | null;
  meHumorEmoji?: string | null;
  partnerHumorEmoji?: string | null;
  /** Só true quando o parceiro (não você) marcou triste. */
  partnerTriste?: boolean;
};

const midBlockFire = {
  background:
    'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, #ef4444 0%, #f97316 55%, #fb923c 100%) border-box',
  border: '1px solid transparent',
  borderRadius: 18,
  boxShadow:
    '0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(249,115,22,0.25), 0 0 16px rgba(249,115,22,0.4), 0 0 32px rgba(239,68,68,0.28)',
} as const;

const midBlockEmber = {
  background:
    'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, #78716c 0%, #a8a29e 55%, #57534e 100%) border-box',
  border: '1px solid transparent',
  borderRadius: 18,
  boxShadow:
    '0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(168,162,158,0.2), 0 0 12px rgba(120,113,108,0.25)',
} as const;

const midBlockCold = {
  background:
    'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, #52525b 0%, #71717a 55%, #3f3f46 100%) border-box',
  border: '1px solid transparent',
  borderRadius: 18,
  boxShadow: '0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(113,113,122,0.18)',
} as const;

const midBlockTriste = {
  background:
    'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, #3b82f6 0%, #6366f1 55%, #818cf8 100%) border-box',
  border: '1px solid transparent',
  borderRadius: 18,
  boxShadow:
    '0 10px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(99,102,241,0.28), 0 0 16px rgba(59,130,246,0.38), 0 0 32px rgba(99,102,241,0.24)',
} as const;

function midBlockStyle(
  state: CoupleStreak['state'],
  partnerTriste: boolean,
): CSSProperties {
  if (partnerTriste) return midBlockTriste;
  if (state === 'cold') return midBlockCold;
  if (state === 'ember') return midBlockEmber;
  return midBlockFire;
}

const GLOW_DONE =
  '0 0 0 1px rgba(52,211,153,0.45), 0 0 12px rgba(52,211,153,0.55), 0 0 22px rgba(16,185,129,0.35)';
const GLOW_TRISTE =
  '0 0 0 1px rgba(129,140,248,0.55), 0 0 12px rgba(96,165,250,0.55), 0 0 22px rgba(99,102,241,0.4)';

function SideCheckBlock({
  src,
  label,
  done,
  humorEmoji,
  fallbackIcon,
  triste,
}: {
  src?: string | null;
  label: string;
  done: boolean;
  humorEmoji?: string | null;
  fallbackIcon: string;
  triste?: boolean;
}) {
  const glow = triste ? GLOW_TRISTE : done ? GLOW_DONE : undefined;

  return (
    <div className="flex flex-col items-center gap-1.5 w-[72px] self-center min-w-0">
      <span className="text-[11px] font-bold text-white truncate max-w-full leading-none text-center">
        {label}
      </span>
      <div className="relative">
        <div
          className={clsx(
            'w-11 h-11 rounded-full overflow-hidden flex items-center justify-center',
            !done && !triste && 'ring-1 ring-white/15 opacity-90',
            triste && 'nm-streak-avatar--triste',
          )}
          style={{
            background: 'rgba(255,255,255,0.08)',
            boxShadow: glow,
          }}
        >
          {src ? (
            <Image src={src} alt={label} width={44} height={44} className="w-full h-full object-cover" />
          ) : (
            <i className={`fas ${fallbackIcon} text-white/35 text-sm`} />
          )}
        </div>
        <span
          className={clsx(
            'absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#0d0d0f] shadow-sm',
            done ? 'bg-[#1a1b20] text-[12px] leading-none' : 'bg-white/15 text-white/40 text-[9px] font-bold',
          )}
          title={
            triste
              ? 'Marcou triste hoje'
              : done
                ? humorEmoji
                  ? 'Clima de hoje'
                  : 'Check-in feito'
                : 'Ainda não marcou'
          }
          aria-label={
            triste ? 'Parceiro marcou triste' : done ? 'Clima de hoje registrado' : 'Check-in pendente'
          }
        >
          {done ? (humorEmoji || '✓') : '·'}
        </span>
      </div>
    </div>
  );
}

export default function CoupleStreakCard({
  streak,
  partnerName,
  meFoto,
  partnerFoto,
  meHumorEmoji,
  partnerHumorEmoji,
  partnerTriste = false,
}: Props) {
  const daysLabel = streak.days === 1 ? '1 dia' : `${streak.days} dias`;

  return (
    <div className="flex items-center gap-2">
      <SideCheckBlock
        src={meFoto}
        label="Você"
        done={streak.meDoneToday}
        humorEmoji={meHumorEmoji}
        fallbackIcon="fa-user"
      />

      <div
        className="flex-1 min-w-0 flex flex-col items-center justify-center px-2 pt-2 pb-2.5 text-center"
        style={midBlockStyle(streak.state, partnerTriste)}
      >
        <StreakFlame state={streak.state} tier={streak.tier} softMood={partnerTriste} />
        <p className="text-xl font-bold leading-none text-white tabular-nums mt-0.5">{daysLabel}</p>
        {partnerTriste ? (
          <p className="text-[10px] mt-1 leading-snug text-sky-200/70 px-1">
            {partnerName} precisa de um carinho
          </p>
        ) : (
          streak.state !== 'alive' && (
            <p className="text-[10px] mt-1 leading-snug text-white/45 px-1">{STATE_COPY[streak.state]}</p>
          )
        )}
      </div>

      <SideCheckBlock
        src={partnerFoto}
        label={partnerName}
        done={streak.partnerDoneToday}
        humorEmoji={partnerHumorEmoji}
        fallbackIcon="fa-user"
        triste={partnerTriste}
      />
    </div>
  );
}
