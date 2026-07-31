'use client';

import { useAppStore } from '@/lib/store/appStore';
import OverlayModal from '@/components/ui/OverlayModal';
import { PrivacyContent, TermsContent } from '@/lib/legal/LegalContent';

export default function LegalModal() {
  const { showLegalModal, legalModalType, set } = useAppStore();

  const isTerms = legalModalType === 'terms';
  const title = isTerms ? 'Termos de Uso' : 'Política de Privacidade';

  function close() {
    set({ showLegalModal: false, legalModalType: null });
  }

  return (
    <OverlayModal
      open={showLegalModal}
      onClose={close}
      maxWidth="max-w-lg"
      scrollPanel={false}
      panelClassName="bg-[#120b16] text-white border border-white/10 p-6 flex flex-col max-h-[85vh]"
      ariaLabel={title}
    >
      <div className="flex items-start justify-between shrink-0">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Consentimento</p>
          <h3 className="text-2xl font-semibold mt-1">{title}</h3>
        </div>
        <button onClick={close} className="text-white/70 hover:text-white transition">
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-xs text-white/80 leading-relaxed overflow-y-auto flex-1">
        {isTerms ? <TermsContent /> : <PrivacyContent />}
      </div>

      <div className="mt-4 shrink-0">
        <button
          onClick={close}
          className="w-full rounded-xl bg-white/10 py-3 text-white/80 font-semibold hover:bg-white/20 transition"
        >
          Entendi
        </button>
      </div>
    </OverlayModal>
  );
}
