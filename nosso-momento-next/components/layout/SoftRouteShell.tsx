'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  installSoftLinkInterceptor,
  SOFT_ENTER_KEY,
  SOFT_EXIT_EVENT,
} from '@/components/layout/softRouteNav';

/**
 * Soft nav global do app autenticado:
 * - intercepta todos os Link/<a> internos
 * - fade CSS de fallback quando não há View Transitions
 *
 * Telas novas dentro de (app) herdam isso automaticamente.
 */
export default function SoftRouteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const pathnameRef = useRef(pathname);
  const [phase, setPhase] = useState<'idle' | 'exit' | 'enter'>('idle');

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (typeof installSoftLinkInterceptor !== 'function') return;
    return installSoftLinkInterceptor(router, () => pathnameRef.current);
  }, [router]);

  useEffect(() => {
    function onExit() {
      setPhase('exit');
    }
    window.addEventListener(SOFT_EXIT_EVENT, onExit);
    return () => window.removeEventListener(SOFT_EXIT_EVENT, onExit);
  }, []);

  useEffect(() => {
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
      ? 'soft-route-exit'
      : phase === 'enter'
        ? 'soft-route-enter'
        : undefined;

  return (
    <div className={className} style={{ minHeight: '100%' }}>
      {children}
    </div>
  );
}
