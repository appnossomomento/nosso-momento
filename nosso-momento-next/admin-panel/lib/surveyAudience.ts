import type { Firestore } from 'firebase-admin/firestore';
import type { SurveySegment } from '@/lib/types/survey';
import { userMatchesSurveySegment } from '@/lib/surveys/segments';

export const SURVEY_SEGMENTS: SurveySegment[] = [
  'todos',
  'todos_vip',
  'todos_nao_vip',
  'homens',
  'homens_vip',
  'mulheres',
  'mulheres_vip',
];

export type AudienceEstimate = {
  alvo: number;
  push: number;
};

function userHasPushToken(
  uid: string,
  userData: Record<string, unknown>,
  tokenUids: Set<string>,
): boolean {
  if (tokenUids.has(uid)) return true;
  const legacy = userData.fcmToken;
  return typeof legacy === 'string' && legacy.length > 0;
}

/** Conta, por segmento, quantos usuários seriam alvo e quantos têm push. */
export async function estimateSurveyAudienceBySegment(
  db: Firestore,
): Promise<Record<SurveySegment, AudienceEstimate>> {
  const empty = Object.fromEntries(
    SURVEY_SEGMENTS.map((s) => [s, { alvo: 0, push: 0 }]),
  ) as Record<SurveySegment, AudienceEstimate>;

  const [usersSnap, tokensSnap] = await Promise.all([
    db.collection('usuarios').get(),
    db.collection('userNotificationTokens').get(),
  ]);

  const tokenUids = new Set<string>();
  for (const doc of tokensSnap.docs) {
    const data = doc.data() || {};
    const tokens = Array.isArray(data.tokens)
      ? data.tokens.filter((t: unknown) => typeof t === 'string' && t.length > 0)
      : typeof data.token === 'string' && data.token.length > 0
        ? [data.token]
        : [];
    if (tokens.length > 0) tokenUids.add(doc.id);
  }

  for (const doc of usersSnap.docs) {
    const u = doc.data() || {};
    const profile = {
      vip: u.vip === true,
      anatomia: u.anatomia as string | undefined,
      sexo: u.sexo as string | undefined,
    };
    const canPush = userHasPushToken(doc.id, u as Record<string, unknown>, tokenUids);

    for (const segment of SURVEY_SEGMENTS) {
      if (!userMatchesSurveySegment(profile, segment)) continue;
      empty[segment].alvo += 1;
      if (canPush) empty[segment].push += 1;
    }
  }

  return empty;
}
