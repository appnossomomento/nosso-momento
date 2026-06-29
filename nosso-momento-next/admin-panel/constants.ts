export type AdminSectionId =
  | 'geral'
  | 'geolocalizada'
  | 'pessoas'
  | 'pareamento'
  | 'demografica'
  | 'engajamento'
  | 'loja'
  | 'cadastros'
  | 'exportacao';

export const ADMIN_SECTIONS: { id: AdminSectionId; label: string; icon: string }[] = [
  { id: 'geral', label: 'Visão Geral', icon: '◉' },
  { id: 'geolocalizada', label: 'Geolocalizada', icon: '⌖' },
  { id: 'pessoas', label: 'Pessoas', icon: '♀♂' },
  { id: 'pareamento', label: 'Pareamento', icon: '♥' },
  { id: 'demografica', label: 'Demográfica', icon: '▤' },
  { id: 'engajamento', label: 'Engajamento', icon: '↗' },
  { id: 'loja', label: 'Loja', icon: '◈' },
  { id: 'cadastros', label: 'Cadastros', icon: '+' },
  { id: 'exportacao', label: 'Exportação', icon: '↓' },
];

export const PERIOD_OPTIONS = [
  { days: 7, label: '7 dias' },
  { days: 15, label: '15 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 180, label: '6 meses' },
  { days: 365, label: '12 meses' },
] as const;

export const CHART_COLORS = ['#ff5565', '#a78bfa', '#34d399', '#38bdf8', '#f472b6', '#fbbf24'];

export const ADMIN_SELECT_CLASS =
  'rounded-lg bg-[#2a2a2a] text-white border border-white/15 px-3 py-2 text-sm outline-none focus:border-[#ff5565] focus:ring-2 focus:ring-[#ff5565]/20';
