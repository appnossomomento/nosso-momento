import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rotas que requerem autenticação
const PROTECTED_PREFIXES = ['/dashboard', '/parear', '/parceiro', '/desafios', '/memorias', '/perfil', '/loja', '/momentos', '/extrato', '/notificacoes', '/personalizar', '/clima'];

// Rotas que só devem ser acessadas por não-autenticados
const AUTH_ONLY = ['/login', '/cadastro', '/recuperar-senha'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lê o cookie de sessão do Firebase Auth (definido via AuthProvider no client)
  const sessionCookie = request.cookies.get('auth-session');
  const isLoggedIn = !!sessionCookie?.value;

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
