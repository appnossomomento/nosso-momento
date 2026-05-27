'use client';

import { useAppStore } from '@/lib/store/appStore';
import clsx from 'clsx';

export default function Modal() {
  const {
    showSystemModal,
    systemModalType,
    systemModalMessage,
    systemModalConfirmText,
    systemModalCancelText,
    systemModalOnConfirm,
    set,
  } = useAppStore();

  if (!showSystemModal) return null;

  const close = () => set({ showSystemModal: false, systemModalOnConfirm: null });
  const confirm = () => {
    systemModalOnConfirm?.();
    close();
  };

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 px-4">
      <div className="card w-full max-w-sm p-6 text-white">
        <p className="text-center text-sm leading-relaxed whitespace-pre-wrap mb-6">
          {systemModalMessage}
        </p>
        <div className="flex gap-3">
          {systemModalType === 'confirm' && (
            <button
              onClick={close}
              className="flex-1 rounded-xl border border-white/20 py-3 text-sm font-medium text-white/80 hover:bg-white/10 transition"
            >
              {systemModalCancelText}
            </button>
          )}
          <button
            onClick={confirm}
            className="flex-1 btn-red rounded-xl py-3 text-sm font-medium"
          >
            {systemModalConfirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Helpers para abrir modais de forma imperativa */
export function openSystemAlert(message: string, confirmText = 'OK') {
  useAppStore.setState({
    showSystemModal: true,
    systemModalType: 'alert',
    systemModalMessage: message,
    systemModalConfirmText: confirmText,
    systemModalOnConfirm: null,
  });
}

export function openSystemConfirm(
  message: string,
  onConfirm: () => void,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
) {
  useAppStore.setState({
    showSystemModal: true,
    systemModalType: 'confirm',
    systemModalMessage: message,
    systemModalConfirmText: confirmText,
    systemModalCancelText: cancelText,
    systemModalOnConfirm: onConfirm,
  });
}
