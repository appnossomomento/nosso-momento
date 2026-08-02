/**
 * Estimativa de custos Firebase/Blaze a partir de métricas internas.
 * NÃO é fatura real — usa cotas free tier públicas + preço Blaze aproximado (USD→BRL).
 */

export type CostStatus = 'atual' | 'atencao' | 'cobranca_iniciada';

export type CostResource = {
  id: string;
  label: string;
  unit: string;
  used: number;
  freeQuota: number;
  /** 0–1+ (pode passar de 100%) */
  pctOfFree: number;
  status: CostStatus;
  note?: string;
};

export type CostEstimate = {
  status: CostStatus;
  statusLabel: string;
  /** USD estimado cobrável no mês (acima do free) */
  estimatedBillableUsd: number;
  estimatedBillableBrl: number;
  usdToBrl: number;
  disclaimer: string;
  resources: CostResource[];
  drivers: { label: string; value: string }[];
  /** Escala aproximada até estourar o recurso mais apertado */
  headroom: {
    limitingResource: string;
    usersUntilLimit: number | null;
    note: string;
  };
};

export type CostUsageInput = {
  users: number;
  active7d: number;
  pareamentos: number;
  memoriasTotal: number;
  memoriasInPeriod: number;
  periodDays: number;
  signupsInPeriod: number;
  /** Soma de logins únicos no período (analytics_daily_logins) */
  loginEventsInPeriod: number;
};

/** Cotas free mensais aproximadas (Blaze inclui free tier diário × 30). */
const FREE = {
  firestoreReads: 50_000 * 30,
  firestoreWrites: 20_000 * 30,
  storageGb: 5,
  storageDownloadGb: 1 * 30,
  functionInvokes: 2_000_000,
};

/** Preços Blaze aproximados (USD). */
const PRICE = {
  readPer100k: 0.06,
  writePer100k: 0.18,
  storagePerGb: 0.026,
  downloadPerGb: 0.12,
  functionPerMillion: 0.4,
};

const USD_BRL = 5.5;
/** Tamanho médio estimado por memória (MB). */
const MB_PER_MEMORIA = 0.75;

function statusFromPct(pct: number): CostStatus {
  if (pct >= 1) return 'cobranca_iniciada';
  if (pct >= 0.7) return 'atencao';
  return 'atual';
}

function worstStatus(statuses: CostStatus[]): CostStatus {
  if (statuses.includes('cobranca_iniciada')) return 'cobranca_iniciada';
  if (statuses.includes('atencao')) return 'atencao';
  return 'atual';
}

function statusLabel(s: CostStatus): string {
  if (s === 'cobranca_iniciada') return 'Cobrança iniciada (estimada)';
  if (s === 'atencao') return 'Atenção — perto do free tier';
  return 'Atual — dentro do free tier (estimado)';
}

function billable(used: number, free: number, pricePerUnit: number, unitSize: number): number {
  const over = Math.max(0, used - free);
  if (over <= 0) return 0;
  return (over / unitSize) * pricePerUnit;
}

function resource(
  id: string,
  label: string,
  unit: string,
  used: number,
  freeQuota: number,
  note?: string,
): CostResource {
  const pctOfFree = freeQuota > 0 ? used / freeQuota : 0;
  return {
    id,
    label,
    unit,
    used,
    freeQuota,
    pctOfFree,
    status: statusFromPct(pctOfFree),
    note,
  };
}

/**
 * Projeta uso mensal a partir do período observado e calcula status/custo.
 */
