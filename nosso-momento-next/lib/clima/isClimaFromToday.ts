import { saoPauloDateString } from '@/lib/utils/saoPauloDate';

function toDate(registradoEm: unknown): Date | null {
  if (!registradoEm) return null;
  try {
    if (typeof registradoEm === 'object' && registradoEm !== null && 'toDate' in registradoEm) {
      return (registradoEm as { toDate: () => Date }).toDate();
    }
    if (typeof registradoEm === 'object' && registradoEm !== null && 'seconds' in registradoEm) {
      return new Date((registradoEm as { seconds: number }).seconds * 1000);
    }
    return new Date(registradoEm as string | number);
  } catch {
    return null;
  }
}

/** True se o check-in de clima é do dia civil atual em America/Sao_Paulo. */
export function isClimaFromToday(
  clima: { registradoEm?: unknown } | null | undefined,
): boolean {
  if (!clima) return false;
  const d = toDate(clima.registradoEm);
  if (!d || Number.isNaN(d.getTime())) return false;
  return saoPauloDateString(d) === saoPauloDateString();
}
