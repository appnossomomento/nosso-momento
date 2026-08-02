'use client';

import { useState, FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { callFunction, sendInput, FUNCTIONS } from '@/lib/firebase/functions';
import { useAppStore } from '@/lib/store/appStore';
import { setParceiroAtivo } from '@/lib/utils/setParceiroAtivo';
import { trackAction } from '@/lib/analytics';
import { openSystemAlert } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import type { Pareamento } from '@/lib/types';
import { MAX_CONEXOES_VIP, getConnectionLimit } from '@/lib/constants';
import AppHeroShell, { ACCENT, TILE } from '@/components/layout/AppHeroShell';

const TILE_SURFACE = {
  background: TILE,
  border: '1px solid rgba(255, 255, 255, 0.09)',
} as const;

function ParearFormSection({
  meuTelefone,
  telefone,
  setTelefone,
  apelido,
  setApelido,
  loading,
  gerandoConvite,
  conviteUrl,
  onGerarConvite,
  onSubmit,
  showContinuarSemParear,
  onContinuarSemParear,
}: {
  meuTelefone: string;
  telefone: string;
  setTelefone: (v: string) => void;
  apelido: string;
  setApelido: (v: string) => void;
  loading: boolean;
  gerandoConvite: boolean;
  conviteUrl: string;
  onGerarConvite: () => void;
  onSubmit: (e: FormEvent) => void;
  showContinuarSemParear?: boolean;
  onContinuarSemParear?: () => void;
}) {
  return (
    <>
      <div className="rounded-2xl p-5" style={TILE_SURFACE}>
        <p className="text-xs text-white/60 mb-1">Seu número (compartilhe com seu parceiro)</p>
        <p className="text-lg font-bold tracking-wide" style={{ color: ACCENT }}>
          {meuTelefone}
        </p>
      </div>

      <button
        type="button"
        onClick={onGerarConvite}
        disabled={gerandoConvite}
        className="rounded-2xl p-5 w-full text-left transition disabled:opacity-60 active:scale-[0.99]"
        style={TILE_SURFACE}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: 'rgba(244, 63, 94, 0.12)',
              border: '1px solid rgba(244, 63, 94, 0.2)',
            }}
          >
            <i className="fas fa-link" style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="text-sm font-semibold">Convide seu amor</p>
            <p className="text-xs text-white/60">{gerandoConvite ? 'Gerando...' : 'Gerar e copiar link de convite'}</p>
          </div>
        </div>
      </button>

      {conviteUrl && (
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'rgba(244, 63, 94, 0.08)',
            border: '1px solid rgba(244, 63, 94, 0.22)',
          }}
        >
          <p className="text-xs font-semibold mb-1" style={{ color: ACCENT }}>
            Link gerado (copiado!):
          </p>
          <p className="text-xs text-white/70 break-all">{conviteUrl}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="rounded-2xl p-5 space-y-3" style={TILE_SURFACE}>
        <p className="text-sm font-semibold">Parear pelo número do parceiro</p>
        <input
          type="tel"
          placeholder="Telefone do parceiro (ex: 11999991111)"
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          maxLength={14}
          inputMode="numeric"
        />
        <input
          type="text"
          placeholder="Apelido carinhoso (ex: Meu amor, Fofinha...)"
          value={apelido}
          onChange={(e) => setApelido(e.target.value)}
          maxLength={30}
        />
        <button
          type="submit"
          disabled={loading}
          className="btn-red w-full py-3 rounded-xl text-sm disabled:opacity-60"
        >
          {loading ? 'Enviando...' : 'SOLICITAR PAREAMENTO'}
        </button>
      </form>

      {showContinuarSemParear && onContinuarSemParear && (
        <button
          type="button"
          onClick={onContinuarSemParear}
          className="w-full text-center text-xs text-white/40 hover:text-white/60 transition py-2"
        >
          Continuar sem parear por enquanto
        </button>
      )}
    </>
  );
}

