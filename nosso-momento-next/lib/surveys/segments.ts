import type { SurveySegment } from '@/lib/types/survey';

type SegmentUser = {
  vip?: boolean | null;
  anatomia?: string | null;
  sexo?: string | null;
};

function normalizeGender(user: SegmentUser): 'masculino' | 'feminino' | null {
  const raw = String(user.anatomia || user.sexo || '')
    .trim()
    .toLowerCase();
  if (!raw) return null;
  if (raw === 'masculino' || raw === 'homem' || raw === 'male' || raw === 'm') {
    return 'masculino';
  }
  if (raw === 'feminino' || raw === 'mulher' || raw === 'female' || raw === 'f') {
    return 'feminino';
  }
  return null;
}

/** Retorna true se o usuário entra no segmento da pesquisa. */
export function userMatchesSurveySegment(
  user: SegmentUser | null | undefined,
  segment: SurveySegment,
): boolean {
  if (!user) return false;
  const isVip = user.vip === true;
  const gender = normalizeGender(user);

  switch (segment) {
    case 'todos':
      return true;
    case 'todos_vip':
      return isVip;
    case 'todos_nao_vip':
      return !isVip;
    case 'homens':
      return gender === 'masculino';
    case 'homens_vip':
      return gender === 'masculino' && isVip;
    case 'mulheres':
      return gender === 'feminino';
    case 'mulheres_vip':
      return gender === 'feminino' && isVip;
    default:
      return false;
  }
}
