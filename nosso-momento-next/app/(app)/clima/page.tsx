'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import clsx from 'clsx';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import AppLoadingScreen from '@/components/ui/AppLoadingScreen';

// ── Constantes ────────────────────────────────────────────────

const HUMORES = [
  { key: 'muito_feliz', emoji: '😍', label: 'Muito Feliz', color: '#ff2d3f', colorBg: 'rgba(255,45,63,0.15)' },
  { key: 'feliz',       emoji: '🥰', label: 'Feliz',       color: '#f97316', colorBg: 'rgba(249,115,22,0.15)' },
  { key: 'normal',      emoji: '😐', label: 'Normal',      color: '#9ca3af', colorBg: 'rgba(156,163,175,0.15)' },
  { key: 'triste',      emoji: '😢', label: 'Triste',      color: '#60a5fa', colorBg: 'rgba(96,165,250,0.15)' },
] as const;

type HumorKey = typeof HUMORES[number]['key'];

const HUMOR_COLOR: Record<string, string> = {
  muito_feliz: '#ff2d3f',
  feliz: '#f97316',
  normal: '#9ca3af',
  triste: '#60a5fa',
};

const MESES = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

// ── Tipos internos ────────────────────────────────────────────

interface DayEntry {
  data: string; // YYYY-MM-DD
  meuHumor: HumorKey | null;
  partnerHumor: HumorKey | null;
}

// ── Helpers ───────────────────────────────────────────────────

function contarHumor(dias: DayEntry[], campo: 'meuHumor' | 'partnerHumor') {
  const counts: Record<string, number> = { muito_feliz: 0, feliz: 0, normal: 0, triste: 0 };
  for (const d of dias) {
    const h = d[campo];
    if (h && h in counts) counts[h]++;
  }
  return counts;
}

function humorDominante(counts: Record<string, number>): HumorKey | null {
  let max = 0;
  let key: HumorKey | null = null;
  for (const h of HUMORES) {
    if (counts[h.key] > max) { max = counts[h.key]; key = h.key; }
  }
  return key;
}

function calcularStreak(dias: DayEntry[], campo: 'meuHumor' | 'partnerHumor'): number {
  const sorted = [...dias].sort((a, b) => b.data.localeCompare(a.data));
  let streak = 0;
  for (const d of sorted) {
    if (d[campo]) streak++;
    else break;
  }
  return streak;
}

// ── Componente Principal ─────────────────────────────────────

