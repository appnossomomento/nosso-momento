import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from '@/lib/firebase/admin';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get('__session')?.value;
  if (!cookie || cookie.split('.').length !== 3) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, false);
    const uid = decoded.uid;
    const date = todayKey();

    const db = getAdminFirestore();
    const dayRef = db.collection('analytics_daily_logins').doc(date);
    const userRef = dayRef.collection('users').doc(uid);

    await db.runTransaction(async (tx) => {
      const userSnap = await tx.get(userRef);
      if (userSnap.exists) return;

      tx.set(userRef, { recordedAt: FieldValue.serverTimestamp() });
      const daySnap = await tx.get(dayRef);
      const prev = daySnap.data()?.loginCount;
      const loginCount = (typeof prev === 'number' ? prev : 0) + 1;
      tx.set(
        dayRef,
        { date, loginCount, updatedAt: FieldValue.serverTimestamp() },
        { merge: true },
      );
    });

    await db.collection('usuarios').doc(uid).set(
      { lastAppOpenAt: FieldValue.serverTimestamp() },
      { merge: true },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[/api/auth/app-open]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
