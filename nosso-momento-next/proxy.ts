import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasAdminCredentials, isValidSessionCookie } from '@/lib/auth/session';
import { verifyAdminSessionCookie, ADMIN_COOKIE } from '@/lib/auth/adminMonitoring';

// Rotas que requerem autenticação
const PROTECTED_PREFIXES = ['/dashboard', '/parear', '/parceiro', '/desafios', '/memorias', '/perfil', '/loja', '/momentos', '/extrato', '/notificacoes', '/personalizar', '/clima'];

// Rotas que só devem ser acessadas por não-autenticados
const AUTH_ONLY = ['/login', '/cadastro', '/recuperar-senha'];

const ADMIN_PREFIX = '/paineladmin-monitoring-v0';
const ADMIN_LOGIN = `${ADMIN_PREFIX}/login`;

async function sessionIsValid(rawValue: string, useCryptoVerify: boolean): Promise<boolean> {
  if (!rawValue) return false;
  if (useCryptoVerify) {
    return isValidSessionCookie(rawValue);
  }
  return rawValue.split('.').length === 3 && rawValue.length > 50;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Painel admin — cookie e allowlist separados do app do casal
  if (pathname.startsWith(ADMIN_PREFIX)) {
    const adminCookie = request.cookies.get(ADMIN_COOKIE)?.value ?? '';
    const skipAdminVerify = process.env.NODE_ENV !== 'production';
    const useAdminCrypto = !skipAdminVerify && hasAdminCredentials();
    let adminValid = false;
    if (useAdminCrypto) {
      adminValid = !!(await verifyAdminSessionCookie(adminCookie));
    } else {
      adminValid = adminCookie.split('.').length === 3 && adminCookie.length > 50;
    }
    const isLogin = pathname === ADMIN_LOGIN || pathname === `${ADMIN_LOGIN}/`;

    if (!isLogin && !adminValid) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = ADMIN_LOGIN;
      return NextResponse.redirect(loginUrl);
    }
    if (isLogin && adminValid) {
      const dashUrl = request.nextUrl.clone();
      dashUrl.pathname = ADMIN_PREFIX;
      return NextResponse.redirect(dashUrl);
    }
    return NextResponse.next();
  }

  const sessionCookie = request.cookies.get('__session');
  const rawValue = sessionCookie?.value ?? '';

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_ONLY.some((p) => pathname.startsWith(p));

  // Dev: gate desligado (Firebase client-side + layout). Produção: verifySessionCookie via Admin SDK.
  const skipCookieGate = process.env.NODE_ENV !== 'production';
  const useCryptoVerify = !skipCookieGate && hasAdminCredentials();
  const isLoggedIn = await sessionIsValid(rawValue, useCryptoVerify);

  if (!skipCookieGate && isProtected && !isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    const response = NextResponse.redirect(loginUrl);
    if (rawValue) response.cookies.delete('__session');
    return response;
  }

  if (!skipCookieGate && pathname === '/' && isLoggedIn) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  if (!skipCookieGate && isAuthPage && isLoggedIn) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Aplica middleware em todas as rotas exceto:
     * - API routes (_next/static, _next/image, favicon, etc.)
     * - Rota de convite (permite acesso sem login)
     */
    '/((?!_next/static|_next/image|favicon.ico|convite|api).*)',
  ],
};
