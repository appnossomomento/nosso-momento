'use client';

import { useEffect } from 'react';
import clsx from 'clsx';
import { useAppStore } from '@/lib/store/appStore';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';

interface ExtratoItem {
  tipo: string;
  valor: number;
  descricao: string;
  autorNome: string;
  timestampMs: number;
}

const TIPO_ICON: Record<string, string> = {
  clima: 'fa-thermometer-half',
  resgate: 'fa-shopping-bag',
  bonus: 'fa-star',
  gift: 'fa-gift',
  desafio: 'fa-trophy',
  pareamento: 'fa-heart',
};

function formatBR(ms: number) {
  return new Date(ms).toLocaleDateString('pt-BR');
}

export default function ExtratoPage() {
  const { extratoItems, extratoHasMore, extratoLoading, idPareamentoAmigavel, set } = useAppStore();
  const items = extratoItems as ExtratoItem[];

  useEffect(() => {
    if (!idPareamentoAmigavel) return;
    if (items.length > 0) return; // já carregados
    async function load() {
      set({ extratoLoading: true });
      try {
        const result = await callFunction<{ items: ExtratoItem[]; hasMore: boolean }>(
          FUNCTIONS.getExtrato,
          { pareamentoId: idPareamentoAmigavel }
        );
        set({ extratoItems: result.items ?? [], extratoHasMore: result.hasMore ?? false });
      } catch {
        showToast('Erro ao carregar extrato.', 'erro');
      } finally {
        set({ extratoLoading: false });
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idPareamentoAmigavel]);

  async function carregarMais() {
    if (!idPareamentoAmigavel || extratoLoading) return;
    const ultimo = items[items.length - 1];
    set({ extratoLoading: true });
    try {
      const result = await callFunction<{ items: ExtratoItem[]; hasMore: boolean }>(
        FUNCTIONS.getExtrato,
        { pareamentoId: idPareamentoAmigavel, startAfterMs: ultimo?.timestampMs }
      );
      set({
        extratoItems: [...items, ...(result.items ?? [])],
        extratoHasMore: result.hasMore ?? false,
      });
    } catch {
      showToast('Erro ao carregar mais.', 'erro');
    } finally {
      set({ extratoLoading: false });
    }
  }

  return (
    <div className="screen bg-black text-white pb-28">
      <ParceiroHeader variant="gradient" />

      <div className="px-4 py-4 space-y-2">
        {extratoLoading && items.length === 0 ? (
          <div className="text-center py-16 text-white/40 text-sm">Carregando extrato...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">🔥</div>
            <p className="text-white/40 text-sm">Nenhuma transação ainda.</p>
          </div>
        ) : (
          <>
            {items.map((item, idx) => {
              const icone = TIPO_ICON[item.tipo] ?? 'fa-circle';
              const positivo = item.valor > 0;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-white/6 border border-white/10 px-4 py-3 flex items-center gap-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <i className={`fas ${icone} text-sm text-white/70`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white leading-snug">{item.descricao}</p>
                    <p className="text-[10px] text-white/40 mt-0.5">{item.autorNome} · {formatBR(item.timestampMs)}</p>
                  </div>
                  <span className={clsx('text-sm font-bold shrink-0', positivo ? 'text-green-400' : 'text-red-400')}>
                    {positivo ? '+' : ''}{item.valor}
                  </span>
                </div>
              );
            })}

            {extratoHasMore && (
              <button
                onClick={carregarMais}
                disabled={extratoLoading}
                className="w-full py-3 rounded-xl bg-white/8 border border-white/10 text-white/60 text-sm font-medium hover:bg-white/12 transition disabled:opacity-50"
              >
                {extratoLoading ? 'Carregando...' : 'Carregar mais'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
