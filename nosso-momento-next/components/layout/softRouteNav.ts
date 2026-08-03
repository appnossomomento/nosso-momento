/** Marca fade CSS só quando o browser não tem View Transitions. */
export const SOFT_ENTER_KEY = 'nm-soft-enter-parceiro';
export const SOFT_EXIT_EVENT = 'nm-soft-nav-exit';

type DocWithVT = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

type RouterLike = { push: (href: string) => void };

/**
 * Navegação suave (dashboard → /parceiro).
 * Prefere View Transitions nativa; em prod o push é bem mais rápido que no next dev.
 * Fallback: fade CSS de saída/entrada.
 */
export function softPushToParceiro(router: RouterLike) {
  const doc = typeof document !== 'undefined' ? (document as DocWithVT) : null;

  if (doc && typeof doc.startViewTransition === 'function') {
    document.documentElement.classList.add('soft-vt');
    const vt = doc.startViewTransition(() => {
      router.push('/parceiro');
    });
    void vt.finished.finally(() => {
      document.documentElement.classList.remove('soft-vt');
    });
    return;
  }

  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(SOFT_ENTER_KEY, '1');
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new CustomEvent(SOFT_EXIT_EVENT));
    window.setTimeout(() => {
      router.push('/parceiro');
    }, 180);
    return;
  }

  router.push('/parceiro');
}
