'use client';

import Link from 'next/link';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { openSystemConfirm } from '@/components/ui/Modal';
import type { CarrinhoItem, MomentoCustom } from '@/lib/types';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';
import MomentoCover from '@/components/ui/MomentoCover';
import { trackGA, trackMeta } from '@/lib/analytics';
import { refreshParceiroPerfil } from '@/lib/services/parceiroPerfil';
import { getCatalogFilterGender, momentMatchesCatalogFilter } from '@/lib/utils/profile';
import { buildCustomMomentId, isCustomMomentId } from '@/lib/utils/customMoments';

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
      .filter((m: MomentoCustom) => m && m.ativo !== false)
      .map((m) => ({
        id: buildCustomMomentId(pareamentoId, m.id),
        nome: m.nome,
        custoFoguinhos: m.preco,
        emoji: m.emoji || '✨',
        img: m.img,
        categoria: 'Custom',
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
      <div className="screen screen-pad bg-black text-white">
        <section className="px-0 pt-11 pb-16 flex flex-col items-center text-center"
          style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}>
          <i className="fas fa-store text-3xl text-white mb-3" />
          <h2 className="text-xl font-semibold">Catálogo</h2>
          <p className="text-sm text-white/80">Escolha momentos para viver</p>
        </section>
        <section className="px-5 -mt-10">
          <div className="rounded-[28px] bg-white p-6 text-center">
            <h3 className="text-lg font-semibold text-red-500">Você ainda não está pareado(a)</h3>
            <p className="text-sm text-gray-600 mt-2">Pareie com seu parceiro para acessar o catálogo.</p>
            <Link href="/parear" className="mt-4 block w-full py-3 rounded-xl bg-red-500 text-white font-semibold">Parear agora</Link>
          </div>
        </section>
      </div>
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
        } as CarrinhoItem,
      ],
      showCartSidebar: true,
    });
    showToast('Adicionado ao carrinho!', 'sucesso');
    trackGA('add_to_cart', { items: [{ item_id: item.id, item_name: item.nome }] });
    trackMeta('AddToCart', { content_ids: [item.id], content_name: item.nome });
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
          return {
            id: c.id,
            ...(custom ? {} : { momentoMestreId: c.id }),
            nome: ext.titulo,
            img: ext.foto || '',
            categoria: ext.categoria || '',
            emoji: ext.emoji || '',
          };
        });

        await sendInput('moment_redeem', {
          partnerUid: pareadoUid,
          pareamentoId,
          items: itemsPayload,
          totalFoguinhos: totalCarrinho,
        });
        trackGA('purchase', { currency: 'BRL', value: totalCarrinho });
        trackMeta('Purchase', { currency: 'BRL', value: totalCarrinho });
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
        className="rounded-2xl overflow-hidden bg-[#1a1020] border border-white/10"
      >
        <div className="relative">
          <MomentoCover
            src={item.img}
            alt={item.nome}
            emoji={item.emoji ?? '🔥'}
            variant="card"
          />
          {item.isCustom && (
            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/90 text-white">
              Personalizado
            </span>
          )}
        </div>
        <div className="p-4">
          <h3 className="font-semibold text-white text-sm leading-snug">{item.nome}</h3>
          <div className="flex items-center justify-between mt-3">
            <span className="text-amber-300 text-sm font-medium flex items-center gap-1">
              <i className="fas fa-fire" /> {item.custoFoguinhos} foguinhos
            </span>
            <button
              type="button"
              onClick={() => adicionarAoCarrinho(item)}
              disabled={semSaldo}
              className={clsx(
                'text-xs px-3 py-2 rounded-lg font-semibold transition',
                semSaldo
                  ? 'bg-white/10 text-white/40 cursor-not-allowed'
                  : 'bg-gradient-to-r from-pink-500 to-red-500 text-white',
              )}
            >
              {semSaldo ? 'Sem saldo' : 'Resgatar'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="screen bg-black text-white pb-28">
      <ParceiroHeader showCart />

      <section
        className="px-6 pt-10 pb-28 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}
      >
        <div className="flex flex-col items-center text-center" style={{ marginTop: -4 }}>
          {parceiroData.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={parceiroData.fotoUrl}
              alt={parceiroData.nome ?? ''}
              className="w-20 h-20 rounded-full object-cover border-2 border-white/40 mb-3"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 mb-3 flex items-center justify-center">
              <i className="fas fa-user text-2xl text-white/70" />
            </div>
          )}
          <h2 className="text-3xl font-semibold text-white">Catálogo de Momentos</h2>
          <p className="text-white/80 mt-1">{parceiroData.nome ?? 'Parceiro'}</p>
        </div>
      </section>

      <section className="px-5 pb-8 -mt-10">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[28px] bg-[#111114] p-4 shadow-lg space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setFiltro(null)}
                className="flex-1 min-w-0 text-center py-[7px] px-[10px] rounded-full font-semibold text-[0.82rem] whitespace-nowrap transition"
                style={!filtro ? { background: '#ef4444', color: '#fff' } : { background: '#1a1a1a', color: '#888' }}
              >
                Todos
              </button>
              {categorias.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFiltro((cat ?? null) === filtro ? null : (cat ?? null))}
                  className="flex-1 min-w-0 text-center py-[7px] px-[10px] rounded-full font-semibold text-[0.82rem] whitespace-nowrap transition"
                  style={filtro === cat ? { background: '#ef4444', color: '#fff' } : { background: '#1a1a1a', color: '#888' }}
                >
                  {cat === 'Sair da Rotina' ? 'Rotina' : cat}
                </button>
              ))}
            </div>
          </div>

          {momentosCustomParceiro.length > 0 && (
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-2 px-1">
                <h3 className="text-sm font-semibold text-white/80">Personalizado</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-300">
                  ✦ VIP
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {momentosCustomParceiro.map((item) => renderCard(item))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
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
        </div>
      </section>

      {showCartSidebar && (
        <>
          <div className="fixed inset-0 bg-black/50 z-20" onClick={() => set({ showCartSidebar: false })} />
          <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-[#120b16] z-30 border-l border-white/10 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between p-6 pb-4">
              <button type="button" onClick={() => set({ showCartSidebar: false })} className="text-white/70 hover:text-white transition">
                <i className="fas fa-chevron-left text-lg" />
              </button>
              <h3 className="text-lg font-semibold text-white text-center flex-1">Meu carrinho</h3>
              <button type="button" className="text-white/70 hover:text-white transition" aria-label="Opções do carrinho">
                <i className="fas fa-ellipsis-vertical text-lg" />
              </button>
            </div>

            <div className="flex-1 px-4 space-y-3">
              {carrinho.length === 0 ? (
                <p className="text-white/40 text-center py-10 text-sm">Seu carrinho está vazio.</p>
              ) : (
                carrinho.map((item, idx) => (
                  <div key={idx} className="bg-white rounded-2xl p-4 flex gap-3 items-center shadow-md">
                    {item.foto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.foto} alt={item.titulo} className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 text-xl">
                        {(item as CarrinhoItem & { emoji?: string }).emoji || '🎁'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isCustomMomentId(item.id) ? 'Personalizado' : 'Momento'}
                      </p>
                      <p className="text-sm font-semibold text-amber-500 mt-1">
                        <i className="fas fa-fire mr-1 text-xs" />
                        {(item as CarrinhoItem & { custoFoguinhos?: number }).custoFoguinhos ?? 0} foguinhos
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => set({ carrinho: carrinho.filter((_, i) => i !== idx) })}
                      className="text-gray-400 hover:text-red-500 transition shrink-0"
                    >
                      <i className="fas fa-times" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {carrinho.length > 0 && (
              <div className="px-4 pb-6 mt-4 space-y-4">
                <div className="rounded-2xl bg-white/90 text-gray-900 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold mb-3">Resumo</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Itens</span>
                      <span className="font-medium">{carrinho.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Meu Saldo</span>
                      <span className="font-semibold text-emerald-600">{foguinhos} foguinhos</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Custo Total</span>
                      <span className="font-semibold text-red-500">-{totalCarrinho} foguinhos</span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 mt-1">
                      <span className="font-semibold text-gray-800">Saldo Final</span>
                      <span className={clsx('font-bold', foguinhos - totalCarrinho < 0 ? 'text-red-500' : 'text-gray-900')}>
                        {foguinhos - totalCarrinho} foguinhos
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={finalizarPedido}
                  disabled={foguinhos < totalCarrinho}
                  className="w-full py-3 bg-gradient-to-r from-pink-500 to-red-500 text-white rounded-xl font-semibold disabled:opacity-50 transition"
                >
                  Finalizar Pedido
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
    </div>
  );
}
