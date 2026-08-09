'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { openSystemConfirm } from '@/components/ui/Modal';
import type { CarrinhoItem, MomentoCustom } from '@/lib/types';
import MomentoCover from '@/components/ui/MomentoCover';
import FoguinhosIcon from '@/components/ui/FoguinhosIcon';
import { trackAction } from '@/lib/analytics';
import { refreshParceiroPerfil } from '@/lib/services/parceiroPerfil';
import { getCatalogFilterGender, momentMatchesCatalogFilter } from '@/lib/utils/profile';
import { buildCustomMomentId, isCustomMomentId } from '@/lib/utils/customMoments';
import AppHeroShell, {
  ACCENT,
  ACCENT_SOFT,
  LP_RED,
  PANEL,
  TILE,
} from '@/components/layout/AppHeroShell';
import { primeiroNome, nomeParaCard } from '@/lib/utils/displayName';
import {
  PRAZO_DIAS_OPTIONS,
  PRAZO_DIAS_DEFAULT,
  type PrazoDiasOption,
} from '@/lib/momentos/prazoStatus';

const CTA_GRAD = `linear-gradient(135deg, ${LP_RED}, ${ACCENT})`;
const CHIP_IDLE = { background: TILE, color: 'rgba(255,255,255,0.45)' } as const;
const CHIP_ON = { background: ACCENT, color: '#fff' } as const;

type LojaItem = {
  id: string;
  nome: string;
  img?: string;
  custoFoguinhos: number;
  categoria?: string;
  emoji?: string;
  isCustom?: boolean;
};

