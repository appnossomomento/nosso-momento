'use client';

import { useAppStore } from '@/lib/store/appStore';

const INSTAGRAM_URL = 'https://instagram.com/nossomomentoapp';

export default function InstagramModal() {
  const { showInstagramModal, set } = useAppStore();

  if (!showInstagramModal) return null;

  function fechar() {
    set({ showInstagramModal: false });
  }

  function abrirInstagram() {
    fechar();
    window.open(INSTAGRAM_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={fechar}
      />

      {/* Card */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
        onClick={fechar}
      >
        <div
          className="w-full max-w-md rounded-3xl text-white shadow-2xl border border-white/10 p-6"
          style={{ background: '#120b16' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
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

          {/* Body */}
          <div className="mt-4 rounded-2xl bg-white/5 border border-white/10 p-4 text-sm text-white/80 leading-relaxed">
            Você será direcionado para o Instagram em uma nova aba.
          </div>

          {/* Actions */}
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
        </div>
      </div>
    </>
  );
}
