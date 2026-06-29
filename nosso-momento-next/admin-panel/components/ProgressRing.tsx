'use client';

type Props = {
  value: number;
  max?: number;
  label: string;
  color?: string;
  size?: number;
};

export default function ProgressRing({
  value,
  max = 100,
  label,
  color = '#ff5565',
  size = 96,
}: Props) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div className="flex flex-col items-center gap-2 p-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeDasharray={c}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold tabular-nums text-white">{pct}%</span>
        </div>
      </div>
      <p className="text-xs text-white/50 text-center leading-tight">{label}</p>
    </div>
  );
}
