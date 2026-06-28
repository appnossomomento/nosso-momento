export const APELIDO_REAL_MAX_LENGTH = 12;

export function primeiroNome(nome?: string | null): string {
  if (!nome?.trim()) return '';
  return nome.trim().split(/\s+/)[0] ?? '';
}

export function nomeParaCard(input: {
  apelidoReal?: string | null;
  nome?: string | null;
  fallback?: string;
}): string {
  const apelido = input.apelidoReal?.trim();
  if (apelido) return apelido;
  const primeiro = primeiroNome(input.nome);
  if (primeiro) return primeiro;
  return input.fallback ?? '';
}

export function montarNomesCasal(
  usuario: { apelidoReal?: string | null; nome?: string | null } | null | undefined,
  parceiro: { apelidoReal?: string | null; nome?: string | null } | null | undefined,
): string {
  const meu = nomeParaCard({ apelidoReal: usuario?.apelidoReal, nome: usuario?.nome });
  const par = nomeParaCard({ apelidoReal: parceiro?.apelidoReal, nome: parceiro?.nome });
  const joined = [meu, par].filter(Boolean).join(' e ');
  return joined || 'Nosso Momento';
}
