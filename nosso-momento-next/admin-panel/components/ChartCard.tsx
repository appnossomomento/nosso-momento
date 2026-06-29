'use client';

type Props = {
  title: string;
  children: React.ReactNode;
  note?: string;
};

export default function ChartCard({ title, children, note }: Props) {
  return (
    <div className="rounded-xl p-4 border border-white/10 bg-[rgba(30,30,30,0.7)] backdrop-blur-sm">
      <h3 className="text-sm font-medium text-white/80 mb-1">{title}</h3>
      {note && <p className="text-xs text-white/35 mb-3">{note}</p>}
      {!note && <div className="mb-3" />}
      {children}
    </div>
  );
}
