'use client';

import { useAppStore } from '@/lib/store/appStore';

export default function FoguinhosPopup() {
  const { showFoguinhosPopup, usuario, parceirosAtivos, notificacoes, set } = useAppStore();
  if (!showFoguinhosPopup) return null;

  const presentes = notificacoes.filter((n) => (n as Record<string, unknown>).icone === 'fa-gift');
  const totalFoguinhos = usuario?.foguinhos ?? 0;

  function close() {
    set({ showFoguinhosPopup: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={close}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0f0b14] border border-white/10 p-6 shadow-2xl text-white max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50">Saldo</p>
            <h2 className="text-2xl font-bold text-yellow-400">
              <i className="fas fa-fire mr-2" />{totalFoguinhos} Foguinhos
            </h2>
          </div>
          <button onClick={close} className="text-white/50 hover:text-white transition">
            <i className="fas fa-times text-lg" />
          </button>
        </div>

        <p className="text-xs text-white/50 mb-4 shrink-0">Use-os para resgatar momentos especiais</p>

        {/* Parceiros ativos (se mais de um) */}
        {parceirosAtivos.length > 1 && (
          <div className="mb-4 shrink-0">
            <p className="text-xs text-white/60 font-semibold mb-2">Saldo por parceiro</p>
            <div className="space-y-2">
              {parceirosAtivos.map((p) => (
                <div key={p.uid} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
                  <p className="text-sm font-medium">{p.nome || 'Parceiro'}</p>
                  <span className="text-yellow-400 font-bold text-sm">
                    <i className="fas fa-fire mr-1" />{p.foguinhos ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Histórico de presentes */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <p className="text-xs text-white/60 font-semibold mb-2">
            Histórico de Presentes <span className="text-white/30">({presentes.length})</span>
          </p>
          {presentes.length === 0 ? (
            <p className="text-center text-white/30 text-sm py-8">Nenhum presente recebido ainda.</p>
          ) : (
            <div className="space-y-2">
              {presentes.map((notif) => {
                const n = notif as Record<string, unknown>;
                const ts = n.timestamp as { seconds: number } | null;
                return (
                  <div
                    key={notif.id}
                    className="flex items-start gap-3 rounded-xl bg-white/5 px-4 py-3"
                  >
                    <div className="w-8 h-8 rounded-full bg-yellow-400/20 flex items-center justify-center shrink-0">
                      <i className="fas fa-gift text-yellow-400 text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{String(n.titulo ?? 'Presente recebido')}</p>
                      <p className="text-xs text-white/60">{notif.mensagem}</p>
                      {ts?.seconds && (
                        <p className="text-xs text-white/30 mt-0.5">
                          {new Date(ts.seconds * 1000).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
