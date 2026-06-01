import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que requerem autenticação
const PROTECTED_PREFIXES = ['/dashboard', '/parear', '/parceiro', '/desafios', '/memorias', '/perfil', '/loja', '/momentos', '/extrato', '/notificacoes', '/personalizar', '/clima'];

// Rotas que só devem ser acessadas por não-autenticados
const AUTH_ONLY = ['/login', '/cadastro', '/recuperar-senha'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lê o cookie de sessão emitido pela API Route /api/auth/session (HttpOnly, server-signed).
  // O cookie __session contém o Firebase Session Cookie (JWT opaco assinado pelo Google).
  // O middleware verifica apenas a presença e formato mínimo (3 segmentos JWT-like);
  // a validação criptográfica completa ocorre nas API Routes/Server Components via Admin SDK.
  const sessionCookie = request.cookies.get('__session');
  const rawValue = sessionCookie?.value ?? '';
  // Um Firebase Session Cookie é um JWT: 3 segmentos Base64url separados por '.'.
  const isLoggedIn = rawValue.split('.').length === 3 && rawValue.length > 50;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_ONLY.some((p) => pathname.startsWith(p));

  if (isProtected && !isLoggedIn) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isLoggedIn) {
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
