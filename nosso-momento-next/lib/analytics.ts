/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Analytics wrappers — GA4 (G-556FY0WV3Q) + Meta Pixel (1883535982201745)
 * Ambos os scripts são carregados no app/layout.tsx.
 * Estas funções são safe-call: falham silenciosamente se os scripts não carregaram.
 */

declare function gtag(...args: any[]): void;
declare function fbq(...args: any[]): void;

export function trackGA(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', event, params);
    }
  } catch (_) {}
}

export function trackMeta(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof fbq !== 'undefined') {
      fbq('track', event, params);
    }
  } catch (_) {}
}