export default function ClimaHistoricoPage() {
  const {
    usuario,
    pareado,
    parceiroData,
    parceiroNome,
    idPareamentoAmigavel,
    pareadoUid,
  } = useAppStore();

  const uid = usuario?.uid ?? null;
  const parceiroNomeDisplay = parceiroNome || parceiroData?.nome || 'Parceiro';
  const meuFoto = usuario?.fotoUrl ?? '/assets/icons/iconprincipal.png';
  const parceiroFoto = parceiroData?.fotoUrl ?? null;

  // Estado de filtro
  const agora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const anoAtual = agora.getUTCFullYear();
  const mesAtual = agora.getUTCMonth(); // 0-based

  const [selectedYear, setSelectedYear]   = useState(anoAtual);
  const [selectedMonth, setSelectedMonth] = useState(mesAtual);
  const [loading, setLoading]             = useState(true);
  const [allDays, setAllDays]             = useState<DayEntry[]>([]);
  const [calendarOpen, setCalendarOpen]   = useState(false);

  // Buscar todos os docs do climaDiario
  useEffect(() => {
    if (!idPareamentoAmigavel || !uid || !pareadoUid) return;

    async function fetchAll() {
      setLoading(true);
      try {
        const snaps = await getDocs(
          collection(db, 'pareamentos', idPareamentoAmigavel!, 'climaDiario')
        );
        const entries: DayEntry[] = [];
        snaps.forEach((docSnap) => {
          const data = docSnap.id; // YYYY-MM-DD
          const d = docSnap.data() as Record<string, { humor?: string } | undefined>;
          const meuHumor     = (d[uid!]?.humor as HumorKey) ?? null;
          const partnerHumor = (d[pareadoUid!]?.humor as HumorKey) ?? null;
          if (meuHumor || partnerHumor) {
            entries.push({ data, meuHumor, partnerHumor });
          }
        });
        setAllDays(entries);
      } catch (err) {
        console.error('[ClimaHistorico] erro ao buscar dados:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();
  }, [idPareamentoAmigavel, uid, pareadoUid]);

  // Anos disponíveis
  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>([anoAtual]);
    for (const d of allDays) {
      set.add(parseInt(d.data.slice(0, 4), 10));
    }
    return Array.from(set).sort((a, b) => b - a);
  }, [allDays, anoAtual]);

  // Dias filtrados pelo mês/ano selecionado
  const diasFiltrados = useMemo(() => {
    const prefixo = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    return allDays.filter((d) => d.data.startsWith(prefixo));
  }, [allDays, selectedYear, selectedMonth]);

  // Estatísticas computadas
  const stats = useMemo(() => {
    const meusCounts    = contarHumor(diasFiltrados, 'meuHumor');
    const partnerCounts = contarHumor(diasFiltrados, 'partnerHumor');
    const meuTotal      = Object.values(meusCounts).reduce((a, b) => a + b, 0);
    const partnerTotal  = Object.values(partnerCounts).reduce((a, b) => a + b, 0);
    const ambosDias     = diasFiltrados.filter((d) => d.meuHumor && d.partnerHumor).length;
    const streakEu      = calcularStreak(allDays, 'meuHumor');
    const streakPartner = calcularStreak(allDays, 'partnerHumor');
    return { meusCounts, partnerCounts, meuTotal, partnerTotal, ambosDias, streakEu, streakPartner };
  }, [diasFiltrados, allDays]);

  // Mapa de humor por dia para o calendário
  const dayMap = useMemo(() => {
    const m: Record<string, DayEntry> = {};
    for (const d of diasFiltrados) m[d.data] = d;
    return m;
  }, [diasFiltrados]);

  // Grade do calendário
  const calendarDays = useMemo(() => {
    const totalDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDOW  = new Date(selectedYear, selectedMonth, 1).getDay(); // 0=Dom
    const offset    = firstDOW === 0 ? 6 : firstDOW - 1; // segunda = 0
    const cells: (string | null)[] = Array(offset).fill(null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(`${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [selectedYear, selectedMonth]);

  const hojeStr = agora.toISOString().slice(0, 10);

  // Tela sem pareamento
  if (!pareado || !idPareamentoAmigavel) {
    return (
      <div className="screen bg-black text-white flex flex-col items-center justify-center text-center px-8">
        <i className="fas fa-chart-line text-red-400 text-5xl mb-6" />
        <h2 className="text-xl font-bold mb-2">Histórico do Clima</h2>
        <p className="text-white/50 text-sm mb-6">Pareie com seu parceiro para ver o histórico de humores.</p>
        <Link href="/parear" className="btn-red px-8 py-3 rounded-xl text-sm font-semibold">
          Parear agora
        </Link>
      </div>
    );
  }

  return (
    <div className="screen bg-black text-white pb-28">

      {/* Header */}
      <div
        className="flex-shrink-0 px-4 pb-3 flex items-center gap-3 w-full sticky top-0 z-30"
        style={{
          background: 'linear-gradient(180deg,#ff2d3f 0%,#ff5565 100%)',
          boxShadow: '0 4px 20px rgba(255,45,63,0.35)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)',
        }}
      >
        <Link
          href="/parceiro"
          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,0,0,0.20)' }}
        >
          <i className="fas fa-arrow-left text-white text-sm" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <i className="fas fa-chart-line text-white text-base" />
          <p className="text-sm font-bold text-white">Histórico do Clima</p>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* Filtro mês / ano */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="w-full appearance-none bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium pr-8 outline-none"
            >
              {MESES.map((m, i) => (
                <option key={i} value={i} className="bg-[#1a1b20] text-white">{m}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down text-white/40 text-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="appearance-none bg-white/8 border border-white/10 rounded-xl px-4 py-3 text-sm text-white font-medium pr-8 outline-none"
            >
              {anosDisponiveis.map((a) => (
                <option key={a} value={a} className="bg-[#1a1b20] text-white">{a}</option>
              ))}
            </select>
            <i className="fas fa-chevron-down text-white/40 text-xs absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {loading ? (
          <AppLoadingScreen
            message="Carregando histórico..."
            fullScreen={false}
            className="py-16"
          />
        ) : (
          <>
            {/* Cards de resumo */}
            <div className="grid grid-cols-3 gap-2">
              <SummaryCard icon="fa-calendar-check" iconColor="#34d399" label="Seus registros"                       value={String(stats.meuTotal)} />
              <SummaryCard icon="fa-link"           iconColor="#f87171" label="Sincronia"                            value={String(stats.ambosDias)} />
              <SummaryCard icon="fa-user"           iconColor="#fb923c" label={parceiroNomeDisplay.split(' ')[0]}   value={String(stats.partnerTotal)} />
            </div>

            {/* Streak */}
            {(stats.streakEu > 1 || stats.streakPartner > 1) && (
              <div
                className="rounded-2xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'rgba(251,146,60,0.10)', border: '1px solid rgba(251,146,60,0.20)' }}
              >
                <i className="fas fa-fire text-orange-400 text-lg" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/60">Sequência atual de registros</p>
                  <div className="flex gap-4 mt-0.5">
                    <span className="text-sm font-bold text-white">
                      Você: <span className="text-orange-400">{stats.streakEu}d</span>
                    </span>
                    <span className="text-sm font-bold text-white">
                      {parceiroNomeDisplay.split(' ')[0]}: <span className="text-orange-400">{stats.streakPartner}d</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Sem dados no período */}
            {stats.meuTotal === 0 && stats.partnerTotal === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <span className="text-5xl mb-3">📭</span>
                <p className="text-white/50 text-sm">Nenhum registro em {MESES[selectedMonth]} {selectedYear}.</p>
                <p className="text-white/30 text-xs mt-1">Registrem o humor diariamente na tela do parceiro!</p>
              </div>
            ) : (
              <>
                {/* Distribuição de humores */}
                <div
                  className="rounded-[20px] p-4 space-y-3"
                  style={{ background: '#1a1b20', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.40)' }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-bold text-white">Distribuição de humores</h3>
                    <div className="flex items-center gap-2 text-[10px] text-white/40">
                      <span className="flex items-center gap-1">
                        <Avatar foto={meuFoto} nome="Eu" size={14} />
                        Você
                      </span>
                      <span className="flex items-center gap-1">
                        <Avatar foto={parceiroFoto} nome={parceiroNomeDisplay} size={14} />
                        {parceiroNomeDisplay.split(' ')[0]}
                      </span>
                    </div>
                  </div>

                  {HUMORES.map((h) => {
                    const meuCount     = stats.meusCounts[h.key]    ?? 0;
                    const partnerCount = stats.partnerCounts[h.key] ?? 0;
                    const maxVal       = Math.max(stats.meuTotal, stats.partnerTotal, 1);
                    const meuPct       = Math.round((meuCount / Math.max(stats.meuTotal, 1)) * 100);
                    const partnerPct   = Math.round((partnerCount / Math.max(stats.partnerTotal, 1)) * 100);

                    return (
                      <div key={h.key} className="flex items-center gap-2">
                        <div className="w-20 shrink-0 flex items-center gap-1.5">
                          <span className="text-base">{h.emoji}</span>
                          <span className="text-[11px] text-white/60 truncate">{h.label}</span>
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(meuCount / maxVal) * 100}%`, background: h.color, minWidth: meuCount > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-[10px] text-white/50 w-12 text-right shrink-0">{meuCount > 0 ? `${meuCount}x ${meuPct}%` : '-'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 h-3.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                              <div className="h-full rounded-full transition-all duration-700 opacity-55" style={{ width: `${(partnerCount / maxVal) * 100}%`, background: h.color, minWidth: partnerCount > 0 ? 6 : 0 }} />
                            </div>
                            <span className="text-[10px] text-white/35 w-12 text-right shrink-0">{partnerCount > 0 ? `${partnerCount}x ${partnerPct}%` : '-'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Humor dominante no mes */}
                {(humorDominante(stats.meusCounts) || humorDominante(stats.partnerCounts)) && (
                  <div className="grid grid-cols-2 gap-2">
                    <DominantCard
                      title="Seu humor do mes"
                      humor={humorDominante(stats.meusCounts)}
                      count={stats.meusCounts[humorDominante(stats.meusCounts) ?? 'feliz']}
                    />
                    <DominantCard
                      title={`Humor de ${parceiroNomeDisplay.split(' ')[0]}`}
                      humor={humorDominante(stats.partnerCounts)}
                      count={stats.partnerCounts[humorDominante(stats.partnerCounts) ?? 'feliz']}
                    />
                  </div>
                )}

                {/* Registros diários — menu suspenso */}
                <div
                  className="rounded-[20px] overflow-hidden"
                  style={{ background: '#1a1b20', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 24px rgba(0,0,0,0.40)' }}
                >
                  <button
                    onClick={() => setCalendarOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-4 py-3.5"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fas fa-calendar-days text-red-400 text-sm" />
                      <span className="text-sm font-bold text-white">Registros diários</span>
                    </div>
                    <i
                      className="fas fa-chevron-down text-white/40 text-xs transition-transform duration-300"
                      style={{ transform: calendarOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    />
                  </button>

                  {calendarOpen && (
                    <div className="px-4 pb-4 border-t border-white/6">
                      <p className="text-xs font-bold pt-3 pb-2" style={{ color: '#ff2d3f' }}>
                        {MESES[selectedMonth]} {selectedYear}
                      </p>

                      <div className="grid grid-cols-7 mb-1">
                        {['Seg','Ter','Qua','Qui','Sex','Sab','Dom'].map((d) => (
                          <div key={d} className="text-center text-[9px] text-white/30 font-bold uppercase pb-1">{d}</div>
                        ))}
                      </div>

                      <div className="grid grid-cols-7 gap-y-1">
                        {calendarDays.map((dateStr, idx) => {
                          if (!dateStr) return <div key={idx} />;
                          const day    = parseInt(dateStr.slice(8), 10);
                          const entry  = dayMap[dateStr] ?? null;
                          const isHoje = dateStr === hojeStr;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-[2px]">
                              <span className={clsx('text-[10px] font-medium leading-none', isHoje ? 'text-red-400 font-bold' : 'text-white/40')}>
                                {day}
                              </span>
                              <CalDot humor={entry?.meuHumor ?? null} />
                              <CalDot humor={entry?.partnerHumor ?? null} faded />
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/6 flex flex-wrap gap-x-3 gap-y-1.5">
                        {HUMORES.map((h) => (
                          <div key={h.key} className="flex items-center gap-1">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: h.color }} />
                            <span className="text-[10px] text-white/50">{h.emoji} {h.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────

function SummaryCard({ icon, iconColor, label, value }: {
  icon: string; iconColor: string; label: string; value: string;
}) {
  return (
    <div
      className="rounded-2xl p-3 flex flex-col items-center text-center gap-1"
      style={{ background: '#1a1b20', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 12px rgba(0,0,0,0.30)' }}
    >
      <i className={`fas ${icon} text-lg`} style={{ color: iconColor }} />
      <span className="text-xl font-bold text-white">{value}</span>
      <span className="text-[10px] text-white/40 leading-tight">{label}</span>
    </div>
  );
}

function Avatar({ foto, nome, size }: { foto: string | null; nome: string; size: number }) {
  return (
    <div
      className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center bg-white/10"
      style={{ width: size, height: size }}
    >
      {foto ? (
        <Image src={foto} alt={nome} width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        <i className="fas fa-user text-white/50" style={{ fontSize: size * 0.5 }} />
      )}
    </div>
  );
}

function CalDot({ humor, faded = false }: { humor: string | null; faded?: boolean }) {
  const color = humor ? (HUMOR_COLOR[humor] ?? 'rgba(255,255,255,0.10)') : 'rgba(255,255,255,0.10)';
  return (
    <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, opacity: faded ? 0.45 : 1, flexShrink: 0 }} />
  );
}

function DominantCard({ title, humor, count }: {
  title: string; humor: HumorKey | null; count: number;
}) {
  if (!humor) return null;
  const h = HUMORES.find((x) => x.key === humor)!;
  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center text-center gap-2"
      style={{ background: h.colorBg, border: `1px solid ${h.color}30`, boxShadow: '0 4px 12px rgba(0,0,0,0.30)' }}
    >
      <span className="text-4xl">{h.emoji}</span>
      <div>
        <p className="text-[10px] text-white/50">{title}</p>
        <p className="text-sm font-bold text-white mt-0.5">{h.label}</p>
        <p className="text-[11px] font-medium mt-0.5" style={{ color: h.color }}>{count}x no mês</p>
      </div>
    </div>
  );
}