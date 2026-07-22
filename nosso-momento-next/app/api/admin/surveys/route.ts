import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import { estimateSurveyAudienceBySegment } from '@/admin-panel/lib/surveyAudience';
import { validateSurveyQuestions } from '@/lib/surveys/validate';
import type {
  Survey,
  SurveyQuestion,
  SurveySegment,
  SurveyStatus,
} from '@/lib/types/survey';
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

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof v === 'string') return v;
  return null;
}

function mapSurvey(id: string, data: Record<string, unknown>): Survey {
  return {
    id,
    title: String(data.title || ''),
    questions: Array.isArray(data.questions) ? (data.questions as SurveyQuestion[]) : [],
    segment: (data.segment as SurveySegment) || 'todos',
    status: (data.status as SurveyStatus) || 'draft',
    pushTitle: String(data.pushTitle || DEFAULT_SURVEY_PUSH.title),
    pushBody: String(data.pushBody || DEFAULT_SURVEY_PUSH.body),
    createdBy: String(data.createdBy || ''),
    createdAt: tsToIso(data.createdAt),
    dispatchedAt: tsToIso(data.dispatchedAt),
    closedAt: tsToIso(data.closedAt),
    targetedCount: typeof data.targetedCount === 'number' ? data.targetedCount : undefined,
    notifiedCount: typeof data.notifiedCount === 'number' ? data.notifiedCount : undefined,
  };
}

async function requireAdmin(request: NextRequest) {
  const cookie = request.cookies.get('__admin_monitoring')?.value;
  return verifyAdminSessionCookie(cookie);
}

export async function GET(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const db = getAdminFirestore();
    const [snap, audienceBySegment] = await Promise.all([
      db.collection('surveys').orderBy('createdAt', 'desc').limit(50).get(),
      estimateSurveyAudienceBySegment(db),
    ]);
    const surveys = snap.docs.map((d) => mapSurvey(d.id, d.data() as Record<string, unknown>));
    return NextResponse.json({ surveys, audienceBySegment });
  } catch (err) {
    console.error('[/api/admin/surveys GET]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}

type CreateBody = {
  title?: unknown;
  questions?: unknown;
  segment?: unknown;
  pushTitle?: unknown;
  pushBody?: unknown;
};

export async function POST(request: NextRequest) {
  const session = await requireAdmin(request);
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
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

  try {
    const db = getAdminFirestore();
    const ref = await db.collection('surveys').add({
      title,
      questions,
      segment,
      status: 'draft',
      pushTitle,
      pushBody,
      createdBy: session.email,
      createdAt: FieldValue.serverTimestamp(),
      dispatchedAt: null,
      closedAt: null,
    });
    const snap = await ref.get();
    return NextResponse.json({ ok: true, survey: mapSurvey(ref.id, (snap.data() || {}) as Record<string, unknown>) });
  } catch (err) {
    console.error('[/api/admin/surveys POST]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
