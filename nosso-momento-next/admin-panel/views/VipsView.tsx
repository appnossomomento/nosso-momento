'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AdminVipUser } from '@/admin-panel/types';
import { ADMIN_SELECT_CLASS } from '@/admin-panel/constants';
import KpiCard from '@/admin-panel/components/KpiCard';
import ChartCard from '@/admin-panel/components/ChartCard';
import DataTable from '@/admin-panel/components/DataTable';
import { formatTelefoneBr } from '@/admin-panel/lib/chartUtils';

type UsersResponse = {
  generatedAt: string;
  total: number;
  vipCount: number;
  users: AdminVipUser[];
};

export default function VipsView() {
  const [users, setUsers] = useState<AdminVipUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [search, setSearch] = useState('');
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      if (!res.ok) throw new Error('fetch_failed');
      const data = (await res.json()) as UsersResponse;
      setUsers(data.users);
      setGeneratedAt(data.generatedAt);
    } catch {
      setErro('Falha ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    const qDigits = q.replace(/\D/g, '');
    return users.filter((u) => {
      if (u.email.toLowerCase().includes(q)) return true;
      if (u.nome.toLowerCase().includes(q)) return true;
      if (qDigits && u.telefone.replace(/\D/g, '').includes(qDigits)) return true;
      return false;
    });
  }, [users, search]);

  const vipCount = users.filter((u) => u.vip).length;

  async function toggleVip(user: AdminVipUser) {
    const next = !user.vip;
    if (!next) {
      const ok = window.confirm(
        `Revogar VIP de ${user.email}?\n\nO usuário voltará ao limite de 1 conexão (plano gratuito).`,
      );
      if (!ok) return;
    }

    setUpdatingUid(user.uid);
    setErro('');
    try {
      const res = await fetch(`/api/admin/users/${user.uid}/vip`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vip: next }),
      });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      if (!res.ok) throw new Error('patch_failed');
      const data = (await res.json()) as { vipUpdatedBy: string };
      setUsers((prev) =>
        prev.map((u) =>
          u.uid === user.uid
            ? {
                ...u,
                vip: next,
                vipUpdatedAt: new Date().toISOString(),
                vipUpdatedBy: data.vipUpdatedBy,
              }
            : u,
        ),
      );
    } catch {
      setErro(`Falha ao ${next ? 'ativar' : 'revogar'} VIP para ${user.email}.`);
    } finally {
      setUpdatingUid(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Usuários" value={users.length} />
        <KpiCard label="VIPs ativos" value={vipCount} accent="#fbbf24" />
        <KpiCard label="Plano gratuito" value={users.length - vipCount} accent="#94a3b8" />
      </div>

      <ChartCard
        title="Controle de VIP"
        note="VIP é individual — não propaga ao parceiro. Libera até 5 conexões e recursos premium. Alterações registradas com email do admin."
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="search"
            placeholder="Buscar por email, nome ou telefone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`${ADMIN_SELECT_CLASS} flex-1 min-w-[200px]`}
          />
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="px-3 py-2 rounded-lg border border-white/20 text-sm hover:bg-white/5 disabled:opacity-50"
          >
            Atualizar
          </button>
          {generatedAt && (
            <span className="text-xs text-white/35">
              Atualizado {new Date(generatedAt).toLocaleString('pt-BR')}
            </span>
          )}
        </div>

        {erro && <p className="text-red-400 text-sm mb-3">{erro}</p>}
        {loading && !users.length ? (
          <p className="text-white/50 text-sm animate-pulse py-6 text-center">Carregando usuários…</p>
        ) : (
          <DataTable
            rows={filtered}
            emptyMessage={search ? 'Nenhum usuário encontrado para esta busca.' : 'Sem usuários cadastrados.'}
            columns={[
              { key: 'email', header: 'Email' },
              { key: 'nome', header: 'Nome' },
              {
                key: 'telefone',
                header: 'Telefone',
                render: (r) => formatTelefoneBr(String(r.telefone)),
              },
              {
                key: 'vip',
                header: 'Status',
                render: (r) =>
                  r.vip ? (
                    <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                      ★ VIP
                    </span>
                  ) : (
                    <span className="text-white/40">Gratuito</span>
                  ),
              },
              {
                key: 'vipUpdatedAt',
                header: 'Última alteração',
                render: (r) => {
                  if (!r.vipUpdatedAt) return '—';
                  const when = new Date(String(r.vipUpdatedAt)).toLocaleString('pt-BR');
                  const by = r.vipUpdatedBy ? ` · ${r.vipUpdatedBy}` : '';
                  return `${when}${by}`;
                },
              },
              {
                key: 'action',
                header: 'Ação',
                render: (r) => {
                  const busy = updatingUid === r.uid;
                  return (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void toggleVip(r as AdminVipUser)}
                      className={`
                        px-3 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50
                        ${r.vip
                          ? 'border border-red-500/40 text-red-300 hover:bg-red-500/10'
                          : 'border border-amber-500/40 text-amber-300 hover:bg-amber-500/10'}
                      `}
                    >
                      {busy ? '…' : r.vip ? 'Revogar VIP' : 'Ativar VIP'}
                    </button>
                  );
                },
              },
            ]}
          />
        )}
      </ChartCard>
    </div>
  );
}
