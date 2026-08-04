'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDoc, doc } from 'firebase/firestore';
import { db, waitForAppCheckToken } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import OverlayModal from '@/components/ui/OverlayModal';
import { formatSeconds } from '@/lib/utils/formatDate';
import PremiumRouletteWheel from '@/components/desafios/PremiumRouletteWheel';
import { rotationToLandOnValor } from '@/lib/desafios/rouletteSegments';
import { primeiroNome } from '@/lib/utils/displayName';
import { artigoParceiro } from '@/lib/utils/usuarioMembership';

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
  const {
    showChallengePopup,
    pendingChallenge,
    idPareamentoAmigavel,
    set,
    parceiroNome,
    parceiroData,
  } = useAppStore();
  const partnerFirst =
    primeiroNome(parceiroNome) ||
    primeiroNome(parceiroData?.nome) ||
    'seu amor';
  const partnerArtigo = artigoParceiro({
    anatomia: parceiroData?.anatomia,
    sexo: parceiroData?.sexo,
    genero: typeof parceiroData?.genero === 'string' ? parceiroData.genero : null,
  });
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null);
  const [spunResult, setSpunResult] = useState<number | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [localSeconds, setLocalSeconds] = useState(CHALLENGE_SECONDS);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSubmittedRef = useRef(false);

  function clearCloseTimer() {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }

  function closeAfterDelay(ms = 5000) {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      set({ desafiosPendentes: Math.max(0, (useAppStore.getState().desafiosPendentes || 1) - 1) });
      advanceQueue(set, () => router.push('/desafios'));
    }, ms);
  }

  useEffect(() => {
    if (showChallengePopup && pendingChallenge) {
      setResposta('');
      setSelectedOption(null);
      setSpunResult(null);
      setSpinning(false);
      setWheelRotation(0);
      setLocalSeconds(CHALLENGE_SECONDS);
      autoSubmittedRef.current = false;
      clearCloseTimer();
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setLocalSeconds((s) => {
          if (s <= 1) { clearInterval(timerRef.current!); return 0; }
          return s - 1;
        });
      }, 1000);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      clearCloseTimer();
    };
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
      showToast('Resposta enviada! 🏆', 'sucesso');
      closeAfterDelay(5000);
    } catch {
      showToast('Erro ao enviar resposta.', 'erro');
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
      showToast('Escolha enviada! 🎯', 'sucesso');
      closeAfterDelay(5000);
    } catch {
      showToast('Erro ao enviar escolha.', 'erro');
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

    // Backend define o valor — só então giramos para o segmento certo
    const uid = useAppStore.getState().usuario?.uid;
    let resultadoEncontrado = false;
    const autoCloseTimeout = setTimeout(() => {
      if (!resultadoEncontrado) {
        setSpinning(false);
        showToast('Não foi possível ler o resultado. Tente de novo.', 'erro');
      }
    }, 14000);

    const finishWithValor = (val: number) => {
      resultadoEncontrado = true;
      clearTimeout(autoCloseTimeout);
      const nextRot = rotationToLandOnValor(wheelRotation, val, 5);
      setWheelRotation(nextRot);
      // Espera a animação CSS (~3.5s) e só então mostra o placar
      window.setTimeout(() => {
        setSpunResult(val);
        setSpinning(false);
        closeAfterDelay(5000);
      }, 3600);
    };

    const readResult = async (attempt = 0): Promise<void> => {
      try {
        const snap = await getDoc(doc(db, 'weeklyChallenges', challengeId));
        const respostas = (snap.data()?.['respostas'] as Record<string, number>) ?? {};
        const val = uid ? respostas[uid] : undefined;
        if (val !== undefined) {
          finishWithValor(val);
          return;
        }
      } catch { /* silencioso */ }
      if (attempt < 20) setTimeout(() => readResult(attempt + 1), 400);
    };
    setTimeout(() => readResult(), 400);
  }

  return (
    <OverlayModal
      open={showChallengePopup && !!pendingChallenge}
      onClose={() => {}}
      dismissOnBackdrop={false}
      backdropClassName="bg-black/85"
      maxWidth="max-w-sm"
      scrollPanel={false}
      panelClassName="overflow-hidden border border-[rgba(255,45,63,0.20)]"
      ariaLabel="Desafio da semana"
    >
      <div
        className="overflow-hidden shadow-2xl"
        style={{
          background:
            tipo === 'roleta'
              ? 'radial-gradient(100% 80% at 50% 0%, #1a0a10 0%, #0a0508 55%, #050305 100%)'
              : '#080808',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header gradient — omitido na roleta (chrome próprio) */}
        {tipo !== 'roleta' && (
          <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#ff2d3f 0%,#ff5565 100%)' }}>
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ background: 'rgba(0,0,0,0.22)' }}
              >
                <i className={`fas ${tipo === 'escolha' ? 'fa-hand-point-up' : 'fa-trophy'} text-white text-base`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white/70 text-xs uppercase tracking-widest">Desafio da Semana</p>
                <h3 className="text-white font-bold text-base leading-tight">{pendingChallenge.titulo}</h3>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Countdown — não aplica à roleta */}
          {tipo !== 'roleta' && (
            <div className="space-y-1.5">
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
            </div>
          )}

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
              <div className="flex justify-center -mt-1">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-[5px] text-[10px] font-medium tracking-wide text-white/90"
                  style={{
                    background: 'rgba(190,18,60,0.22)',
                    border: '1px solid rgba(255,80,100,0.22)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/assets/icons/icon-192x192.png"
                    alt=""
                    width={22}
                    height={22}
                    className="object-contain shrink-0"
                    aria-hidden
                  />
                  <span className="relative top-[1.5px]">Desafio Semanal</span>
                </span>
              </div>
              <h3 className="text-center text-[22px] font-semibold leading-[1.2] tracking-tight text-white px-1">
                A conexão está em dia?
                <br />
                <span style={{ color: '#f43f5e' }}>Gire a roleta!</span>
              </h3>
              <p className="text-center text-[13px] text-white/55 -mt-0.5 px-1">
                Gire junto com {partnerArtigo} {partnerFirst} e ganhe... ou perca!
              </p>

              <div className="flex justify-center pt-1 pb-5">
                <PremiumRouletteWheel
                  rotationDeg={wheelRotation}
                  spinning={spinning}
                  size={270}
                />
              </div>

              {spunResult !== null ? (
                <div className="flex flex-col items-center gap-1 py-1">
                  <p
                    className="text-[28px] font-bold tracking-tight"
                    style={{ color: '#f43f5e' }}
                  >
                    {spunResult > 0 ? `+${spunResult}` : spunResult} Foguinhos
                  </p>
                  <p className="text-center text-[13px] font-bold text-white px-2">
                    Some com o resultado d{partnerArtigo} {partnerFirst}
                  </p>
                </div>
              ) : !spinning ? (
                <button
                  onClick={handleGirar}
                  disabled={esgotado}
                  className="w-full py-3 rounded-2xl font-semibold tracking-[0.04em] text-white text-[14px] disabled:opacity-40"
                  style={{
                    background: 'linear-gradient(180deg,#fb7185 0%,#e11d48 52%,#be123c 100%)',
                    boxShadow: '0 6px 20px rgba(244,63,94,0.28)',
                  }}
                >
                  GIRAR ROLETA
                </button>
              ) : null}
            </>
          )}


        </div>
      </div>
    </OverlayModal>
  );
}

