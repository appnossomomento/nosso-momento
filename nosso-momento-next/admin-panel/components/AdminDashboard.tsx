'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import type { AdminMetrics } from '@/admin-panel/types';
import type { AdminSectionId } from '@/admin-panel/constants';
import { ADMIN_SECTIONS } from '@/admin-panel/constants';
import AdminSidebarNav from '@/admin-panel/components/AdminSidebarNav';
import PeriodFilter from '@/admin-panel/components/PeriodFilter';
import AdminSectionViews from '@/admin-panel/views/AdminSectionViews';

const VALID_SECTIONS = new Set(ADMIN_SECTIONS.map((s) => s.id));

function parseSection(raw: string | null): AdminSectionId {
  if (raw === 'genero') return 'pessoas';
  if (raw && VALID_SECTIONS.has(raw as AdminSectionId)) return raw as AdminSectionId;
  return 'geral';
}

export default function AdminDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const section = parseSection(searchParams.get('view'));

  const [days, setDays] = useState(30);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  const sectionLabel = ADMIN_SECTIONS.find((s) => s.id === section)?.label ?? 'Visão Geral';

  const load = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch(`/api/admin/metrics?days=${days}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      if (!res.ok) throw new Error('fetch_failed');
      setMetrics((await res.json()) as AdminMetrics);
    } catch {
      setErro('Falha ao carregar métricas.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  function setSection(id: AdminSectionId) {
    const params = new URLSearchParams(searchParams.toString());
    if (id === 'geral') params.delete('view');
    else params.set('view', id);
    const q = params.toString();
    router.push(q ? `/paineladmin-monitoring-v0?${q}` : '/paineladmin-monitoring-v0');
  }

  async function handleLogout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    window.location.href = '/paineladmin-monitoring-v0/login';
  }

  function handleExport() {
    window.location.href = '/api/admin/export';
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <AdminSidebarNav
        active={section}
        onSelect={setSection}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-white/10 px-4 py-4 md:px-6 sticky top-0 bg-[#0a0a0a]/95 backdrop-blur z-30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="lg:hidden px-2 py-1 rounded border border-white/15 text-sm"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menu"
              >
                ☰
              </button>
              <div>
                <h1 className="text-lg font-semibold">{sectionLabel}</h1>
                {metrics && (
                  <p className="text-xs text-white/35">
                    Gerado em {new Date(metrics.generatedAt).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PeriodFilter value={days} onChange={setDays} />
              <button
                type="button"
                onClick={() => void load()}
                className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="px-3 py-2 rounded-lg text-sm text-red-300 border border-red-500/30 hover:bg-red-500/10"
              >
                Sair
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-6 overflow-x-hidden">
          {loading && !metrics && (
            <p className="text-white/50 text-sm animate-pulse">Carregando métricas...</p>
          )}
          {erro && <p className="text-red-400 text-sm mb-4">{erro}</p>}
          {metrics && (
            <div className={loading ? 'opacity-60 pointer-events-none' : ''}>
              <AdminSectionViews section={section} metrics={metrics} onExport={handleExport} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
