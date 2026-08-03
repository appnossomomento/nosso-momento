import clsx from 'clsx';
import FoguinhosIcon from '@/components/ui/FoguinhosIcon';
import { fundadorTitle } from '@/lib/utils/usuarioMembership';

type Props = {
  className?: string;
  /** Se false, não posiciona absolute no canto (útil inline). */
  absolute?: boolean;
  anatomia?: string | null;
  sexo?: string | null;
  genero?: string | null;
};

/**
 * Mesma pill do contador de foguinhos em /parceiro —
 * fundo branco, logo original, texto Fundador/Fundadora.
 */
export default function FundadorBadge({
  className,
  absolute = true,
  anatomia,
  sexo,
  genero,
}: Props) {
  const label = fundadorTitle({ anatomia, sexo, genero });

  return (
    <span
      className={clsx(
        'flex items-center gap-1 flex-shrink-0 select-none',
        absolute && 'absolute right-3.5 top-3 z-10',
        className,
      )}
      aria-label={label}
      title={label}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 14,
        padding: '3px 8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
      }}
    >
      <FoguinhosIcon size={18} />
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          lineHeight: 1,
          letterSpacing: '0.01em',
          color: '#111111',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          textRendering: 'optimizeLegibility',
        }}
      >
        {label}
      </span>
    </span>
  );
}
