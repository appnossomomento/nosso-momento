'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';
import { db, waitForAppCheckToken } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { formatSeconds } from '@/lib/utils/formatDate';

const ROULETTE_OPTIONS = [
  { valor: 1, prob: 0.147, label: '+1 🔥' },
  { valor: 2, prob: 0.147, label: '+2 🔥🔥' },
  { valor: -1, prob: 0.147, label: '-1 💔' },
  { valor: -2, prob: 0.147, label: '-2 💔💔' },
  { valor: 4, prob: 0.147, label: '+4 🚀' },
  { valor: -3, prob: 0.147, label: '-3 😬' },
  { valor: 10, prob: 0.118, label: '+10 ⚡️' },
];

// Segmentos do gráfico de pizza (computados uma vez)
const _WHEEL_CX = 100, _WHEEL_CY = 100, _WHEEL_R = 82;
// dourado para positivos, vermelho escuro para negativos
const _getSegColor = (valor: number) => valor >= 0 ? '#b8860b' : '#7f1d1d';
// variação de tom para distinguir segmentos do mesmo sinal
const _POS_TONES = ['#b8860b', '#a07800', '#d4a017', '#8b6914', '#c9960c'];
const _NEG_TONES = ['#7f1d1d', '#6b1a1a', '#991b1b', '#5c1515', '#8b2020'];
const _totalProb = ROULETTE_OPTIONS.reduce((s, o) => s + o.prob, 0);
let _cumAngle = -90;
const ROULETTE_SEGMENTS = ROULETTE_OPTIONS.map((opt, i) => {
  const deg = (opt.prob / _totalProb) * 360;
  const sa = _cumAngle;
  _cumAngle += deg;
  const ea = _cumAngle;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = _WHEEL_CX + _WHEEL_R * Math.cos(toRad(sa));
  const y1 = _WHEEL_CY + _WHEEL_R * Math.sin(toRad(sa));
  const x2 = _WHEEL_CX + _WHEEL_R * Math.cos(toRad(ea));
  const y2 = _WHEEL_CY + _WHEEL_R * Math.sin(toRad(ea));
  const midRad = toRad((sa + ea) / 2);
  const lr = _WHEEL_R * 0.62;
  const parts = opt.label.split(' ');
  const tones = opt.valor >= 0 ? _POS_TONES : _NEG_TONES;
  const toneIdx = (opt.valor >= 0 ? _POS_TONES : _NEG_TONES).indexOf(tones[0]); // always 0, just pick by count
  const posCount = ROULETTE_OPTIONS.slice(0, i).filter(o => o.valor >= 0).length;
  const negCount = ROULETTE_OPTIONS.slice(0, i).filter(o => o.valor < 0).length;
  const color = opt.valor === 10 ? '#ffffff' : opt.valor >= 0 ? _POS_TONES[posCount % _POS_TONES.length] : _NEG_TONES[negCount % _NEG_TONES.length];
  const textColor = opt.valor === 10 ? '#1a1a1a' : 'white';
  const textStroke = opt.valor === 10 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.65)';
  return {
    path: `M${_WHEEL_CX},${_WHEEL_CY} L${x1.toFixed(2)},${y1.toFixed(2)} A${_WHEEL_R},${_WHEEL_R} 0 ${deg > 180 ? 1 : 0} 1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`,
    lx: _WHEEL_CX + lr * Math.cos(midRad),
    ly: _WHEEL_CY + lr * Math.sin(midRad),
    num: parts[0],
    icon: parts[1] ?? '',
    color,
    textColor,
    textStroke,
    valor: opt.valor,
    startAngle: sa,
    endAngle: ea,
  };
});

function getSegmentAtPointer(totalRotation: number) {
  const r = ((totalRotation % 360) + 360) % 360;
  // o ponteiro fica no topo (-90° SVG). Após girar r graus CW, o ângulo original no ponteiro = -90 - r
  const origAngle = (((-90 - r) % 360) + 360) % 360;
  for (const seg of ROULETTE_SEGMENTS) {
    const s = ((seg.startAngle % 360) + 360) % 360;
    const e = ((seg.endAngle % 360) + 360) % 360;
    if (s < e) {
      if (origAngle >= s && origAngle < e) return seg;
    } else {
      if (origAngle >= s || origAngle < e) return seg;
    }
  }
  return ROULETTE_SEGMENTS[0];
}

