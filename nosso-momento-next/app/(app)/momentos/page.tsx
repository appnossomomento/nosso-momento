'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput, callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { formatDateRelative } from '@/lib/utils/formatDate';
import clsx from 'clsx';
import OverlayModal from '@/components/ui/OverlayModal';
import { trackAction } from '@/lib/analytics';
import {
  isStorageMediaPath,
  resolveMediaUrlMap,
} from '@/lib/utils/resolveMediaUrls';
import AppHeroShell, {
  ACCENT,
  LP_RED,
  TILE,
} from '@/components/layout/AppHeroShell';
import {
  PRAZO_DIAS_OPTIONS,
  PRAZO_DIAS_DEFAULT,
  type PrazoDiasOption,
  derivePrazoStatus,
  prazoStatusLabel,
  prazoStatusStyle,
  formatDataLimiteShort,
  computeDataLimite,
} from '@/lib/momentos/prazoStatus';

const CTA_GRAD = `linear-gradient(135deg, ${LP_RED}, ${ACCENT})`;
const CHIP_IDLE = { background: TILE, color: 'rgba(255,255,255,0.45)' } as const;
const CHIP_ON = { background: ACCENT, color: '#fff' } as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove o prefixo "data:<mime>;base64," para enviar apenas os bytes
      resolve(result.split(',')[1] ?? result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

interface TarefaMomento {
  id: string;
  momentoNome: string;
  momentoImg?: string;
  momentoEmoji?: string;
  status: string;
  dataResgate: { seconds: number } | null;
  dataLimite?: { seconds: number } | null;
  prazoDias?: number;
  penalidadeAplicadaAt?: { seconds: number } | null;
  penalidadeValor?: number | null;
  fromUid?: string;
  toUid?: string;
  idPareamento?: string;
}

type Tab = 'recebidos' | 'enviados';

export default function MomentosPage() {
  const { usuario, idPareamentoAmigavel } = useAppStore();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<Tab>('recebidos');
  const [momentos, setMomentos] = useState<TarefaMomento[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [realizandoMomento, setRealizandoMomento] = useState<TarefaMomento | null>(null);
  const [realizandoFoto, setRealizandoFoto] = useState<File | null>(null);
  const [realizandoFotoPreview, setRealizandoFotoPreview] = useState<string | null>(null);
  const [realizandoEnviando, setRealizandoEnviando] = useState(false);
  const [postergandoMomento, setPostergandoMomento] = useState<TarefaMomento | null>(null);
  const [prazoPostergar, setPrazoPostergar] = useState<PrazoDiasOption>(PRAZO_DIAS_DEFAULT);
  const [postergandoEnviando, setPostergandoEnviando] = useState(false);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const uid = usuario?.uid ?? null;

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'enviados' || t === 'recebidos') setTab(t);
  }, [searchParams]);

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
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TarefaMomento));
        const paths = rows
          .map((m) => m.momentoImg)
          .filter((v): v is string => Boolean(v && isStorageMediaPath(v)));
        if (paths.length) {
          const urls = await resolveMediaUrlMap(paths);
          for (const m of rows) {
            if (m.momentoImg && urls[m.momentoImg]) {
              m.momentoImg = urls[m.momentoImg]!;
            }
          }
        }
        setMomentos(rows);
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

  function abrirPostergar(m: TarefaMomento) {
    setPostergandoMomento(m);
    setPrazoPostergar(PRAZO_DIAS_DEFAULT);
  }

  function fecharPostergar() {
    setPostergandoMomento(null);
    setPostergandoEnviando(false);
  }

  async function confirmarPostergar() {
    if (!postergandoMomento || postergandoEnviando || !idPareamentoAmigavel) return;
    setPostergandoEnviando(true);
    try {
      await sendInput('moment_postpone', {
        pareamentoId: idPareamentoAmigavel,
        tarefaId: postergandoMomento.id,
        prazoDias: prazoPostergar,
      });
      setMomentos((prev) =>
        prev.map((row) => {
          if (row.id !== postergandoMomento.id) return row;
          const lim = computeDataLimite(prazoPostergar);
          return {
            ...row,
            prazoDias: prazoPostergar,
            dataLimite: { seconds: Math.floor(lim.getTime() / 1000) },
          };
        }),
      );
      showToast('Prazo postergado!', 'sucesso');
      fecharPostergar();
    } catch {
      showToast('Erro ao postergar prazo.', 'erro');
      setPostergandoEnviando(false);
    }
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
      // Converte a foto para base64 — o Admin SDK na CF faz o upload no Storage.
      // O client nunca escreve diretamente no Storage.
      let fotoBase64: string | null = null;
      let fotoContentType: string | null = null;
      let fotoFileName: string | null = null;
      if (realizandoFoto) {
        fotoBase64 = await fileToBase64(realizandoFoto);
        fotoContentType = realizandoFoto.type || 'image/jpeg';
        fotoFileName = realizandoFoto.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      }

      await sendInput('moment_complete', {
        pareamentoId: idPareamentoAmigavel,
        tarefaId: realizandoMomento.id,
        comFoto: !!fotoBase64,
      });
      trackAction('momento_realizado', { com_foto: !!fotoBase64 });

      if (fotoBase64) {
        // Campos exatos esperados pela CF createMemoriaPhoto:
        // tarefaId (obrigatório), base64 (obrigatório), contentType, fileName
        await callFunction(FUNCTIONS.createMemoriaPhoto, {
          tarefaId: realizandoMomento.id,
          base64: fotoBase64,
          contentType: fotoContentType,
          fileName: fotoFileName,
        });
      }

      setMomentos((prev) =>
        prev.map((m) => (m.id === realizandoMomento.id ? { ...m, status: 'realizado' } : m))
      );
      showToast(fotoBase64 ? '🔥 Momento realizado e memória registrada!' : '🔥 Momento marcado como realizado!', 'sucesso');
      fecharConfirmacao();
    } catch (err) {
      console.error('[MomentosPage] confirmarRealizado erro:', err);
      showToast('Erro ao confirmar momento.', 'erro');
    } finally {
      setRealizandoEnviando(false);
    }
  }

  return (
    <>
      <AppHeroShell
        sheetClassName="space-y-4"
        hero={
          <>
            <i className="fas fa-heart text-3xl text-white mb-3" />
            <h2 className="text-[26px] font-semibold text-white leading-tight">Momentos</h2>
            <p className="text-white/75 text-sm mt-1">Recebidos e enviados</p>
          </>
        }
      >
          {/* Tabs */}
          <div className="flex gap-2">
            {(['recebidos', 'enviados'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition capitalize"
                style={tab === t ? CHIP_ON : CHIP_IDLE}
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
                const realizado = m.status === 'realizado' || m.status === 'Realizado';
                const prazoKey = !realizado ? derivePrazoStatus(m.dataLimite) : null;
                const ateStr = !realizado ? formatDataLimiteShort(m.dataLimite) : null;
                const penalizado = Boolean(m.penalidadeAplicadaAt);
                return (
                  <div
                    key={m.id}
                    className="rounded-xl px-4 py-3 flex items-center gap-3"
                    style={{
                      background: TILE,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    {/* Thumbnail: imagem do catálogo → emoji → ícone de status */}
                    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
                      {m.momentoImg ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.momentoImg}
                          alt={m.momentoNome}
                          className="w-full h-full object-cover"
                        />
                      ) : m.momentoEmoji ? (
                        <div
                          className="w-full h-full flex items-center justify-center text-xl"
                          style={{ background: 'rgba(244,63,94,0.15)' }}
                        >
                          {m.momentoEmoji}
                        </div>
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ background: CTA_GRAD }}
                        >
                          <i className={clsx('fas text-base text-white', realizado ? 'fa-heart' : 'fa-clock')} />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white leading-snug">{m.momentoNome}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={
                            realizado
                              ? { background: 'rgba(34,197,94,0.18)', color: '#4ade80' }
                              : { background: 'rgba(244,63,94,0.18)', color: ACCENT }
                          }
                        >
                          {realizado ? 'Realizado' : 'Pendente'}
                        </span>
                        {prazoKey && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={prazoStatusStyle(prazoKey)}
                          >
                            {prazoStatusLabel(prazoKey)}
                          </span>
                        )}
                        {penalizado && !realizado && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.2)', color: LP_RED }}
                          >
                            −{m.penalidadeValor ?? 5} aplicados
                          </span>
                        )}
                        {ateStr && (
                          <span className="text-[10px] text-white/40">Até {ateStr}</span>
                        )}
                        {dataStr && !ateStr && (
                          <span className="text-[10px] text-white/40">{dataStr}</span>
                        )}
                      </div>
                    </div>
                    {tab === 'enviados' && !realizado && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        <button
                          onClick={() => abrirConfirmacao(m)}
                          className="text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                          style={{ background: CTA_GRAD }}
                        >
                          ✓ Feito
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirPostergar(m)}
                          className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            color: 'rgba(255,255,255,0.55)',
                          }}
                        >
                          Postergar
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
      </AppHeroShell>

      {/* ── Modal: Registrar memória ao concluir momento ── */}
      {realizandoMomento && (
      <OverlayModal
        open
        onClose={fecharConfirmacao}
        backdropClassName="bg-black/85"
        maxWidth="max-w-sm"
        scrollPanel={false}
        panelClassName="overflow-hidden border border-white/10"
        ariaLabel="Registrar memória do momento"
      >
        <div className="overflow-hidden" style={{ background: '#101010' }}>
            {/* Header gradient */}
            <div className="px-6 py-5" style={{ background: CTA_GRAD }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                  >
                    <i className="fas fa-check text-white text-base" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base leading-tight">Momento Realizado!</h3>
                    <p className="text-white/70 text-xs mt-0.5 truncate">{realizandoMomento.momentoNome}</p>
                  </div>
                </div>
                <button
                  onClick={fecharConfirmacao}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-2"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                >
                  <i className="fas fa-times text-white text-sm" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <p className="text-white/50 text-sm text-center">Quer registrar uma memória deste momento?</p>

              {/* Incentivo: foto = recompensa */}
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{
                  background: realizandoFoto ? 'rgba(34,197,94,0.10)' : 'rgba(244,63,94,0.08)',
                  border: `1px solid ${realizandoFoto ? 'rgba(34,197,94,0.25)' : 'rgba(244,63,94,0.20)'}`,
                }}
              >
                <i
                  className={`fas ${realizandoFoto ? 'fa-check-circle' : 'fa-camera'} text-sm shrink-0`}
                  style={{ color: realizandoFoto ? 'rgb(134,239,172)' : ACCENT }}
                />
                <p className="text-xs leading-snug" style={{ color: realizandoFoto ? 'rgb(134,239,172)' : 'rgba(255,255,255,0.55)' }}>
                  {realizandoFoto
                    ? <><strong className="text-green-400">Recompensa</strong> será adicionada ao confirmar!</>
                    : <>Adicione uma foto e ganhe uma recompensa.</>}
                </p>
              </div>

              {/* Área de foto */}
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                className="w-full rounded-2xl overflow-hidden flex items-center justify-center"
                style={{
                  background: TILE,
                  border: '1px solid rgba(244,63,94,0.22)',
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
                    <i className="fas fa-camera text-2xl" style={{ color: ACCENT }} />
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

              {/* Privacidade */}
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <i className="fas fa-lock text-[11px] mt-0.5 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <p className="text-[11px] leading-snug text-white/40">
                  A foto de vocês ficará disponível apenas para o casal.
                </p>
              </div>

              {/* Botão confirmar */}
              <button
                onClick={confirmarRealizado}
                disabled={realizandoEnviando}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: CTA_GRAD }}
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
      </OverlayModal>
      )}

      {postergandoMomento && (
        <OverlayModal
          open
          onClose={fecharPostergar}
          backdropClassName="bg-black/85"
          maxWidth="max-w-sm"
          scrollPanel={false}
          panelClassName="overflow-hidden border border-white/10"
          ariaLabel="Postergar prazo do momento"
        >
          <div className="overflow-hidden p-5 space-y-4" style={{ background: '#101010' }}>
            <h3 className="text-white font-bold text-base">Postergar prazo</h3>
            <p className="text-white/50 text-sm truncate">{postergandoMomento.momentoNome}</p>
            <label className="block text-sm font-semibold text-white">
              Mais quantos dias?
            </label>
            <select
              value={prazoPostergar}
              onChange={(e) =>
                setPrazoPostergar(Number(e.target.value) as PrazoDiasOption)
              }
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {PRAZO_DIAS_OPTIONS.map((d) => (
                <option key={d} value={d} className="bg-[#141414] text-white">
                  {d} {d === 1 ? 'dia' : 'dias'}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={confirmarPostergar}
              disabled={postergandoEnviando}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
              style={{ background: CTA_GRAD }}
            >
              {postergandoEnviando ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={fecharPostergar}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Cancelar
            </button>
          </div>
        </OverlayModal>
      )}
    </>
  );
}
