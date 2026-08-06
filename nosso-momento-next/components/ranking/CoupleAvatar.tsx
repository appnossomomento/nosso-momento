'use client';

import Image from 'next/image';
import clsx from 'clsx';

const FALLBACK = '/assets/icons/iconprincipal.png';

export type CoupleAvatarRing = 'gold' | 'silver' | 'bronze' | 'accent';

type SizeKey = 'sm' | 'md' | 'lg';

const SIZE: Record<SizeKey, { avatar: number; overlap: number }> = {
  sm: { avatar: 36, overlap: 10 },
  md: { avatar: 56, overlap: 14 },
  lg: { avatar: 72, overlap: 16 },
};

const RING: Record<CoupleAvatarRing, { glow: string }> = {
  gold: {
    glow: '0 0 0 2px #fbbf24, 0 0 14px rgba(251,191,36,0.55), 0 0 28px rgba(245,158,11,0.35)',
  },
  silver: {
    glow: '0 0 0 2px #cbd5e1, 0 0 12px rgba(203,213,225,0.4)',
  },
  bronze: {
    glow: '0 0 0 2px #d97706, 0 0 12px rgba(217,119,6,0.45)',
  },
  accent: {
    glow: '0 0 0 1.5px rgba(255,255,255,0.18)',
  },
};

type Props = {
  leftFoto?: string | null;
  rightFoto?: string | null;
  leftAlt?: string;
  rightAlt?: string;
  size?: SizeKey;
  ring?: CoupleAvatarRing;
  className?: string;
};

export default function CoupleAvatar({
  leftFoto,
  rightFoto,
  leftAlt = '',
  rightAlt = '',
  size = 'md',
  ring = 'accent',
  className,
}: Props) {
  const { avatar, overlap } = SIZE[size];
  const ringStyle = RING[ring];
  const width = avatar * 2 - overlap;

  return (
    <div
      className={clsx('relative flex items-center justify-center', className)}
      style={{ width, height: avatar }}
    >
      <div
        className="relative z-[1] rounded-full overflow-hidden shrink-0"
        style={{
          width: avatar,
          height: avatar,
          marginRight: -overlap,
          boxShadow: ringStyle.glow,
        }}
      >
        <Image
          src={leftFoto || FALLBACK}
          alt={leftAlt}
          width={avatar}
          height={avatar}
          className="w-full h-full object-cover"
        />
      </div>
      <div
        className="relative z-[1] rounded-full overflow-hidden shrink-0"
        style={{
          width: avatar,
          height: avatar,
          boxShadow: ringStyle.glow,
        }}
      >
        <Image
          src={rightFoto || FALLBACK}
          alt={rightAlt}
          width={avatar}
          height={avatar}
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
}
