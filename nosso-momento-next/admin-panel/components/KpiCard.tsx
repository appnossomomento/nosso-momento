'use client';

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
  delta?: number | null;
};

export default function KpiCard({ label, value, hint, accent = '#ff5565', delta }: Props) {
  return (
    <div
      className="rounded-xl p-4 border border-white/10"
      style={{ background: 'linear-gradient(145deg, #1a1225 0%, #0f0b14 100%)' }}
    >
      <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {delta != null && (
        <p className={`text-xs mt-1 tabular-nums ${delta >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {delta >= 0 ? '+' : ''}
          {delta}% vs período anterior
        </p>
      )}
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}
