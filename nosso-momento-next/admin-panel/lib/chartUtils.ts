type DayPoint = { date: string; count: number };
type LabelCount = { label: string; count: number };

export function rollupWeekly(points: DayPoint[]): LabelCount[] {
  const weeks: Record<string, number> = {};
  for (const p of points) {
    const d = new Date(p.date + 'T12:00:00');
    const start = new Date(d);
    start.setDate(d.getDate() - d.getDay());
    const key = start.toISOString().slice(0, 10);
    weeks[key] = (weeks[key] ?? 0) + p.count;
  }
  return Object.entries(weeks)
    .map(([label, count]) => ({ label: label.slice(5), count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function rollupMonthly(points: DayPoint[]): LabelCount[] {
  const months: Record<string, number> = {};
  for (const p of points) {
    const key = p.date.slice(0, 7);
    months[key] = (months[key] ?? 0) + p.count;
  }
  return Object.entries(months)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function pct(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 1000) / 10;
}

export function formatTelefoneBr(telefone: string): string {
  const digits = telefone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return digits || '—';
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0] ?? ''}***@${domain}`;
}

export function withPercent(items: LabelCount[], total?: number): (LabelCount & { pct: number })[] {
  const base = total ?? items.reduce((s, i) => s + i.count, 0);
  return items.map((i) => ({ ...i, pct: pct(i.count, base) }));
}
