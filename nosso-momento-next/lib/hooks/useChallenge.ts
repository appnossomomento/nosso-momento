import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store/appStore';

/**
 * Gerencia o countdown do desafio semanal ativo.
 * Quando `challengeDeadline` está definido, decrementa `challengeSecondsLeft` a cada segundo.
 * Só escreve no store quando o valor muda (evita re-render global a 1 Hz).
 */
export function useChallenge() {
  const challengeDeadline = useAppStore((s) => s.challengeDeadline);
  const pendingChallenge = useAppStore((s) => s.pendingChallenge);
  const set = useAppStore((s) => s.set);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSecondsRef = useRef<number | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    lastSecondsRef.current = null;

    if (!challengeDeadline && !pendingChallenge) return;

    const deadline =
      challengeDeadline ??
      (pendingChallenge
        ? (() => {
            const d = (pendingChallenge as Record<string, unknown>).deadline;
            return typeof d === 'number' ? d : null;
          })()
        : null);

    if (!deadline) return;

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadline! - now) / 1000));
      if (lastSecondsRef.current !== diff) {
        lastSecondsRef.current = diff;
        set({ challengeSecondsLeft: diff });
      }
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [challengeDeadline, pendingChallenge, set]);
}
