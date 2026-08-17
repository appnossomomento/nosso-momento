'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '@/lib/store/appStore';
import AppHeroShell, { ACCENT, TILE } from '@/components/layout/AppHeroShell';
import CoupleAvatar, {
  type CoupleAvatarRing,
} from '@/components/ranking/CoupleAvatar';
import RankingCrown, { metalFromRing } from '@/components/ranking/RankingCrown';
import CinzasLottie from '@/components/ranking/CinzasLottie';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { diasRestantesAte } from '@/lib/ranking/periodo';
import type {
  GetRankingResponse,
  RankingCouplePublic,
  RankingPeriod,
} from '@/lib/ranking/types';

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const;

function ringForPos(pos: number): CoupleAvatarRing {
  if (pos === 1) return 'gold';
  if (pos === 2) return 'silver';
  if (pos === 3) return 'bronze';
  return 'accent';
}

function PodiumSlot({
  entry,
  size,
}: {
  entry: RankingCouplePublic;
  size: 'lg' | 'md';
}) {
  const label = `${entry.leftLabel} & ${entry.rightLabel}`;
  const ring = ringForPos(entry.pos);
  const metal = metalFromRing(ring);
  const crownSize = size === 'lg' ? 34 : 26;
  const nameSize = size === 'lg' ? 14 : 12;
  const ptsSize = size === 'lg' ? 45 : 24;
  const ptsMetalClass = metal ? `nm-ranking-couple-pts--${metal}` : '';

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      {metal && (
        <RankingCrown metal={metal} size={crownSize} className="-mb-0.5" />
      )}
      <CoupleAvatar
        leftFoto={entry.leftFotoUrl}
        rightFoto={entry.rightFotoUrl}
        leftAlt={entry.leftLabel}
        rightAlt={entry.rightLabel}
        size={size}
        ring={ring}
      />
      <div className="flex flex-col items-center gap-0 mt-1.5 leading-none">
        <p
          className="nm-ranking-couple-name text-white text-center leading-tight truncate max-w-[110px]"
          style={{ fontSize: nameSize }}
        >
          {label}
        </p>
        <p
          className={`nm-ranking-couple-pts tabular-nums leading-none mt-0.5 ${ptsMetalClass}`}
          style={{
            fontSize: ptsSize,
            ...(metal ? {} : { color: ACCENT }),
          }}
        >
          {String(entry.pontos)}
        </p>
      </div>
    </div>
  );
}

function RankingRow({
  row,
  divider,
}: {
  row: RankingCouplePublic;
  divider: boolean;
}) {
  const isMe = Boolean(row.isCaller);
  const delta = row.deltaPos ?? 0;

  return (
    <div
      className="flex items-center gap-2.5 px-3.5 py-3"
      style={{
        borderBottom: divider ? '1px solid rgba(255,255,255,0.06)' : undefined,
        background: isMe ? 'rgba(244,63,94,0.12)' : undefined,
      }}
    >
      <span
        className="w-6 text-sm font-bold tabular-nums shrink-0"
        style={{ color: '#be123c' }}
      >
        {row.pos}
      </span>
      <CoupleAvatar
        leftFoto={row.leftFotoUrl}
        rightFoto={row.rightFotoUrl}
        size="sm"
        ring="accent"
      />
      <span
        className="flex-1 min-w-0 text-[13px] font-semibold truncate"
        style={{ color: '#a3a3a3' }}
      >
        {row.leftLabel} & {row.rightLabel}
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span
          className="w-3.5 text-center text-[11px] leading-none"
          aria-label={
            delta > 0
              ? `Subiu ${delta}`
              : delta < 0
                ? `Desceu ${Math.abs(delta)}`
                : 'Sem mudança'
          }
        >
          {delta > 0 ? (
            <i className="fas fa-caret-up" style={{ color: '#22c55e' }} />
          ) : delta < 0 ? (
            <i className="fas fa-caret-down" style={{ color: '#ef4444' }} />
          ) : (
            <i
              className="fas fa-minus"
              style={{ color: 'rgba(255,255,255,0.25)', fontSize: 8 }}
            />
          )}
        </span>
        <span
          className="nm-ranking-couple-pts text-[14px] tabular-nums"
          style={{ color: isMe ? ACCENT : 'rgba(255,255,255,0.88)' }}
        >
          {String(row.pontos)}
        </span>
      </span>
    </div>
  );
}

