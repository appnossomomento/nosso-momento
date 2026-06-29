'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS } from '@/admin-panel/constants';
import EmptyState from '@/admin-panel/components/EmptyState';

type Item = { label: string; count: number };

type Props = {
  items: Item[];
  centerLabel?: string;
};

export default function DonutChart({ items, centerLabel }: Props) {
  const data = items.filter((i) => i.count > 0).slice(0, 8);
  const total = data.reduce((s, i) => s + i.count, 0);

  if (!data.length) return <EmptyState />;

  return (
    <div className="flex flex-col md:flex-row items-center gap-4">
      <div className="relative w-full max-w-[200px] h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#2a2a2a',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-sm font-semibold text-white/80">{centerLabel}</span>
          </div>
        )}
        {!centerLabel && total > 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-xl font-bold text-white tabular-nums">{total}</span>
          </div>
        )}
      </div>
      <ul className="flex-1 space-y-1.5 text-xs w-full">
        {data.map((item, i) => (
          <li key={item.label} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-white/70 truncate">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: CHART_COLORS[i % CHART_COLORS.length] }}
              />
              {item.label}
            </span>
            <span className="text-white/50 tabular-nums shrink-0">
              {item.count} ({Math.round((item.count / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
