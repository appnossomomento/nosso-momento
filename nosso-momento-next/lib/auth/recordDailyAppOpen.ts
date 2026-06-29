/** Registra abertura do app no dia (1x por dia, por aba). */
export function recordDailyAppOpen(): void {
  if (typeof window === 'undefined') return;
  const day = new Date().toISOString().slice(0, 10);
  const key = `nm_app_open_${day}`;
  if (sessionStorage.getItem(key)) return;
  sessionStorage.setItem(key, '1');
  void fetch('/api/auth/app-open', { method: 'POST', credentials: 'include' }).catch(() => {});
}
