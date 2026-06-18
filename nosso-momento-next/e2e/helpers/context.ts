import type { Browser, BrowserContext } from '@playwright/test';

function getAppCheckDebugToken(): string | undefined {
  const token =
    process.env.E2E_APPCHECK_DEBUG_TOKEN ||
    process.env.NEXT_PUBLIC_APPCHECK_DEBUG_TOKEN;
  return token && token.trim() ? token.trim() : undefined;
}

/** Contexto Playwright com App Check debug token (necessário com ENFORCE_APP_CHECK=true). */
export async function createE2eContext(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext();
  const debugToken = getAppCheckDebugToken();
  if (debugToken) {
    await context.addInitScript((token: string) => {
      (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string }).FIREBASE_APPCHECK_DEBUG_TOKEN =
        token;
    }, debugToken);
  }
  return context;
}
