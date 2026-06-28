'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import Image from 'next/image';
import clsx from 'clsx';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';

const CATEGORIAS = ['Todos', 'Lovezin', 'Sair da Rotina', 'Quentes'] as const;

function getMonthRange(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startMs: start.getTime(), endMs: end.getTime() };
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function mesesJuntos(pareadoDesde: string | null | undefined): number {
  if (!pareadoDesde) return 0;
  const start = new Date(pareadoDesde);
  const now = new Date();
  return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
}

export default function MemoriasPage() {
  const router = useRouter();
  const {
    memoriasItems,
    memoriasLoading,
    idPareamentoAmigavel,
    set,
    usuario,
    parceiroNome,
  } = useAppStore();
  const uid = usuario?.uid ?? null;

  // Redireciona para /parear se o usuário não tiver pareamento ativo
  useEffect(() => {
    if (!usuario) return;
    const pareadoCom = usuario.pareadoCom;
    const isPareado = !!pareadoCom && !pareadoCom.startsWith('pending_') && pareadoCom !== 'none';
    if (!isPareado) router.replace('/parear');
  }, [usuario, router]);

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [categoria, setCategoria] = useState<string>('Todos');
  const [carregado, setCarregado] = useState(false);
  const [foguinhosGastosMes, setFoguinhosGastosMes] = useState(0);
  const [momentosResgatadosMes, setMomentosResgatadosMes] = useState(0);
  const [realizacoesMes, setRealizacoesMes] = useState(0);

  const carregar = useCallback(async (m: Date) => {
    if (!idPareamentoAmigavel) return;
    set({ memoriasLoading: true });
    const { startMs, endMs } = getMonthRange(m);

    // Fotos do mês via CF
    try {
      const response = await callFunction<{ items: unknown[]; hasMore: boolean }>(
        FUNCTIONS.getMemorias,
        { limit: 200, startMs, endMs, pareamentoId: idPareamentoAmigavel }
      );
      set({
        memoriasItems: (response?.items ?? []) as typeof memoriasItems,
        memoriasHasMore: !!response?.hasMore,
      });
    } catch {
      showToast('Erro ao carregar memórias.', 'erro');
    } finally {
      set({ memoriasLoading: false });
      setCarregado(true);
    }

    // Query única: tasks resgatados pelo usuário atual (satisfaz a security rule de list)
    // → filtra idPareamento e mês client-side
    if (!uid) return;
    try {
      const q = query(
        collection(db, 'tarefasMomentos'),
        where('resgatadoPorUid', '==', uid),
        limit(500)
      );
      const snap = await getDocs(q);

      function tsToMs(ts: unknown): number | null {
        if (!ts) return null;
        if (typeof (ts as { toMillis?: () => number }).toMillis === 'function') {
          return (ts as { toMillis: () => number }).toMillis();
        }
        const n = Number(ts);
        return isNaN(n) ? null : n;
      }

      let gastos = 0;
      let resgates = 0;
      let realizacoes = 0;

      for (const doc of snap.docs) {
        const data = doc.data();

        // Ignora tarefas de outro pareamento
        if (data.idPareamento !== idPareamentoAmigavel) continue;

        // Foguinhos gastos e momentos resgatados: filtrado por dataResgate
        const resgateMs = tsToMs(data.dataResgate);
        if (resgateMs !== null && resgateMs >= startMs && resgateMs <= endMs) {
          resgates += 1;
          gastos += Number(data.custoFoguinhos ?? 0);
        }

        // Realizações: filtrado por dataConclusao (status pode ser maiúsculo ou minúsculo)
        const statusStr = String(data.status ?? '').toLowerCase();
        if (statusStr === 'realizado') {
          const conclusaoMs = tsToMs(data.dataConclusao);
          if (conclusaoMs !== null && conclusaoMs >= startMs && conclusaoMs <= endMs) {
            realizacoes += 1;
          }
        }
      }

      setFoguinhosGastosMes(gastos);
      setMomentosResgatadosMes(resgates);
      setRealizacoesMes(realizacoes);
    } catch {
      // stats mensais são opcionais — a grade de fotos já carregou via CF
    }
  }, [idPareamentoAmigavel, uid, set]);

  useEffect(() => {
    carregar(month);
  }, [month, carregar]);

  function changeMonth(delta: number) {
    setMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
  }

  const isFuture = month > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const filtrados = categoria === 'Todos'
    ? memoriasItems
    : memoriasItems.filter((m) => {
        const cat = String((m as Record<string, unknown>).momentoCategoria ?? (m as Record<string, unknown>).categoria ?? '');
        return cat === categoria;
      });

  // Bio stats — os 3 indicadores são mensais
  // realizações = max(tarefas com status Realizado, fotos do mês)
  // o max() garante que completions pré-fix (foto sem status Realizado) também sejam contadas
  const realizacoesExibir = Math.max(realizacoesMes, memoriasItems.length);
  const bioStats = [
    { icon: '🔥', value: foguinhosGastosMes, label: 'foguinhos gastos' },
    { icon: '💏', value: momentosResgatadosMes, label: 'momentos resgatados' },
    { icon: '✅', value: realizacoesExibir, label: 'realizações' },
  ];

  const nomesCasal = [usuario?.nome, parceiroNome].filter(Boolean).join(' e ');
  const meses = mesesJuntos(usuario?.pareadoDesde);

  // Foto de perfil: foto aleatória de "Sair da Rotina" do mês, estabilizada por useMemo
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fotoPerfil = useMemo(() => {
    const sdrItems = memoriasItems.filter((item) => {
      const cat = String(
        (item as Record<string, unknown>).momentoCategoria ??
        (item as Record<string, unknown>).categoria ?? ''
      );
      return cat === 'Sair da Rotina';
    });
    if (sdrItems.length === 0) return null;
    const random = sdrItems[Math.floor(Math.random() * sdrItems.length)];
    return String(
      (random as Record<string, unknown>).thumbnailUrl ??
      (random as Record<string, unknown>).fotoUrl ??
      (random as Record<string, unknown>).url ?? ''
    ) || null;
  }, [memoriasItems]);

  // Sincroniza fotoPerfil e mês selecionado com o store para o ShareModal
  useEffect(() => {
    set({
      memoriasShareLastPhoto: fotoPerfil,
      memoriasMonth: month.toISOString(),
    });
  }, [fotoPerfil, month, set]);

  return (
    <div className="screen bg-black text-white pb-24">
      <ParceiroHeader variant="gradient" />

      <div className="px-4 mt-3 pb-8 space-y-4">
        {/* Navegação de mês — fora do card neon */}
        <div className="rounded-2xl bg-[#0f0b14] px-4 py-3 flex items-center justify-between border border-white/[0.08]">
          <button
            onClick={() => changeMonth(-1)}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition"
          >
            <i className="fas fa-chevron-left text-white text-sm" />
          </button>
          <p className="text-sm font-semibold text-white capitalize">{monthLabel(month)}</p>
          <button
            onClick={() => changeMonth(1)}
            disabled={isFuture}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition disabled:opacity-30"
          >
            <i className="fas fa-chevron-right text-white text-sm" />
          </button>
        </div>

        {/* Card neon envolvendo todo o conteúdo */}
        <div
          style={{
            background: 'linear-gradient(#12131a, #12131a) padding-box, linear-gradient(135deg, rgba(255,45,63,0.95), rgba(255,100,120,0.55), rgba(255,45,63,0.95)) border-box',
            border: '1.5px solid transparent',
            borderRadius: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,0.65), 0 0 10px rgba(255,45,63,0.55), 0 0 25px rgba(255,45,63,0.35), 0 0 55px rgba(255,45,63,0.18)',
          }}
        >
          {/* Seção de perfil */}
          <div className="p-4 flex gap-4">
            {/* Foto de perfil: foto aleatória de Sair da Rotina ou logo do app — proporção 3:4 */}
            <div className="w-[90px] rounded-2xl overflow-hidden shrink-0 relative" style={{ aspectRatio: '3/4' }}>
              {fotoPerfil ? (
                <Image
                  src={fotoPerfil}
                  alt="Memória do casal"
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white p-3">
                  <Image
                    src="/assets/icons/iconprincipal.png"
                    alt="Nosso Momento"
                    width={72}
                    height={72}
                    className="object-contain"
                  />
                </div>
              )}
            </div>

            {/* Info + Bio */}
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white leading-snug truncate">
                {nomesCasal || 'Nosso Momento'}
              </p>
              <p className="text-xs text-white/50 mt-0.5">
                {monthLabel(month)}{meses > 0 ? ` - juntos há ${meses} ${meses === 1 ? 'mês' : 'meses'}` : ''}
              </p>

              {/* Bio stats — alinhamento vertical com right-align nos números */}
              <div className="mt-3 space-y-1.5">
                {bioStats.map(({ icon, value, label }) => (
                  <div key={label} className="flex items-center gap-1 text-sm">
                    <span className="w-5 text-center shrink-0">{icon}</span>
                    <span className="w-8 text-right font-bold text-white shrink-0">{value}</span>
                    <span className="text-white/60 ml-2">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Botões de ação */}
          <div className="px-4 pb-4 flex gap-3">
            <button
              onClick={() => set({ memoriasShareModalOpen: true })}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg,#ff2d3f,#ff5565)' }}
            >
              <i className="fas fa-share-alt" />
              Compartilhar
            </button>
            <button
              onClick={() => showToast('❤️ Like enviado!', 'sucesso')}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 bg-white/10 border border-white/10"
            >
              <i className="fas fa-heart text-red-400" />
              Deixar um Like
            </button>
          </div>

          {/* Filtros centralizados */}
          <div className="px-4 pb-3 flex flex-wrap justify-center gap-2">
            {CATEGORIAS.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoria(cat)}
                className={clsx(
                  'px-4 py-1.5 rounded-full text-xs font-semibold transition',
                  categoria === cat ? 'bg-white text-black' : 'bg-white/10 text-white/60'
                )}
              >
                {cat === 'Sair da Rotina' ? 'Rotina' : cat}
              </button>
            ))}
          </div>

          {/* Separador + ícone de grid */}
          <div className="border-t border-white/10 mx-4" />
          <div className="flex justify-center py-3">
            <i className="fas fa-th text-white/50 text-sm" />
          </div>

          {/* Grid de fotos */}
          {memoriasLoading ? (
            <div className="text-center py-10 text-white/40 text-sm px-4 pb-6">Carregando...</div>
          ) : !carregado ? (
            <div className="pb-6" />
          ) : filtrados.length === 0 ? (
            <div className="text-center py-10 px-4 pb-6">
              <div className="text-4xl mb-3">📸</div>
              <p className="text-white/40 text-sm">
                {categoria !== 'Todos'
                  ? `Nenhuma memória em "${categoria === 'Sair da Rotina' ? 'Rotina' : categoria}" neste mês.`
                  : 'Nenhuma memória neste mês.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-0.5 overflow-hidden rounded-b-[20px]">
              {filtrados.map((item, idx) => {
                const imgUrl = String(
                  (item as Record<string, unknown>).thumbnailUrl ??
                  (item as Record<string, unknown>).fotoUrl ??
                  (item as Record<string, unknown>).url ?? ''
                );
                return (
                  <button
                    key={((item as Record<string, unknown>).id as string) ?? idx}
                    onClick={() => set({ memoriasViewerIndex: idx, showMemoriasViewer: true })}
                    className="aspect-square relative overflow-hidden bg-white/5"
                  >
                    {imgUrl ? (
                      <Image
                        src={imgUrl}
                        alt="Memória"
                        fill
                        className="object-cover"
                        sizes="33vw"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5">
                        <i className="fas fa-image text-white/20 text-xl" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
