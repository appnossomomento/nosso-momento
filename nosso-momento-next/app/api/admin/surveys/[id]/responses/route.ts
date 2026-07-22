import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { verifyAdminSessionCookie } from '@/lib/auth/adminMonitoring';
import { getAdminFirestore } from '@/lib/firebase/admin';
import type { SurveyAnswer, SurveyQuestion } from '@/lib/types/survey';

function tsToIso(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Timestamp) return v.toDate().toISOString();
  if (typeof (v as { toDate?: () => Date }).toDate === 'function') {
    return (v as { toDate: () => Date }).toDate().toISOString();
  }
  return null;
}

export async function GET(
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
    const surveySnap = await db.collection('surveys').doc(id).get();
    if (!surveySnap.exists) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const survey = surveySnap.data() || {};
    const questions = Array.isArray(survey.questions)
      ? (survey.questions as SurveyQuestion[])
      : [];

    const respSnap = await db
      .collection('surveyResponses')
      .where('surveyId', '==', id)
      .get();

    let answered = 0;
    let skipped = 0;
    const aggregates: Record<
      string,
      {
        type: string;
        label: string;
        choiceCounts?: Record<string, number>;
        foguinhosSum?: number;
        foguinhosCount?: number;
        foguinhosAvg?: number;
        foguinhosDist?: Record<string, number>;
        textSamples?: string[];
      }
    > = {};

    for (const q of questions) {
      aggregates[q.id] = {
        type: q.type,
        label: q.label,
        ...(q.type === 'choice'
          ? {
              choiceCounts: Object.fromEntries(
                (q.options || []).map((o) => [o, 0]),
              ),
            }
          : {}),
        ...(q.type === 'foguinhos'
          ? {
              foguinhosSum: 0,
              foguinhosCount: 0,
              foguinhosDist: { '0': 0, '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
            }
          : {}),
        ...(q.type === 'text' ? { textSamples: [] } : {}),
      };
    }

    const recent: Array<{
      userId: string;
      skipped: boolean;
      createdAt: string | null;
      answers: SurveyAnswer[];
    }> = [];

    for (const doc of respSnap.docs) {
      const d = doc.data() || {};
      const isSkipped = d.skipped === true;
      if (isSkipped) skipped += 1;
      else answered += 1;

      const answers = Array.isArray(d.answers) ? (d.answers as SurveyAnswer[]) : [];
      recent.push({
        userId: String(d.userId || ''),
        skipped: isSkipped,
        createdAt: tsToIso(d.createdAt),
        answers,
      });

      if (isSkipped) continue;

      for (const a of answers) {
        const bucket = aggregates[a.questionId];
        if (!bucket) continue;
        if (bucket.type === 'choice' && bucket.choiceCounts) {
          const key = String(a.value);
          bucket.choiceCounts[key] = (bucket.choiceCounts[key] || 0) + 1;
        } else if (bucket.type === 'foguinhos') {
          const n = Number(a.value);
          if (Number.isFinite(n) && n >= 0 && n <= 5) {
            bucket.foguinhosSum = (bucket.foguinhosSum || 0) + n;
            bucket.foguinhosCount = (bucket.foguinhosCount || 0) + 1;
            if (bucket.foguinhosDist) {
              const key = String(Math.round(n));
              bucket.foguinhosDist[key] = (bucket.foguinhosDist[key] || 0) + 1;
            }
          }
        } else if (bucket.type === 'text' && bucket.textSamples) {
          const t = String(a.value || '').trim();
          if (t && bucket.textSamples.length < 20) bucket.textSamples.push(t);
        }
      }
    }

    for (const bucket of Object.values(aggregates)) {
      if (bucket.type === 'foguinhos' && (bucket.foguinhosCount || 0) > 0) {
        bucket.foguinhosAvg =
          Math.round(((bucket.foguinhosSum || 0) / (bucket.foguinhosCount || 1)) * 10) /
          10;
      }
    }

    recent.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

    return NextResponse.json({
      surveyId: id,
      title: String(survey.title || ''),
      status: String(survey.status || ''),
      targetedCount: survey.targetedCount ?? null,
      notifiedCount: survey.notifiedCount ?? null,
      totals: {
        responses: respSnap.size,
        answered,
        skipped,
      },
      aggregates,
      recent: recent.slice(0, 50),
    });
  } catch (err) {
    console.error('[/api/admin/surveys/[id]/responses]', err);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
