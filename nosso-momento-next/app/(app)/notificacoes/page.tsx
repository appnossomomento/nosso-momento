'use client';

import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/lib/store/appStore';
import {
  isNotificacaoLida,
  marcarNotificacoesComoLidas,
} from '@/lib/hooks/useNotificacoes';
import type { Notificacao } from '@/lib/types';

type NotifTab = 'momentos' | 'diario' | 'conquistas';

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'momentos', label: 'Momentos' },
  { id: 'diario', label: 'Diário' },
  { id: 'conquistas', label: 'Conquistas' },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

const ICON_MAP: Record<string, { color: string; bg: string }> = {
  'fa-fire': { color: 'text-amber-500', bg: 'bg-amber-50' },
  'fa-shopping-bag': { color: 'text-orange-500', bg: 'bg-orange-50' },
  'fa-store': { color: 'text-violet-500', bg: 'bg-violet-50' },
  'fa-trophy': { color: 'text-yellow-500', bg: 'bg-yellow-50' },
  'fa-dice': { color: 'text-blue-500', bg: 'bg-blue-50' },
  'fa-thermometer-half': { color: 'text-rose-500', bg: 'bg-rose-50' },
  'fa-gift': { color: 'text-pink-500', bg: 'bg-pink-50' },
  'fa-heart': { color: 'text-pink-400', bg: 'bg-pink-50' },
  'fa-bell': { color: 'text-gray-500', bg: 'bg-gray-100' },
};

function filtrarPorAba(notif: Notificacao, tab: NotifTab): boolean {
  const tipo = String(notif.tipo ?? '');
  const icone = String(notif.icone ?? '');

  if (tab === 'momentos') {
    return (
      tipo === 'momento_resgatado' ||
      tipo === 'moment_completion' ||
      tipo === 'catalog_update'
    );
  }
  if (tab === 'conquistas') {
    return tipo === 'achievement' || tipo === 'milestone';
  }
  return (
    tipo === 'desafio' ||
    tipo === 'clima' ||
    tipo === 'lembrete_humor' ||
    tipo === 'chama_apagando' ||
    icone === 'fa-gift' ||
    (!tipo && icone !== 'fa-heart')
  );
}

function relativeTime(seconds: number): string {
  const diffMs = Date.now() - seconds * 1000;
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'Agora';
  if (m < 60) return `${m}min`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

function tituloParaNotif(notif: Notificacao): string {
  const tipo = String(notif.tipo ?? '');
  const icone = String(notif.icone ?? '');
  if (notif.titulo) return String(notif.titulo);
  if (icone === 'fa-gift') return '🎁 Presente recebido';
  if (icone === 'fa-thermometer-half') return '🌡️ Clima do Dia';
  if (icone === 'fa-shopping-bag') return '🛍️ Momento resgatado!';
  if (tipo === 'moment_completion') return '🔥 Missão concluída!';
  if (tipo === 'achievement') return '🏅 Nova conquista!';
  if (tipo === 'milestone') return '💏 Marco especial!';
  if (tipo === 'desafio') return '🏆 Desafio';
  if (tipo === 'chama_apagando') return 'A chama está apagando!';
  return 'Atualização';
}

export default function NotificacoesPage() {
  const { notificacoes, notificacoesTab, set } = useAppStore();
  const tab: NotifTab = VALID_TABS.has(notificacoesTab)
    ? (notificacoesTab as NotifTab)
    : 'momentos';

  useEffect(() => {
    if (!VALID_TABS.has(notificacoesTab)) {
      set({ notificacoesTab: 'momentos' });
    }
  }, [notificacoesTab, set]);

  const filtradas = useMemo(
    () => notificacoes.filter((n) => filtrarPorAba(n, tab)),
    [notificacoes, tab],
  );

  const tabUnreadIdsKey = useMemo(
    () =>
      filtradas
        .filter((n) => !isNotificacaoLida(n))
        .map((n) => n.id)
        .sort()
        .join(','),
    [filtradas],
  );

  // Marca como lidas só as não-lidas da aba atual
  useEffect(() => {
    if (!tabUnreadIdsKey) return;
    const ids = new Set(tabUnreadIdsKey.split(','));
    const atuais = useAppStore.getState().notificacoes;
    const naoLidas = atuais.filter(
      (n) => ids.has(n.id) && !isNotificacaoLida(n),
    );
    if (!naoLidas.length) return;
    marcarNotificacoesComoLidas(naoLidas).catch((err) => {
      console.error('[NotificacoesPage] erro ao marcar como lidas:', err);
    });
  }, [tab, tabUnreadIdsKey]);

  return (
    <div className="screen screen-pad bg-black text-white">
      <section
        className="px-0 pt-11 pb-16"
        style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}
      >
        <div className="flex flex-col items-center text-center -mt-3">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <i className="fas fa-bell text-2xl text-white" />
          </div>
          <h2 className="text-xl font-semibold">Notificações</h2>
          <p className="text-sm text-white/80">Veja as novidades do seu perfil</p>
        </div>
      </section>

      <section className="px-5 -mt-10">
        <div className="rounded-[32px] bg-[#0f0b14] p-4 shadow-lg space-y-4">
          <div className="flex gap-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => set({ notificacoesTab: t.id })}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-semibold transition',
                  tab === t.id
                    ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white'
                    : 'bg-white/5 text-white/50',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {filtradas.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🔔</div>
              <p className="text-white/40 text-sm">Nenhuma notificação aqui.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtradas.map((notif) => {
                const icone = String(notif.icone ?? 'fa-bell');
                const ts = notif.timestamp as { seconds: number } | null;
                const lida = isNotificacaoLida(notif);
                const { color, bg } = ICON_MAP[icone] ?? {
                  color: 'text-gray-400',
                  bg: 'bg-gray-100',
                };

                return (
                  <div
                    key={notif.id}
                    className={clsx(
                      'flex items-start gap-3 rounded-xl px-4 py-3 transition',
                      lida
                        ? 'bg-white/[0.03] opacity-50'
                        : 'bg-white/[0.10] border-l-[3px] border-[#ff4d6a] shadow-[0_0_0_1px_rgba(255,77,106,0.12)]',
                    )}
                  >
                    <div
                      className={clsx(
                        'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                        bg,
                      )}
                    >
                      <i className={`fas ${icone} text-base ${color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={clsx(
                          'text-sm font-semibold leading-snug',
                          lida ? 'text-white/70' : 'text-white',
                        )}
                      >
                        {tituloParaNotif(notif)}
                      </p>
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                        {String(notif.mensagem ?? '')}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0 mt-0.5">
                      {ts?.seconds && (
                        <span className="text-[10px] text-white/30">
                          {relativeTime(ts.seconds)}
                        </span>
                      )}
                      {!lida && (
                        <span
                          className="w-2 h-2 rounded-full bg-[#ff2d3f] shadow-[0_0_6px_rgba(255,45,63,0.7)]"
                          aria-label="Não lida"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
