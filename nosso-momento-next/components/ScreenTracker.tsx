'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { trackScreenView } from '@/lib/analytics';
import {
  hasMarketingConsent,
  onCookieConsentChange,
} from '@/lib/consent/cookies';

declare function fbq(...args: any[]): void;

/**
 * Dispara screen_view (GA4) e PageView (Meta) a cada mudança de rota do App Router,
 * somente com consentimento de marketing.
 */
export default function ScreenTracker() {
  const pathname = usePathname();
  const firstRun = useRef(true);
  const consentRef = useRef(false);

  useEffect(() => {
    consentRef.current = hasMarketingConsent();
    return onCookieConsentChange(() => {
      const next = hasMarketingConsent();
      const justAccepted = next && !consentRef.current;
      consentRef.current = next;
      if (justAccepted && pathname) {
        firstRun.current = true;
        trackScreenView(pathname);
        try {
          if (typeof fbq !== 'undefined') fbq('track', 'PageView');
        } catch (_) {}
        firstRun.current = false;
      }
    });
  }, [pathname]);

  useEffect(() => {
    if (!pathname || !hasMarketingConsent()) return;
    trackScreenView(pathname);

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
