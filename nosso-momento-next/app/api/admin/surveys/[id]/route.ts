import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { validateSurveyQuestions } from '@/lib/surveys/validate';
import type { SurveySegment } from '@/lib/types/survey';
import { DEFAULT_SURVEY_PUSH } from '@/lib/types/survey';

const SEGMENTS = new Set<SurveySegment>([
  'homens',
  'homens_vip',
  'mulheres',
  'mulheres_vip',
  'todos',
  'todos_vip',
  'todos_nao_vip',
]);

type PatchBody = {
  action?: string;
  title?: unknown;
  questions?: unknown;
  segment?: unknown;
  pushTitle?: unknown;
  pushBody?: unknown;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  const session = await verifyAdminSessionCookie(cookie);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: PatchBody = {};
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    /* empty */
  }

  const action = body.action || 'close';

  try {
    const db = getAdminFirestore();
    const ref = db.collection('surveys').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const current = snap.data() || {};

    if (action === 'close') {
      await ref.update({
        status: 'closed',
        closedAt: FieldValue.serverTimestamp(),
        closedBy: session.email,
      });
      return NextResponse.json({ ok: true, id, status: 'closed' });
    }

    if (action === 'update') {
      if (current.status !== 'draft') {
        return NextResponse.json(
          { error: 'only_draft_editable', message: 'Só rascunhos na fila podem ser editados.' },
          { status: 409 },
        );
      }

      const title = String(body.title || '').trim();
      if (!title || title.length > 120) {
        return NextResponse.json({ error: 'invalid_title' }, { status: 400 });
      }

      const segment = body.segment as SurveySegment;
      if (!SEGMENTS.has(segment)) {
        return NextResponse.json({ error: 'invalid_segment' }, { status: 400 });
      }

      const questions = validateSurveyQuestions(body.questions);
      if (!questions) {
        return NextResponse.json({ error: 'invalid_questions' }, { status: 400 });
      }

      const pushTitle = String(body.pushTitle || DEFAULT_SURVEY_PUSH.title).trim().slice(0, 80);
      const pushBody = String(body.pushBody || DEFAULT_SURVEY_PUSH.body).trim().slice(0, 160);

      await ref.update({
        title,
        segment,
        questions,
        pushTitle,
        pushBody,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: session.email,
      });

      return NextResponse.json({ ok: true, id, status: 'draft' });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    console.error('[/api/admin/surveys/[id] PATCH]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
