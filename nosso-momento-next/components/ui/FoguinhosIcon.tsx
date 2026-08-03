import Image from 'next/image';
import clsx from 'clsx';

const LOGO = '/assets/icons/iconprincipal.png';

type Props = {
  size?: number;
  className?: string;
};

/** Logo do app como ícone da moeda (foguinhos). */
export default function FoguinhosIcon({ size = 14, className }: Props) {
  return (
    <Image
      src={LOGO}
      alt=""
      width={size}
      height={size}
      className={clsx('inline-block shrink-0 object-contain', className)}
      aria-hidden
    />
  );
}
