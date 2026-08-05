'use client';

import AppHeroShell, { ACCENT, TILE } from '@/components/layout/AppHeroShell';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

const ROWS = [
  { pos: 1, casal: '—', pontos: '—' },
  { pos: 2, casal: '—', pontos: '—' },
  { pos: 3, casal: '—', pontos: '—' },
  { pos: 4, casal: '—', pontos: '—' },
  { pos: 5, casal: '—', pontos: '—' },
  { pos: 6, casal: '—', pontos: '—' },
  { pos: 7, casal: '—', pontos: '—' },
  { pos: 8, casal: '—', pontos: '—' },
];

function diasRestantesNoMes(): number {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return Math.max(0, last - now.getDate());
}

export default function RankingPage() {
  const mesAtual = MESES[new Date().getMonth()];
  const dias = diasRestantesNoMes();
  const diasLabel = dias === 1 ? '1 dia' : `${dias} dias`;

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
            <i className="fas fa-medal text-3xl text-white" />
          </div>
          <h2 className="text-[25px] font-bold leading-tight tracking-tight">
            Ranking
          </h2>
          <p className="mt-0.5 text-[15px] text-white/75 leading-snug">
            Aqui estão os casais mais conectados de {mesAtual}.
          </p>
        </>
      }
    >
      <div
        className="overflow-hidden rounded-[20px]"
        style={{
          background: TILE,
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <div
          className="grid grid-cols-[52px_1fr_72px] gap-2 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider"
          style={{
            color: 'rgba(255,255,255,0.4)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <span>#</span>
          <span>Casal</span>
          <span className="text-right">Pontos</span>
        </div>
        {ROWS.map((row, i) => (
          <div
            key={row.pos}
            className="grid grid-cols-[52px_1fr_72px] items-center gap-2 px-4 py-3.5"
            style={{
              borderBottom:
                i < ROWS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
            }}
          >
            <span
              className="text-sm font-bold tabular-nums"
              style={{ color: row.pos <= 3 ? ACCENT : 'rgba(255,255,255,0.55)' }}
            >
              {row.pos}º
            </span>
            <span className="text-sm text-white/35 font-medium">{row.casal}</span>
            <span className="text-sm text-white/35 text-right tabular-nums">{row.pontos}</span>
          </div>
        ))}
      </div>
      <p
        className="text-center text-[13px] font-semibold px-3 leading-snug"
        style={{
          background: 'linear-gradient(90deg, #fb7185 0%, #f43f5e 45%, #fb923c 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        Faltam {diasLabel} para definir os campeões.
      </p>
    </AppHeroShell>
  );
}
