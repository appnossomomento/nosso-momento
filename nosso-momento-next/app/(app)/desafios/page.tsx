'use client';

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';
import AppHeroShell, {
  ACCENT,
  ACCENT_SOFT,
  LP_RED,
  TILE,
} from '@/components/layout/AppHeroShell';
import FoguinhosIcon from '@/components/ui/FoguinhosIcon';
import { primeiroNome } from '@/lib/utils/displayName';

const CTA_GRAD = `linear-gradient(135deg, ${LP_RED}, ${ACCENT})`;
const CHIP_IDLE = { background: TILE, color: 'rgba(255,255,255,0.45)' } as const;
const CHIP_ON = { background: ACCENT, color: '#fff' } as const;

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
  { id: 'first_check_in', title: 'Primeiro Passo', description: 'Realize seu primeiro registro de clima.', hint: 'Registre seu humor pela tela de clima.', icon: 'fa-person-rays', accentColor: '#fbbf24', reward: 1, categoria: 'clima' },
  { id: 'checkin_streak_7', title: 'Foguinho Semanal', description: 'Registre o clima 7 dias consecutivos.', hint: 'Registre diariamente sem perder nenhum dia.', icon: 'fa-calendar-week', accentColor: '#34d399', reward: 3, categoria: 'clima' },
  { id: 'checkin_master', title: 'Mestre do Clima', description: 'Registre o clima 30 vezes no total.', hint: 'Consistência é tudo: registre seu humor frequentemente.', icon: 'fa-stopwatch', accentColor: '#60a5fa', reward: 10, categoria: 'clima' },
  { id: 'sou_fiel', title: 'Sou Fiel', description: 'Registre o clima 60 vezes no total.', hint: 'Mantenha o ritmo diário para mostrar compromisso.', icon: 'fa-hand-holding-heart', accentColor: '#38bdf8', reward: 20, categoria: 'clima' },
  { id: 'sintonia_clima', title: 'Sintonia', description: 'Registre o clima no mesmo dia que seu parceiro.', hint: 'Vocês dois precisam registrar o humor no mesmo dia.', icon: 'fa-heart-pulse', accentColor: '#f43f5e', reward: 1, categoria: 'clima' },
  { id: 'relacao_saudavel', title: 'Relação Saudável', description: "Registre o humor 'Ótimo' 5 vezes.", hint: 'Registre seu melhor humor 5 vezes para desbloquear.', icon: 'fa-face-laugh-beam', accentColor: '#4ade80', reward: 2, categoria: 'clima' },
  { id: 'first_moment_redeem', title: 'Primeiro Momento', description: 'Resgate o seu primeiro momento.', hint: 'Escolha um momento e resgate com foguinhos.', icon: 'fa-heart', accentColor: '#f472b6', reward: 1, categoria: 'relacao' },
  { id: 'moment_collector', title: 'Colecionador de Momentos', description: 'Resgate 5 momentos diferentes.', hint: 'Continue resgatando momentos para o seu mural.', icon: 'fa-gift', accentColor: '#c084fc', reward: 3, categoria: 'relacao' },
  { id: 'to_amando', title: 'Tô Amando', description: 'Resgate momentos de 3 categorias diferentes.', hint: 'Explore diferentes categorias de momentos.', icon: 'fa-star', accentColor: '#e879f9', reward: 2, categoria: 'relacao' },
  { id: 'jornada_iniciada', title: 'Jornada Iniciada', description: 'Tenha um momento resgatado pelo seu parceiro.', hint: 'Seu parceiro precisa resgatar um momento para você.', icon: 'fa-envelope-open-text', accentColor: '#fb7185', reward: 1, categoria: 'relacao' },
  { id: 'atitude', title: 'Atitude', description: 'Complete um momento marcando como realizado.', hint: 'Marque um momento como realizado na aba de momentos.', icon: 'fa-circle-check', accentColor: '#34d399', reward: 1, categoria: 'relacao' },
  { id: 'foguinhos_investor', title: 'Investidor de Foguinhos', description: 'Gaste 50 foguinhos em momentos.', hint: 'Momentos incríveis custam foguinhos – continue investindo!', icon: 'fa-coins', accentColor: '#facc15', reward: 10, categoria: 'engajamento' },
  { id: 'caliente', title: 'Caliente', description: 'Gaste 100 foguinhos em momentos.', hint: 'Quanto mais foguinhos, mais experiências intensas.', icon: 'fa-fire-flame-curved', accentColor: '#fb923c', reward: 20, categoria: 'engajamento' },
  { id: 'em_sincronia', title: 'Em Sincronia', description: 'Acerte o desafio 3 semanas seguidas.', hint: 'Respondam juntos e certos por 3 semanas consecutivas.', icon: 'fa-brain', accentColor: '#a78bfa', reward: 5, categoria: 'engajamento' },
  { id: 'ligeiro', title: 'Ligeiro', description: 'Responda o desafio em menos de 1 hora.', hint: 'Abra o desafio e responda rapidinho!', icon: 'fa-bolt', accentColor: '#fbbf24', reward: 1, categoria: 'engajamento' },
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

