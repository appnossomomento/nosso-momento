export const GASTO_CATEGORIAS = [
  'Moradia',
  'Mercado',
  'Transporte',
  'Lazer',
  'Saúde',
  'Contas',
  'Outros',
] as const;

export type GastoCategoria = (typeof GASTO_CATEGORIAS)[number];

export const CATEGORIA_COLORS: Record<GastoCategoria, string> = {
  Moradia: '#f43f5e',
  Mercado: '#fb923c',
  Transporte: '#a78bfa',
  Lazer: '#34d399',
  Saúde: '#fb7185',
  Contas: '#60a5fa',
  Outros: '#94a3b8',
};

export function formatBRLFromCentavos(centavos: number): string {
  return (centavos / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

export function parseBRLToCentavos(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100);
}
