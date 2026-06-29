export default function VipStatusBanner() {
  return (
    <div
      className="rounded-xl border border-amber-500/35 px-4 py-3 flex items-center gap-3"
      style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.14) 0%, rgba(234,179,8,0.08) 100%)' }}
    >
      <div className="w-10 h-10 rounded-full bg-amber-500/25 flex items-center justify-center shrink-0">
        <i className="fas fa-star text-amber-300 text-sm" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-amber-300 leading-tight">⭐ VIP ATIVO!</p>
        <p className="text-xs text-white/55 mt-0.5">Aproveite suas regalias.</p>
      </div>
    </div>
  );
}
