/** Registra abertura do app no dia (1x por dia, por aba). Falha silenciosa — não bloqueia login. */
export function recordDailyAppOpen(): void {
  if (typeof window === 'undefined') return;
  const day = new Date().toISOString().slice(0, 10);
  const key = `nm_app_open_${day}`;
  if (sessionStorage.getItem(key)) return;

  void fetch('/api/auth/app-open', { method: 'POST', credentials: 'include' })
    .then((res) => {
      if (res.ok) sessionStorage.setItem(key, '1');
    })
    .catch(() => {});
}
