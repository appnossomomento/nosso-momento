import clsx from 'clsx';
import Image from 'next/image';

const LOGO_WHITE = '/assets/icons/logo-icon-white-bottom.png';

type Props = {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  /** Borda do badge — use claro no header gradiente */
  borderClassName?: string;
};

export default function VipStarBadge({
  className,
  size = 'md',
  borderClassName = 'border-[#0f0b14]',
}: Props) {
  const dim = size === 'sm' ? 'w-6 h-6' : size === 'lg' ? 'w-12 h-12' : 'w-7 h-7';
  const logoPx = size === 'sm' ? 12 : size === 'lg' ? 22 : 14;

  return (
    <span
      className={clsx(
        'absolute z-10 flex items-center justify-center rounded-full',
        'bg-gradient-to-br from-amber-300 via-yellow-400 to-amber-600',
        'border-2 shadow-[0_2px_8px_rgba(251,191,36,0.55)]',
        borderClassName,
        dim,
        className,
      )}
      aria-label="VIP ativo"
      title="VIP ativo"
    >
      <Image
        src={LOGO_WHITE}
        alt=""
        width={logoPx}
        height={logoPx}
        className="object-contain drop-shadow"
        aria-hidden
      />
    </span>
  );
}
