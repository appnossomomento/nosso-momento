import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { hasAdminCredentials, isValidSessionCookie } from '@/lib/auth/session';

// Rotas que requerem autenticação
const PROTECTED_PREFIXES = ['/dashboard', '/parear', '/parceiro', '/desafios', '/memorias', '/perfil', '/loja', '/momentos', '/extrato', '/notificacoes', '/personalizar', '/clima'];

// Rotas que só devem ser acessadas por não-autenticados
const AUTH_ONLY = ['/login', '/cadastro', '/recuperar-senha'];

async function sessionIsValid(rawValue: string, useCryptoVerify: boolean): Promise<boolean> {
  if (!rawValue) return false;
  if (useCryptoVerify) {
    return isValidSessionCookie(rawValue);
  }
  return rawValue.split('.').length === 3 && rawValue.length > 50;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

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
