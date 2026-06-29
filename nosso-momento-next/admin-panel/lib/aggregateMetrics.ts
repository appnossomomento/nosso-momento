import type { Firestore } from 'firebase-admin/firestore';
import type { AdminMetrics, AdminUserRow, RecentSignup } from '../types';

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

function fmtDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bump(map: Record<string, number>, key: string) {
  const k = key.trim() || 'Não informado';
  map[k] = (map[k] ?? 0) + 1;
}

function toSortedList(map: Record<string, number>): { label: string; count: number }[] {
  return Object.entries(map)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function isPareado(data: Record<string, unknown>): boolean {
  if (data.pareadoUid) return true;
  if (data.pareadoCom) return true;
  const ativos = data.pareamentosAtivos;
  return Array.isArray(ativos) && ativos.length > 0;
}

function faixaEtaria(dataNascimento: unknown): string {
  const born = toDate(dataNascimento);
  if (!born) return 'Não informado';
  const age = Math.floor((Date.now() - born.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (age < 18) return 'Menor de 18';
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  return '55+';
}

function pareamentoCreatedAt(data: Record<string, unknown>): Date | null {
  return (
    toDate(data.createdAt) ??
    toDate(data.createdAtMs) ??
    toDate(data.criadoEm) ??
    null
  );
}

export async function fetchAllUsers(db: Firestore): Promise<AdminUserRow[]> {
  const snap = await db.collection('usuarios').get();
  return snap.docs.map((doc) => {
    const d = doc.data();
    const created = toDate(d.createdAt);
    const lastCheck = toDate(d.lastCheckInDate);
    return {
      uid: doc.id,
      email: String(d.email ?? ''),
      nome: String(d.nome ?? ''),
      estado: String(d.estado ?? ''),
      cidade: String(d.cidade ?? ''),
      genero: String(d.genero ?? d.sexo ?? ''),
      anatomia: String(d.anatomia ?? d.sexo ?? ''),
      estadoCivil: String(d.estadoCivil ?? ''),
      createdAt: created ? created.toISOString() : '',
      lastCheckIn: lastCheck ? lastCheck.toISOString() : '',
      pareado: isPareado(d),
      notificationsEnabled: d.notificationsEnabled === true,
    };
  });
}

export async function aggregateMetrics(db: Firestore, periodDays: number): Promise<AdminMetrics> {
  const now = Date.now();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;
  const prevPeriodStart = now - periodDays * 2 * 24 * 60 * 60 * 1000;
  const activeStart = now - 7 * 24 * 60 * 60 * 1000;

  const [usersSnap, pareamentosSnap] = await Promise.all([
    db.collection('usuarios').get(),
    db.collection('pareamentos').get(),
  ]);

  let signupsInPeriod = 0;
  let signupsPrevPeriod = 0;
  let activeInPeriod = 0;
  let withPairing = 0;
  let notificationsEnabled = 0;

  const byEstado: Record<string, number> = {};
  const byCidade: Record<string, number> = {};
  const byGenero: Record<string, number> = {};
  const byAnatomia: Record<string, number> = {};
  const byEstadoCivil: Record<string, number> = {};
  const byOrientacao: Record<string, number> = {};
  const byFaixaEtaria: Record<string, number> = {};
  const signupsDayMap: Record<string, number> = {};
  const activeDayMap: Record<string, number> = {};
  const generoPareadoMap: Record<string, { pareado: number; solteiro: number }> = {};
  const recentSignups: RecentSignup[] = [];

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const created = toDate(d.createdAt);
    const lastCheck = toDate(d.lastCheckInDate);
    const pareado = isPareado(d);
    const genero = String(d.genero ?? d.sexo ?? '').trim() || 'Não informado';
    const estado = String(d.estado ?? '').trim();
    const cidade = String(d.cidade ?? '').trim();
    const cidadeKey = cidade && estado ? `${cidade} (${estado})` : cidade || 'Não informado';

    if (created) {
      const ts = created.getTime();
      if (ts >= periodStart) {
        signupsInPeriod += 1;
        bump(signupsDayMap, fmtDay(created));
        recentSignups.push({
          email: String(d.email ?? ''),
          estado: estado || '—',
          createdAt: created.toISOString(),
        });
      } else if (ts >= prevPeriodStart && ts < periodStart) {
        signupsPrevPeriod += 1;
      }
    }

    if (lastCheck) {
      if (lastCheck.getTime() >= activeStart) activeInPeriod += 1;
      if (lastCheck.getTime() >= periodStart) {
        bump(activeDayMap, fmtDay(lastCheck));
      }
    }

    if (pareado) withPairing += 1;
    if (d.notificationsEnabled === true) notificationsEnabled += 1;

    bump(byEstado, estado);
    bump(byCidade, cidadeKey);
    bump(byGenero, genero);
    bump(byAnatomia, String(d.anatomia ?? d.sexo ?? ''));
    bump(byEstadoCivil, String(d.estadoCivil ?? ''));
    bump(byOrientacao, String(d.orientacaoSexual ?? ''));
    bump(byFaixaEtaria, faixaEtaria(d.dataNascimento));

    if (!generoPareadoMap[genero]) generoPareadoMap[genero] = { pareado: 0, solteiro: 0 };
    if (pareado) generoPareadoMap[genero].pareado += 1;
    else generoPareadoMap[genero].solteiro += 1;
  }

  recentSignups.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pareamentosDayMap: Record<string, number> = {};
  for (const doc of pareamentosSnap.docs) {
    const created = pareamentoCreatedAt(doc.data());
    if (created && created.getTime() >= periodStart) {
      bump(pareamentosDayMap, fmtDay(created));
    }
  }

  const signupsByDay = Object.entries(signupsDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const pareamentosByDay = Object.entries(pareamentosDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const activeByDay = Object.entries(activeDayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const signupsGrowthPct =
    signupsPrevPeriod > 0
      ? Math.round(((signupsInPeriod - signupsPrevPeriod) / signupsPrevPeriod) * 1000) / 10
      : signupsInPeriod > 0
        ? 100
        : null;

  const generoPareado = Object.entries(generoPareadoMap)
    .map(([genero, v]) => ({ genero, pareado: v.pareado, solteiro: v.solteiro }))
    .sort((a, b) => b.pareado + b.solteiro - (a.pareado + a.solteiro));

  return {
    generatedAt: new Date().toISOString(),
    periodDays,
    totals: {
      users: usersSnap.size,
      pareamentos: pareamentosSnap.size,
      signupsInPeriod,
      signupsPrevPeriod,
      signupsGrowthPct,
      activeInPeriod,
      withPairing,
      notificationsEnabled,
    },
    signupsByDay,
    pareamentosByDay,
    activeByDay,
    byEstado: toSortedList(byEstado),
    byCidade: toSortedList(byCidade),
    byGenero: toSortedList(byGenero),
    byAnatomia: toSortedList(byAnatomia),
    byEstadoCivil: toSortedList(byEstadoCivil),
    byOrientacao: toSortedList(byOrientacao),
    byFaixaEtaria: toSortedList(byFaixaEtaria),
    generoPareado,
    recentSignups: recentSignups.slice(0, 20),
  };
}

export function usersToCsv(rows: AdminUserRow[]): string {
  const header = [
    'uid',
    'email',
    'nome',
    'estado',
    'cidade',
    'genero',
    'anatomia',
    'estadoCivil',
    'createdAt',
    'lastCheckIn',
    'pareado',
    'notificationsEnabled',
  ];
  const escape = (v: string | boolean) => {
    const s = String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(
      [
        row.uid,
        row.email,
        row.nome,
        row.estado,
        row.cidade,
        row.genero,
        row.anatomia,
        row.estadoCivil,
        row.createdAt,
        row.lastCheckIn,
        row.pareado,
        row.notificationsEnabled,
      ]
        .map(escape)
        .join(','),
    );
  }
  return lines.join('\n');
}
