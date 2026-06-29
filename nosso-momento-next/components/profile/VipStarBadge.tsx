import clsx from 'clsx';

type Props = {
  className?: string;
  size?: 'sm' | 'md';
  /** Borda do badge — use claro no header gradiente */
  borderClassName?: string;
};

export default function VipStarBadge({
  className,
  size = 'md',
  borderClassName = 'border-[#0f0b14]',
}: Props) {
  const dim = size === 'sm' ? 'w-6 h-6' : 'w-7 h-7';
  const icon = size === 'sm' ? 'text-[9px]' : 'text-[11px]';

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
      <i className={clsx('fas fa-star text-white drop-shadow', icon)} />
    </span>
  );
}
