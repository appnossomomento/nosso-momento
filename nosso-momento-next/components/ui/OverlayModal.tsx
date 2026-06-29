'use client';

import clsx from 'clsx';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  overlayClassName?: string;
  panelClassName?: string;
  backdropClassName?: string;
  maxWidth?: string;
  zIndex?: number;
  ariaLabel?: string;
  /** When false, panel uses overflow-hidden (inner sections scroll). Default true. */
  scrollPanel?: boolean;
  dismissOnBackdrop?: boolean;
};

export default function OverlayModal({
  open,
  onClose,
  children,
  overlayClassName,
  panelClassName,
  backdropClassName = 'bg-black/70 backdrop-blur-sm',
  maxWidth = 'max-w-lg',
  zIndex = 50,
  ariaLabel,
  scrollPanel = true,
  dismissOnBackdrop = true,
}: Props) {
  if (!open) return null;

  const handleOverlayClick = dismissOnBackdrop ? onClose : undefined;

  return (
    <div
      className={clsx(
        'fixed inset-0 flex items-center justify-center px-4 py-6',
        overlayClassName,
      )}
      style={{ zIndex }}
      onClick={handleOverlayClick}
    >
      <div className={clsx('absolute inset-0', backdropClassName)} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={clsx(
          'relative w-full rounded-3xl shadow-2xl',
          scrollPanel && 'max-h-[min(90vh,calc(100dvh-3rem))] overflow-y-auto',
          !scrollPanel && 'max-h-[min(90vh,calc(100dvh-3rem))] overflow-hidden flex flex-col',
          maxWidth,
          panelClassName,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
