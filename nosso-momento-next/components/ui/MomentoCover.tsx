'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { sanitizeMomentoImgUrl } from '@/lib/utils/momentoImage';

type MomentoCoverVariant = 'thumb' | 'card';

const VARIANT_STYLES: Record<
  MomentoCoverVariant,
  { img: string; fallback: string; emoji: string }
> = {
  thumb: {
    img: 'w-14 h-14 rounded-xl object-cover shrink-0',
    fallback:
      'w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center shrink-0',
    emoji: 'text-2xl',
  },
  card: {
    img: 'w-full h-40 object-cover',
    fallback:
      'w-full h-40 bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center',
    emoji: 'text-5xl',
  },
};

type Props = {
  src?: string | null;
  alt: string;
  emoji?: string;
  variant?: MomentoCoverVariant;
};

export default function MomentoCover({
  src,
  alt,
  emoji = '🔥',
  variant = 'thumb',
}: Props) {
  const [failed, setFailed] = useState(false);
  const styles = VARIANT_STYLES[variant];
  const safeSrc = sanitizeMomentoImgUrl(src);
  const showImg = !!safeSrc && !failed;

  if (!showImg) {
    return (
      <div className={styles.fallback}>
        <span className={styles.emoji} aria-hidden="true">{emoji}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={alt}
      className={clsx(styles.img)}
      onError={() => setFailed(true)}
    />
  );
}
