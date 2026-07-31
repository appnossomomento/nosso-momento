import type { Metadata } from 'next';
import { PrivacyContent } from '@/lib/legal/LegalContent';

export const metadata: Metadata = {
  title: 'Política de Privacidade | Nosso Momento',
  description: 'Política de Privacidade do aplicativo Nosso Momento (LGPD).',
};

export default function PrivacidadePage() {
  return (
    <article>
      <p className="text-xs uppercase tracking-widest text-white/50">Legal</p>
      <h1 className="text-3xl font-semibold mt-1 mb-6">Política de Privacidade</h1>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-sm text-white/80 leading-relaxed">
        <PrivacyContent />
      </div>
    </article>
  );
}
