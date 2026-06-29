'use client';

import { withPercent } from '@/admin-panel/lib/chartUtils';
import EmptyState from '@/admin-panel/components/EmptyState';

type Item = { label: string; count: number };

type Props = {
  items: Item[];
  total?: number;
};

export default function GeoMapBr({ items, total }: Props) {
  const top = withPercent(items.slice(0, 10), total);
  const max = top[0]?.count ?? 1;

  if (!top.length) return <EmptyState message="Sem dados geográficos ainda." />;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {top.slice(0, 5).map((uf) => (
          <div
            key={uf.label}
            className="rounded-lg border border-white/10 bg-[#1a1225] px-3 py-2 text-center"
          >
            <p className="text-lg font-bold text-[#ff5565] tabular-nums">{uf.count}</p>
            <p className="text-xs text-white/50 truncate">{uf.label}</p>
            <p className="text-[10px] text-white/35">{uf.pct}%</p>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {top.map((uf) => (
          <div key={uf.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/70">{uf.label}</span>
              <span className="text-white/50 tabular-nums">
                {uf.count} ({uf.pct}%)
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(uf.count / max) * 100}%`,
                  background: 'linear-gradient(90deg, #ff2d3f, #ff5565)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
