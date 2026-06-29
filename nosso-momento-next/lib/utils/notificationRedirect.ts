/** Mapeia redirectTo legado (SPA) e tipo de notificação para rotas do Next.js. */

export type NotificationRedirectTarget = {
  path: string;
  openAchievementsPopup?: boolean;
};

const LEGACY_SCREEN_MAP: Record<string, NotificationRedirectTarget> = {
  main: { path: '/dashboard' },
  momentos: { path: '/momentos' },
  perfil: { path: '/perfil' },
  perfilParceiro: { path: '/parceiro' },
  achievementsPopup: { path: '/dashboard', openAchievementsPopup: true },
};

export function resolveNotificationTarget(
  redirectTo?: string | null,
  tipo?: string | null,
): NotificationRedirectTarget {
  const key = typeof redirectTo === 'string' ? redirectTo.trim() : '';
  if (key && LEGACY_SCREEN_MAP[key]) {
    return LEGACY_SCREEN_MAP[key];
  }
  if (key.startsWith('/')) {
    return { path: key };
  }

  const type = typeof tipo === 'string' ? tipo.trim() : '';
  if (type === 'lembrete_humor') return { path: '/clima' };
  if (type === 'momento_resgatado' || type === 'moment_completion') return { path: '/momentos' };
  if (type === 'achievement' || type === 'milestone') {
    return { path: '/dashboard', openAchievementsPopup: true };
  }
  if (type === 'pairing') return { path: '/parear' };
  if (type === 'vip_activated') return { path: '/perfil' };

  return { path: key ? '/notificacoes' : '/dashboard' };
}

/** URL para abrir nova janela/aba a partir do service worker. */
export function notificationTargetToUrl(
  redirectTo?: string | null,
  tipo?: string | null,
): string {
  const target = resolveNotificationTarget(redirectTo, tipo);
  if (target.openAchievementsPopup) {
    return `${target.path}?achievements=1`;
  }
  return target.path;
}
