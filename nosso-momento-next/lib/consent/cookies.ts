/** Consentimento de cookies de marketing (GA4 / Meta Pixel). */

export const COOKIE_CONSENT_KEY = 'nm_cookie_consent';
export type CookieConsentValue = 'accepted' | 'declined';

const CHANGE_EVENT = 'nm-cookie-consent-change';

export function getCookieConsent(): CookieConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (raw === 'accepted' || raw === 'declined') return raw;
  } catch {
    /* ignore */
  }
  return null;
}

export function hasMarketingConsent(): boolean {
  return getCookieConsent() === 'accepted';
}

export function setCookieConsent(value: CookieConsentValue): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(COOKIE_CONSENT_KEY, value);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, {detail: value}));
}

export function onCookieConsentChange(
  listener: (value: CookieConsentValue | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const handler = () => listener(getCookieConsent());
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
