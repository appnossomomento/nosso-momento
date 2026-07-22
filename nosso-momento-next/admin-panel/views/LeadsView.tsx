'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LpLead } from '@/admin-panel/types';
import { ADMIN_SELECT_CLASS } from '@/admin-panel/constants';
import KpiCard from '@/admin-panel/components/KpiCard';
import ChartCard from '@/admin-panel/components/ChartCard';
import DataTable from '@/admin-panel/components/DataTable';

type LeadsResponse = {
  generatedAt: string;
  total: number;
  countSheet: number;
  meta: number;
  leads: LpLead[];
};

function fmtDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function utmLabel(l: LpLead) {
  const parts = [
    l.utmSource && `src:${l.utmSource}`,
    l.utmMedium && `med:${l.utmMedium}`,
    l.utmCampaign && `camp:${l.utmCampaign}`,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : '—';
}

export default function LeadsView() {
  const [leads, setLeads] = useState<LpLead[]>([]);
  const [meta, setMeta] = useState(50);
  const [countSheet, setCountSheet] = useState(0);
  const [generatedAt, setGeneratedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    setErro('');
    try {
      const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const res = await fetch(`/api/admin/leads${qs}`, { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      const data = (await res.json()) as LeadsResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        throw new Error(data.message || data.error || 'fetch_failed');
      }
      setLeads(data.leads || []);
      setMeta(data.meta ?? 50);
      setCountSheet(data.countSheet ?? data.total ?? 0);
      setGeneratedAt(data.generatedAt || '');
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : 'Falha ao carregar leads. Atualize o Apps Script e confira LP_LEADS_TOKEN.',
      );
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withUtm = useMemo(
    () => leads.filter((l) => l.utmSource || l.utmMedium || l.utmCampaign || l.gclid || l.fbclid).length,
    [leads],
  );

  const byOrigem = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of leads) {
      const key = (l.origem || 'não informado').toLowerCase();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [leads]);

  function exportCsv() {
    const cols = [
      'data',
      'nome',
      'whatsapp',
      'email',
      'parceiroNome',
      'cidadeEstado',
      'origem',
      'utmSource',
      'utmMedium',
      'utmCampaign',
      'utmContent',
      'utmTerm',
      'gclid',
      'fbclid',
      'landingUrl',
    ];
    const lines = [
      cols.join(','),
      ...leads.map((l) =>
        cols
          .map((c) => {
            const v = String((l as Record<string, string>)[c] ?? '');
            return `"${v.replace(/"/g, '""')}"`;
          })
          .join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads-lp-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Leads (lista)" value={leads.length} />
        <KpiCard label="Na planilha" value={countSheet} accent="#34d399" />
        <KpiCard label="Com UTM" value={withUtm} accent="#fbbf24" />
        <KpiCard
          label="Vagas"
          value={`${Math.max(0, meta - countSheet)}`}
          hint={`meta ${meta}`}
          accent="#a78bfa"
        />
      </div>

      {erro && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {erro}
          <p className="text-xs text-amber-200/70 mt-1">
            Cole o novo <code className="text-amber-100">cadastro-apps-script.gs</code> no Apps Script,
            publique uma nova versão do Web App e confira o token{' '}
            <code className="text-amber-100">LP_LEADS_TOKEN</code>.
          </p>
        </div>
      )}

      <ChartCard
        title="Leads da Landing (cadastrovip)"
        note={generatedAt ? `Atualizado: ${fmtDate(generatedAt)}` : undefined}
      >
        <div className="flex flex-col md:flex-row gap-2 mb-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void load(search);
            }}
            placeholder="Buscar nome, e-mail, UTM, origem..."
            className={`flex-1 ${ADMIN_SELECT_CLASS}`}
          />
          <button
            type="button"
            onClick={() => void load(search)}
            className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={!leads.length}
            className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5 disabled:opacity-40"
          >
            CSV
          </button>
        </div>

        {byOrigem.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {byOrigem.map(([label, n]) => (
              <span
                key={label}
                className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 text-white/60 border border-white/10"
              >
                {label}: <strong className="text-white/90">{n}</strong>
              </span>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-white/40 text-sm animate-pulse">Carregando leads...</p>
        ) : leads.length === 0 ? (
          <p className="text-white/40 text-sm">Nenhum lead encontrado.</p>
        ) : (
          <DataTable
            columns={[
              { key: 'data', header: 'Data', render: (r) => fmtDate(String(r.data ?? '')) },
              { key: 'nome', header: 'Nome' },
              { key: 'whatsapp', header: 'WhatsApp' },
              { key: 'email', header: 'E-mail' },
              { key: 'parceiroNome', header: 'Parceiro' },
              { key: 'origem', header: 'Origem' },
              {
                key: 'utm',
                header: 'UTM',
                render: (r) => (
                  <span className="text-xs text-amber-200/90" title={String(r.landingUrl || '')}>
                    {utmLabel(r as unknown as LpLead)}
                  </span>
                ),
              },
            ]}
            rows={leads as unknown as Record<string, unknown>[]}
          />
        )}
      </ChartCard>
    </div>
  );
}
