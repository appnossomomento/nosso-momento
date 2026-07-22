/** Tipos compartilhados do sistema de pesquisas in-app (MVP). */

export type SurveySegment =
  | 'homens'
  | 'homens_vip'
  | 'mulheres'
  | 'mulheres_vip'
  | 'todos'
  | 'todos_vip'
  | 'todos_nao_vip';

export type SurveyQuestionType = 'choice' | 'text' | 'foguinhos';

export type SurveyStatus = 'draft' | 'active' | 'closed';

export type SurveyQuestion = {
  id: string;
  type: SurveyQuestionType;
  label: string;
  /** Obrigatório quando type === 'choice' */
  options?: string[];
};

export type Survey = {
  id: string;
  title: string;
  questions: SurveyQuestion[];
  segment: SurveySegment;
  status: SurveyStatus;
  pushTitle: string;
  pushBody: string;
  createdBy: string;
  createdAt: string | null;
  dispatchedAt: string | null;
  closedAt: string | null;
  targetedCount?: number;
  notifiedCount?: number;
};

export type SurveyAnswer = {
  questionId: string;
  /** choice: texto da opção; text: string; foguinhos: número 0–5 */
  value: string | number;
};

export type SurveyResponse = {
  id: string;
  surveyId: string;
  userId: string;
  answers: SurveyAnswer[];
  skipped: boolean;
  createdAt: string | null;
};

export const SURVEY_SEGMENT_LABELS: Record<SurveySegment, string> = {
  homens: 'Homens',
  homens_vip: 'Homens VIP',
  mulheres: 'Mulheres',
  mulheres_vip: 'Mulheres VIP',
  todos: 'Todos',
  todos_vip: 'Todos VIP',
  todos_nao_vip: 'Todos Não-VIP',
};

export const DEFAULT_SURVEY_PUSH = {
  title: 'Queremos te ouvir 🔥',
  body: 'Responda rápido! Sua opinião molda o Nosso Momento.',
} as const;
