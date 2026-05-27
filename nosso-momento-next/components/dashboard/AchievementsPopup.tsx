'use client';

import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';

interface Achievement {
  id: string;
  title: string;
  description: string;
  hint: string;
  icon: string;
  accentColor: string;
  reward: number;
  categoria: 'clima' | 'relacao' | 'engajamento' | 'individual';
}

const ACHIEVEMENTS: Achievement[] = [
  // CLIMA
  { id: 'first_check_in', title: 'Primeiro Passo', description: 'Realize seu primeiro registro de clima.', hint: 'Registre seu humor pela tela de clima.', icon: 'fa-person-rays', accentColor: '#fbbf24', reward: 1, categoria: 'clima' },
  { id: 'checkin_streak_7', title: 'Foguinho Semanal', description: 'Registre o clima 7 dias consecutivos.', hint: 'Registre diariamente sem perder nenhum dia.', icon: 'fa-calendar-week', accentColor: '#34d399', reward: 3, categoria: 'clima' },
  { id: 'checkin_master', title: 'Mestre do Clima', description: 'Registre o clima 30 vezes no total.', hint: 'Consistência é tudo: registre seu humor frequentemente.', icon: 'fa-stopwatch', accentColor: '#60a5fa', reward: 10, categoria: 'clima' },
  { id: 'sou_fiel', title: 'Sou Fiel', description: 'Registre o clima 60 vezes no total.', hint: 'Mantenha o ritmo diário para mostrar compromisso.', icon: 'fa-hand-holding-heart', accentColor: '#38bdf8', reward: 20, categoria: 'clima' },
  { id: 'sintonia_clima', title: 'Sintonia', description: 'Registre o clima no mesmo dia que seu parceiro.', hint: 'Vocês dois precisam registrar o humor no mesmo dia.', icon: 'fa-heart-pulse', accentColor: '#f43f5e', reward: 1, categoria: 'clima' },
  { id: 'relacao_saudavel', title: 'Relação Saudável', description: "Registre o humor 'Ótimo' 5 vezes.", hint: 'Registre seu melhor humor 5 vezes para desbloquear.', icon: 'fa-face-laugh-beam', accentColor: '#4ade80', reward: 2, categoria: 'clima' },
  // RELAÇÃO
  { id: 'first_moment_redeem', title: 'Primeiro Momento', description: 'Resgate o seu primeiro momento.', hint: 'Escolha um momento e resgate com foguinhos.', icon: 'fa-heart', accentColor: '#f472b6', reward: 1, categoria: 'relacao' },
  { id: 'moment_collector', title: 'Colecionador de Momentos', description: 'Resgate 5 momentos diferentes.', hint: 'Continue resgatando momentos para o seu mural.', icon: 'fa-gift', accentColor: '#c084fc', reward: 3, categoria: 'relacao' },
  { id: 'to_amando', title: 'Tô Amando', description: 'Resgate momentos de 3 categorias diferentes.', hint: 'Explore diferentes categorias de momentos.', icon: 'fa-star', accentColor: '#e879f9', reward: 2, categoria: 'relacao' },
  { id: 'jornada_iniciada', title: 'Jornada Iniciada', description: 'Tenha um momento resgatado pelo seu parceiro.', hint: 'Seu parceiro precisa resgatar um momento para você.', icon: 'fa-envelope-open-text', accentColor: '#fb7185', reward: 1, categoria: 'relacao' },
  { id: 'atitude', title: 'Atitude', description: 'Complete um momento marcando como realizado.', hint: 'Marque um momento como realizado na aba de momentos.', icon: 'fa-circle-check', accentColor: '#34d399', reward: 1, categoria: 'relacao' },
  // ENGAJAMENTO
  { id: 'foguinhos_investor', title: 'Investidor de Foguinhos', description: 'Gaste 50 foguinhos em momentos.', hint: 'Momentos incríveis custam foguinhos – continue investindo!', icon: 'fa-coins', accentColor: '#facc15', reward: 10, categoria: 'engajamento' },
  { id: 'caliente', title: 'Caliente', description: 'Gaste 100 foguinhos em momentos.', hint: 'Quanto mais foguinhos, mais experiências intensas.', icon: 'fa-fire-flame-curved', accentColor: '#fb923c', reward: 20, categoria: 'engajamento' },
  { id: 'em_sincronia', title: 'Em Sincronia', description: 'Acerte o desafio 3 semanas seguidas.', hint: 'Respondam juntos e certos por 3 semanas consecutivas.', icon: 'fa-brain', accentColor: '#a78bfa', reward: 5, categoria: 'engajamento' },
  { id: 'ligeiro', title: 'Ligeiro', description: 'Responda o desafio em menos de 1 hora.', hint: 'Abra o desafio e responda rapidinho!', icon: 'fa-bolt', accentColor: '#fbbf24', reward: 1, categoria: 'engajamento' },
  // INDIVIDUAL
  { id: 'primeiro_mes', title: 'Primeiro Mês', description: 'Complete 30 dias usando o Nosso Momento.', hint: 'Continue usando o app por 30 dias.', icon: 'fa-calendar-check', accentColor: '#67e8f9', reward: 3, categoria: 'individual' },
  { id: 'com_cara', title: 'Com Cara', description: 'Adicione uma foto de perfil.', hint: 'Vá em Meu Perfil e envie uma foto.', icon: 'fa-camera', accentColor: '#94a3b8', reward: 1, categoria: 'individual' },
  { id: 'criando_memorias', title: 'Criando Memórias', description: 'Envie uma foto ao registrar um momento realizado.', hint: 'Ao marcar um momento como feito, adicione uma foto.', icon: 'fa-images', accentColor: '#f472b6', reward: 1, categoria: 'individual' },
];

