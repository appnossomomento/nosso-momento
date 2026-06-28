export const MESES_NASCIMENTO = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
] as const;

export function diasNoMes(mes: number, ano: number): number {
  if (!mes || !ano) return 31;
  return new Date(ano, mes, 0).getDate();
}

export function buildDiaOptions(mes: string, ano: string): { value: string; label: string }[] {
  const m = parseInt(mes, 10);
  const y = parseInt(ano, 10);
  const total = mes && ano ? diasNoMes(m, y) : 31;
  return Array.from({ length: total }, (_, i) => {
    const d = String(i + 1);
    return { value: d, label: d.padStart(2, '0') };
  });
}

export function buildAnoNascimentoOptions(minAge = 18, maxAge = 120): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  const maxYear = currentYear - minAge;
  const minYear = currentYear - maxAge;
  const years: { value: string; label: string }[] = [];
  for (let y = maxYear; y >= minYear; y--) {
    years.push({ value: String(y), label: String(y) });
  }
  return years;
}
