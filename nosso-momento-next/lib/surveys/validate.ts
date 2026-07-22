import type { SurveyQuestion, SurveyQuestionType } from '@/lib/types/survey';

export function validateSurveyQuestions(raw: unknown): SurveyQuestion[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 8) return null;
  const out: SurveyQuestion[] = [];
  for (const q of raw) {
    if (!q || typeof q !== 'object') return null;
    const type = (q as SurveyQuestion).type as SurveyQuestionType;
    const label = String((q as SurveyQuestion).label || '').trim();
    const id = String((q as SurveyQuestion).id || '').trim();
    if (!id || !label) return null;
    if (type !== 'choice' && type !== 'text' && type !== 'foguinhos') return null;
    if (type === 'choice') {
      const options = (q as SurveyQuestion).options;
      if (!Array.isArray(options) || options.length < 2 || options.length > 8) return null;
      if (!options.every((o) => typeof o === 'string' && o.trim())) return null;
      out.push({
        id,
        type,
        label,
        options: options.map((o) => o.trim()),
      });
    } else {
      out.push({ id, type, label });
    }
  }
  return out;
}
