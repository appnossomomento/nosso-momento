'use client';

type Props = {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
};

export default function StatCard({ label, value, hint, accent = '#ff2d3f' }: Props) {
  return (
    <div
      className="rounded-xl p-4 border border-white/10"
      style={{ background: 'linear-gradient(145deg, #1a1225 0%, #0f0b14 100%)' }}
    >
      <p className="text-xs text-white/50 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
        {value}
      </p>
      {hint && <p className="text-xs text-white/40 mt-1">{hint}</p>}
    </div>
  );
}
