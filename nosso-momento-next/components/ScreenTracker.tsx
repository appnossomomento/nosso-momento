'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackScreenView } from '@/lib/analytics';

declare function fbq(...args: any[]): void;

/**
 * Dispara screen_view (GA4) e PageView (Meta) a cada mudança de rota do App Router.
 * O page_view automático do GA4 está desligado no layout (send_page_view:false),
 * então este componente é a fonte única de page_view/screen_view.
 * No Meta, o script de init já dispara o primeiro PageView, então pulamos a 1ª rota.
 */
export default function ScreenTracker() {
  const pathname = usePathname();
  const firstRun = useRef(true);

  useEffect(() => {
    if (!pathname) return;
    trackScreenView(pathname);

    // Meta: init já disparou o 1º PageView; dispara nas navegações seguintes.
    if (firstRun.current) {
      firstRun.current = false;
    } else {
      try {
        if (typeof fbq !== 'undefined') fbq('track', 'PageView');
      } catch (_) {}
    }
  }, [pathname]);

  return null;
}
