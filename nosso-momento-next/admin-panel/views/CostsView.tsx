'use client';

import type { AdminMetrics } from '@/admin-panel/types';
import type { CostStatus } from '@/admin-panel/lib/estimateCosts';
import KpiCard from '@/admin-panel/components/KpiCard';
import ChartCard from '@/admin-panel/components/ChartCard';
import ProgressRing from '@/admin-panel/components/ProgressRing';

function statusColors(status: CostStatus): { bg: string; border: string; text: string } {
  if (status === 'cobranca_iniciada') {
    return {
      bg: 'rgba(239, 68, 68, 0.12)',
      border: 'rgba(239, 68, 68, 0.45)',
      text: '#f87171',
    };
  }
  if (status === 'atencao') {
    return {
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.45)',
      text: '#fbbf24',
    };
  }
  return {
    bg: 'rgba(52, 211, 153, 0.12)',
    border: 'rgba(52, 211, 153, 0.4)',
    text: '#34d399',
  };
}

function formatUsed(used: number, unit: string): string {
  if (unit.includes('GB')) return `${used.toLocaleString('pt-BR')} ${unit}`;
  return `${Math.round(used).toLocaleString('pt-BR')} ${unit}`;
}

function shortStatusLabel(status: CostStatus): string {
  if (status === 'cobranca_iniciada') return 'Cobrança iniciada';
  if (status === 'atencao') return 'Atenção';
  return 'Free Tier';
}

export default function CostsView({ m }: { m: AdminMetrics }) {
  const { costs, usage } = m;
  const colors = statusColors(costs.status);
  const tightest = [...costs.resources].sort((a, b) => b.pctOfFree - a.pctOfFree)[0];
  const tightLabel = tightest?.label.split('—')[0]?.trim() ?? '—';

  return (
    <div className="space-y-6">
      <div
        className="rounded-2xl px-5 py-4 flex flex-col gap-1.5"
        style={{ background: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <div className="flex items-center gap-2.5">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              background: colors.text,
              boxShadow: `0 0 10px ${colors.text}`,
            }}
            aria-hidden
          />
          <p className="text-base font-semibold" style={{ color: colors.text }}>
            Status: {shortStatusLabel(costs.status)}
          </p>
        </div>
        <h2 className="text-sm font-medium text-white/60 pl-[22px]">
          Período: {m.periodDays} dias → projeção mensal
        </h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Estimativa cobrável"
          value={`R$ ${costs.estimatedBillableBrl.toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
          })}`}
          hint={`≈ US$ ${costs.estimatedBillableUsd.toFixed(2)} (câmbio ${costs.usdToBrl})`}
          accent={colors.text}
        />
        <KpiCard label="Memórias (total)" value={usage.memoriasTotal} accent="#a78bfa" />
        <KpiCard
          label={`Memórias (${m.periodDays}d)`}
          value={usage.memoriasInPeriod}
          accent="#f472b6"
        />
        <KpiCard
          label="Ativos (7d)"
          value={m.totals.activeInPeriod}
          hint="Base do modelo de leitura/CF"
          accent="#38bdf8"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Uso × free tier (projetado/mês)"
          note="Barras = % da cota gratuita estimada. Acima de 100% = cobrança provável nesse recurso."
        >
          <div className="space-y-4">
            {costs.resources.map((r) => {
              const pct = Math.min(1.5, r.pctOfFree);
              const barColor =
                r.status === 'cobranca_iniciada'
                  ? '#f87171'
                  : r.status === 'atencao'
                    ? '#fbbf24'
                    : '#34d399';
              return (
                <div key={r.id}>
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <p className="text-sm font-medium text-white/85">{r.label}</p>
                    <p className="text-xs text-white/45">
                      {formatUsed(r.used, r.unit)} / {formatUsed(r.freeQuota, r.unit)} free
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, pct * 100)}%`,
                        background: barColor,
                      }}
                    />
                  </div>
                  <p className="text-[11px] text-white/35 mt-1">
                    {(r.pctOfFree * 100).toFixed(0)}% da cota
                    {r.note ? ` · ${r.note}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </ChartCard>

        <div className="space-y-4">
          <ChartCard title="Recurso mais apertado">
            <div className="flex items-center gap-6">
              <ProgressRing
                value={Math.min(tightest?.pctOfFree ?? 0, 1)}
                max={1}
                label={tightLabel}
                color={colors.text}
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white/90">
                  {costs.headroom.limitingResource}
                </p>
                <p className="text-xs text-white/45 mt-2 leading-relaxed">
                  {costs.headroom.note}
                </p>
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Insumos do modelo">
            <ul className="space-y-2">
              {costs.drivers.map((d) => (
                <li
                  key={d.label}
                  className="flex justify-between gap-3 text-sm border-b border-white/5 pb-2 last:border-0"
                >
                  <span className="text-white/50">{d.label}</span>
                  <span className="font-medium text-white/85">{d.value}</span>
                </li>
              ))}
            </ul>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}
