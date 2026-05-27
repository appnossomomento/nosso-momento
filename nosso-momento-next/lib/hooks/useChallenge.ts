import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store/appStore';

/**
 * Gerencia o countdown do desafio semanal ativo.
 * Quando `challengeDeadline` está definido, decrementa `challengeSecondsLeft` a cada segundo.
 */
export function useChallenge() {
  const { challengeDeadline, pendingChallenge, set } = useAppStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Limpa timer anterior
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!challengeDeadline && !pendingChallenge) return;

    const deadline = challengeDeadline ?? (
      pendingChallenge
        ? (() => {
            // fallback: tenta ler deadline do pendingChallenge
            const d = (pendingChallenge as Record<string, unknown>).deadline;
            return typeof d === 'number' ? d : null;
          })()
        : null
    );

    if (!deadline) return;

    function tick() {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((deadline! - now) / 1000));
      set({ challengeSecondsLeft: diff });
      if (diff <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    tick(); // atualiza imediatamente
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [challengeDeadline, pendingChallenge, set]);
}
