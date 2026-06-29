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
  byGenero: LabelCount[];
  byAnatomia: LabelCount[];
  byEstadoCivil: LabelCount[];
  byOrientacao: LabelCount[];
  byFaixaEtaria: LabelCount[];
  generoPareado: { genero: string; pareado: number; solteiro: number }[];
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
