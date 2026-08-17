/**
 * Contrato da futura CF `getRanking`.
 * Client NÃO lê `usuarios` alheios — só consome este payload.
 */

export type RankingPeriod = 'semanal' | 'mensal';

/** Entrada pública de um casal no placar (já higienizada pelo backend). */
export type RankingCouplePublic = {
  pos: number;
  pontos: number;
  /**
   * Variação de posição vs período anterior.
   * >0 subiu | <0 desceu | 0 manteve | null/undefined sem histórico.
   */
  deltaPos?: number | null;
  /** Display já resolvido: apelidoReal → primeiro nome. */
  leftLabel: string;
  rightLabel: string;
  /**
   * URL de foto — na CF real deve ser assinada/curta duração.
   * Mock local pode usar fotoUrl do perfil ou fallback.
   */
  leftFotoUrl: string | null;
  rightFotoUrl: string | null;
  /** true se este casal é o do caller (para highlight). */
  isCaller?: boolean;
};

export type GetRankingRequest = {
  period: RankingPeriod;
  /** Conexão a considerar quando o usuário tem mais de um pareamento. */
  pareamentoId?: string;
};

export type GetRankingResponse = {
  period: RankingPeriod;
  /** Identificador do período no backend: "2026-W34" ou "2026-08". */
  periodId?: string;
  /** epoch ms do fim do período (countdown). */
  periodEndsAt: number;
  entries: RankingCouplePublic[]; // até 10
  /** Casal do caller, presente mesmo quando ele está fora do top 10. */
  caller?: RankingCouplePublic | null;
};
