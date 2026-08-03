'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import VipStarBadge from '@/components/profile/VipStarBadge';
import StreakFlame from '@/components/parceiro/StreakFlame';
import AppHeroShell, {
  ACCENT,
  ACCENT_SOFT,
  TILE,
} from '@/components/layout/AppHeroShell';
import { softPushToParceiro } from '@/components/layout/softRouteNav';
import { computeCoupleStreak } from '@/lib/clima/coupleStreak';
import { saoPauloDateString } from '@/lib/utils/saoPauloDate';
import { primeiroNome } from '@/lib/utils/displayName';

type DashTile = {
  href: string;
  icon: string;
  title: string;
  subtitle: string;
  highlight?: boolean;
  badge?: number;
};

export default function DashboardPage() {
  const router = useRouter();
  const {
    usuario,
    notificacoesTarefasNaoLidas,
    notificacoesPresentesNaoLidas,
    notificacoesConquistasNaoLidas,
    parceirosAtivos,
    parceiroData,
    parceiroNome,
    climaHoje,
    climaPartnerHoje,
    climaSemana,
    climaHistory,
  } = useAppStore();

  const pendingCount =
    (notificacoesTarefasNaoLidas ?? 0) +
    (notificacoesPresentesNaoLidas ?? 0) +
    (notificacoesConquistasNaoLidas ?? 0);
  const hasPending = pendingCount > 0;
  const userName = primeiroNome(usuario?.nome) || 'Amor';
  const fotoPerfil = usuario?.fotoUrl || '/assets/icons/iconprincipal.png';
  const isVip = usuario?.vip === true;
  const pareamentosCount = parceirosAtivos?.length ?? 0;
  const jaFezClima = Boolean(climaHoje);
  const partnerTriste = climaPartnerHoje?.humor === 'triste';

  const streak = useMemo(() => {
    const history =
      climaHistory.length > 0
        ? climaHistory
        : climaSemana.map((d) => ({
            data: d.data,
            humor: d.humor,
            partnerHumor: d.partnerHumor,
          }));
    const hojeStr = saoPauloDateString();
    const patched = history.map((d) => {
      if (d.data !== hojeStr) return d;
      return {
        ...d,
        humor: climaHoje ? climaHoje.humor : d.humor,
        partnerHumor: climaPartnerHoje ? climaPartnerHoje.humor : d.partnerHumor,
      };
    });
    return computeCoupleStreak(patched, hojeStr);
  }, [climaHistory, climaSemana, climaHoje, climaPartnerHoje]);

  const partnerFirstName =
    primeiroNome(parceiroData?.nome) ||
    primeiroNome(parceiroNome) ||
    primeiroNome(parceirosAtivos?.[0]?.nome) ||
    'seu parceiro';

  /** Lembrete da chama — alinhado ao estado da streak do /parceiro. */
  const tip = (() => {
    if (streak.coupleDoneToday) {
      return {
        title: 'Chama acesa',
        body: `Veja como ${partnerFirstName} está se sentindo hoje.`,
      };
    }
    if (jaFezClima) {
      return {
        title: 'Humor marcado',
        body: `Lembre ${partnerFirstName} de registrar o humor.`,
      };
    }
    switch (streak.state) {
      case 'cold':
        return { title: 'Chama apagada', body: 'Marque o humor e reacenda.' };
      case 'ember':
        return { title: 'Chama apagando', body: 'Marque o humor agora.' };
      case 'at_risk':
        return {
          title: 'Ainda dá tempo',
          body: 'Marque o humor de hoje e não apague a chama.',
        };
      default:
        return { title: 'Mantenha a chama', body: 'Marque o humor de hoje.' };
    }
  })();

  const tiles: DashTile[] = [
    {
      href: '/perfil',
      icon: 'fa-user',
      title: 'Meu Perfil',
      subtitle: 'Ver e Editar',
    },
    {
      href: '/notificacoes',
      icon: 'fa-bell',
      title: 'Notificações',
      subtitle: hasPending ? `${pendingCount} novas` : 'Tudo em dia',
      highlight: hasPending,
      badge: hasPending ? pendingCount : undefined,
    },
    {
      href: '/parear',
      icon: 'fa-heart',
      title: 'Pareamentos',
      subtitle: `${pareamentosCount} ${pareamentosCount === 1 ? 'conexão' : 'conexões'}`,
    },
    {
      href: '/memorias',
      icon: 'fa-book-open',
      title: 'Memórias',
      subtitle: 'Relembre',
    },
  ];

  return (
    <AppHeroShell
      showBack={false}
      hero={
        <>
          <div className="relative mb-5">
            <div
              className="rounded-full overflow-hidden"
              style={{
                width: 118,
                height: 118,
                boxShadow: [
                  `0 0 0 3px ${ACCENT}`,
                  '0 0 0 8px rgba(244, 63, 94, 0.2)',
                  '0 8px 40px rgba(244, 63, 94, 0.55)',
                ].join(', '),
              }}
            >
              <Image
                src={fotoPerfil}
                alt="Foto de perfil"
                width={118}
                height={118}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            {isVip && (
              <VipStarBadge
                size="md"
                borderClassName="border-white"
                className="bottom-[3px] right-[3px]"
              />
            )}
          </div>

          <h2 className="relative text-[25px] font-bold leading-tight tracking-tight">
            Olá, {userName}
          </h2>
          <p className="mt-0.5 text-[15px] text-white/75 leading-snug">
            Menos automático. Mais conexão.
          </p>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((tile) => (
          <Link
            key={tile.href}
            href={tile.href}
            className="relative flex flex-col rounded-[24px] p-4 text-left transition active:scale-[0.98]"
            style={{
              minHeight: 196,
              background: tile.highlight
                ? 'rgba(255, 90, 110, 0.14)'
                : TILE,
              border: tile.highlight
                ? `1.5px solid ${ACCENT}`
                : '1px solid rgba(255, 255, 255, 0.09)',
              boxShadow: tile.highlight
                ? [
                    `0 0 0 1px rgba(244, 63, 94, 0.35)`,
                    '0 0 18px rgba(244, 63, 94, 0.55)',
                    '0 0 36px rgba(244, 63, 94, 0.28)',
                    'inset 0 1px 0 rgba(255,255,255,0.06)',
                  ].join(', ')
                : '0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div className="relative mb-5" style={{ width: 72, height: 72 }}>
              <div
                className="flex items-center justify-center rounded-[20px] w-full h-full"
                style={{
                  background: 'rgba(244, 63, 94, 0.1)',
                  border: '1px solid rgba(244, 63, 94, 0.16)',
                }}
              >
                <i
                  className={`fas ${tile.icon}`}
                  style={{
                    color: ACCENT,
                    fontSize: 34,
                    filter: 'drop-shadow(0 0 3px rgba(244, 63, 94, 0.25))',
                  }}
                />
              </div>
              {typeof tile.badge === 'number' && tile.badge > 0 && (
                <span
                  className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] px-1 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                  style={{
                    background: 'linear-gradient(135deg, #FF4A2A 0%, #FF8A1A 100%)',
                    boxShadow:
                      '0 0 0 2px #141414, 0 2px 10px rgba(255, 120, 30, 0.55)',
                  }}
                >
                  {tile.badge > 99 ? '99+' : tile.badge}
                </span>
              )}
            </div>

            <div className="pr-9">
              <h3 className="text-[16px] font-bold text-white leading-snug">
                {tile.title}
              </h3>
              <p className="text-[13px] text-white/45 mt-1">{tile.subtitle}</p>
            </div>

            <span
              className="absolute bottom-4 right-4 flex items-center justify-center rounded-full"
              style={{
                width: 32,
                height: 32,
                background: tile.highlight
                  ? 'rgba(244, 63, 94, 0.12)'
                  : 'rgba(255,255,255,0.05)',
                border: tile.highlight
                  ? `1px solid rgba(244, 63, 94, 0.4)`
                  : '1px solid rgba(255,255,255,0.1)',
              }}
            >
              <i
                className="fas fa-chevron-right"
                style={{
                  fontSize: 12,
                  color: tile.highlight ? ACCENT : 'rgba(255,255,255,0.4)',
                }}
              />
            </span>
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => softPushToParceiro(router)}
        className="w-full text-left flex items-center gap-3 rounded-[20px] px-3.5 py-3.5 transition active:scale-[0.98]"
        style={{
          background: 'rgba(244, 63, 94, 0.08)',
          border: '1px solid rgba(244, 63, 94, 0.22)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
        }}
      >
        <span
          className="shrink-0 flex items-center justify-center overflow-hidden"
          style={{ width: 48, height: 48 }}
          aria-hidden
        >
          <StreakFlame
            state={streak.state}
            tier={streak.tier}
            softMood={partnerTriste}
            size="sm"
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-bold" style={{ color: ACCENT }}>
            {tip.title}
          </p>
          <p className="text-[12px] text-white/65 leading-snug mt-0.5">
            {tip.body}
          </p>
        </div>
        <i
          className="fas fa-chevron-right shrink-0"
          style={{ color: ACCENT_SOFT, fontSize: 13 }}
        />
      </button>
    </AppHeroShell>
  );
}
