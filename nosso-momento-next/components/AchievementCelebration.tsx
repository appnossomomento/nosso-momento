'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store/appStore';

const ACHIEVEMENT_BANNER_MS = 4200;

const ACHIEVEMENTS: { id: string; title: string; icon: string; accentColor: string }[] = [
  { id: 'first_check_in', title: 'Primeiro Passo', icon: 'fa-person-rays', accentColor: '#fbbf24' },
  { id: 'checkin_streak_7', title: 'Foguinho Semanal', icon: 'fa-calendar-week', accentColor: '#34d399' },
  { id: 'checkin_master', title: 'Mestre do Clima', icon: 'fa-stopwatch', accentColor: '#60a5fa' },
  { id: 'sou_fiel', title: 'Sou Fiel', icon: 'fa-hand-holding-heart', accentColor: '#38bdf8' },
  { id: 'sintonia_clima', title: 'Sintonia', icon: 'fa-heart-pulse', accentColor: '#f43f5e' },
  { id: 'relacao_saudavel', title: 'Relação Saudável', icon: 'fa-face-laugh-beam', accentColor: '#4ade80' },
  { id: 'first_moment_redeem', title: 'Primeiro Momento', icon: 'fa-heart', accentColor: '#f472b6' },
  { id: 'moment_collector', title: 'Colecionador de Momentos', icon: 'fa-gift', accentColor: '#c084fc' },
  { id: 'to_amando', title: 'Tô Amando', icon: 'fa-star', accentColor: '#e879f9' },
  { id: 'jornada_iniciada', title: 'Jornada Iniciada', icon: 'fa-envelope-open-text', accentColor: '#fb7185' },
  { id: 'atitude', title: 'Atitude', icon: 'fa-circle-check', accentColor: '#34d399' },
  { id: 'foguinhos_investor', title: 'Investidor de Foguinhos', icon: 'fa-coins', accentColor: '#facc15' },
  { id: 'caliente', title: 'Caliente', icon: 'fa-fire-flame-curved', accentColor: '#fb923c' },
  { id: 'em_sincronia', title: 'Em Sincronia', icon: 'fa-brain', accentColor: '#a78bfa' },
  { id: 'ligeiro', title: 'Ligeiro', icon: 'fa-bolt', accentColor: '#fbbf24' },
  { id: 'primeiro_mes', title: 'Primeiro Mês', icon: 'fa-calendar-check', accentColor: '#67e8f9' },
  { id: 'com_cara', title: 'Com Cara', icon: 'fa-camera', accentColor: '#94a3b8' },
  { id: 'criando_memorias', title: 'Criando Memórias', icon: 'fa-images', accentColor: '#f472b6' },
];

export default function AchievementCelebration() {
  const { conquistas, notificacoesConquistasNaoLidas, pendingCelebrationId, set } = useAppStore();
  const prevConquistas = useRef<Record<string, boolean>>({});
  const prevCount = useRef(0);

  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [current, setCurrent] = useState<{ title: string; icon: string; accentColor: string } | null>(null);

  // Detecta nova conquista por conquistas ou por pendingCelebrationId vindo do FCM foreground
  useEffect(() => {
    let achievementInfo: { title: string; icon: string; accentColor: string } | null = null;

    if (pendingCelebrationId) {
      const found = ACHIEVEMENTS.find((a) => a.id === pendingCelebrationId);
      achievementInfo = found ?? { title: 'Nova conquista!', icon: 'fa-trophy', accentColor: '#fbbf24' };
      set({ pendingCelebrationId: null });
    } else {
      // Detecta conquista nova comparando com estado anterior
      const newIds = Object.keys(conquistas).filter((id) => conquistas[id] && !prevConquistas.current[id]);
      if (newIds.length > 0) {
        const found = ACHIEVEMENTS.find((a) => a.id === newIds[0]);
        achievementInfo = found ?? { title: 'Nova conquista!', icon: 'fa-trophy', accentColor: '#fbbf24' };
      }
    }

    prevConquistas.current = { ...conquistas };
    prevCount.current = notificacoesConquistasNaoLidas;

    if (!achievementInfo) return;

    setCurrent(achievementInfo);
    setVisible(true);
    setExiting(false);

    const exitTimer = setTimeout(() => setExiting(true), ACHIEVEMENT_BANNER_MS - 400);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setExiting(false);
      setCurrent(null);
    }, ACHIEVEMENT_BANNER_MS);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conquistas, notificacoesConquistasNaoLidas, pendingCelebrationId]);

  if (!visible || !current) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(90vw, 360px)',
        background: '#1f2937',
        border: `2px solid ${current.accentColor}`,
        borderRadius: 16,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: `0 0 24px ${current.accentColor}66`,
        opacity: exiting ? 0 : 1,
        transition: exiting ? 'opacity 0.4s ease' : 'opacity 0.3s ease',
        animation: !exiting ? 'achievementSlideIn 0.4s cubic-bezier(0.34,1.56,0.64,1)' : undefined,
      }}
    >
      <style>{`
        @keyframes achievementSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-24px) scale(0.9); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0)    scale(1);   }
        }
        @keyframes trophyPop {
          0%   { transform: scale(0.5) rotate(-15deg); }
          60%  { transform: scale(1.25) rotate(8deg);  }
          80%  { transform: scale(0.9)  rotate(-4deg); }
          100% { transform: scale(1)    rotate(0deg);  }
        }
      `}</style>

      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: current.accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          animation: 'trophyPop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards',
        }}
      >
        <i className={`fa-solid ${current.icon}`} style={{ color: '#111827', fontSize: 20 }} />
      </div>

      <div>
        <div style={{ fontSize: 11, color: current.accentColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>
          Conquista desbloqueada!
        </div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#f9fafb', marginTop: 2 }}>
          {current.title}
        </div>
      </div>
    </div>
  );
}
