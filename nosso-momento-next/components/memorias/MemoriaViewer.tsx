'use client';

import Image from 'next/image';
import { useAppStore } from '@/lib/store/appStore';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { openSystemConfirm } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';

export default function MemoriaViewer() {
  const { showMemoriasViewer, memoriasItems, memoriasViewerIndex, set } = useAppStore();
  if (!showMemoriasViewer) return null;

  const items = memoriasItems;
  const idx = memoriasViewerIndex ?? 0;
  const item = items[idx];
  if (!item) return null;

  function close() {
    set({ showMemoriasViewer: false, memoriasViewerIndex: null });
  }

  function navigate(dir: -1 | 1) {
    const next = idx + dir;
    if (next >= 0 && next < items.length) {
      set({ memoriasViewerIndex: next });
    }
  }

  async function handleDelete() {
    openSystemConfirm(
      'Tem certeza que deseja excluir esta foto?',
      async () => {
        try {
          await callFunction(FUNCTIONS.deleteMemoria, { memoriaId: item.id });
          const updated = items.filter((m) => m.id !== item.id);
          if (updated.length === 0) {
            set({ memoriasItems: [], showMemoriasViewer: false, memoriasViewerIndex: null, memoriasView: 'welcome' });
          } else {
            set({
              memoriasItems: updated,
              memoriasViewerIndex: Math.min(idx, updated.length - 1),
            });
          }
          showToast('Foto excluída com sucesso!', 'sucesso');
        } catch {
          showToast('Erro ao excluir a foto.', 'erro');
        }
      },
      'Excluir',
      'Cancelar'
    );
  }

  const imgUrl = String(item.fotoUrl ?? item.url ?? '');

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center px-4" onClick={close}>
      <div
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Imagem com navegação */}
        <div className="relative">
          <div className="w-full aspect-[3/4] overflow-hidden rounded-2xl bg-gray-100">
            {imgUrl ? (
              <Image
                src={imgUrl}
                alt="Memória"
                fill
                className="object-cover"
                sizes="400px"
              />
            ) : null}
          </div>

          {idx > 0 && (
            <button
              onClick={() => navigate(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white text-sm flex items-center justify-center"
              aria-label="Foto anterior"
            >
              ‹
            </button>
          )}
          {idx < items.length - 1 && (
            <button
              onClick={() => navigate(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/30 text-white text-sm flex items-center justify-center"
              aria-label="Próxima foto"
            >
              ›
            </button>
          )}
        </div>

        {/* Descrição */}
        {item.descricao ? (
          <p className="text-sm text-gray-600 mt-4">{String(item.descricao)}</p>
        ) : null}

        {/* Contador */}
        <p className="text-xs text-gray-400 text-center mt-2">{idx + 1} / {items.length}</p>

        {/* Ações */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            onClick={close}
            className="w-11 h-11 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center"
            aria-label="Fechar"
          >
            <i className="fas fa-times" />
          </button>
          <button
            onClick={handleDelete}
            className="w-11 h-11 rounded-full bg-red-500 text-white flex items-center justify-center"
            aria-label="Excluir foto"
          >
            <i className="fas fa-trash" />
          </button>
        </div>
      </div>
    </div>
  );
}
