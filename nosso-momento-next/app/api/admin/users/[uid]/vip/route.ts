import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';

type Body = { vip?: unknown };

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ uid: string }> },
) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { uid } = await context.params;
  if (!uid?.trim()) {
    return NextResponse.json({ error: 'invalid_uid' }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  if (typeof body.vip !== 'boolean') {
    return NextResponse.json({ error: 'vip_required' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const ref = db.collection('usuarios').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }

    const wasVip = snap.data()?.vip === true;

    await ref.update({
      vip: body.vip,
      vipUpdatedAt: FieldValue.serverTimestamp(),
      vipUpdatedBy: session.email,
    });

    if (body.vip && !wasVip) {
      await db.collection('notificacoes').add({
        userId: uid,
        titulo: '⭐ VIP ATIVO!',
        mensagem: 'Aproveite suas regalias.',
        icone: 'fa-star',
        tipo: 'vip_activated',
        redirectTo: 'perfil',
        lida: false,
        timestamp: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({
      ok: true,
      uid,
      vip: body.vip,
      vipUpdatedBy: session.email,
    });
  } catch (err) {
    console.error('[/api/admin/users/[uid]/vip]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
