'use client';

import {useEffect, useState} from 'react';
import {
  getCookieConsent,
  setCookieConsent,
  type CookieConsentValue,
} from '@/lib/consent/cookies';

/**
 * Banner LGPD: só libera GA/Meta após aceite explícito.
 * Preferência fica em localStorage (`nm_cookie_consent`).
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  function choose(value: CookieConsentValue) {
    setCookieConsent(value);
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[200] p-4 sm:p-6 pointer-events-none"
      role="dialog"
      aria-live="polite"
      aria-label="Consentimento de cookies"
    >
      <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-white/10 bg-[#120b16]/95 text-white shadow-2xl backdrop-blur-md p-4 sm:p-5">
        <p className="text-sm font-semibold text-white/90">Cookies e privacidade</p>
        <p className="mt-2 text-xs leading-relaxed text-white/60">
          Usamos cookies de medição (Google Analytics e Meta Pixel) para entender
          o uso do app e melhorar a experiência. Você pode aceitar ou recusar.
          Sessão e funcionamento essencial não dependem disso.
        </p>
        <div className="mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            type="button"
            onClick={() => choose('declined')}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/70 hover:bg-white/10 transition"
          >
            Recusar
          </button>
          <button
            type="button"
            onClick={() => choose('accepted')}
            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-500 transition"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
}