export function estimateCosts(input: CostUsageInput): CostEstimate {
  const days = Math.max(1, input.periodDays);
  const scaleToMonth = 30 / days;

  // Heurísticas conservadoras de produto Nosso Momento
  const readsPerActiveDay = 120; // listeners + telas
  const estimatedReadsMonth =
    input.active7d * (30 / 7) * readsPerActiveDay +
    input.loginEventsInPeriod * scaleToMonth * 40;

  const estimatedWritesMonth =
    input.signupsInPeriod * scaleToMonth * 8 +
    input.memoriasInPeriod * scaleToMonth * 3 +
    input.active7d * (30 / 7) * 2; // clima etc.

  const storageGb = (input.memoriasTotal * MB_PER_MEMORIA) / 1024;
  // Download: cada memória vista ~2× no mês por usuário ativo do casal
  const downloadGb =
    (input.memoriasInPeriod * scaleToMonth * MB_PER_MEMORIA * 2.5) / 1024;

  const cfInvokesMonth =
    input.loginEventsInPeriod * scaleToMonth * 8 +
    input.memoriasInPeriod * scaleToMonth * 4 +
    input.active7d * (30 / 7) * 15;

  const resources = [
    resource(
      'reads',
      'Firestore — leituras',
      'ops/mês',
      Math.round(estimatedReadsMonth),
      FREE.firestoreReads,
      'Estimado por ativos + logins (listeners).',
    ),
    resource(
      'writes',
      'Firestore — escritas',
      'ops/mês',
      Math.round(estimatedWritesMonth),
      FREE.firestoreWrites,
      'Cadastros, memórias, clima.',
    ),
    resource(
      'storage',
      'Storage — armazenado',
      'GB',
      Math.round(storageGb * 1000) / 1000,
      FREE.storageGb,
      `~${MB_PER_MEMORIA} MB por memória × ${input.memoriasTotal} fotos.`,
    ),
    resource(
      'download',
      'Storage — download',
      'GB/mês',
      Math.round(downloadGb * 1000) / 1000,
      FREE.storageDownloadGb,
      'Projeção a partir de memórias do período.',
    ),
    resource(
      'functions',
      'Cloud Functions',
      'invocações/mês',
      Math.round(cfInvokesMonth),
      FREE.functionInvokes,
      'getMemorias, processInput, perfil, etc.',
    ),
  ];

  const estimatedBillableUsd =
    billable(estimatedReadsMonth, FREE.firestoreReads, PRICE.readPer100k, 100_000) +
    billable(estimatedWritesMonth, FREE.firestoreWrites, PRICE.writePer100k, 100_000) +
    billable(storageGb, FREE.storageGb, PRICE.storagePerGb, 1) +
    billable(downloadGb, FREE.storageDownloadGb, PRICE.downloadPerGb, 1) +
    billable(cfInvokesMonth, FREE.functionInvokes, PRICE.functionPerMillion, 1_000_000);

  const overall = worstStatus(resources.map((r) => r.status));
  // Se já tem billable > 1 centavo, marca cobrança
  const status =
    estimatedBillableUsd >= 0.01 ? 'cobranca_iniciada' : overall;

  const tightest = [...resources].sort((a, b) => b.pctOfFree - a.pctOfFree)[0];
  const users = Math.max(1, input.users);
  const usersUntilLimit =
    tightest && tightest.pctOfFree > 0
      ? Math.max(0, Math.round(users * (1 / tightest.pctOfFree - 1)))
      : null;

  return {
    status,
    statusLabel: statusLabel(status),
    estimatedBillableUsd: Math.round(estimatedBillableUsd * 100) / 100,
    estimatedBillableBrl: Math.round(estimatedBillableUsd * USD_BRL * 100) / 100,
    usdToBrl: USD_BRL,
    disclaimer:
      'Estimativa interna com cotas/preços públicos do Blaze. Não é a fatura do Google. Fotos e listeners reais podem variar.',
    resources,
    drivers: [
      { label: 'Usuários', value: String(input.users) },
      { label: 'Ativos (7d)', value: String(input.active7d) },
      { label: 'Pareamentos', value: String(input.pareamentos) },
      { label: 'Memórias (total)', value: String(input.memoriasTotal) },
      {
        label: `Memórias (${input.periodDays}d)`,
        value: String(input.memoriasInPeriod),
      },
      {
        label: `Logins únicos somados (${input.periodDays}d)`,
        value: String(input.loginEventsInPeriod),
      },
    ],
    headroom: {
      limitingResource: tightest?.label ?? '—',
      usersUntilLimit,
      note:
        usersUntilLimit == null
          ? 'Sem base suficiente para projetar.'
          : usersUntilLimit === 0
            ? 'Já no limite (ou acima) do recurso mais apertado — no modelo estimado.'
            : `No ritmo atual, ~${usersUntilLimit} usuários a mais até estourar “${tightest.label}” (modelo linear grosseiro).`,
    },
  };
}