const CATEGORIAS = [
  { id: 'engajamento', label: 'Engajamento' },
  { id: 'clima', label: 'Clima' },
  { id: 'relacao', label: 'Relação' },
  { id: 'individual', label: 'Individual' },
] as const;

const TABS = [
  { id: 'conquistas', label: 'Conquistados' },
  { id: 'emAberto', label: 'Em aberto' },
] as const;

export default function AchievementsPopup() {
  const { showAchievementsPopup, usuario, conquistasCategoria, desafiosTab, set } = useAppStore();
  if (!showAchievementsPopup) return null;

  const conquistas = usuario?.conquistas ?? {};
  const categoria = (conquistasCategoria as Achievement['categoria']) ?? 'engajamento';
  const tab = desafiosTab ?? 'conquistas';
  const filtrados = ACHIEVEMENTS.filter((a) => a.categoria === categoria);
  const visiveis = tab === 'conquistas'
    ? filtrados.filter((a) => !!conquistas[a.id])
    : filtrados.filter((a) => !conquistas[a.id]);

  const totalGeral = ACHIEVEMENTS.filter((a) => !!conquistas[a.id]).length;

  function close() {
    set({ showAchievementsPopup: false });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={close}>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-[#0f0b14] border border-white/10 p-6 shadow-2xl text-white max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1 shrink-0">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/50">Desafios</p>
            <h2 className="text-2xl font-bold">Conquistas</h2>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/50 bg-white/10 rounded-full px-3 py-1">
              {totalGeral}/{ACHIEVEMENTS.length}
            </span>
            <button onClick={close} className="text-white/50 hover:text-white transition">
              <i className="fas fa-times text-lg" />
            </button>
          </div>
        </div>

        {/* Tabs conquistado / em aberto */}
        <div className="flex gap-2 mt-4 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => set({ desafiosTab: t.id })}
              className={clsx(
                'flex-1 py-2 rounded-xl text-xs font-semibold transition',
                tab === t.id ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white' : 'bg-white/5 text-white/50'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Categorias */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 shrink-0">
          {CATEGORIAS.map((c) => (
            <button
              key={c.id}
              onClick={() => set({ conquistasCategoria: c.id })}
              className={clsx(
                'shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition',
                categoria === c.id ? 'bg-white text-black' : 'bg-white/10 text-white/60'
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div className="mt-4 flex-1 overflow-y-auto min-h-0 space-y-3">
          {visiveis.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">{tab === 'conquistas' ? '🏆' : '🎯'}</div>
              <p className="text-white/40 text-sm">
                {tab === 'conquistas' ? 'Nenhuma conquista nesta categoria ainda.' : 'Todas conquistadas nesta categoria!'}
              </p>
            </div>
          ) : (
            visiveis.map((a) => {
              const desbloqueada = !!conquistas[a.id];
              const dataInfo = conquistas[a.id] as Record<string, unknown> | boolean | undefined;
              const unlockedAt = typeof dataInfo === 'object' && dataInfo !== null
                ? (dataInfo as Record<string, unknown>).unlockedAt
                : null;
              return (
                <div
                  key={a.id}
                  className={clsx(
                    'rounded-2xl border p-4 transition',
                    desbloqueada ? 'bg-gray-900 border-transparent' : 'bg-[#141414] border-[#2a2a2a] opacity-65'
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                      style={desbloqueada ? { background: a.accentColor, color: '#111827' } : { background: '#374151' }}
                    >
                      <i className={`fas ${a.icon} text-lg ${desbloqueada ? '' : 'text-gray-500'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('font-semibold text-sm', desbloqueada ? 'text-white' : 'text-gray-300')}>
                        {a.title}
                      </p>
                      <p className={clsx('text-xs', desbloqueada ? 'text-gray-400' : 'text-gray-500')}>
                        {desbloqueada ? a.description : a.hint}
                      </p>
                      {a.reward > 0 && (
                        <p className="text-xs font-semibold text-amber-400 mt-1">
                          <i className="fas fa-fire mr-1" />{a.reward} foguinho{a.reward !== 1 ? 's' : ''}
                        </p>
                      )}
                      {desbloqueada && !!unlockedAt ? (
                        <p className="text-xs text-emerald-400 mt-0.5">
                          <i className="fas fa-check-circle mr-1" />Desbloqueada
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
