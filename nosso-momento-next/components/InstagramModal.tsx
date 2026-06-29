'use client';

import { useAppStore } from '@/lib/store/appStore';
import OverlayModal from '@/components/ui/OverlayModal';

const INSTAGRAM_URL = 'https://instagram.com/nossomomentoapp';

export default function InstagramModal() {
  const { showInstagramModal, set } = useAppStore();

  function fechar() {
    set({ showInstagramModal: false });
  }

  function abrirInstagram() {
    fechar();
    window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <OverlayModal
      open={showInstagramModal}
      onClose={fechar}
      maxWidth="max-w-md"
      panelClassName="bg-[#120b16] text-white border border-white/10 p-6"
      ariaLabel="Seguir no Instagram"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/60">Instagram</p>
          <h3 className="text-2xl font-semibold mt-1">Siga o Nosso Momento</h3>
        </div>
        <button
          onClick={fechar}
          className="text-white/70 hover:text-white transition-colors"
          aria-label="Fechar"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/80 leading-relaxed">
        Você será direcionado para o Instagram em uma nova aba.
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={fechar}
          className="flex-1 rounded-xl bg-white/10 py-3 text-white/80 font-semibold transition hover:bg-white/20 active:scale-95"
        >
          Agora não
        </button>
        <button
          onClick={abrirInstagram}
          className="flex-1 rounded-xl py-3 text-white font-semibold transition active:scale-95"
          style={{ background: 'linear-gradient(135deg,#ec4899,#ef4444)' }}
        >
          Abrir Instagram
        </button>
      </div>
    </OverlayModal>
  );
}