export default function DesafiosPage() {
  const { usuario, pareadoUid: pareadoUidAtivo, conquistasCategoria, desafiosTab, set } = useAppStore();

  const conquistas = usuario?.conquistas ?? {};
  const categoria = (conquistasCategoria as Achievement['categoria']) ?? 'engajamento';
  const tab = desafiosTab ?? 'emAberto';

  // ── Desafios Semanais ─────────────────────────────────────────
  const uid = usuario?.uid ?? null;
  const pareadoUid = pareadoUidAtivo ?? usuario?.pareadoUid ?? null;

  interface ActiveChallenge {
    docId: string;
    tipo: 'pergunta' | 'escolha' | 'roleta';
    titulo: string;
    status: string;
    jaRespondeu: boolean;
    opcaoA?: string;
    opcaoB?: string;
    pergunta?: string;
    deadline: number;
    startedAtMs: number;
    data: Record<string, unknown>;
  }

  const CYCLE_MS = 7 * 24 * 60 * 60 * 1000;
  const [activeDesafios, setActiveDesafios] = useState<ActiveChallenge[]>([]);

  useEffect(() => {  
    if (!uid || !pareadoUid) { setActiveDesafios([]); return; }
    const pairKey = [uid, pareadoUid].sort().join('_');
    const docsToWatch = [
      { docId: `alma_gemea_${pairKey}`, tipo: 'pergunta' as const },
      { docId: `preferencias_${pairKey}`, tipo: 'escolha' as const },
      { docId: `roleta_${pairKey}`, tipo: 'roleta' as const },
    ];
    const unsubs: (() => void)[] = [];
    const results: Record<string, ActiveChallenge | null> = {};

    for (const { docId, tipo } of docsToWatch) {
      results[docId] = null;
      const unsub = onSnapshot(doc(db, 'weeklyChallenges', docId), (snap) => {
        if (!snap.exists()) {
          results[docId] = null;
        } else {
          const d = snap.data() as Record<string, unknown>;
          const startedAtMs = typeof d['startedAtMs'] === 'number' ? d['startedAtMs'] : 0;
          const deadline = startedAtMs + CYCLE_MS;
          const expired = Date.now() >= deadline;
          const status = d['status'] as string;
          if (expired || (
            status !== 'pendente' &&
            status !== 'concluido' &&
            status !== 'finalizado' &&
            status !== 'finalizado_sem_recompensa'
          )) {
            results[docId] = null;
          } else {
            const respostas = (d['respostas'] as Record<string, unknown>) ?? {};
            results[docId] = {
              docId,
              tipo,
              titulo: (d['titulo'] as string) ?? 'Desafio',
              status,
              jaRespondeu: respostas[uid] !== undefined,
              opcaoA: d['opcaoA'] as string | undefined,
              opcaoB: d['opcaoB'] as string | undefined,
              pergunta: d['pergunta'] as string | undefined,
              deadline,
              startedAtMs,
              data: d,
            };
          }
        }
        setActiveDesafios(Object.values(results).filter(Boolean) as ActiveChallenge[]);
      }, (err) => console.warn('[DesafiosPage]', err));
      unsubs.push(unsub);
    }
    return () => unsubs.forEach((fn) => fn());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, pareadoUid]);

  // Remove desafios expirados do estado quando o prazo passa, sem depender de
  // um novo snapshot do Firestore (que só dispara se o documento mudar).
  useEffect(() => {
    if (!activeDesafios.length) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const ch of activeDesafios) {
      const ms = ch.deadline - now;
      if (ms > 0) {
        timers.push(
          setTimeout(() => {
            setActiveDesafios((prev) => prev.filter((c) => c.docId !== ch.docId));
          }, ms + 200)
        );
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [activeDesafios]);

  function handleResponder(ch: ActiveChallenge) {
    const challenge = {
      id: ch.docId,
      titulo: ch.titulo,
      deadline: ch.deadline,
      tipo: ch.tipo,
      opcaoA: ch.opcaoA,
      opcaoB: ch.opcaoB,
      pergunta: ch.pergunta,
    };
    set({
      showChallengePopup: true,
      pendingChallenge: challenge,
      challengeDeadline: ch.deadline,
    });
  }
  const filtrados = ACHIEVEMENTS.filter((a) => a.categoria === categoria);
  const visiveis = tab === 'conquistas'
    ? filtrados.filter((a) => !!conquistas[a.id])
    : filtrados.filter((a) => !conquistas[a.id]);

  const totalGeral = ACHIEVEMENTS.filter((a) => !!conquistas[a.id]).length;

  return (
    <AppHeroShell
      sheetClassName="space-y-4"
      hero={
        <>
          <i className="fas fa-flag-checkered text-3xl text-white mb-3" />
          <h2 className="text-[26px] font-semibold text-white leading-tight">Desafios</h2>
          <p className="text-white/75 text-sm mt-1">Acompanhe seus desafios e conquistas</p>
        </>
      }
    >
          {/* ── Desafios da Semana ──────────────────────────── */}
          {activeDesafios.length > 0 && (
            <div className="space-y-2">
              <p className="text-white/50 text-xs font-semibold uppercase tracking-widest px-1">
                Desafios da Semana
              </p>
              {activeDesafios.map((ch) => {
                const iconMap = { pergunta: 'fa-trophy', escolha: 'fa-hand-point-up', roleta: 'fa-dice' };
                const icon = iconMap[ch.tipo] ?? 'fa-trophy';
                const concluido =
                  ch.status === 'concluido' ||
                  ch.status === 'finalizado' ||
                  ch.status === 'finalizado_sem_recompensa';
                const respostas = ch.data['respostas'] as Record<string, unknown> | undefined;
                const pairUids = (ch.data['pairUids'] as string[] | undefined) ?? [];
                const minhaRespostaRaw = respostas?.[uid ?? ''];
                const respostaParceiroRaw = respostas?.[pareadoUid ?? ''];
                const minhaResposta = typeof minhaRespostaRaw === 'string' || typeof minhaRespostaRaw === 'number'
                  ? String(minhaRespostaRaw)
                  : null;
                const respostaParceiro = typeof respostaParceiroRaw === 'string' || typeof respostaParceiroRaw === 'number'
                  ? String(respostaParceiroRaw)
                  : null;
                const toUpperSafe = (v: unknown) => String(v).toLocaleUpperCase('pt-BR');
                const formatarResposta = (valor: unknown): string => {
                  if (!valor) return 'sem resposta';
                  if (valor === '__TIMEOUT__' || valor === '__timeout__') return 'tempo esgotado';
                  if (valor === 'A') return toUpperSafe(ch.opcaoA ?? 'A');
                  if (valor === 'B') return toUpperSafe(ch.opcaoB ?? 'B');
                  return toUpperSafe(valor);
                };
                const respostaEscolha = minhaResposta === 'A'
                  ? toUpperSafe(ch.opcaoA ?? 'A')
                  : minhaResposta === 'B'
                    ? toUpperSafe(ch.opcaoB ?? 'B')
                    : (minhaResposta ? toUpperSafe(minhaResposta) : null);

                const nomeDoUid = (targetUid: string | undefined): string => {
                  if (!targetUid) return 'Usuário';
                  if (targetUid === uid) return usuario?.nome ?? usuario?.apelido ?? 'Usuário';
                  const parceiro = useAppStore.getState().parceirosAtivos.find((p) => p.uid === targetUid);
                  if (parceiro?.nome) return parceiro.nome;
                  if (targetUid === pareadoUid) return useAppStore.getState().parceiroNome ?? 'Parceiro';
                  return 'Usuário';
                };

                const nomeA = nomeDoUid(pairUids[0]);
                const nomeB = nomeDoUid(pairUids[1]);
                const respostaA = ch.tipo === 'roleta' ? null : formatarResposta(
                  respostas?.[pairUids[0] ?? ''] ?? null,
                );
                const respostaB = ch.tipo === 'roleta' ? null : formatarResposta(
                  respostas?.[pairUids[1] ?? ''] ?? null,
                );
                const recompensaBase = Number(
                  (ch.data['reward'] as number | undefined) ?? (ch.tipo === 'escolha' ? 2 : 1),
                );
                const resumoConcluido =
                  ch.status === 'finalizado' || ch.status === 'finalizado_sem_recompensa'
                    ? (
                      <div className="space-y-0.5 mt-0.5">
                        <p className="text-xs leading-snug">
                          <span className="font-bold text-white">{primeiroNome(nomeA)}: </span>
                          <span className="font-extrabold" style={{ color: ACCENT }}>
                            {respostaA ?? 'SEM RESPOSTA'}
                          </span>
                        </p>
                        <p className="text-xs leading-snug">
                          <span className="font-bold text-white">{primeiroNome(nomeB)}: </span>
                          <span className="font-extrabold" style={{ color: ACCENT }}>
                            {respostaB ?? 'SEM RESPOSTA'}
                          </span>
                        </p>
                        <p
                          className="text-xs leading-snug font-semibold flex items-center gap-1"
                          style={{ color: ACCENT_SOFT }}
                        >
                          {ch.status === 'finalizado' ? (
                            <>Vocês ganharam +{recompensaBase} <FoguinhosIcon size={14} /> foguinhos cada.</>
                          ) : (
                            <>Vocês perderam 1 <FoguinhosIcon size={14} /> foguinho cada.</>
                          )}
                        </p>
                      </div>
                    )
                    : null;
                return (
                  <div
                    key={ch.docId}
                    className="rounded-2xl p-3 flex items-center gap-3"
                    style={{
                      background: 'rgba(244,63,94,0.08)',
                      border: '1px solid rgba(244,63,94,0.20)',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'rgba(244,63,94,0.18)' }}
                    >
                      <i className={`fas ${icon} text-sm`} style={{ color: ACCENT_SOFT }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{ch.titulo}</p>
                      {(ch.tipo === 'pergunta' || ch.tipo === 'escolha') && resumoConcluido}
                      {ch.tipo === 'escolha' && ch.opcaoA && (
                        !resumoConcluido && respostaEscolha
                          ? <p className="text-white/40 text-xs truncate">R: {respostaEscolha}</p>
                          : <p className="text-white/40 text-xs truncate">{ch.opcaoA} vs {ch.opcaoB}</p>
                      )}
                      {ch.tipo === 'pergunta' && ch.pergunta && (
                        resumoConcluido
                          ? null
                          : minhaResposta
                            ? <p className="text-white/40 text-xs truncate">R: {toUpperSafe(minhaResposta)}</p>
                            : <p className="text-white/40 text-xs truncate">{ch.pergunta}</p>
                      )}
                      {ch.tipo === 'roleta' && (() => {
                        const respostasRoleta = ch.data['respostas'] as Record<string, number> | undefined;
                        const meuValor = respostasRoleta?.[uid ?? ''];
                        const parceiroValor = respostasRoleta?.[pareadoUid ?? ''];
                        if (ch.status === 'concluido' && meuValor !== undefined && parceiroValor !== undefined) {
                          const soma = meuValor + parceiroValor;
                          const fmtMeu = meuValor > 0 ? `+${meuValor}` : `${meuValor}`;
                          const fmtParceiro = parceiroValor > 0 ? `+${parceiroValor}` : `${parceiroValor}`;
                          const fmtSoma = soma > 0 ? `+${soma}` : `${soma}`;
                          return (
                            <p className="text-xs flex items-center gap-1 flex-wrap">
                              <span className="font-bold" style={{ color: meuValor >= 0 ? '#d4a017' : '#ef4444' }}>{fmtMeu}</span>
                              <span className="text-white/30">+</span>
                              <span className="font-semibold text-white/70">{fmtParceiro}</span>
                              <span className="text-white/30">=</span>
                              <span className="font-bold" style={{ color: soma >= 0 ? '#d4a017' : '#ef4444' }}>{fmtSoma} 🔥</span>
                            </p>
                          );
                        }
                        return meuValor !== undefined
                          ? <p className="text-xs font-bold" style={{ color: meuValor >= 0 ? '#d4a017' : '#ef4444' }}>
                              {meuValor > 0 ? `+${meuValor}` : meuValor} foguinhos
                            </p>
                          : <p className="text-white/40 text-xs">Gire a roleta!</p>;
                      })()}
                    </div>
                    {concluido ? (
                      <span className="text-xs font-semibold shrink-0" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        Concluído ✓
                      </span>
                    ) : ch.jaRespondeu ? (
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.40)' }}
                      >
                        Aguardando...
                      </span>
                    ) : (
                      <button
                        onClick={() => handleResponder(ch)}
                        className="text-xs font-bold px-3 py-1.5 rounded-full shrink-0 text-white"
                        style={{ background: CTA_GRAD }}
                      >
                        Responder
                      </button>
                    )}
                  </div>
                );
              })}
              <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2">
            {[{ id: 'emAberto', label: 'Em Aberto' }, { id: 'conquistas', label: 'Conquistas' }].map((t) => (
              <button
                key={t.id}
                onClick={() => set({ desafiosTab: t.id })}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition"
                style={tab === t.id ? CHIP_ON : CHIP_IDLE}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Categorias */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CATEGORIAS.map((c) => (
              <button
                key={c.id}
                onClick={() => set({ conquistasCategoria: c.id })}
                className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition"
                style={categoria === c.id ? CHIP_ON : CHIP_IDLE}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Lista */}
          {visiveis.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-4xl mb-3">{tab === 'conquistas' ? '🏆' : '🎯'}</div>
              <p className="text-white/40 text-sm">
                {tab === 'conquistas' ? 'Nenhuma conquista nesta categoria ainda.' : 'Todas conquistadas nesta categoria!'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visiveis.map((a) => {
                const desbloqueada = !!conquistas[a.id];
                return (
                  <div
                    key={a.id}
                    className={clsx('rounded-2xl p-4 transition', !desbloqueada && 'opacity-65')}
                    style={{
                      background: TILE,
                      border: desbloqueada
                        ? '1px solid rgba(244,63,94,0.22)'
                        : '1px solid rgba(255,255,255,0.08)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                        style={
                          desbloqueada
                            ? { background: a.accentColor, color: '#111827' }
                            : { background: 'rgba(255,255,255,0.08)' }
                        }
                      >
                        <i className={`fas ${a.icon} text-lg ${desbloqueada ? '' : 'text-white/35'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={clsx('font-semibold text-sm', desbloqueada ? 'text-white' : 'text-white/70')}>
                          {a.title}
                        </p>
                        <p className={clsx('text-xs mt-0.5', desbloqueada ? 'text-white/50' : 'text-white/35')}>
                          {desbloqueada ? a.description : a.hint}
                        </p>
                        {a.reward > 0 && (
                          <p
                            className="text-xs font-semibold mt-1 flex items-center gap-1.5 leading-none"
                            style={{ color: ACCENT_SOFT }}
                          >
                            <FoguinhosIcon size={14} />
                            <span>
                              {a.reward} foguinho{a.reward !== 1 ? 's' : ''}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-center pt-2">
            <span className="text-[11px] text-white/30 tracking-wide">
              Desbloqueadas {totalGeral}/{ACHIEVEMENTS.length}
            </span>
          </div>
    </AppHeroShell>
  );
}
