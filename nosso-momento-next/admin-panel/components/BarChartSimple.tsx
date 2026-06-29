'use client';

type Item = { label: string; count: number };

type Props = {
  title: string;
  items: Item[];
  maxItems?: number;
};

export default function BarChartSimple({ title, items, maxItems = 12 }: Props) {
  const slice = items.slice(0, maxItems);
  const max = Math.max(1, ...slice.map((i) => i.count));

  if (!slice.length) {
    return (
      <div className="rounded-xl p-4 border border-white/10 bg-[#0f0b14]">
        <h3 className="text-sm font-medium text-white/80 mb-3">{title}</h3>
        <p className="text-xs text-white/40">Sem dados ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-4 border border-white/10 bg-[#0f0b14]">
      {title ? <h3 className="text-sm font-medium text-white/80 mb-4">{title}</h3> : null}
      <div className="space-y-2">
        {slice.map((item) => (
          <div key={item.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-white/70 truncate pr-2">{item.label}</span>
              <span className="text-white/50 tabular-nums shrink-0">{item.count}</span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(item.count / max) * 100}%`,
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