function PodiumSkeleton() {
  return (
    <div className="mt-6 mb-1 flex w-full items-end justify-center gap-3 px-1">
      {[98, 128, 98].map((w, i) => (
        <div key={i} className="flex-1 flex justify-center pb-1">
          <div className="flex flex-col items-center gap-2 animate-pulse">
            <div
              className="rounded-full"
              style={{
                width: w,
                height: i === 1 ? 72 : 56,
                background: 'rgba(255,255,255,0.10)',
              }}
            />
            <div
              className="rounded-full"
              style={{
                width: 70,
                height: 10,
                background: 'rgba(255,255,255,0.08)',
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 px-3.5 py-3"
          style={{
            borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}
        >
          <div
            className="w-6 h-3 rounded-full shrink-0"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          />
          <div
            className="rounded-full shrink-0"
            style={{ width: 52, height: 30, background: 'rgba(255,255,255,0.08)' }}
          />
          <div
            className="flex-1 h-3 rounded-full"
            style={{ background: 'rgba(255,255,255,0.06)' }}
          />
        </div>
      ))}
    </div>
  );
}

export default function RankingPage() {
  const [period, setPeriod] = useState<RankingPeriod>('mensal');
  const { parceirosAtivos, pareadoUid, idPareamentoAmigavel } = useAppStore(
    useShallow((s) => ({
      parceirosAtivos: s.parceirosAtivos,
      pareadoUid: s.pareadoUid,
      idPareamentoAmigavel: s.idPareamentoAmigavel,
    })),
  );

  const isPaired =
    (parceirosAtivos?.length ?? 0) > 0 || Boolean(pareadoUid);

  const [ranking, setRanking] = useState<GetRankingResponse | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    if (!isPaired) return;

    let cancelado = false;
    setCarregando(true);
    setErro(false);

    callFunction<GetRankingResponse>(FUNCTIONS.getRanking, {
      period,
      ...(idPareamentoAmigavel ? { pareamentoId: idPareamentoAmigavel } : {}),
    })
      .then((res) => {
        if (!cancelado) setRanking(res);
      })
      .catch(() => {
        if (!cancelado) setErro(true);
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [period, isPaired, idPareamentoAmigavel, tentativa]);

  const recarregar = useCallback(() => setTentativa((t) => t + 1), []);

  const entries = ranking?.entries ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3, 10);
  const podiumOrder = [top3[1], top3[0], top3[2]];
  // O casal precisa se enxergar mesmo quando não alcança o top 10.
  const callerFora =
    ranking?.caller && !entries.some((e) => e.isCaller) ? ranking.caller : null;

  const mesAtual = MESES[new Date().getMonth()];
  const dias = ranking ? diasRestantesAte(ranking.periodEndsAt) : 0;
  const diasLabel = dias === 1 ? '1 dia' : `${dias} dias`;
  const periodoLabel =
    period === 'mensal' ? `de ${mesAtual}` : 'esta semana';

  if (!isPaired) {
    return (
      <AppHeroShell
        sheetClassName="space-y-5"
        hero={
          <>
            <CinzasLottie size={140} className="mb-3" />
            <h2 className="text-[25px] font-bold leading-tight tracking-tight">
              Chama apagada
            </h2>
            <p className="mt-1 text-[15px] text-white/75 leading-snug px-2">
              Pareie com quem você ama para entrar no ranking dos casais mais
              conectados.
            </p>
          </>
        }
      >
        <Link
          href="/parear"
          className="block w-full rounded-2xl py-3.5 text-center text-[14px] font-bold text-white"
          style={{
            background: 'linear-gradient(180deg,#fb7185 0%,#e11d48 52%,#be123c 100%)',
            boxShadow: '0 6px 20px rgba(244,63,94,0.35)',
          }}
        >
          Parear agora
        </Link>
      </AppHeroShell>
    );
  }

  return (
    <AppHeroShell
      sheetClassName="space-y-4"
      hero={
        <>
          <h2 className="text-[25px] font-bold leading-tight tracking-tight">
            Disputa de Casais
          </h2>
          <p className="mt-0.5 text-[14px] text-white/70 leading-snug">
            Casais mais conectados{' '}
            <span className="font-semibold text-white">{periodoLabel}</span>
          </p>

          <div
            className="mt-4 inline-flex rounded-full p-1"
            style={{
              background: 'rgba(0,0,0,0.35)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {([
              ['semanal', 'Semanal'],
              ['mensal', 'Mensal'],
            ] as const).map(([id, label]) => {
              const on = period === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setPeriod(id)}
                  className="rounded-full px-4 py-1.5 text-[12px] font-bold transition"
                  style={
                    on
                      ? {
                          background:
                            'linear-gradient(135deg,#fb7185,#e11d48)',
                          color: '#fff',
                          boxShadow: '0 2px 10px rgba(244,63,94,0.4)',
                        }
                      : { color: 'rgba(255,255,255,0.55)' }
                  }
                >
                  {label}
                </button>
              );
            })}
          </div>

          {carregando ? (
            <PodiumSkeleton />
          ) : (
            <div className="mt-6 mb-1 flex w-full items-end justify-center gap-3 px-1">
              <div className="pb-1 flex-1 flex justify-center">
                {podiumOrder[0] && (
                  <PodiumSlot entry={podiumOrder[0]} size="md" />
                )}
              </div>
              <div className="pb-4 flex-1 flex justify-center">
                {podiumOrder[1] && (
                  <PodiumSlot entry={podiumOrder[1]} size="lg" />
                )}
              </div>
              <div className="pb-1 flex-1 flex justify-center">
                {podiumOrder[2] && (
                  <PodiumSlot entry={podiumOrder[2]} size="md" />
                )}
              </div>
            </div>
          )}
        </>
      }
    >
      <div
        className="overflow-hidden rounded-[22px]"
        style={{
          background: TILE,
          border: '1px solid rgba(255,255,255,0.09)',
          boxShadow:
            '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        {carregando ? (
          <ListSkeleton />
        ) : erro ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] leading-snug" style={{ color: '#a3a3a3' }}>
              Não deu para carregar a disputa agora.
            </p>
            <button
              type="button"
              onClick={recarregar}
              className="mt-3 rounded-full px-4 py-1.5 text-[12px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg,#fb7185,#e11d48)' }}
            >
              Tentar de novo
            </button>
          </div>
        ) : entries.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] leading-snug" style={{ color: '#a3a3a3' }}>
              A disputa {periodoLabel} ainda não começou. Registrem o clima e
              realizem um momento para abrir o placar.
            </p>
          </div>
        ) : rest.length === 0 ? (
          <div className="px-4 py-6 text-center">
            <p className="text-[13px] leading-snug" style={{ color: '#a3a3a3' }}>
              Por enquanto só o pódio tem pontos {periodoLabel}.
            </p>
          </div>
        ) : (
          rest.map((row, i) => (
            <RankingRow
              key={row.pos}
              row={row}
              divider={i < rest.length - 1}
            />
          ))
        )}
      </div>

      {callerFora && (
        <div
          className="overflow-hidden rounded-[22px]"
          style={{
            background: TILE,
            border: '1px solid rgba(244,63,94,0.28)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}
        >
          <RankingRow row={callerFora} divider={false} />
        </div>
      )}

      {!carregando && !erro && (
        <p
          className="text-center text-[13px] font-semibold px-3 leading-snug pt-1"
          style={{
            background:
              'linear-gradient(90deg, #fb7185 0%, #f43f5e 45%, #fb923c 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Faltam {diasLabel} para definir os campeões.
        </p>
      )}
    </AppHeroShell>
  );
}
