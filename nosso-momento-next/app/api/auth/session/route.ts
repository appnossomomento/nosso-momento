/**
 * API Route: /api/auth/session
 *
 * POST — Recebe o idToken do Firebase Auth (emitido pelo cliente após login),
 *        verifica-o com o Admin SDK e emite um cookie de sessão HttpOnly + Secure.
 *
 * DELETE — Destroi o cookie de sessão (logout).
 *
 * SEGURANÇA:
 *  - O cookie é HttpOnly: não acessível via JS no browser (mitiga XSS).
 *  - SameSite=Strict: mitiga CSRF.
 *  - Secure: apenas enviado sobre HTTPS.
 *  - O valor é o próprio Firebase Session Cookie assinado pelo Google (não um JWT arbitrário).
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

// Duração da sessão: 7 dias (máximo permitido pelo Firebase Session Cookie).
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const idToken: string | undefined = body?.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'missing_id_token' }, { status: 400 });
    }

    // Verifica o idToken antes de criar a sessão (detecta tokens expirados/inválidos).
    await adminAuth.verifyIdToken(idToken, /* checkRevoked */ true);

    // Cria o Firebase Session Cookie (token opaco assinado pelo Google).
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    const response = NextResponse.json({ ok: true }, { status: 200 });

    response.cookies.set('__session', sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_DURATION_MS / 1000,
      path: '/',
    });

    // Remove o cookie legado (se existir) para evitar inconsistências.
    response.cookies.delete('auth-session');

    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'unknown';
    console.error('[/api/auth/session POST] erro:', message);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.delete('__session');
  response.cookies.delete('auth-session');
  return response;
}
