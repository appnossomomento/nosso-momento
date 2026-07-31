import type { Metadata } from 'next';
import { TermsContent } from '@/lib/legal/LegalContent';

export const metadata: Metadata = {
  title: 'Termos de Uso | Nosso Momento',
  description: 'Termos de Uso do aplicativo Nosso Momento.',
};

export default function TermosPage() {
  return (
    <article>
      <p className="text-xs uppercase tracking-widest text-white/50">Legal</p>
      <h1 className="text-3xl font-semibold mt-1 mb-6">Termos de Uso</h1>
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5 text-sm text-white/80 leading-relaxed">
        <TermsContent />
      </div>
    </article>
  );
}
