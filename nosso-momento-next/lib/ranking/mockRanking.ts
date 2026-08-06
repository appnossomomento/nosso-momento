import { nomeParaCard } from '@/lib/utils/displayName';
import type {
  GetRankingResponse,
  RankingCouplePublic,
  RankingPeriod,
} from '@/lib/ranking/types';

const FALLBACK = '/assets/icons/iconprincipal.png';

/** Apelidos curtos de mock (simula apelidoReal no placar). */
const MOCK_ROWS: {
  left: string;
  right: string;
  pontos: number;
  deltaPos: number;
}[] = [
  { left: 'Aninha', right: 'Bruninho', pontos: 1240, deltaPos: 1 },
  { left: 'Cacá', right: 'Di', pontos: 1185, deltaPos: -1 },
  { left: 'Lê', right: 'Fê', pontos: 1090, deltaPos: 2 },
  { left: 'Gabs', right: 'Hug', pontos: 980, deltaPos: 0 },
  { left: 'Iri', right: 'Jão', pontos: 910, deltaPos: -2 },
  { left: 'Kai', right: 'Lia', pontos: 860, deltaPos: 3 },
  { left: 'May', right: 'Nic', pontos: 805, deltaPos: -1 },
  { left: 'Oli', right: 'Ped', pontos: 740, deltaPos: 0 },
  { left: 'Qui', right: 'Raf', pontos: 690, deltaPos: 1 },
  { left: 'Sofi', right: 'Theo', pontos: 640, deltaPos: -3 },
];

function periodEndsAt(period: RankingPeriod): number {
  const now = new Date();
  if (period === 'mensal') {
    return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
  }
  const day = now.getDay();
  const add = day === 0 ? 0 : 7 - day;
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + add);
  return end.getTime();
}

/**
 * Mock local no formato da CF `getRanking`.
 * Injeta o casal do caller na 1ª posição com apelido prioritário + fotos reais.
 */
export function buildMockRanking(opts: {
  period: RankingPeriod;
  isPaired: boolean;
  me: { apelidoReal?: string | null; nome?: string | null; fotoUrl?: string | null };
  partner: { apelidoReal?: string | null; nome?: string | null; fotoUrl?: string | null };
}): GetRankingResponse {
  const meLabel = nomeParaCard({
    apelidoReal: opts.me.apelidoReal,
    nome: opts.me.nome,
    fallback: 'Você',
  });
  const partnerLabel = nomeParaCard({
    apelidoReal: opts.partner.apelidoReal,
    nome: opts.partner.nome,
    fallback: 'Parceiro',
  });

  const entries: RankingCouplePublic[] = MOCK_ROWS.map((row, i) => {
    const pos = i + 1;
    if (opts.isPaired && pos === 1) {
      return {
        pos,
        pontos: row.pontos,
        deltaPos: row.deltaPos,
        leftLabel: meLabel,
        rightLabel: partnerLabel,
        leftFotoUrl: opts.me.fotoUrl || FALLBACK,
        rightFotoUrl: opts.partner.fotoUrl || FALLBACK,
        isCaller: true,
      };
    }
    return {
      pos,
      pontos: row.pontos,
      deltaPos: row.deltaPos,
      leftLabel: row.left,
      rightLabel: row.right,
      leftFotoUrl: FALLBACK,
      rightFotoUrl: FALLBACK,
      isCaller: false,
    };
  });

  return {
    period: opts.period,
    periodEndsAt: periodEndsAt(opts.period),
    entries,
  };
}

export function diasRestantesAte(endsAt: number): number {
  const ms = endsAt - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}
