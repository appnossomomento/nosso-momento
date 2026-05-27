'use client';

import { useAppStore } from '@/lib/store/appStore';

export default function VipPopup() {
  const { showVipPopup, set } = useAppStore();

  if (!showVipPopup) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-5"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={() => set({ showVipPopup: false })}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: '#080808', border: '1px solid rgba(255,45,63,0.20)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center gap-4"
          style={{ background: 'linear-gradient(135deg, #ff2d3f 0%, #ff5565 100%)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.22)' }}
          >
            <i className="fas fa-crown text-xl text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Acesso VIP</h2>
            <p className="text-xs text-white/80">Recursos exclusivos</p>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="px-6 py-5 space-y-4">
          {/* Card info */}
          <div
            className="rounded-2xl p-4 space-y-3"
            style={{ background: '#111', border: '1px solid rgba(255,45,63,0.22)' }}
          >
            <p className="text-sm text-white/80 leading-relaxed">
              O <span className="text-white font-semibold">Ambiente VIP</span> é exclusivo para usuários com plano premium. Com ele, você desbloqueia:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2 text-sm text-white/70">
                <i className="fas fa-check text-pink-400 text-xs w-4" />
                Múltiplas conexões (Modo Poliamor)
              </li>
              <li className="flex items-center gap-2 text-sm text-white/70">
                <i className="fas fa-check text-pink-400 text-xs w-4" />
                Recursos premium e catálogo completo
              </li>
              <li className="flex items-center gap-2 text-sm text-white/70">
                <i className="fas fa-check text-pink-400 text-xs w-4" />
                Prioridade no suporte
              </li>
            </ul>
          </div>

          {/* Contato */}
          <div
            className="rounded-2xl p-4"
            style={{ background: '#111', border: '1px solid rgba(255,45,63,0.22)' }}
          >
            <p className="text-xs text-white/50 mb-1">Entre em contato para se tornar VIP:</p>
            <a
              href="mailto:faleconosco@nossomomento.app"
              className="text-sm font-semibold text-pink-400 hover:text-pink-300 transition"
            >
              faleconosco@nossomomento.app
            </a>
          </div>

          {/* Botão */}
          <button
            onClick={() => set({ showVipPopup: false })}
            className="w-full py-3 rounded-2xl text-sm font-semibold text-white transition"
            style={{ background: 'linear-gradient(135deg, #ff2d3f, #c8003a)' }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