export default function LojaPage() {
  const {
    momentosMestres,
    parceiroData,
    pareado,
    carrinho,
    showCartSidebar,
    set,
    idPareamentoAmigavel,
    pareadoUid,
    conexaoAtiva,
    momentosCustomAtivo,
  } = useAppStore();
  const usuario = useAppStore((s) => s.usuario);
  const [filtro, setFiltro] = useState<string | null>(null);

  const pareamentoId = conexaoAtiva?.pareamentoId ?? idPareamentoAmigavel ?? null;
  const catalogoParceiro = parceiroData?.catalogoPersonalizado ?? {};
  const partnerGender = parceiroData ? getCatalogFilterGender(parceiroData) : 'unisex';

  const momentosParaParceiro = useMemo(
    () => {
      if (!parceiroData) return [];
      return momentosMestres.filter((m) => {
        if (!momentMatchesCatalogFilter(m.targetGender, partnerGender)) return false;
        const cfg = catalogoParceiro[m.nome ?? ''];
        if (cfg?.bloqueado || cfg?.excluido) return false;
        return true;
      });
    },
    [momentosMestres, partnerGender, catalogoParceiro, parceiroData],
  );

  const momentosCustomParceiro: LojaItem[] = useMemo(() => {
    if (!pareadoUid || !pareamentoId || !momentosCustomAtivo) return [];
    const raw = momentosCustomAtivo[pareadoUid];
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m: MomentoCustom) => m && m.ativo !== false && m.bloqueado !== true)
      .map((m) => ({
        id: buildCustomMomentId(pareamentoId, m.id),
        nome: m.nome,
        custoFoguinhos: m.preco,
        emoji: m.emoji || '✨',
        img: m.img,
        categoria: 'Personalizado',
        isCustom: true,
      }));
  }, [pareadoUid, pareamentoId, momentosCustomAtivo]);

  const prevPartnerRef = useRef<{ uid: string | null; pareamentoId: string | null }>({
    uid: null,
    pareamentoId: null,
  });

  useEffect(() => {
    if (pareadoUid) void refreshParceiroPerfil(pareadoUid);
  }, [pareadoUid]);

  // Poliamor: limpa carrinho só ao trocar parceiro/pareamento (não no mount).
  useEffect(() => {
    const prev = prevPartnerRef.current;
    const partnerChanged = prev.uid !== null && prev.uid !== (pareadoUid ?? null);
    const pareamentoChanged =
      prev.pareamentoId !== null && prev.pareamentoId !== pareamentoId;

    prevPartnerRef.current = {
      uid: pareadoUid ?? null,
      pareamentoId,
    };

    if ((partnerChanged || pareamentoChanged) && carrinho.length > 0) {
      set({ carrinho: [], showCartSidebar: false });
    }
  }, [pareadoUid, pareamentoId, carrinho.length, set]);

  if (!pareado || !parceiroData) {
    return (
      <AppHeroShell
        hero={
          <>
            <i className="fas fa-store text-3xl text-white mb-3" />
            <h2 className="text-2xl font-semibold text-white">Catálogo</h2>
            <p className="text-sm text-white/75 mt-1">Escolha momentos para viver</p>
          </>
        }
      >
        <div className="rounded-2xl p-6 text-center" style={{ background: TILE }}>
          <h3 className="text-lg font-semibold" style={{ color: ACCENT }}>
            Você ainda não está pareado(a)
          </h3>
          <p className="text-sm text-white/55 mt-2">
            Pareie com seu parceiro para acessar o catálogo.
          </p>
          <Link
            href="/parear"
            className="mt-4 block w-full py-3 rounded-xl text-white font-semibold"
            style={{ background: CTA_GRAD }}
          >
            Parear agora
          </Link>
        </div>
      </AppHeroShell>
    );
  }

  const foguinhos = Number(usuario?.foguinhos ?? 0);

  const categorias = [...new Set(momentosParaParceiro.map((m) => m.categoria))];
  const momentosFiltrados = filtro
    ? momentosParaParceiro.filter((m) => m.categoria === filtro)
    : momentosParaParceiro;

  const totalCarrinho = carrinho.reduce(
    (s, c) => s + (Number((c as CarrinhoItem & { custoFoguinhos?: number }).custoFoguinhos) || 0),
    0,
  );

  function adicionarAoCarrinho(item: LojaItem) {
    if (carrinho.find((c) => c.id === item.id)) {
      showToast('Já está no carrinho.', 'aviso');
      return;
    }
    set({
      carrinho: [
        ...carrinho,
        {
          id: item.id,
          titulo: item.nome,
          foto: item.img,
          quantidade: 1,
          custoFoguinhos: item.custoFoguinhos,
          categoria: item.categoria || '',
          emoji: item.emoji || '',
          prazoDias: PRAZO_DIAS_DEFAULT,
        } as CarrinhoItem,
      ],
      showCartSidebar: true,
    });
    showToast('Adicionado ao carrinho!', 'sucesso');
    trackAction('momentos_carrinho', {
      content_ids: [item.id],
      content_name: item.nome,
      items: [{ item_id: item.id, item_name: item.nome }],
    });
  }

  async function finalizarPedido() {
    if (!carrinho.length) {
      showToast('Carrinho vazio.', 'aviso');
      return;
    }
    if (!pareadoUid || !pareamentoId) {
      showToast('Conexão inválida. Tente novamente.', 'erro');
      return;
    }

    openSystemConfirm('Confirmar pedido?', async () => {
      try {
        const itemsPayload = carrinho.map((c) => {
          const ext = c as CarrinhoItem & {
            custoFoguinhos?: number;
            categoria?: string;
            emoji?: string;
            foto?: string;
          };
          const custom = isCustomMomentId(c.id);
          const pd = PRAZO_DIAS_OPTIONS.includes(
            Number(c.prazoDias) as PrazoDiasOption,
          )
            ? (Number(c.prazoDias) as PrazoDiasOption)
            : PRAZO_DIAS_DEFAULT;
          return {
            id: c.id,
            ...(custom ? {} : { momentoMestreId: c.id }),
            nome: ext.titulo,
            img: ext.foto || '',
            categoria: ext.categoria || '',
            emoji: ext.emoji || '',
            prazoDias: pd,
          };
        });

        await sendInput('moment_redeem', {
          partnerUid: pareadoUid,
          pareamentoId,
          items: itemsPayload,
          totalFoguinhos: totalCarrinho,
        });
        trackAction('momento_resgatado', {
          currency: 'BRL',
          value: totalCarrinho,
          num_items: carrinho.length,
        });
        if (usuario) {
          set({
            usuario: { ...usuario, foguinhos: Math.max(0, foguinhos - totalCarrinho) },
          });
        }
        set({ carrinho: [], showCartSidebar: false });
        showToast('Momentos resgatados! Veja em Momentos 🔥', 'sucesso');
      } catch {
        showToast('Erro ao finalizar pedido.', 'erro');
      }
    });
  }

  function renderCard(item: LojaItem) {
    const semSaldo = foguinhos < item.custoFoguinhos;
    return (
      <div
        key={item.id}
        className="rounded-2xl overflow-hidden"
        style={{
          background: TILE,
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div className="relative">
          <MomentoCover
            src={item.img}
            alt={item.nome}
            emoji={item.emoji ?? '🔥'}
            variant="card"
          />
          {item.isCustom && (
            <span
              className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
              style={{ background: ACCENT }}
            >
              Personalizado
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-white text-sm leading-snug">{item.nome}</h3>
          <div className="flex items-center justify-between mt-3">
            <span
              className="text-sm font-medium leading-none flex items-center gap-1.5"
              style={{ color: ACCENT_SOFT }}
            >
              <FoguinhosIcon size={20} />
              <span>{item.custoFoguinhos} foguinhos</span>
            </span>
            <button
              type="button"
              onClick={() => adicionarAoCarrinho(item)}
              disabled={semSaldo}
              className={clsx(
                'text-xs px-3 py-2 rounded-lg font-semibold transition',
                semSaldo && 'cursor-not-allowed',
              )}
              style={
                semSaldo
                  ? { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }
                  : { background: CTA_GRAD, color: '#fff' }
              }
            >
              {semSaldo ? 'Sem saldo' : 'Resgatar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const partnerName = nomeParaCard({
    apelidoReal: (parceiroData as { apelidoReal?: string | null }).apelidoReal,
    nome: parceiroData.nome,
    fallback: 'ele(a)',
  }) || primeiroNome(parceiroData.nome) || 'ele(a)';
  const cartCount = carrinho.length;

  return (
    <>
      <AppHeroShell
        sheetClassName="space-y-4"
        hero={
          <>
            <div className="absolute right-3.5 top-3 z-10 flex items-center gap-2">
              <div
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{
                  background: 'rgba(0,0,0,0.62)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
              >
                <FoguinhosIcon size={20} />
                <span className="text-sm font-bold text-white">{foguinhos}</span>
              </div>
              <button
                type="button"
                onClick={() => set({ showCartSidebar: true })}
                className="relative flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95"
                style={{
                  background: 'rgba(0,0,0,0.62)',
                  border: '1px solid rgba(255,255,255,0.10)',
                }}
                aria-label="Abrir carrinho"
              >
                <i className="fas fa-shopping-cart text-white text-sm" />
                {cartCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                    style={{ background: ACCENT }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>

            {parceiroData.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={parceiroData.fotoUrl}
                alt={parceiroData.nome ?? ''}
                className="w-[88px] h-[88px] rounded-full object-cover mb-3"
                style={{ border: `2.5px solid rgba(255,255,255,0.55)` }}
              />
            ) : (
              <div
                className="w-[88px] h-[88px] rounded-full mb-3 flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.15)', border: '2.5px solid rgba(255,255,255,0.4)' }}
              >
                <i className="fas fa-user text-2xl text-white/70" />
              </div>
            )}
            <h2 className="text-[26px] font-semibold text-white leading-tight">
              Catálogo de Momentos
            </h2>
            <p className="text-white/75 mt-1 text-sm">{partnerName}</p>
          </>
        }
      >
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            onClick={() => setFiltro(null)}
            className="flex-1 min-w-0 text-center py-[7px] px-[10px] rounded-full font-semibold text-[0.82rem] whitespace-nowrap transition"
            style={!filtro ? CHIP_ON : CHIP_IDLE}
          >
            Todos
          </button>
          {categorias.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFiltro((cat ?? null) === filtro ? null : (cat ?? null))}
              className="flex-1 min-w-0 text-center py-[7px] px-[10px] rounded-full font-semibold text-[0.82rem] whitespace-nowrap transition"
              style={filtro === cat ? CHIP_ON : CHIP_IDLE}
            >
              {cat === 'Sair da Rotina' ? 'Rotina' : cat}
            </button>
          ))}
        </div>

        {momentosCustomParceiro.length > 0 && (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-2 px-0.5">
              <h3 className="text-sm font-semibold text-white/80">Personalizado</h3>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(244,63,94,0.22)', color: ACCENT_SOFT }}
              >
                ✦ VIP
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {momentosCustomParceiro.map((item) => renderCard(item))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {momentosFiltrados.map((m) => {
            const cfg = catalogoParceiro[m.nome ?? ''];
            const preco = cfg?.preco !== undefined ? cfg.preco : Number(m.intensidade ?? 1) * 2;
            return renderCard({
              id: m.id,
              nome: m.nome ?? '',
              img: m.img ? String(m.img) : undefined,
              custoFoguinhos: preco,
              categoria: m.categoria,
              emoji: m.emoji ? String(m.emoji) : undefined,
              isCustom: false,
            });
          })}
        </div>
      </AppHeroShell>

      {showCartSidebar && (
        <>
          <div
            className="fixed inset-0 z-[110]"
            style={{ background: 'rgba(0,0,0,0.65)' }}
            onClick={() => set({ showCartSidebar: false })}
          />
          <div
            className="fixed right-0 top-0 h-full w-full sm:w-96 z-[120] border-l overflow-y-auto flex flex-col"
            style={{
              background: PANEL,
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex items-center justify-between p-6 pb-4">
              <button
                type="button"
                onClick={() => set({ showCartSidebar: false })}
                className="text-white/70 hover:text-white transition"
              >
                <i className="fas fa-chevron-left text-lg" />
              </button>
              <h3 className="text-lg font-semibold text-white text-center flex-1">Meu carrinho</h3>
              <span className="w-6" aria-hidden />
            </div>

            <div className="flex-1 px-4 space-y-3">
              {carrinho.length === 0 ? (
                <p className="text-white/40 text-center py-10 text-sm">Seu carrinho está vazio.</p>
              ) : (
                carrinho.map((item, idx) => {
                  const prazoItem = (
                    PRAZO_DIAS_OPTIONS.includes(
                      Number(item.prazoDias) as PrazoDiasOption,
                    )
                      ? Number(item.prazoDias)
                      : PRAZO_DIAS_DEFAULT
                  ) as PrazoDiasOption;
                  return (
                  <div
                    key={idx}
                    className="rounded-2xl p-4 space-y-3"
                    style={{
                      background: TILE,
                      border: '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex gap-3 items-center">
                      {item.foto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.foto}
                          alt={item.titulo}
                          className="w-16 h-16 rounded-xl object-cover shrink-0"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        />
                      ) : (
                        <div
                          className="w-16 h-16 rounded-xl flex items-center justify-center shrink-0 text-xl"
                          style={{ background: 'rgba(255,255,255,0.06)' }}
                        >
                          {(item as CarrinhoItem & { emoji?: string }).emoji || '🎁'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{item.titulo}</p>
                        <p className="text-xs text-white/40 mt-0.5">
                          {(() => {
                            const cat = String(
                              (item as CarrinhoItem & { categoria?: string }).categoria || '',
                            ).trim();
                            if (isCustomMomentId(item.id)) return cat || 'Personalizado';
                            if (cat === 'Sair da Rotina') return 'Rotina';
                            return cat || 'Momento';
                          })()}
                        </p>
                        <p
                          className="text-sm font-semibold mt-1 flex items-center gap-1.5 leading-none"
                          style={{ color: ACCENT_SOFT }}
                        >
                          <FoguinhosIcon size={20} />
                          <span>
                            {(item as CarrinhoItem & { custoFoguinhos?: number }).custoFoguinhos ?? 0}{' '}
                            foguinhos
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => set({ carrinho: carrinho.filter((_, i) => i !== idx) })}
                        className="text-white/35 hover:text-white transition shrink-0 self-start"
                      >
                        <i className="fas fa-times" />
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-white/55 mb-1.5">
                        Quantos dias {partnerName} tem para realizar?
                      </label>
                      <select
                        value={prazoItem}
                        onChange={(e) => {
                          const next = Number(e.target.value) as PrazoDiasOption;
                          set({
                            carrinho: carrinho.map((c, i) =>
                              i === idx ? { ...c, prazoDias: next } : c,
                            ),
                          });
                        }}
                        className="w-full rounded-xl px-3 py-2 text-sm text-white outline-none"
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
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {carrinho.length > 0 && (
              <div
                className="px-4 mt-4 space-y-3"
                style={{
                  /* Carrinho cobre a nav; folga do canto + safe area */
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 28px)',
                }}
              >
                <div
                  className="rounded-xl px-3 py-2.5 flex items-center gap-2.5"
                  style={{
                    background: 'rgba(244,63,94,0.08)',
                    border: '1px solid rgba(244,63,94,0.18)',
                  }}
                >
                  <i
                    className="fas fa-clock text-sm shrink-0"
                    style={{ color: ACCENT }}
                    aria-hidden
                  />
                  <p className="text-[11px] leading-snug text-white/55">
                    Se atrasar mais de 24h após o prazo, {partnerName} perderá 5 foguinhos.
                  </p>
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: TILE,
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  <h4 className="text-sm font-semibold text-white mb-3">Resumo</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Itens</span>
                      <span className="font-medium text-white">{carrinho.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Meu Saldo</span>
                      <span className="font-semibold text-white">{foguinhos} foguinhos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Custo Total</span>
                      <span className="font-semibold" style={{ color: ACCENT }}>
                        -{totalCarrinho} foguinhos
                      </span>
                    </div>
                    <div
                      className="flex justify-between pt-2 mt-1"
                      style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      <span className="font-semibold text-white">Saldo Final</span>
                      <span
                        className="font-bold"
                        style={{
                          color: foguinhos - totalCarrinho < 0 ? ACCENT : '#fff',
                        }}
                      >
                        {foguinhos - totalCarrinho} foguinhos
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={foguinhos < totalCarrinho}
                  className="w-full py-3 text-white rounded-xl font-semibold disabled:opacity-50 transition"
                  style={{ background: CTA_GRAD }}
                >
                  Resgatar Momento
                </button>
                <button
                  type="button"
                  onClick={() => set({ showCartSidebar: false })}
                  className="w-full py-2 text-white/70 hover:text-white transition text-sm"
                >
                  Continuar Resgatando
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}
