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
};

export type GetRankingResponse = {
  period: RankingPeriod;
  /** epoch ms do fim do período (countdown). */
  periodEndsAt: number;
  entries: RankingCouplePublic[]; // até 10
};