export default function ParearPage() {
  const router = useRouter();
  const { usuario, parceirosAtivos, conexaoAtiva, set } = useAppStore();

  const [telefone, setTelefone] = useState('');
  const [apelido, setApelido] = useState('');
  const [loading, setLoading] = useState(false);
  const [conviteUrl, setConviteUrl] = useState('');
  const [gerandoConvite, setGerandoConvite] = useState(false);

  const meuTelefone = usuario?.telefone ?? '(sem telefone cadastrado)';
  const isVip = usuario?.vip === true;
  const temConexoes = parceirosAtivos && parceirosAtivos.length > 0;
  const conexaoCount = parceirosAtivos?.length ?? 0;
  const limiteConexoes = getConnectionLimit(isVip);
  const atMaxConnections = conexaoCount >= limiteConexoes;
  const showAdicionarSection = !temConexoes || (isVip && !atMaxConnections);

  function handleNovaConexao() {
    if (!isVip && temConexoes) {
      trackAction('seja_vip', { origem: 'parear_nova_conexao' });
      set({ showVipPopup: true });
      return;
    }
    if (isVip && atMaxConnections) {
      openSystemAlert('Limite de 5 conexões atingido.');
      return;
    }
    document.getElementById('adicionar-conexao')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function guardLimiteConexoes(): boolean {
    if (!isVip && temConexoes) {
      trackAction('seja_vip', { origem: 'parear_limite' });
      set({ showVipPopup: true });
      return false;
    }
    if (isVip && atMaxConnections) {
      openSystemAlert('Limite de 5 conexões atingido.');
      return false;
    }
    return true;
  }

  function handleContinuarSemParear() {
    try {
      localStorage.setItem('allowDashboardWithoutPairing', '1');
    } catch (_) {}
    router.push('/dashboard');
  }

  function handleSelectConexao(partner: Pareamento) {
    setParceiroAtivo(partner);
    router.push('/parceiro');
  }

  async function handleParear(e: FormEvent) {
    e.preventDefault();
    if (!guardLimiteConexoes()) return;
    const telNumero = telefone.replace(/\D/g, '');
    if (telNumero.length !== 11) {
      openSystemAlert('Digite um celular válido com DDD (11 dígitos, ex: 11999991111).');
      return;
    }
    if (!apelido.trim()) {
      openSystemAlert('Informe um apelido carinhoso para seu parceiro.');
      return;
    }
    setLoading(true);
    try {
      const check = await callFunction<{ ok: boolean }>(FUNCTIONS.verificarTelefone, {
        telefone: telNumero,
      });
      if (!check.ok) {
        openSystemAlert('Não foi possível verificar o número. Tente novamente.');
        return;
      }
      await sendInput('pairing_request', {
        fromName: usuario?.nome ?? '',
        fromPhone: usuario?.telefone ?? '',
        toPhone: telNumero,
        apelido: apelido.trim(),
      });
      showToast('Solicitação enviada! Aguarde seu parceiro aceitar.', 'sucesso');
      trackAction('pareamento_manual');
      setTelefone('');
      setApelido('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('429')) {
        openSystemAlert('Muitas tentativas. Aguarde um momento e tente novamente.');
      } else if (msg.includes('401') || msg.includes('autenticado')) {
        openSystemAlert('Sessão expirada. Faça login novamente.');
      } else {
        openSystemAlert('Não foi possível enviar a solicitação. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleGerarConvite() {
    if (!guardLimiteConexoes()) return;
    setGerandoConvite(true);
    try {
      const result = await callFunction<{ token: string; url: string }>(FUNCTIONS.gerarConvite, {});
      const localUrl = `${window.location.origin}/convite/${result.token}`;
      setConviteUrl(localUrl);
      trackAction('pareamento_link', { stage: 'gerado' });
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Nosso Momento 💛',
            text: 'Você foi convidado(a) para o nosso espaço juntos!',
            url: localUrl,
          });
        } catch (shareErr) {
          if ((shareErr as Error).name !== 'AbortError') {
            await navigator.clipboard.writeText(localUrl);
            showToast('Link de convite copiado!', 'sucesso');
          }
        }
      } else {
        try { await navigator.clipboard.writeText(localUrl); } catch (_) {}
        showToast('Link de convite copiado!', 'sucesso');
      }
    } catch (_) {
      showToast('Não foi possível gerar o convite.', 'erro');
    } finally {
      setGerandoConvite(false);
    }
  }

  const formProps = {
    meuTelefone,
    telefone,
    setTelefone,
    apelido,
    setApelido,
    loading,
    gerandoConvite,
    conviteUrl,
    onGerarConvite: handleGerarConvite,
    onSubmit: handleParear,
  };

  return (
    <AppHeroShell
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
            <i className="fas fa-heart text-3xl text-white" />
          </div>
          <h2 className="text-[25px] font-bold leading-tight tracking-tight">
            Pareamentos
          </h2>
          <p className="mt-0.5 text-[15px] text-white/75 leading-snug px-4">
            {isVip ? 'Gerencie até 5 conexões' : 'Conecte-se com seu parceiro'}
          </p>
        </>
      }
    >
        {temConexoes && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white/80">Minhas Conexões</p>
              <div className="flex items-center gap-2">
                {isVip && (
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-white/70">
                    {conexaoCount}/{MAX_CONEXOES_VIP}
                  </span>
                )}
                <span
                  className="text-[10px] font-bold px-2.5 py-1 rounded-full"
                  style={
                    isVip
                      ? { background: 'linear-gradient(135deg,#7c3aed,#a855f7)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.55)' }
                  }
                >
                  {isVip ? '✦ POLIAMOR' : 'MONOGAMIA'}
                </span>
              </div>
            </div>

            {parceirosAtivos.map((p) => {
              const isAtivo = conexaoAtiva?.uid === p.uid;
              return (
                <button
                  key={p.uid}
                  onClick={() => handleSelectConexao(p)}
                  className="w-full rounded-2xl p-4 flex items-center gap-4 transition text-left active:scale-[0.99]"
                  style={
                    isAtivo
                      ? {
                          background: 'rgba(244, 63, 94, 0.14)',
                          border: `1px solid ${ACCENT}`,
                        }
                      : TILE_SURFACE
                  }
                >
                  <div className="relative flex-shrink-0">
                    {p.fotoUrl ? (
                      <Image
                        src={p.fotoUrl}
                        alt={p.nome}
                        width={52}
                        height={52}
                        className="w-13 h-13 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-[52px] h-[52px] rounded-2xl bg-white/10 flex items-center justify-center">
                        <i className="fas fa-user text-white/40 text-xl" />
                      </div>
                    )}
                    {isAtivo && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-400 border-2 border-black" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.nome}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {p.foguinhos ?? 0} 🔥 foguinhos
                    </p>
                  </div>

                  {isAtivo ? (
                    <span className="text-[10px] font-bold text-green-400 bg-green-400/15 px-2.5 py-1 rounded-full flex-shrink-0">
                      Ativo
                    </span>
                  ) : (
                    <i className="fas fa-chevron-right text-white/30 text-sm flex-shrink-0" />
                  )}
                </button>
              );
            })}

            {!isVip && temConexoes &&
              Array.from({ length: MAX_CONEXOES_VIP - 1 }, (_, i) => i + 2).map((slot) => (
                <div
                  key={`locked-${slot}`}
                  className="w-full rounded-2xl p-4 flex items-center gap-3 opacity-50"
                  style={{
                    background: TILE,
                    border: '1px dashed rgba(255,255,255,0.12)',
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                    <i className="fas fa-lock text-white/30 text-sm" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm text-white/40">Conexão {slot}</p>
                    <p className="text-xs text-white/25">Disponível no plano VIP</p>
                  </div>
                  <i className="fas fa-crown text-yellow-400/40 text-sm ml-auto" />
                </div>
              ))}

            <button
              type="button"
              onClick={handleNovaConexao}
              disabled={isVip && atMaxConnections}
              className="w-full rounded-2xl p-4 flex items-center gap-3 transition disabled:opacity-40"
              style={{
                background: TILE,
                border: '1px dashed rgba(255,255,255,0.18)',
              }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(244, 63, 94, 0.12)' }}
              >
                <i
                  className={`fas ${isVip && atMaxConnections ? 'fa-ban' : 'fa-plus'}`}
                  style={{ color: ACCENT }}
                />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white/70">Nova Conexão</p>
                <p className="text-xs text-white/40">
                  {isVip
                    ? atMaxConnections
                      ? 'Limite de 5 conexões atingido'
                      : 'Adicionar parceiro'
                    : 'Requer plano VIP'}
                </p>
              </div>
              {!isVip && (
                <i className="fas fa-crown text-yellow-400/60 text-sm ml-auto" />
              )}
            </button>
          </div>
        )}

        {showAdicionarSection && (
          <div id="adicionar-conexao" className="space-y-4 scroll-mt-4">
            {temConexoes && (
              <p className="text-sm font-semibold text-white/80 pt-2">Adicionar conexão</p>
            )}
            <ParearFormSection
              {...formProps}
              showContinuarSemParear={!temConexoes}
              onContinuarSemParear={handleContinuarSemParear}
            />
          </div>
        )}
    </AppHeroShell>
  );
}