function advanceQueue(set: (p: object) => void, onQueueFinished?: () => void) {
  const store = useAppStore.getState();
  const queue = store.pendingChallengeQueue ?? [];
  if (queue.length > 0) {
    const [next, ...rest] = queue;
    set({
      showChallengePopup: true,
      pendingChallenge: next,
      challengeDeadline: next.deadline ?? null,
      pendingChallengeQueue: rest,
    });
  } else {
    set({ showChallengePopup: false, pendingChallenge: null });
    onQueueFinished?.();
  }
}

const CHALLENGE_SECONDS = 60;

async function submitChallengeInput(
  type: string,
  fields: Record<string, unknown> = {},
): Promise<{ ok: boolean; id: string }> {
  await waitForAppCheckToken(process.env.NODE_ENV === 'development' ? 3000 : 12000);
  return sendInput(type, fields);
}

export default function ChallengePopup() {
  const router = useRouter();
  const { showChallengePopup, pendingChallenge, idPareamentoAmigavel, set } = useAppStore();
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null);
  const [spunResult, setSpunResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [localSeconds, setLocalSeconds] = useState(CHALLENGE_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSubmittedRef = useRef(false);

  useEffect(() => {
    if (showChallengePopup && pendingChallenge) {
      setResposta('');
      setSelectedOption(null);
      setSpunResult(null);
      setSpinning(false);
      setWheelRotation(0);
      setLocalSeconds(CHALLENGE_SECONDS);
      autoSubmittedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setLocalSeconds((s) => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [showChallengePopup, pendingChallenge?.id]);

  // Auto-submit quando o tempo esgotar
  useEffect(() => {
    if (localSeconds > 0 || !showChallengePopup || !pendingChallenge) return;
    if (autoSubmittedRef.current) return;
    autoSubmittedRef.current = true;
    const tipoAtual = pendingChallenge.tipo ?? 'pergunta';
    const idAtual = pendingChallenge.id;
    const submit = async () => {
      try {
        if (tipoAtual === 'pergunta') {
          const pareamentoIdAtual = useAppStore.getState().idPareamentoAmigavel;
          await submitChallengeInput('weekly_challenge_answer', {
            answer: '__TIMEOUT__',
            challengeId: idAtual,
            challengeDocId: idAtual,
            ...(pareamentoIdAtual ? { pareamentoId: pareamentoIdAtual } : {}),
          });
        } else if (tipoAtual === 'escolha') {
          await submitChallengeInput('preference_challenge_answer', { answer: '__TIMEOUT__', challengeId: idAtual, challengeDocId: idAtual });
        } else if (tipoAtual === 'roleta') {
          const pareamentoIdAtual = useAppStore.getState().idPareamentoAmigavel;
          await submitChallengeInput('roulette_spin', {
            challengeId: idAtual,
            challengeDocId: idAtual,
            ...(pareamentoIdAtual ? { pareamentoId: pareamentoIdAtual } : {}),
          });
        }
      } catch { /* silencioso */ }
      set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
      advanceQueue(set, () => router.push('/desafios'));
    };
    submit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSeconds]);

  if (!showChallengePopup || !pendingChallenge) return null;

  const tipo = pendingChallenge.tipo ?? 'pergunta';
  const esgotado = localSeconds <= 0;

  // ── Pergunta aberta ─────────────────────────────────────────
  async function handleEnviarPergunta() {
    if (enviando || !resposta.trim() || esgotado) return;
    setEnviando(true);
    try {
      const pareamentoIdAtual = useAppStore.getState().idPareamentoAmigavel;
      await submitChallengeInput('weekly_challenge_answer', {
        answer: resposta.trim(),
        challengeId: pendingChallenge!.id,
        challengeDocId: pendingChallenge!.id,
        ...(pareamentoIdAtual ? { pareamentoId: pareamentoIdAtual } : {}),
      });
      set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
      advanceQueue(set, () => router.push('/desafios'));
      showToast('Resposta enviada! 🏆', 'sucesso');
    } catch {
      showToast('Erro ao enviar resposta.', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  // ── Preferências A/B ────────────────────────────────────────
  async function handleEnviarEscolha() {
    if (enviando || !selectedOption || esgotado) return;
    setEnviando(true);
    try {
      await submitChallengeInput('preference_challenge_answer', {
        answer: selectedOption,
        challengeId: pendingChallenge!.id,
        challengeDocId: pendingChallenge!.id,
      });
      set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
      advanceQueue(set, () => router.push('/desafios'));
      showToast('Escolha enviada! 🎯', 'sucesso');
    } catch {
      showToast('Erro ao enviar escolha.', 'erro');
    } finally {
      setEnviando(false);
    }
  }

  // ── Roleta ──────────────────────────────────────────────────
  async function handleGirar() {
    if (spinning || enviando || esgotado) return;
    autoSubmittedRef.current = true; // impede auto-submit pelo timer
    const challengeId = pendingChallenge!.id;

    // Marcar como dismissed imediatamente — impede o listener de reabrir o popup
    const prev = useAppStore.getState().dismissedChallengeIds;
    if (!prev.includes(challengeId)) {
      set({ dismissedChallengeIds: [...prev, challengeId] });
    }

    const extra = Math.floor(Math.random() * 360);
    const newRotation = wheelRotation + 5 * 360 + extra;
    setWheelRotation(newRotation);
    setSpinning(true);
    try {
      await submitChallengeInput('roulette_spin', {
        challengeId,
        challengeDocId: challengeId,
        ...(idPareamentoAmigavel ? { pareamentoId: idPareamentoAmigavel } : {}),
      });
    } catch {
      showToast('Erro ao girar roleta.', 'erro');
      setSpinning(false);
      return;
    }
    // Após animação: ler resultado real do Firestore (backend escolhe o valor)
    const uid = useAppStore.getState().usuario?.uid;
    let resultadoEncontrado = false;
    // Timeout de segurança: fecha popup após 14s mesmo sem resultado
    const autoCloseTimeout = setTimeout(() => {
      if (!resultadoEncontrado) {
        const seg = getSegmentAtPointer(newRotation);
        setSpunResult(seg.valor);
        setSpinning(false);
      }
      // Aguarda mais 3s para o usuário ver o resultado antes de fechar
      setTimeout(() => {
        set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
        advanceQueue(set, () => router.push('/desafios'));
      }, 3000);
    }, 14000);
    const readResult = async (attempt = 0): Promise<void> => {
      try {
        const snap = await getDoc(doc(db, 'weeklyChallenges', challengeId));
        const respostas = (snap.data()?.['respostas'] as Record<string, number>) ?? {};
        const val = uid ? respostas[uid] : undefined;
        if (val !== undefined) {
          resultadoEncontrado = true;
          setSpunResult(val);
          setSpinning(false);
          // Cancela o auto-close de 14s e fecha após 5s de exibição do resultado
          clearTimeout(autoCloseTimeout);
          setTimeout(() => {
            set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
            advanceQueue(set, () => router.push('/desafios'));
          }, 5000);
          return;
        }
      } catch { /* silencioso */ }
      if (attempt < 16) setTimeout(() => readResult(attempt + 1), 600);
      // Se esgotar 16 tentativas (~11s), o autoCloseTimeout (14s) cobrirá o fallback
    };
    // Inicia polling em 1500ms — animação CSS é independente, não bloqueia
    setTimeout(() => readResult(), 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: '#080808', border: '1px solid rgba(255,45,63,0.20)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient */}
        <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(0,0,0,0.22)' }}
            >
              <i className={`fas ${tipo === 'roleta' ? 'fa-dice' : tipo === 'escolha' ? 'fa-hand-point-up' : 'fa-trophy'} text-white text-base`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/70 text-xs uppercase tracking-widest">Desafio da Semana</p>
              <h3 className="text-white font-bold text-base leading-tight">{pendingChallenge.titulo}</h3>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Countdown */}
          {!(tipo === 'roleta' && spunResult !== null) && <div className="space-y-1.5">
            <p className="text-center text-xs" style={{ color: 'rgba(255,255,255,0.50)' }}>
              Você tem <span className="font-bold text-white">60 segundos</span> para responder
            </p>
            <div
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
              style={{
                background: esgotado ? 'rgba(239,68,68,0.15)' : localSeconds <= 10 ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.06)',
                color: esgotado ? '#f87171' : localSeconds <= 10 ? '#fca5a5' : 'rgba(255,255,255,0.70)',
              }}
            >
              <i className="fas fa-clock" />
              {esgotado ? 'Tempo esgotado!' : formatSeconds(localSeconds)}
            </div>
          </div>}

          {/* ── PERGUNTA branch ── */}
          {tipo === 'pergunta' && (
            <>
              {pendingChallenge.pergunta && (
                <p className="text-white/80 text-sm text-center leading-snug">
                  {pendingChallenge.pergunta}
                </p>
              )}
              <input
                ref={inputRef}
                value={resposta}
                onChange={(e) => setResposta(e.target.value.toUpperCase())}
                disabled={esgotado}
                placeholder="Sua resposta..."
                className="w-full rounded-xl px-4 py-3 text-white text-sm uppercase focus:outline-none disabled:opacity-40"
                style={{ background: '#111', border: '1px solid rgba(255,45,63,0.22)', caretColor: '#ff5565' }}
                onKeyDown={(e) => e.key === 'Enter' && handleEnviarPergunta()}
              />
              <button
                onClick={handleEnviarPergunta}
                disabled={enviando || !resposta.trim() || esgotado}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
              >
                {enviando ? 'Enviando...' : 'Enviar Resposta'}
              </button>
            </>
          )}

          {/* ── ESCOLHA branch ── */}
          {tipo === 'escolha' && (
            <>
              <p className="text-white/70 text-xs text-center">Escolham a mesma opção para ganhar pontos!</p>
              <div className="grid grid-cols-2 gap-3">
                {(['A', 'B'] as const).map((opt) => {
                  const label = opt === 'A' ? pendingChallenge.opcaoA : pendingChallenge.opcaoB;
                  const active = selectedOption === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => setSelectedOption(opt)}
                      disabled={esgotado}
                      className="py-4 rounded-2xl font-bold text-sm transition-all disabled:opacity-40"
                      style={{
                        background: active
                          ? 'linear-gradient(135deg,#ff2d3f,#c8003a)'
                          : 'rgba(255,255,255,0.06)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                        border: active
                          ? '2px solid rgba(255,45,63,0.6)'
                          : '2px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {label ?? opt}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={handleEnviarEscolha}
                disabled={enviando || !selectedOption || esgotado}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
              >
                {enviando ? 'Enviando...' : 'Confirmar Escolha'}
              </button>
            </>
          )}

          {/* ── ROLETA branch ── */}
          {tipo === 'roleta' && (
            <>
              <p className="text-white font-semibold text-base text-center">Ganhe em casal 🔥</p>

              {/* Roda da roleta */}
              <div className="flex flex-col items-center" style={{ gap: 0 }}>
                {/* Ponteiro */}
                <div style={{
                  width: 0,
                  height: 0,
                  borderLeft: '10px solid transparent',
                  borderRight: '10px solid transparent',
                  borderTop: '18px solid #ffffff',
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.7))',
                  marginBottom: '-2px',
                  zIndex: 1,
                }} />
                {/* SVG gráfico de pizza */}
                <svg
                  viewBox="0 0 200 200"
                  width={210}
                  height={210}
                  style={{
                    transform: `rotate(${wheelRotation}deg)`,
                    transition: spinning
                      ? 'transform 3.5s cubic-bezier(0.17,0.67,0.12,0.99)'
                      : 'none',
                    borderRadius: '50%',
                    boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
                    display: 'block',
                  }}
                >
                  {ROULETTE_SEGMENTS.map((seg, i) => (
                    <g key={i}>
                      <path d={seg.path} fill={seg.color} stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" />
                      <text
                        x={seg.lx}
                        y={seg.ly}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill={seg.textColor}
                        stroke={seg.textStroke}
                        strokeWidth="2.5"
                        paintOrder="stroke"
                      >
                        {seg.num}
                      </text>
                    </g>
                  ))}
                  {/* Centro */}
                  <circle cx={_WHEEL_CX} cy={_WHEEL_CY} r="14" fill="#111" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                  <circle cx={_WHEEL_CX} cy={_WHEEL_CY} r="5" fill="rgba(255,255,255,0.35)" />
                </svg>
              </div>

              {spunResult !== null ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <p className="text-white/60 text-xs uppercase tracking-widest">Você tirou</p>
                  <p
                    className="text-5xl font-black"
                    style={{ color: spunResult >= 0 ? '#d4a017' : '#ef4444' }}
                  >
                    {spunResult > 0 ? `+${spunResult}` : spunResult}
                  </p>
                  <p className="text-white/70 text-sm font-medium">
                    {spunResult >= 0 ? '🔥 foguinhos para o casal!' : '💔 foguinhos perdidos pelo casal'}
                  </p>
                  <div
                    className="flex items-center gap-2 mt-1 px-4 py-2 rounded-xl text-xs"
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)' }}
                  >
                    <i className="fas fa-hourglass-half" />
                    <span>Aguardando o parceiro girar...</span>
                  </div>
                  <button
                    onClick={() => {
                      set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
                      advanceQueue(set, () => router.push('/desafios'));
                    }}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm mt-2"
                    style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
                  >
                    Fechar
                  </button>
                </div>
              ) : !spinning ? (
                <button
                  onClick={handleGirar}
                  disabled={esgotado}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#ff2d3f,#c8003a)' }}
                >
                  🎰 Girar Roleta
                </button>
              ) : (
                <p className="text-center text-white/50 text-xs pt-1 animate-pulse">
                  Girando...
                </p>
              )}
            </>
          )}


        </div>
      </div>
    </div>
  );
}

