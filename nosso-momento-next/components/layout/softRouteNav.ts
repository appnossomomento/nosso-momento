'use client';

/** Marca fade CSS só quando o browser não tem View Transitions. */
export const SOFT_ENTER_KEY = 'nm-soft-enter';
export const SOFT_EXIT_EVENT = 'nm-soft-nav-exit';

/** Em um <a>/<Link>: data-soft-nav="off" pula a soft nav. */
export const SOFT_NAV_OFF = 'off';

type DocWithVT = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

type RouterLike = {
  push: (href: string) => void;
  replace?: (href: string) => void;
  back?: () => void;
};

/** Evita empilhar View Transitions / timeouts em toques rápidos. */
let softNavLock = false;

function hasViewTransition(): DocWithVT | null {
  if (typeof document === 'undefined') return null;
  const doc = document as DocWithVT;
  return typeof doc.startViewTransition === 'function' ? doc : null;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function markCssFallback() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SOFT_ENTER_KEY, '1');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(SOFT_EXIT_EVENT));
}

function runNative(update: () => void) {
  const doc = hasViewTransition()!;
  softNavLock = true;
  document.documentElement.classList.add('soft-vt');
  const vt = doc.startViewTransition!(update);
  void vt.finished.finally(() => {
    document.documentElement.classList.remove('soft-vt');
    softNavLock = false;
  });
}

/**
 * Navegação suave para qualquer rota do app.
 * Prefere View Transitions nativa; senão fade CSS saída/entrada.
 */
export function softNavigate(
  router: RouterLike,
  href: string,
  method: 'push' | 'replace' = 'push',
) {
  if (softNavLock) return;

  const go = () => {
    if (method === 'replace' && router.replace) router.replace(href);
    else router.push(href);
  };

  if (prefersReducedMotion()) {
    go();
    return;
  }

  if (hasViewTransition()) {
    runNative(go);
    return;
  }

  softNavLock = true;
  markCssFallback();
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      go();
      softNavLock = false;
    }, 180);
    return;
  }
  softNavLock = false;
  go();
}

export function softPush(router: RouterLike, href: string) {
  softNavigate(router, href, 'push');
}

export function softReplace(router: RouterLike, href: string) {
  softNavigate(router, href, 'replace');
}

export function softBack(router: RouterLike, fallback = '/dashboard') {
  if (softNavLock) return;

  const go = () => {
    if (typeof window !== 'undefined' && window.history.length > 1 && router.back) {
      router.back();
      return;
    }
    router.push(fallback);
  };

  if (prefersReducedMotion()) {
    go();
    return;
  }

  if (hasViewTransition()) {
    runNative(go);
    return;
  }

  softNavLock = true;
  markCssFallback();
  if (typeof window !== 'undefined') {
    window.setTimeout(() => {
      go();
      softNavLock = false;
    }, 180);
    return;
  }
  softNavLock = false;
  go();
}

/** @deprecated use softPush(router, '/parceiro') */
export function softPushToParceiro(router: RouterLike) {
  softPush(router, '/parceiro');
}

function resolveAppHref(raw: string): string | null {
  if (!raw || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) {
    return null;
  }
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

/**
 * Intercepta cliques em <a>/<Link> internos do app.
 * Telas novas com Link passam a usar soft nav automaticamente.
 */
export function installSoftLinkInterceptor(
  router: RouterLike,
  getPathname: () => string,
): () => void {
  function onClick(e: MouseEvent) {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const el = (e.target as Element | null)?.closest?.('a[href]');
    if (!el) return;

    const a = el as HTMLAnchorElement;
    if (a.target === '_blank' || a.hasAttribute('download')) return;
    if (a.dataset.softNav === SOFT_NAV_OFF) return;

    const href = resolveAppHref(a.getAttribute('href') || '');
    if (!href) return;

    const pathOnly = href.split('#')[0] || href;
    const current = `${window.location.pathname}${window.location.search}`;
    if (pathOnly === current || pathOnly === getPathname()) return;

    e.preventDefault();
    softPush(router, href);
  }

  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}
