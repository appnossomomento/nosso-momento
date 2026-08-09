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
import AppHeroShell, { ACCENT } from '@/components/layout/AppHeroShell';
import { montarNomesCasal, primeiroNome } from '@/lib/utils/displayName';
import { setParceiroAtivo } from '@/lib/utils/setParceiroAtivo';
import type { Pareamento } from '@/lib/types';

const LOGO_COLOR = '/assets/icons/iconprincipal.png';
const FALLBACK_AVATAR = '/assets/icons/iconprincipal.png';
const AVATAR = 96;
/** Sobreposição leve — só as bordas se invadem; o logo fica no centro da interseção. */
const AVATAR_OVERLAP = 12;

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
    parceiroData,
    parceirosAtivos,
    pareadoUid,
  } = useAppStore();
  const uid = usuario?.uid ?? null;
  const [switchOpen, setSwitchOpen] = useState(false);
  const multiConexao = (parceirosAtivos?.length ?? 0) > 1;

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

  const nomesCasal = montarNomesCasal(usuario, {
    apelidoReal: parceiroData?.apelidoReal,
    nome: parceiroNome ?? parceiroData?.nome,
  });
  // Hero: só first name. Apelido fica no feed (nomesCasal / nomeParaCard).
  const nomeMeu = primeiroNome(usuario?.nome) || 'Eu';
  const nomePar =
    primeiroNome(parceiroNome ?? parceiroData?.nome) || 'Parceiro';
  const tituloCasal = `${nomeMeu} & ${nomePar}`;
  const minhaFoto = usuario?.fotoUrl || FALLBACK_AVATAR;
  const fotoParceiro = parceiroData?.fotoUrl || FALLBACK_AVATAR;
  const meses = mesesJuntos(usuario?.pareadoDesde);

  function handleTrocarParceiro(partner: Pareamento) {
    if (partner.uid === (pareadoUid || parceiroData?.uid)) {
      setSwitchOpen(false);
      return;
    }
    setParceiroAtivo(partner);
    setSwitchOpen(false);
    setCarregado(false);
    showToast(`Memórias com ${partner.nome}`, 'sucesso');
  }

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
    // fotoUrl vem assinada do getMemorias (LGPD); thumbnailUrl legado pode estar morto
    return String(
      (random as Record<string, unknown>).fotoUrl ??
      (random as Record<string, unknown>).thumbnailUrl ??
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
    <AppHeroShell
      bareSheet
      sheetClassName="space-y-4"
      hero={
        <>
          <div className="relative mb-4 flex items-center justify-center" style={{ height: AVATAR }}>
            <div
              className="relative z-[1] rounded-full overflow-hidden"
              style={{
                width: AVATAR,
                height: AVATAR,
                marginRight: -AVATAR_OVERLAP,
                boxShadow: [
                  `0 0 0 3px ${ACCENT}`,
                  '0 0 0 7px rgba(244, 63, 94, 0.22)',
                ].join(', '),
              }}
            >
              <Image
                src={minhaFoto}
                alt={nomeMeu}
                width={AVATAR}
                height={AVATAR}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div
              className="relative z-[1] rounded-full overflow-hidden"
              style={{
                width: AVATAR,
                height: AVATAR,
                boxShadow: [
                  `0 0 0 3px ${ACCENT}`,
                  '0 0 0 7px rgba(244, 63, 94, 0.22)',
                ].join(', '),
              }}
            >
              <Image
                src={fotoParceiro}
                alt={nomePar}
                width={AVATAR}
                height={AVATAR}
                className="w-full h-full object-cover"
                priority
              />
            </div>

            {/* Logo-coração na junção — cor original + glow */}
            <div
              className="absolute z-[2] flex items-center justify-center rounded-full bg-white"
              style={{
                width: 32,
                height: 32,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                boxShadow: [
                  '0 0 0 2px rgba(255,255,255,0.9)',
                  '0 0 12px rgba(239, 68, 68, 0.75)',
                  '0 0 24px rgba(244, 63, 94, 0.55)',
                  '0 0 36px rgba(244, 63, 94, 0.35)',
                ].join(', '),
              }}
              aria-hidden
            >
              <Image
                src={LOGO_COLOR}
                alt=""
                width={30}
                height={30}
                className="object-contain"
              />
            </div>
          </div>

          <h2 className="text-[22px] font-bold leading-tight tracking-tight px-2">
            {tituloCasal}
          </h2>
          <p className="mt-0.5 text-[14px] text-white/75 leading-snug px-4">
            O espaço exclusivo das suas memórias
          </p>

          {multiConexao && (
            <div className="relative mt-3 w-full max-w-[280px]">
              <button
                type="button"
                onClick={() => setSwitchOpen((v) => !v)}
                className="mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold text-white/80 transition active:scale-[0.98]"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.18)',
                }}
              >
                Trocar conexão
                <i
                  className={clsx(
                    'fas fa-chevron-down text-[9px] transition-transform',
                    switchOpen && 'rotate-180',
                  )}
                />
              </button>
              {switchOpen && (
                <div
                  className="absolute left-1/2 top-full z-20 mt-2 w-full -translate-x-1/2 overflow-hidden rounded-2xl p-1.5"
                  style={{
                    background: '#141414',
                    border: '1px solid rgba(255,255,255,0.12)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.55)',
                  }}
                >
                  {parceirosAtivos.map((p) => {
                    const ativo = p.uid === (pareadoUid || parceiroData?.uid);
                    return (
                      <button
                        key={p.uid}
                        type="button"
                        onClick={() => handleTrocarParceiro(p)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition"
                        style={
                          ativo
                            ? {
                                background: 'rgba(244, 63, 94, 0.14)',
                                border: `1px solid ${ACCENT}`,
                              }
                            : undefined
                        }
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
                          {p.fotoUrl ? (
                            <Image
                              src={p.fotoUrl}
                              alt={p.nome}
                              width={32}
                              height={32}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center">
                              <i className="fas fa-user text-white/40 text-xs" />
                            </span>
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-white">
                          {p.nome}
                        </span>
                        {ativo && (
                          <i className="fas fa-check text-[10px]" style={{ color: ACCENT }} />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      }
    >
        {/* Navegação de mês — sem bloco preto, direto no gradiente */}
        <div className="px-1 py-1 flex items-center justify-between">
          <button
            onClick={() => changeMonth(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95"
            style={{
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            aria-label="Mês anterior"
          >
            <i className="fas fa-chevron-left text-white text-sm" />
          </button>
          <p className="text-sm font-semibold text-white capitalize">{monthLabel(month)}</p>
          <button
            onClick={() => changeMonth(1)}
            disabled={isFuture}
            className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-30"
            style={{
              background: 'rgba(0,0,0,0.28)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
            aria-label="Próximo mês"
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
                  unoptimized
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
                  (item as Record<string, unknown>).fotoUrl ??
                  (item as Record<string, unknown>).thumbnailUrl ??
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
                        unoptimized
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
    </AppHeroShell>
  );
}
