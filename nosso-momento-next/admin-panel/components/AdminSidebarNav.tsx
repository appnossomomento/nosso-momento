'use client';

import type { AdminSectionId } from '@/admin-panel/constants';
import { ADMIN_SECTIONS } from '@/admin-panel/constants';

type Props = {
  active: AdminSectionId;
  onSelect: (id: AdminSectionId) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

export default function AdminSidebarNav({ active, onSelect, mobileOpen, onCloseMobile }: Props) {
  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onCloseMobile}
        />
      )}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50 w-60 shrink-0
          bg-[#0a0a0a] border-r border-white/10 flex flex-col
          transition-transform duration-200
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        <div className="px-4 py-5 border-b border-white/10">
          <p className="text-base font-semibold text-white">Nosso Momento</p>
          <p className="text-xs text-white/40 mt-0.5">Monitoring — uso interno</p>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {ADMIN_SECTIONS.map((item) => {
            const isActive = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  onCloseMobile();
                }}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors
                  ${isActive
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white/80 hover:bg-white/5'}
                `}
                style={
                  isActive
                    ? { background: 'linear-gradient(135deg, #ff3547 0%, #ff6b7c 100%)' }
                    : undefined
                }
              >
                <span className="w-5 text-center opacity-80">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
