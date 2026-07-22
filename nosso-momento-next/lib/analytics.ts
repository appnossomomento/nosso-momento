/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Analytics wrappers — GA4 (G-556FY0WV3Q) + Meta Pixel (1883535982201745)
 * Ambos os scripts são carregados no app/layout.tsx.
 * Estas funções são safe-call: falham silenciosamente se os scripts não carregaram.
 */

declare function gtag(...args: any[]): void;
declare function fbq(...args: any[]): void;

export function trackGA(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof gtag !== 'undefined') {
      gtag('event', event, params);
    }
  } catch (_) {}
}

/** Evento padrão do Meta (AddToCart, Purchase, Lead...) — usado para otimização de anúncios. */
export function trackMeta(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof fbq !== 'undefined') {
      fbq('track', event, params);
    }
  } catch (_) {}
}

/** Evento CUSTOMIZADO do Meta (nomes de negócio: RegistroHumor, ShareMemoria...). */
export function trackMetaCustom(event: string, params: Record<string, unknown> = {}) {
  try {
    if (typeof fbq !== 'undefined') {
      fbq('trackCustom', event, params);
    }
  } catch (_) {}
}

/**
 * Registro central de eventos de negócio.
 * - `ga`: nome do evento no GA4 (snake_case). Para e-commerce mantemos os nomes
 *   recomendados (add_to_cart, purchase) para habilitar os relatórios nativos.
 * - `meta`: nome do evento no Meta Pixel.
 * - `std`: se true, dispara como evento PADRÃO do Meta (fbq track); se false, como
 *   evento CUSTOMIZADO (fbq trackCustom).
 * - `label`: nome de negócio exibido no parâmetro `acao` (facilita ver no GA4/Pixel).
 */
export const APP_EVENTS = {
  momentos_carrinho: { ga: 'add_to_cart', meta: 'AddToCart', std: true, label: 'MomentosNoCarrinho' },
  momento_resgatado: { ga: 'purchase', meta: 'Purchase', std: true, label: 'MomentoResgatado' },
  registro_humor: { ga: 'registro_humor', meta: 'RegistroHumor', std: false, label: 'RegistroHumor' },
  momento_realizado: { ga: 'momento_realizado', meta: 'MomentoRealizado', std: false, label: 'MomentoRealizado' },
  share_memoria: { ga: 'share_memoria', meta: 'ShareMemoria', std: false, label: 'ShareMemoria' },
  pareamento_link: { ga: 'pareamento_link', meta: 'PareamentoLink', std: false, label: 'PareamentoLink' },
  pareamento_manual: { ga: 'pareamento_manual', meta: 'PareamentoManual', std: false, label: 'PareamentoManual' },
  seja_vip: { ga: 'seja_vip', meta: 'SejaVip', std: false, label: 'SejaVip' },
  clique_botao_lp: { ga: 'clique_botao_lp', meta: 'CliqueBotaoLP', std: false, label: 'CliqueBotaoLP' },
} as const;

export type AppEventKey = keyof typeof APP_EVENTS;

/**
 * Dispara uma ação de negócio simultaneamente no GA4 e no Meta Pixel,
 * usando o mapeamento de `APP_EVENTS`. Preferir esta função para novos eventos.
 */
export function trackAction(key: AppEventKey, params: Record<string, unknown> = {}) {
  const def = APP_EVENTS[key];
  if (!def) return;
  trackGA(def.ga, { ...params, acao: def.label });
  if (def.std) trackMeta(def.meta, params);
  else trackMetaCustom(def.meta, params);
}

/** Mapa de rotas -> nome amigável de tela (screen tracking). */
export function screenNameFromPath(pathname: string): string {
  const map: Record<string, string> = {
    '/dashboard': 'Início',
    '/loja': 'Loja',
    '/momentos': 'Momentos',
    '/memorias': 'Memórias',
    '/parear': 'Parear',
    '/parceiro': 'Parceiro',
    '/perfil': 'Perfil',
    '/clima': 'Clima',
    '/desafios': 'Desafios',
    '/extrato': 'Extrato',
    '/notificacoes': 'Notificações',
    '/personalizar': 'Personalizar',
    '/login': 'Login',
    '/cadastro': 'Cadastro',
  };
  if (map[pathname]) return map[pathname];
  if (pathname.startsWith('/convite')) return 'Convite';
  return pathname;
}

/** Dispara screen_view (GA4) + PageView (Meta) para a tela atual. */
export function trackScreenView(pathname: string) {
  const screen = screenNameFromPath(pathname);
  trackGA('screen_view', { screen_name: screen, page_path: pathname });
  trackGA('page_view', { page_path: pathname, page_title: screen });
}
