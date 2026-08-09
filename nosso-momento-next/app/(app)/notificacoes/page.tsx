'use client';

import { useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/lib/store/appStore';
import {
  isNotificacaoLida,
  marcarNotificacoesComoLidas,
} from '@/lib/hooks/useNotificacoes';
import type { Notificacao } from '@/lib/types';
import AppHeroShell, { ACCENT, TILE } from '@/components/layout/AppHeroShell';

type NotifTab = 'momentos' | 'diario' | 'conquistas';

const TABS: { id: NotifTab; label: string }[] = [
  { id: 'momentos', label: 'Momentos' },
  { id: 'diario', label: 'Diário' },
  { id: 'conquistas', label: 'Conquistas' },
];

const VALID_TABS = new Set<string>(TABS.map((t) => t.id));

const ICON_MAP: Record<string, { color: string; bg: string }> = {
  'fa-fire': { color: 'text-amber-400', bg: 'bg-amber-500/15' },
  'fa-shopping-bag': { color: 'text-orange-400', bg: 'bg-orange-500/15' },
  'fa-store': { color: 'text-violet-400', bg: 'bg-violet-500/15' },
  'fa-trophy': { color: 'text-yellow-400', bg: 'bg-yellow-500/15' },
  'fa-dice': { color: 'text-blue-400', bg: 'bg-blue-500/15' },
  'fa-thermometer-half': { color: 'text-rose-400', bg: 'bg-rose-500/15' },
  'fa-gift': { color: 'text-pink-400', bg: 'bg-pink-500/15' },
  'fa-heart': { color: 'text-pink-400', bg: 'bg-pink-500/15' },
  'fa-bell': { color: 'text-white/60', bg: 'bg-white/10' },
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
    () =>
      notificacoes
        .filter((n) => filtrarPorAba(n, tab))
        // Já vêm orderBy timestamp desc — mantém só as 10 mais recentes da aba
        .slice(0, 10),
    [notificacoes, tab],
  );

  // Ao abrir a tela, marca todas as não lidas (qualquer aba) —
  // assim o badge do Início some junto com a lista.
  const allUnreadIdsKey = useMemo(
    () =>
      notificacoes
        .filter((n) => !isNotificacaoLida(n))
        .map((n) => n.id)
        .sort()
        .join(','),
    [notificacoes],
  );

  useEffect(() => {
    if (!allUnreadIdsKey) return;
    const ids = new Set(allUnreadIdsKey.split(','));
    const atuais = useAppStore.getState().notificacoes;
    const naoLidas = atuais.filter(
      (n) => ids.has(n.id) && !isNotificacaoLida(n),
    );
    if (!naoLidas.length) return;
    marcarNotificacoesComoLidas(naoLidas).catch((err) => {
      console.error('[NotificacoesPage] erro ao marcar como lidas:', err);
    });
  }, [allUnreadIdsKey]);

  return (
    <AppHeroShell
      bareSheet
      sheetClassName="space-y-4"
      hero={
        <>
          <div
            className="mb-5 flex items-center justify-center rounded-full"
            style={{
              width: 80,
              height: 80,
              background: 'rgba(255,255,255,0.12)',
              boxShadow: [
                `0 0 0 3px ${ACCENT}`,
                '0 0 0 8px rgba(244, 63, 94, 0.2)',
              ].join(', '),
            }}
          >
            <i className="fas fa-bell text-3xl text-white" />
          </div>
          <h2 className="text-[25px] font-bold leading-tight tracking-tight">
            Notificações
          </h2>
          <p className="mt-0.5 text-[15px] text-white/75 leading-snug">
            Veja as novidades do seu perfil
          </p>
        </>
      }
    >
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => set({ notificacoesTab: t.id })}
            className={clsx(
              'flex-1 py-2.5 rounded-xl text-xs font-semibold transition',
              tab === t.id
                ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                : 'text-white/50',
            )}
            style={
              tab === t.id
                ? undefined
                : {
                    background: TILE,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtradas.length === 0 ? (
        <div className="text-center py-10">
          <i className="fas fa-bell text-3xl text-white/20 mb-3" />
          <p className="text-white/40 text-sm">Nenhuma notificação aqui.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((notif) => {
            const icone = String(notif.icone ?? 'fa-bell');
            const ts = notif.timestamp as { seconds: number } | null;
            const lida = isNotificacaoLida(notif);
            const { color, bg } = ICON_MAP[icone] ?? {
              color: 'text-white/50',
              bg: 'bg-white/10',
            };

            return (
              <div
                key={notif.id}
                className={clsx(
                  'flex items-start gap-3 rounded-xl px-4 py-3 transition',
                  lida && 'opacity-50',
                )}
                style={
                  lida
                    ? {
                        background: '#222222',
                        border: '1px solid rgba(255,255,255,0.1)',
                      }
                    : {
                        background: 'rgba(244, 63, 94, 0.1)',
                        border: '1px solid rgba(244, 63, 94, 0.28)',
                        borderLeftWidth: 3,
                        borderLeftColor: ACCENT,
                      }
                }
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
                      className="w-2 h-2 rounded-full shadow-[0_0_6px_rgba(244,63,94,0.7)]"
                      style={{ background: ACCENT }}
                      aria-label="Não lida"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppHeroShell>
  );
}
