import type { Firestore } from 'firebase-admin/firestore';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const d = (value as { toDate: () => Date }).toDate();
    return d instanceof Date ? d : null;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function tsMs(data: Record<string, unknown>, ...fields: string[]): number | null {
  for (const f of fields) {
    const raw = data[f];
    const d = toDate(raw);
    if (d) return d.getTime();
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function fmtDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function bumpDay(map: Record<string, number>, ms: number) {
  bump(map, fmtDay(ms));
}

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function toSortedDays(map: Record<string, number>): { date: string; count: number }[] {
  return Object.entries(map)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type LojaMetrics = {
  resgatadosInPeriod: number;
  pendentesTotal: number;
  realizadosComFotoInPeriod: number;
  realizadosSemFotoInPeriod: number;
  resgatadosByDay: { date: string; count: number }[];
  realizadosByDay: { date: string; count: number }[];
  memoriasCriadasInPeriod: number;
  memoriasByDay: { date: string; count: number }[];
  /** Carrinho é client-side (Zustand) — não persistido no Firestore */
  carrinhosAbandonadosTracked: false;
  /** Compartilhamento via navigator.share — sem evento no backend ainda */
  compartilhamentosMemoriasTracked: false;
  /** Curtidas de memórias — feature não implementada no backend */
  curtidasMemoriasTracked: false;
};

export async function aggregateLojaMetrics(
  db: Firestore,
  periodStart: number,
): Promise<LojaMetrics> {
  const [tarefasSnap, memoriasSnap] = await Promise.all([
    db.collection('tarefasMomentos').get(),
    db.collection('memorias').get(),
  ]);

  let resgatadosInPeriod = 0;
  let pendentesTotal = 0;
  let realizadosComFotoInPeriod = 0;
  let realizadosSemFotoInPeriod = 0;
  let memoriasCriadasInPeriod = 0;

  const resgatadosDayMap: Record<string, number> = {};
  const realizadosDayMap: Record<string, number> = {};
  const memoriasDayMap: Record<string, number> = {};

  for (const doc of tarefasSnap.docs) {
    const d = doc.data();
    const status = String(d.status ?? '').toLowerCase();
    const resgateMs = tsMs(d, 'dataResgate', 'dataResgateMs', 'createdAtMs');
    const conclusaoMs = tsMs(d, 'dataConclusao', 'dataConclusaoMs');

    if (status === 'pendente') pendentesTotal += 1;

    if (resgateMs !== null && resgateMs >= periodStart) {
      resgatadosInPeriod += 1;
      bumpDay(resgatadosDayMap, resgateMs);
    }

    if (status === 'realizado' && conclusaoMs !== null && conclusaoMs >= periodStart) {
      bumpDay(realizadosDayMap, conclusaoMs);
      if (d.comFoto === true) realizadosComFotoInPeriod += 1;
      else realizadosSemFotoInPeriod += 1;
    }
  }

  for (const doc of memoriasSnap.docs) {
    const d = doc.data();
    const createdMs = tsMs(d, 'createdAtMs', 'createdAt');
    if (createdMs !== null && createdMs >= periodStart) {
      memoriasCriadasInPeriod += 1;
      bumpDay(memoriasDayMap, createdMs);
    }
  }

  return {
    resgatadosInPeriod,
    pendentesTotal,
    realizadosComFotoInPeriod,
    realizadosSemFotoInPeriod,
    resgatadosByDay: toSortedDays(resgatadosDayMap),
    realizadosByDay: toSortedDays(realizadosDayMap),
    memoriasCriadasInPeriod,
    memoriasByDay: toSortedDays(memoriasDayMap),
    carrinhosAbandonadosTracked: false,
    compartilhamentosMemoriasTracked: false,
    curtidasMemoriasTracked: false,
  };
}
