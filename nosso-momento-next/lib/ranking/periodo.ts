/** Dias restantes até o fim do período, vindo do `periodEndsAt` da CF. */
export function diasRestantesAte(endsAt: number): number {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
