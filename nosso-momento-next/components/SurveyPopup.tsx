'use client';

import { useMemo, useState } from 'react';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import OverlayModal from '@/components/ui/OverlayModal';
import type { SurveyAnswer } from '@/lib/types/survey';
import { showToast } from '@/components/ui/Toast';
import clsx from 'clsx';

export default function SurveyPopup() {
  const { showSurveyPopup, pendingSurvey, usuario, set } = useAppStore();
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);

  const questions = pendingSurvey?.questions || [];
  const current = questions[step];
  const isLast = step >= questions.length - 1;

  const canAdvance = useMemo(() => {
    if (!current) return false;
    const v = answers[current.id];
    if (current.type === 'foguinhos') {
      return typeof v === 'number' && v >= 0 && v <= 5;
    }
    if (current.type === 'choice') {
      return typeof v === 'string' && v.length > 0;
    }
    return typeof v === 'string' && v.trim().length > 0;
  }, [answers, current]);

  if (!showSurveyPopup || !pendingSurvey || !usuario?.uid) return null;

  function closeLocal() {
    set({ showSurveyPopup: false, pendingSurvey: null });
    setAnswers({});
    setStep(0);
  }

  async function persist(skipped: boolean) {
    if (!pendingSurvey || !usuario?.uid || !db) return;
    setSubmitting(true);
    try {
      const payloadAnswers: SurveyAnswer[] = skipped
        ? []
        : questions.map((q) => ({
            questionId: q.id,
            value: answers[q.id] ?? (q.type === 'foguinhos' ? 0 : ''),
          }));

      await setDoc(doc(db, 'surveyResponses', `${pendingSurvey.id}_${usuario.uid}`), {
        surveyId: pendingSurvey.id,
        userId: usuario.uid,
        answers: payloadAnswers,
        skipped,
        createdAt: serverTimestamp(),
      });

      showToast(
        skipped ? 'Tudo bem — obrigado mesmo assim!' : 'Obrigado! Sua resposta ajuda a gente 🔥',
        'sucesso',
      );
      closeLocal();
    } catch {
      showToast('Não foi possível enviar. Tente de novo.', 'erro');
    } finally {
      setSubmitting(false);
    }
  }

  function handleNext() {
    if (!canAdvance) return;
    if (isLast) {
      void persist(false);
      return;
    }
    setStep((s) => s + 1);
  }

  return (
    <OverlayModal
      open={showSurveyPopup}
      onClose={() => {
        /* só fecha via pular / enviar — prioridade máxima */
      }}
      dismissOnBackdrop={false}
      backdropClassName="bg-black/90"
      maxWidth="max-w-sm"
      scrollPanel={false}
      zIndex={80}
      panelClassName="overflow-hidden border border-[rgba(255,45,63,0.25)]"
      ariaLabel="Pesquisa Nosso Momento"
    >
      <div style={{ background: '#080808' }}>
        <div
          className="px-5 py-4"
          style={{ background: 'linear-gradient(135deg, #ff2d3f 0%, #ff5565 100%)' }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-white/80">
            Queremos te ouvir
          </p>
          <h2 className="text-base font-bold text-white mt-1 leading-snug">
            {pendingSurvey.title}
          </h2>
          {questions.length > 1 && (
            <p className="text-xs text-white/70 mt-1">
              {step + 1} de {questions.length}
            </p>
          )}
        </div>

        <div className="px-5 py-5 space-y-4">
          {current && (
            <>
              <p className="text-sm text-white/90 leading-relaxed">{current.label}</p>

              {current.type === 'foguinhos' && (
                <div className="flex justify-between gap-1">
                  {[0, 1, 2, 3, 4, 5].map((n) => {
                    const selected = answers[current.id] === n;
                    return (
                      <button
                        key={n}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [current.id]: n }))
                        }
                        className={clsx(
                          'flex-1 py-3 rounded-xl text-xs font-bold transition flex flex-col items-center gap-0.5',
                          selected
                            ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/50'
                            : 'bg-white/5 text-white/50 hover:bg-white/10',
                        )}
                        aria-label={`${n} foguinhos`}
                      >
                        <span>{n === 0 ? '—' : '🔥'}</span>
                        <span>{n}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {current.type === 'choice' && (
                <div className="space-y-2">
                  {(current.options || []).map((opt) => {
                    const selected = answers[current.id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [current.id]: opt }))
                        }
                        className={clsx(
                          'w-full text-left px-4 py-3 rounded-xl text-sm transition',
                          selected
                            ? 'bg-pink-500/20 text-white ring-1 ring-pink-400/40'
                            : 'bg-white/5 text-white/70 hover:bg-white/10',
                        )}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {current.type === 'text' && (
                <textarea
                  value={String(answers[current.id] ?? '')}
                  onChange={(e) =>
                    setAnswers((prev) => ({
                      ...prev,
                      [current.id]: e.target.value.slice(0, 500),
                    }))
                  }
                  rows={3}
                  maxLength={500}
                  placeholder="Escreva aqui..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-pink-400/50"
                />
              )}
            </>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={submitting}
              onClick={() => void persist(true)}
              className="flex-1 py-3 rounded-2xl text-sm text-white/50 hover:text-white/70 transition disabled:opacity-40"
            >
              Agora não
            </button>
            <button
              type="button"
              disabled={!canAdvance || submitting}
              onClick={handleNext}
              className="flex-[1.4] py-3 rounded-2xl text-sm font-semibold text-white transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #ff2d3f, #c8003a)' }}
            >
              {submitting ? 'Enviando...' : isLast ? 'Enviar' : 'Próxima'}
            </button>
          </div>
        </div>
      </div>
    </OverlayModal>
  );
}
