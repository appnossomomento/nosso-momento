let inFlight: Promise<number | null> | null = null;

/** Garante numeroUsuario via API (cadastro ou backfill no login). */
export async function ensureUserNumber(): Promise<number | null> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    try {
      const res = await fetch('/api/auth/allocate-user-number', { method: 'POST' });
      if (!res.ok) return null;
      const data = (await res.json()) as { numeroUsuario?: unknown };
      const n = Number(data.numeroUsuario);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
