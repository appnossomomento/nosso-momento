import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';
import {
  ADMIN_COOKIE,
  SESSION_MS,
  isAdminEmail,
} from '@/lib/auth/adminMonitoring';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.ADMIN_MONITORING_EMAILS?.trim()) {
      return NextResponse.json({ error: 'admin_not_configured' }, { status: 503 });
    }

    const body = await request.json();
    const idToken: string | undefined = body?.idToken;
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json({ error: 'missing_id_token' }, { status: 400 });
    }

    const decoded = await adminAuth.verifyIdToken(idToken, true);
    const email = decoded.email ?? '';
    if (!isAdminEmail(email)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }

    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn: SESSION_MS,
    });

    const response = NextResponse.json({ ok: true }, { status: 200 });
    response.cookies.set(ADMIN_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_MS / 1000,
      path: '/',
    });
    return response;
  } catch (err) {
    console.error('[/api/admin/session POST]', err);
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
