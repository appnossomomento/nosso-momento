import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { userMatchesSurveySegment } from '@/lib/surveys/segments';
import type { SurveySegment } from '@/lib/types/survey';

const BATCH_LIMIT = 400;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    const db = getAdminFirestore();
    const surveyRef = db.collection('surveys').doc(id);
    const surveySnap = await surveyRef.get();
    if (!surveySnap.exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const survey = surveySnap.data() || {};
    if (survey.status === 'active') {
      return NextResponse.json({ error: 'already_active' }, { status: 409 });
    }
    if (survey.status === 'closed') {
      return NextResponse.json({ error: 'already_closed' }, { status: 409 });
    }

    const segment = (survey.segment || 'todos') as SurveySegment;
    const pushTitle = String(survey.pushTitle || 'Queremos te ouvir 🔥');
    const pushBody = String(
      survey.pushBody || 'Responda rápido! Sua opinião molda o Nosso Momento.',
    );

    // Encerra qualquer outra pesquisa ativa (MVP: 1 ativa por vez).
    const activeSnap = await db.collection('surveys').where('status', '==', 'active').get();
    const closeBatch = db.batch();
    let closeOps = 0;
    for (const doc of activeSnap.docs) {
      if (doc.id === id) continue;
      closeBatch.update(doc.ref, {
        status: 'closed',
        closedAt: FieldValue.serverTimestamp(),
      });
      closeOps += 1;
    }
    if (closeOps > 0) await closeBatch.commit();

    // Segmenta usuários e dispara push via notificacoes → FCM.
    const usersSnap = await db.collection('usuarios').get();
    const targets: string[] = [];
    for (const doc of usersSnap.docs) {
      const u = doc.data() || {};
      if (
        userMatchesSurveySegment(
          { vip: u.vip === true, anatomia: u.anatomia, sexo: u.sexo },
          segment,
        )
      ) {
        targets.push(doc.id);
      }
    }

    let notified = 0;
    for (let i = 0; i < targets.length; i += BATCH_LIMIT) {
      const chunk = targets.slice(i, i + BATCH_LIMIT);
      const batch = db.batch();
      for (const uid of chunk) {
        const notifRef = db.collection('notificacoes').doc();
        batch.set(notifRef, {
          userId: uid,
          titulo: pushTitle,
          mensagem: pushBody,
          icone: 'fa-comment-dots',
          tipo: 'survey',
          redirectTo: 'survey',
          surveyId: id,
          lida: false,
          timestamp: FieldValue.serverTimestamp(),
          criadoEm: FieldValue.serverTimestamp(),
        });
        notified += 1;
      }
      await batch.commit();
    }

    await surveyRef.update({
      status: 'active',
      dispatchedAt: FieldValue.serverTimestamp(),
      dispatchedBy: session.email,
      targetedCount: targets.length,
      notifiedCount: notified,
      closedAt: null,
    });

    return NextResponse.json({
      ok: true,
      id,
      status: 'active',
      targetedCount: targets.length,
      notifiedCount: notified,
    });
  } catch (err) {
    console.error('[/api/admin/surveys/[id]/dispatch]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
