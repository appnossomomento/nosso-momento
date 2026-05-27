'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';

type ToastType = 'sucesso' | 'erro' | 'aviso' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

let addToastFn: ((message: string, type: ToastType) => void) | null = null;

/** Função global para disparar toasts (usada fora de componentes React) */
export function showToast(message: string, type: ToastType = 'info') {
  addToastFn?.(message, type);
}

export default function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  let counter = 0;

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = ++counter;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  useEffect(() => {
    addToastFn = addToast;
    return () => {
      addToastFn = null;
    };
  }, [addToast]);

  const colorMap: Record<ToastType, string> = {
    sucesso: 'bg-green-600',
    erro: 'bg-red-600',
    aviso: 'bg-yellow-500',
    info: 'bg-blue-600',
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={clsx(
            'rounded-xl px-4 py-3 text-white text-sm font-medium shadow-lg text-center animate-fade-in',
            colorMap[t.type]
          )}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
