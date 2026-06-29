import type { LojaMetrics } from '@/admin-panel/lib/aggregateLojaMetrics';

export type LabelCount = { label: string; count: number };

export type RecentSignup = {
  email: string;
  estado: string;
  createdAt: string;
};

export type AdminMetrics = {
  generatedAt: string;
  periodDays: number;
  totals: {
    users: number;
    pareamentos: number;
    signupsInPeriod: number;
    signupsPrevPeriod: number;
    signupsGrowthPct: number | null;
    activeInPeriod: number;
    withPairing: number;
    notificationsEnabled: number;
  };
  signupsByDay: { date: string; count: number }[];
  pareamentosByDay: { date: string; count: number }[];
  activeByDay: { date: string; count: number }[];
  byEstado: LabelCount[];
  byCidade: LabelCount[];
  /** Anatomia normalizada — apenas Masculino e Feminino */
  byAnatomia: LabelCount[];
  byOrientacao: LabelCount[];
  byEstadoCivil: LabelCount[];
  byFaixaEtaria: LabelCount[];
  loja: LojaMetrics;
  recentSignups: RecentSignup[];
};

export type AdminUserRow = {
  uid: string;
  email: string;
  nome: string;
  estado: string;
  cidade: string;
  genero: string;
  anatomia: string;
  estadoCivil: string;
  createdAt: string;
  lastCheckIn: string;
  pareado: boolean;
  notificationsEnabled: boolean;
};
