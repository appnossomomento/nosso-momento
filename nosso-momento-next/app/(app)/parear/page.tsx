'use client';

import { useState, FormEvent, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { callFunction, sendInput, FUNCTIONS } from '@/lib/firebase/functions';
import { useAppStore } from '@/lib/store/appStore';
import { trackGA, trackMeta } from '@/lib/analytics';
import { openSystemAlert } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import type { Pareamento, ConexaoAtiva } from '@/lib/types';

export default function ParearPage() {
  const router = useRouter();
  const { usuario, parceirosAtivos, conexaoAtiva, pareado, parceiroData, set } = useAppStore();

  // Quando o store já tem parceiro carregado (race condition no carregamento inicial),
  // redireciona imediatamente para /parceiro sem mostrar esta tela.
  useEffect(() => {
    if (pareado && parceiroData) {
      router.replace('/parceiro');
    }
  }, [pareado, parceiroData, router]);
  const [telefone, setTelefone] = useState('');
  const [apelido, setApelido] = useState('');
  const [loading, setLoading] = useState(false);
  const [conviteUrl, setConviteUrl] = useState('');
  const [gerandoConvite, setGerandoConvite] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const meuTelefone = usuario?.telefone ?? '(sem telefone cadastrado)';
  const isVip = usuario?.vip === true;
  const temConexoes = parceirosAtivos && parceirosAtivos.length > 0;

  function handleContinuarSemParear() {
    try {
      localStorage.setItem('allowDashboardWithoutPairing', '1');
    } catch (_) {}
    router.push('/dashboard');
  }

  function handleSelectConexao(partner: Pareamento) {
    const novaConexao: ConexaoAtiva = {
      uid: partner.uid,
      nome: partner.nome,
      fotoUrl: partner.fotoUrl ?? '',
      pareamentoId: partner.pareamentoId,
      idAmigavel: partner.pareamentoId ?? '',
      foguinhos: partner.foguinhos ?? 0,
    };
    set({
      conexaoAtiva: novaConexao,
      pareadoUid: partner.uid,
      idPareamentoAmigavel: partner.pareamentoId,
      pareado: true,
      usuario: usuario ? { ...usuario, pareadoUid: partner.uid } : usuario,
    });
    try {
      localStorage.setItem(`conexaoAtivaUid:${usuario?.uid}`, partner.uid);
    } catch (_) {}
    router.push('/parceiro');
  }

  function handleNovaConexao() {
    if (!isVip && temConexoes) {
      set({ showVipPopup: true });
      return;
    }
    setShowAddModal(true);
  }

  async function handleParear(e: FormEvent) {
    e.preventDefault();
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
      // Rate-limit check (CF retorna { ok: true } de forma neutra por segurança;
      // a validação real acontece de forma assíncrona no processInput)
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
      trackGA('initiate_pairing');
      trackMeta('InitiatePairing');
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
    setGerandoConvite(true);
    try {
      const result = await callFunction<{ token: string; url: string }>(FUNCTIONS.gerarConvite, {});
      const localUrl = `${window.location.origin}/convite/${result.token}`;
      setConviteUrl(localUrl);
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

  return (
    <div className="screen screen-pad bg-black text-white">
      {/* Header */}
      <section className="px-0 pt-11 pb-6" style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}>
        <div className="flex flex-col items-center text-center -mt-3">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mb-3">
            <i className="fas fa-heart text-2xl text-white" />
          </div>
          <h2 className="text-xl font-semibold">Pareamento</h2>
          <p className="text-sm text-white/80">
            {isVip ? 'Modo Poliamor ativo' : 'Conecte-se com seu parceiro'}
          </p>
        </div>
      </section>

      <section className="px-5 pt-4 pb-8 space-y-4">

        {/* ── Minhas Conexões (só aparece se já tiver conexões) ── */}
        {temConexoes && (
          <div className="space-y-3">
            {/* Cabeçalho com badge */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white/80">Minhas Conexões</p>
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

            {/* Cards de parceiros */}
            {parceirosAtivos.map((p) => {
              const isAtivo = conexaoAtiva?.uid === p.uid;
              return (
                <button
                  key={p.uid}
                  onClick={() => handleSelectConexao(p)}
                  className="w-full rounded-2xl p-4 flex items-center gap-4 transition text-left"
                  style={
                    isAtivo
                      ? { background: 'linear-gradient(135deg,rgba(255,45,63,0.20),rgba(255,85,101,0.12))', border: '1px solid rgba(255,45,63,0.45)' }
                      : { background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }
                  }
                >
                  {/* Foto */}
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

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{p.nome}</p>
                    <p className="text-xs text-white/50 mt-0.5">
                      {p.foguinhos ?? 0} 🔥 foguinhos
                    </p>
                  </div>

                  {/* Status / seta */}
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

            {/* Botão adicionar nova conexão */}
            <button
              onClick={handleNovaConexao}
              className="w-full rounded-2xl p-4 flex items-center gap-3 transition"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px dashed rgba(255,255,255,0.15)' }}
            >
              <div className="w-10 h-10 rounded-xl bg-pink-500/15 flex items-center justify-center">
                <i className="fas fa-plus text-pink-400" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-white/70">Nova Conexão</p>
                <p className="text-xs text-white/40">{isVip ? 'Adicionar parceiro' : 'Requer plano VIP'}</p>
              </div>
              {!isVip && (
                <i className="fas fa-crown text-yellow-400/60 text-sm ml-auto" />
              )}
            </button>
          </div>
        )}

        {/* ── Formulário (só exibido inline quando não há conexões ainda) ── */}
        {!temConexoes && (
          <>
            {/* Seu telefone */}
            <div className="rounded-2xl bg-white/10 p-5">
              <p className="text-xs text-white/60 mb-1">Seu número (compartilhe com seu parceiro)</p>
              <p className="text-lg font-bold tracking-wide text-pink-400">{meuTelefone}</p>
            </div>

            {/* Convite via link */}
            <button
              onClick={handleGerarConvite}
              disabled={gerandoConvite}
              className="rounded-2xl bg-white/10 p-5 w-full text-left hover:bg-white/20 transition disabled:opacity-60"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                  <i className="fas fa-link text-pink-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Convide seu amor</p>
                  <p className="text-xs text-white/60">{gerandoConvite ? 'Gerando...' : 'Gerar e copiar link de convite'}</p>
                </div>
              </div>
            </button>

            {/* URL do convite gerado */}
            {conviteUrl && (
              <div className="rounded-2xl bg-pink-500/10 border border-pink-500/20 p-4">
                <p className="text-xs text-pink-400 font-semibold mb-1">Link gerado (copiado!):</p>
                <p className="text-xs text-white/70 break-all">{conviteUrl}</p>
              </div>
            )}

            {/* Formulário de telefone */}
            <form onSubmit={handleParear} className="rounded-2xl bg-white/10 p-5 space-y-3">
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

            <button
              onClick={handleContinuarSemParear}
              className="w-full text-center text-xs text-white/40 hover:text-white/60 transition py-2"
            >
              Continuar sem parear por enquanto
            </button>
          </>
        )}
      </section>

      {/* ── Popup: Nova Conexão (VIP) ── */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl overflow-hidden"
            style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5" style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.20)' }}>
                  <i className="fas fa-plus text-white text-sm" />
                </div>
                <div>
                  <p className="text-white/70 text-xs uppercase tracking-widest">VIP · Poliamor</p>
                  <h3 className="text-white font-bold text-base leading-tight">Nova Conexão</h3>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(0,0,0,0.20)' }}
              >
                <i className="fas fa-times text-white text-sm" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="p-5 space-y-3 pb-10">
              {/* Seu telefone */}
              <div className="rounded-2xl bg-white/10 p-5">
                <p className="text-xs text-white/60 mb-1">Seu número (compartilhe com seu parceiro)</p>
                <p className="text-lg font-bold tracking-wide text-pink-400">{meuTelefone}</p>
              </div>

              {/* Convite via link */}
              <button
                onClick={handleGerarConvite}
                disabled={gerandoConvite}
                className="rounded-2xl bg-white/10 p-5 w-full text-left hover:bg-white/20 transition disabled:opacity-60"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-500/20 flex items-center justify-center">
                    <i className="fas fa-link text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Convide seu amor</p>
                    <p className="text-xs text-white/60">{gerandoConvite ? 'Gerando...' : 'Gerar e copiar link de convite'}</p>
                  </div>
                </div>
              </button>

              {/* URL do convite gerado */}
              {conviteUrl && (
                <div className="rounded-2xl bg-pink-500/10 border border-pink-500/20 p-4">
                  <p className="text-xs text-pink-400 font-semibold mb-1">Link gerado (copiado!):</p>
                  <p className="text-xs text-white/70 break-all">{conviteUrl}</p>
                </div>
              )}

              {/* Formulário de telefone */}
              <form onSubmit={handleParear} className="rounded-2xl bg-white/10 p-5 space-y-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
