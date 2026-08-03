import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

const COUNTER_DOC = 'usuarios';

/**
 * Garante numeroUsuario sequencial (1, 2, 3…) no doc do usuário autenticado.
 * Idempotente: se já existir, devolve o mesmo número.
 */
export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('__session')?.value;
  if (!cookie || cookie.split('.').length !== 3) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, false);
    const uid = decoded.uid;
    const db = getAdminFirestore();
    const userRef = db.collection('usuarios').doc(uid);
    const counterRef = db.collection('config').doc(COUNTER_DOC);

    const numeroUsuario = await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        const err = new Error('user_not_found');
        throw err;
      }

      const existing = Number(userSnap.data()?.numeroUsuario);
      if (Number.isFinite(existing) && existing > 0) {
        return existing;
      }

      const counterSnap = await tx.get(counterRef);
      const prev = Number(counterSnap.exists ? counterSnap.data()?.last : 0);
      const next = (Number.isFinite(prev) ? prev : 0) + 1;

      tx.set(
        counterRef,
        {
          last: next,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      tx.update(userRef, {
        numeroUsuario: next,
        numeroUsuarioAt: FieldValue.serverTimestamp(),
      });
      return next;
    });

    return NextResponse.json({ ok: true, numeroUsuario });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === 'user_not_found') {
      return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
    }
    console.error('[/api/auth/allocate-user-number]', message);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
