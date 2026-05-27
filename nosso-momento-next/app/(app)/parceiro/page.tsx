'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import clsx from 'clsx';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { openSystemConfirm } from '@/components/ui/Modal';
import { useWeeklyChallenge } from '@/lib/hooks/useWeeklyChallenge';

const HUMORES = [
  { key: 'muito_feliz', emoji: '😍', label: 'Muito Feliz', delta: '+2 🔥' },
  { key: 'feliz', emoji: '🥰', label: 'Feliz', delta: '+1 🔥' },
  { key: 'normal', emoji: '😐', label: 'Normal', delta: '0' },
  { key: 'triste', emoji: '😢', label: 'Triste', delta: '-1 🔥' },
] as const;

const HUMOR_EMOJI: Record<string, string> = {
  muito_feliz: '😍', feliz: '🥰', normal: '😐', triste: '😢',
};

const METAS_DIAS = [30, 100, 180, 365, 500, 730, 1000, 1500, 2000];

function calcTempoJunto(pareadoDesde: string | null | undefined): {
  texto: string;
  dias: number;
  dataFormatada: string;
} | null {
  if (!pareadoDesde) return null;
  const inicio = new Date(pareadoDesde);
  if (isNaN(inicio.getTime())) return null;

  const agora = new Date();
  const diffDias = Math.floor((agora.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDias < 0) return null;

  const anos = Math.floor(diffDias / 365);
  const mesesRest = Math.floor((diffDias % 365) / 30);
  const diasRest = diffDias % 30;

  const partes: string[] = [];
  if (anos > 0) partes.push(`${anos} ${anos === 1 ? 'ano' : 'anos'}`);
  if (mesesRest > 0) partes.push(`${mesesRest} ${mesesRest === 1 ? 'mês' : 'meses'}`);
  if (diasRest > 0 || partes.length === 0) partes.push(`${diasRest} ${diasRest === 1 ? 'dia' : 'dias'}`);

  const texto = partes.length > 1
    ? partes.slice(0, -1).join(', ') + ' e ' + partes[partes.length - 1]
    : partes[0];

  return { texto, dias: diffDias, dataFormatada: inicio.toLocaleDateString('pt-BR') };
}

export default function ParceiroPage() {
  const router = useRouter();
  const {
    parceiroData,
    pareado,
    parceiroNome,
    usuario,
    pareadoUid,
    parceirosAtivos,
    climaHoje,
    climaPartnerHoje,
    climaSemana,
    set,
  } = useAppStore();

  const [submetendo, setSubmetendo] = useState(false);
  useWeeklyChallenge();

  if (!pareado || !parceiroData) {
    return (
      <div className="screen screen-pad bg-black text-white flex flex-col items-center justify-center text-center px-8">
        <i className="fas fa-heart text-red-400 text-5xl mb-6" />
        <h2 className="text-xl font-bold mb-2">Nenhuma conexão ativa</h2>
        <p className="text-white/50 text-sm mb-6">Pareie com seu parceiro para acessar esta área.</p>
        <Link href="/parear" className="btn-red px-8 py-3 rounded-xl text-sm font-semibold">
          Parear agora
        </Link>
      </div>
    );
  }

  const nome = parceiroData.nome || 'Parceiro';
  const foto = parceiroData.fotoUrl;
  const parAtivo = parceirosAtivos.find((p) => p.uid === (pareadoUid || parceiroData.uid));
  const foguinhosHeader = Number(parAtivo?.foguinhos ?? usuario?.foguinhos ?? 0);
  const jaFezClima = !!climaHoje;
  const partnerTriste = climaPartnerHoje?.humor === 'triste';
  const meuFoto = usuario?.fotoUrl ?? '/assets/icons/iconprincipal.png';

  // ── Timeline (tempo junto) ──────────────────────────────────
  // pareadoDesde está em pareamentosAtivos[i].pareadoDesde (não no nível raiz do doc)
  const usuarioRecord = usuario as unknown as Record<string, unknown> | null;
  const pareamentosAtivos = usuarioRecord?.pareamentosAtivos as Array<Record<string, unknown>> | undefined;
  const entradaParceiro = pareamentosAtivos?.find(
    (e) => e.uid === parceiroData.uid || e.uid === usuario?.pareadoUid
  );
  const pareadoDesdeSrc =
    (entradaParceiro?.pareadoDesde as string | null | undefined) ??
    usuarioRecord?.pareadoDesde as string | null | undefined;
  const tc = calcTempoJunto(pareadoDesdeSrc);

  // ── Dias da semana (SP UTC-3) ──────────────────────────────
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const hojeUTC = agora.toISOString().slice(0, 10);

  // Se climaSemana ainda não carregou, gera 7 dias placeholder
  const LABELS_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const semanaVisivel = climaSemana.length > 0 ? climaSemana : (() => {
    const dayOfWeek = agora.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayMs = agora.getTime() + diffToMonday * 86400000;
    const mondayDate = new Date(mondayMs);
    const mondayNorm = Date.UTC(mondayDate.getUTCFullYear(), mondayDate.getUTCMonth(), mondayDate.getUTCDate());
    return Array.from({ length: 7 }, (_, i) => {
      const dia = new Date(mondayNorm + i * 86400000).toISOString().slice(0, 10);
      return { data: dia, label: LABELS_SEMANA[i], humor: null, partnerHumor: null, isHoje: dia === hojeUTC };
    });
  })();

  async function handleSubmitClima(humor: string) {
    if (jaFezClima || submetendo) return;
    if (!parceiroData?.uid || !(parceiroData as Record<string, unknown>).pareamentoId) {
      showToast('Erro: conexão sem ID de pareamento.', 'erro');
      return;
    }
    setSubmetendo(true);
    try {
      await sendInput('clima_update', {
        partnerUid: parceiroData.uid,
        pareamentoId: (parceiroData as Record<string, unknown>).pareamentoId,
        humor,
      });
      set({
        climaHoje: { humor, registradoEm: new Date() },
        climaSemana: climaSemana.map((d) =>
          d.data === hojeUTC ? { ...d, humor } : d
        ),
      });
      showToast('Clima registrado! 🔥', 'sucesso');
    } catch {
      showToast('Erro ao registrar clima.', 'erro');
    } finally {
      setSubmetendo(false);
    }
  }

  function handleDesfazerPareamento() {
    openSystemConfirm(
      'Tem certeza que quer desfazer o pareamento?',
      async () => {
        if (!parceiroData) return;
        try {
          await sendInput('pairing_unpair', {
            partnerUid: parceiroData.uid,
            partnerPhone: parceiroData.telefone,
            pareamentoId: (parceiroData as Record<string, unknown>).pareamentoId,
          });
          set({ pareado: false, parceiroData: null, parceiroNome: null, pareadoUid: null });
          showToast('Pareamento desfeito.', 'sucesso');
          router.push('/parear');
        } catch {
          showToast('Erro ao desfazer pareamento.', 'erro');
        }
      },
      'Desfazer',
      'Cancelar'
    );
  }

  return (
    <div className="screen bg-black text-white pb-28">
      {/* Header gradient — igual ao buildParceiroHeaderHtml('gradient') do index */}
      <div
        className="flex-shrink-0 px-4 pb-3 flex items-center gap-3 w-full sticky top-0 z-30"
        style={{ background: 'linear-gradient(180deg,#ff2d3f 0%,#ff5565 100%)', boxShadow: '0 4px 20px rgba(255,45,63,0.35)', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)' }}
      >
        <button
          onClick={() => router.push('/dashboard')}
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.20)' }}
        >
          <i className="fas fa-arrow-left text-white text-sm" />
        </button>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div
            className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
            style={{ border: '2px solid rgba(255,255,255,0.40)', background: 'rgba(0,0,0,0.20)' }}
          >
            {foto ? (
              <Image src={foto} alt={nome} width={36} height={36} className="w-full h-full object-cover" />
            ) : (
              <i className="fas fa-user text-white/70 text-xs" />
            )}
          </div>
          <p className="text-sm font-bold text-white truncate">{nome}</p>
        </div>
        <div
          className="flex items-center gap-1.5 flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.20)', borderRadius: 20, padding: '4px 10px' }}
        >
          <i className="fas fa-fire text-white text-sm" />
          <span className="text-sm font-bold text-white">{foguinhosHeader}</span>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Alerta parceiro triste */}
        {partnerTriste && (
          <div className="rounded-xl bg-red-900/40 border border-red-700/40 text-red-200 text-sm px-4 py-3 flex items-center gap-3">
            <i className="fas fa-heart-crack" />
            <span><strong>{nome}</strong> marcou &ldquo;Triste&rdquo; hoje. Que tal um carinho?</span>
          </div>
        )}

        {/* Timeline — Tempo juntos */}
        {tc && (() => {
          const proximaMeta = METAS_DIAS.find((m) => m > tc.dias);
          const progressoPct = proximaMeta ? Math.min(100, Math.round((tc.dias / proximaMeta) * 100)) : 100;
          const diasParaMeta = proximaMeta ? proximaMeta - tc.dias : null;
          return (
            <div
              className="p-5 text-center"
              style={{
                background: 'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, rgba(255,45,63,0.50), rgba(255,106,120,0.34), rgba(255,45,63,0.20)) border-box',
                border: '1px solid transparent',
                borderRadius: 20,
                boxShadow: '0 10px 28px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,85,101,0.10), 0 0 20px rgba(255,73,106,0.16)',
              }}
            >
              <img src="/assets/icons/iconprincipal.png" alt="Nosso Momento" style={{ width: 48, height: 48, margin: '0 auto 8px', objectFit: 'contain', filter: 'drop-shadow(0 0 8px rgba(255,73,106,0.55))' }} />
              <p className="text-2xl font-bold leading-tight text-white">{tc.texto}</p>
              <p className="text-xs mt-1" style={{ color: '#9a9ba4' }}>sintonizados desde {tc.dataFormatada}</p>
              {proximaMeta ? (
                <div className="mt-3 px-1">
                  <div className="flex justify-between text-[10px] mb-1.5" style={{ color: 'rgba(255,255,255,0.40)' }}>
                    <span>{tc.dias} dias juntos</span>
                    <span>Meta: {proximaMeta} dias · faltam {diasParaMeta}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progressoPct}%`, background: 'linear-gradient(90deg,#ff2d3f,#ff6a78)' }}
                    />
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold mt-2" style={{ color: '#ff6a78' }}>🏆 Mais de 2000 dias juntos!</p>
              )}
            </div>
          );
        })()}

        {/* Check-in de clima */}
        <div
          className="rounded-[20px] p-4"
          style={{
            background: 'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, rgba(255,45,63,0.50), rgba(255,106,120,0.34), rgba(255,45,63,0.20)) border-box',
            border: '1px solid transparent',
            boxShadow: '0 10px 28px rgba(0,0,0,0.48), 0 0 0 1px rgba(255,85,101,0.10), 0 0 20px rgba(255,73,106,0.16)',
          }}
        >
          <h3 className="text-sm font-semibold text-white/90 mb-1 flex items-center gap-2">
            <i className="fas fa-thermometer-half text-red-400" />
            Como você está hoje?
            <Link
              href="/clima"
              className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-semibold text-white/60 hover:text-white transition-colors flex-shrink-0"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <i className="fas fa-chart-line text-[9px]" />
              Histórico
            </Link>
          </h3>
          <p className="text-xs text-white/50 mb-3">
            {jaFezClima ? `Você marcou ${HUMOR_EMOJI[climaHoje!.humor] ?? ''} hoje.` : 'Marque e seu parceiro ganha foguinhos!'}
          </p>
          <div className="flex gap-2">
            {HUMORES.map((h) => {
              const isActive = jaFezClima && climaHoje?.humor === h.key;
              return (
                <button
                  key={h.key}
                  onClick={() => handleSubmitClima(h.key)}
                  disabled={jaFezClima || submetendo}
                  className={clsx(
                    'termometro-btn flex-1 flex flex-col items-center gap-1 py-3',
                    isActive ? 'active' : ''
                  )}
                >
                  <span className="text-2xl">{h.emoji}</span>
                  <span className={clsx('text-[10px] font-semibold', isActive ? 'text-gray-600' : 'text-white/70')}>{h.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tracking semanal — sempre visível, fundo vermelho igual ao index.html */}
        <div
          className="rounded-2xl p-4 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 60%,#ff7080 100%)',
            boxShadow: '0 4px 12px rgba(255,45,63,0.20)',
          }}
        >
          {/* Labels dos dias */}
          <div className="flex items-center gap-1 mb-2">
            <div className="w-8 shrink-0" />
            <div className="flex flex-1">
              {semanaVisivel.map((dia, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  <span
                    className="text-[10px] font-bold uppercase"
                    style={{ color: dia.isHoje ? '#fff' : 'rgba(0,0,0,0.65)' }}
                  >
                    {dia.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Eu */}
          <div className="flex items-center gap-1 mb-2">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: '2px solid rgba(0,0,0,0.30)' }}
            >
              <Image src={meuFoto} alt="Eu" width={32} height={32} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-1">
              {semanaVisivel.map((dia, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  {dia.humor ? (
                    <span style={{ fontSize: 27, lineHeight: 1 }}>{HUMOR_EMOJI[dia.humor]}</span>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', border: '2px solid rgba(0,0,0,0.30)', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
          {/* Parceiro */}
          <div className="flex items-center gap-1">
            <div
              className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0"
              style={{ border: '2px solid rgba(0,0,0,0.30)', background: 'rgba(0,0,0,0.20)' }}
            >
              {foto ? (
                <Image src={foto} alt={nome} width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="fas fa-user text-xs text-white" />
                </div>
              )}
            </div>
            <div className="flex flex-1">
              {semanaVisivel.map((dia, i) => (
                <div key={i} className="flex flex-col items-center flex-1">
                  {dia.partnerHumor ? (
                    <span style={{ fontSize: 27, lineHeight: 1 }}>{HUMOR_EMOJI[dia.partnerHumor]}</span>
                  ) : (
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.18)', border: '2px solid rgba(0,0,0,0.30)', flexShrink: 0 }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ações rápidas — estilo .perfil-parceiro-card.action-premium */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { href: '/loja', icon: 'fa-store', label: 'Catálogo', catalog: true },
            { href: '/personalizar', icon: 'fa-tags', label: 'Personalizar', catalog: false },
            { href: '/momentos', icon: 'fa-heart', label: 'Momentos', catalog: false },
            { href: '/extrato', icon: 'fa-fire', label: 'Extrato', catalog: false },
            { href: '/desafios', icon: 'fa-trophy', label: 'Desafios', catalog: false },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="p-4 text-center flex flex-col items-center gap-2 transition active:scale-95 rounded-[20px]"
              style={a.catalog ? {
                background: 'linear-gradient(#1f2024, #1f2024) padding-box, linear-gradient(135deg, rgba(255,145,42,0.68), rgba(255,190,100,0.46), rgba(255,145,42,0.24)) border-box',
                border: '1px solid transparent',
                boxShadow: '0 11px 30px rgba(0,0,0,0.52), 0 0 0 1px rgba(255,165,79,0.20), 0 0 26px rgba(255,152,72,0.24)',
              } : {
                background: 'linear-gradient(#1e1f25, #1e1f25) padding-box, linear-gradient(135deg, rgba(255,45,63,0.58), rgba(255,106,120,0.40), rgba(255,45,63,0.23)) border-box',
                border: '1px solid transparent',
                boxShadow: '0 11px 30px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,85,101,0.14), 0 0 24px rgba(255,73,106,0.21)',
              }}
            >
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center"
                style={a.catalog ? {
                  background: 'rgba(255,145,42,0.14)',
                  boxShadow: '0 0 16px rgba(255,163,82,0.46), inset 0 0 7px rgba(255,163,82,0.16)',
                } : {
                  background: 'rgba(255,45,63,0.12)',
                  boxShadow: '0 0 14px rgba(255,73,106,0.38), inset 0 0 6px rgba(255,73,106,0.12)',
                }}
              >
                <i
                  className={`fas ${a.icon} text-lg`}
                  style={a.catalog ? {
                    color: '#ffb86a',
                    filter: 'drop-shadow(0 0 6px rgba(255,167,87,0.95))',
                  } : {
                    color: '#ff6a78',
                    filter: 'drop-shadow(0 0 5px rgba(255,73,106,0.85))',
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-white/80">{a.label}</span>
            </Link>
          ))}
        </div>

        {/* Instagram CTA */}
        <button
          onClick={() => set({ showInstagramModal: true })}
          className="w-full rounded-2xl p-4 text-sm font-medium flex items-center justify-center gap-2 transition active:scale-95"
          style={{
            background: 'linear-gradient(#1a1b20, #1a1b20) padding-box, linear-gradient(135deg, #ec4899, #ef4444) border-box',
            border: '1px solid transparent',
          }}
        >
          <i className="fab fa-instagram text-pink-400" />
          <span className="text-white/80">Siga-nos no Instagram!</span>
        </button>

        {/* Desfazer pareamento */}
        <button
          onClick={handleDesfazerPareamento}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm font-medium hover:bg-red-500/20 transition"
        >
          <i className="fas fa-link-slash mr-2" />Desfazer Pareamento
        </button>
      </div>
    </div>
  );
}
