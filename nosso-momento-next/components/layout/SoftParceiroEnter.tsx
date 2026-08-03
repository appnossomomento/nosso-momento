'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { SOFT_ENTER_KEY, SOFT_EXIT_EVENT } from '@/components/layout/softRouteNav';

/**
 * Exemplo: fade-out ao sair + fade-in ao chegar em /parceiro.
 */
export default function SoftParceiroEnter({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  useEffect(() => {
    function onExit() {
      setPhase('exit');
    }
    window.addEventListener(SOFT_EXIT_EVENT, onExit);
    return () => window.removeEventListener(SOFT_EXIT_EVENT, onExit);
  }, []);

  useEffect(() => {
    if (pathname !== '/parceiro') {
      setPhase('idle');
      return;
    }
    let flagged = false;
    try {
      flagged = sessionStorage.getItem(SOFT_ENTER_KEY) === '1';
      if (flagged) sessionStorage.removeItem(SOFT_ENTER_KEY);
    } catch {
      flagged = false;
    }
    if (!flagged) {
      setPhase('idle');
      return;
    }
    setPhase('enter');
    const t = window.setTimeout(() => setPhase('idle'), 320);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const className =
    phase === 'exit'
      ? 'soft-parceiro-exit'
      : phase === 'enter'
        ? 'soft-parceiro-enter'
        : undefined;

  return (
    <div className={className} style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
