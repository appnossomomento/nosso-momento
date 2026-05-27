'use client';

import { useEffect, useRef, useState } from 'react';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput, callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { formatDateRelative } from '@/lib/utils/formatDate';
import clsx from 'clsx';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';
import { trackGA, trackMeta } from '@/lib/analytics';

interface TarefaMomento {
  id: string;
  momentoNome: string;
  status: string;
  dataResgate: { seconds: number } | null;
  fromUid?: string;
  toUid?: string;
  idPareamento?: string;
}

type Tab = 'recebidos' | 'enviados';

export default function MomentosPage() {
  const { usuario, idPareamentoAmigavel } = useAppStore();
  const [tab, setTab] = useState<Tab>('recebidos');
  const [momentos, setMomentos] = useState<TarefaMomento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [realizandoMomento, setRealizandoMomento] = useState<TarefaMomento | null>(null);
  const [realizandoFoto, setRealizandoFoto] = useState<File | null>(null);
  const [realizandoFotoPreview, setRealizandoFotoPreview] = useState<string | null>(null);
  const [realizandoEnviando, setRealizandoEnviando] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const uid = usuario?.uid ?? null;

  useEffect(() => {
    if (!uid || !idPareamentoAmigavel) return;
    async function fetchMomentos() {
      setCarregando(true);
      try {
        const queryField = tab === 'recebidos' ? 'executadoPorUid' : 'resgatadoPorUid';
        const q = query(
          collection(db, 'tarefasMomentos'),
          where(queryField, '==', uid),
          where('idPareamento', '==', idPareamentoAmigavel),
          orderBy('dataResgate', 'desc'),
          limit(30)
        );
        const snap = await getDocs(q);
        setMomentos(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as TarefaMomento))
        );
      } catch {
        showToast('Erro ao carregar momentos.', 'erro');
      } finally {
        setCarregando(false);
      }
    }
    fetchMomentos();
  }, [uid, idPareamentoAmigavel, tab]);

  function abrirConfirmacao(m: TarefaMomento) {
    setRealizandoMomento(m);
    setRealizandoFoto(null);
    setRealizandoFotoPreview(null);
  }

  function fecharConfirmacao() {
    setRealizandoMomento(null);
    setRealizandoFoto(null);
    setRealizandoFotoPreview(null);
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setRealizandoFoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setRealizandoFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function confirmarRealizado() {
    if (!realizandoMomento || realizandoEnviando) return;
    setRealizandoEnviando(true);
    try {
      let fotoUrl: string | null = null;
      if (realizandoFoto && uid) {
        const sRef = storageRef(storage, `memorias/${idPareamentoAmigavel}/${Date.now()}_${realizandoFoto.name}`);
        const snap = await uploadBytes(sRef, realizandoFoto);
        fotoUrl = await getDownloadURL(snap.ref);
      }

      await sendInput('moment_complete', {
        pareamentoId: idPareamentoAmigavel,
        tarefaId: realizandoMomento.id,
      });
      trackGA('complete_moment');
      trackMeta('CompleteMoment');

      if (fotoUrl) {
        await callFunction(FUNCTIONS.createMemoriaPhoto, {
          pareamentoId: idPareamentoAmigavel,
          fotoUrl,
          momentoNome: realizandoMomento.momentoNome,
          categoria: 'Lovezin',
        });
      }

      setMomentos((prev) =>
        prev.map((m) => (m.id === realizandoMomento.id ? { ...m, status: 'realizado' } : m))
      );
      showToast(fotoUrl ? '🔥 Momento realizado e memória registrada!' : '🔥 Momento marcado como realizado!', 'sucesso');
      fecharConfirmacao();
    } catch {
      showToast('Erro ao confirmar momento.', 'erro');
    } finally {
      setRealizandoEnviando(false);
    }
  }

  return (
    <div className="screen bg-black text-white pb-28">
      <ParceiroHeader />

      {/* Hero section — igual ao _momentosHero do index.html */}
      <section
        className="px-6 pt-10 pb-28 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}
      >
        <div className="flex flex-col items-center text-center" style={{ marginTop: -8 }}>
          <i className="fas fa-heart text-3xl text-white mb-3" />
          <h2 className="text-3xl font-semibold text-white">Momentos</h2>
          <p className="text-white/80">Recebidos e enviados</p>
        </div>
      </section>

      <section className="px-5 pb-8 -mt-10">
        <div className="rounded-[28px] bg-[#0f0b14] p-4 shadow-lg space-y-4">
          {/* Tabs */}
          <div className="flex gap-2">
            {(['recebidos', 'enviados'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={clsx(
                  'flex-1 py-2.5 rounded-xl text-xs font-semibold transition capitalize',
                  tab === t ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' : 'bg-white/5 text-white/50'
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Content */}
          {carregando ? (
            <div className="text-center py-10 text-white/40 text-sm">Carregando...</div>
          ) : momentos.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">🛍️</div>
              <p className="text-white/40 text-sm">Nenhum momento {tab}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {momentos.map((m) => {
                const dataStr = m.dataResgate
                  ? formatDateRelative(new Date(m.dataResgate.seconds * 1000))
                  : null;
                const realizado = m.status === 'realizado';
                return (
                  <div
                    key={m.id}
                    className="rounded-xl bg-white/8 border border-white/10 px-4 py-3 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center shrink-0">
                      <i className={clsx('fas text-base text-white', realizado ? 'fa-fire' : 'fa-clock')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{m.momentoNome}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full', realizado ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-300')}>
                          {realizado ? 'Realizado' : 'Pendente'}
                        </span>
                        {dataStr && <span className="text-[10px] text-white/40">{dataStr}</span>}
                      </div>
                    </div>
                    {tab === 'enviados' && !realizado && (
                      <button
                        onClick={() => abrirConfirmacao(m)}
                        className="shrink-0 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                        style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
                      >
                        ✓ Feito
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Modal: Registrar memória ao concluir momento ── */}
      {realizandoMomento && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-6 sm:pb-0"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={fecharConfirmacao}
        >
          <div
            className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            style={{ background: '#080808', border: '1px solid rgba(255,45,63,0.20)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header gradient */}
            <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,0,0,0.22)' }}
                  >
                    <i className="fas fa-fire text-white text-base" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base leading-tight">Momento Realizado!</h3>
                    <p className="text-white/70 text-xs mt-0.5 truncate">{realizandoMomento.momentoNome}</p>
                  </div>
                </div>
                <button
                  onClick={fecharConfirmacao}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-2"
                  style={{ background: 'rgba(0,0,0,0.22)' }}
                >
                  <i className="fas fa-times text-white text-sm" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-white/50 text-sm text-center">Quer registrar uma memória deste momento?</p>

              {/* Área de foto */}
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  background: '#111',
                  border: '1px solid rgba(255,45,63,0.22)',
                  minHeight: realizandoFotoPreview ? 0 : 140,
                }}
              >
                {realizandoFotoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={realizandoFotoPreview}
                    alt="Preview"
                    style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-8">
                    <i className="fas fa-camera text-2xl" style={{ color: 'rgba(255,45,63,0.7)' }} />
                    <span className="text-white/40 text-xs">Toque para adicionar uma foto</span>
                    <span className="text-white/20 text-[10px]">(opcional)</span>
                  </div>
                )}
              </button>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFotoChange}
              />

              {/* Botão confirmar */}
              <button
                onClick={confirmarRealizado}
                disabled={realizandoEnviando}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
              >
                {realizandoEnviando
                  ? 'Salvando...'
                  : realizandoFoto
                  ? '🔥 Confirmar com Foto'
                  : '✓ Confirmar sem Foto'}
              </button>

              {/* Botão cancelar */}
              <button
                onClick={fecharConfirmacao}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
