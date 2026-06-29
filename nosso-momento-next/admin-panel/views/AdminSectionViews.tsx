'use client';

import type { AdminMetrics } from '@/admin-panel/types';
import type { AdminSectionId } from '@/admin-panel/constants';
import KpiCard from '@/admin-panel/components/KpiCard';
import ChartCard from '@/admin-panel/components/ChartCard';
import DonutChart from '@/admin-panel/components/DonutChart';
import LineAreaChart from '@/admin-panel/components/LineAreaChart';
import BarChartSimple from '@/admin-panel/components/BarChartSimple';
import ProgressRing from '@/admin-panel/components/ProgressRing';
import GeoMapBr from '@/admin-panel/components/GeoMapBr';
import DataTable from '@/admin-panel/components/DataTable';
import { formatTelefoneBr, pct, rollupMonthly, rollupWeekly, withPercent } from '@/admin-panel/lib/chartUtils';
import VipsView from '@/admin-panel/views/VipsView';

const SNAPSHOT_NOTE = 'Distribuição acumulada — base total de usuários cadastrados.';

function GeralView({ m }: { m: AdminMetrics }) {
  const { totals } = m;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiCard label="Usuários" value={totals.users} />
        <KpiCard label={`Cadastros (${m.periodDays}d)`} value={totals.signupsInPeriod} accent="#34d399" delta={totals.signupsGrowthPct} />
        <KpiCard label="Pareamentos" value={totals.pareamentos} accent="#a78bfa" />
        <KpiCard label="Pareados" value={totals.withPairing} accent="#f472b6" />
        <KpiCard label="Ativos (7d)" value={totals.activeInPeriod} hint="Check-in clima" accent="#38bdf8" />
        <KpiCard label="Push ativo" value={totals.notificationsEnabled} accent="#fbbf24" />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title={`Cadastros por dia (${m.periodDays}d)`}>
            <LineAreaChart data={m.signupsByDay} color="#ff5565" gradientId="signupsDaily" />
          </ChartCard>
        </div>
        <ChartCard title="Indicadores">
          <div className="grid grid-cols-3 gap-2">
            <ProgressRing value={totals.withPairing} max={totals.users || 1} label="Pareados" color="#f472b6" />
            <ProgressRing value={totals.notificationsEnabled} max={totals.users || 1} label="Push" color="#fbbf24" />
            <ProgressRing value={totals.activeInPeriod} max={totals.users || 1} label="Ativos 7d" color="#38bdf8" />
          </div>
        </ChartCard>
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title={`Logins diários (${m.periodDays}d)`} note="Usuários únicos que abriram o app no dia.">
          <LineAreaChart data={m.loginsByDay} color="#fb923c" gradientId="loginsDaily" />
        </ChartCard>
        <ChartCard title="Cadastros por semana">
          <BarChartSimple
            title=""
            items={rollupWeekly(m.signupsByDay)}
            maxItems={20}
          />
        </ChartCard>
      </div>
    </div>
  );
}

function GeolocalizadaView({ m }: { m: AdminMetrics }) {
  const rows = withPercent(m.byEstado, m.totals.users);
  return (
    <div className="space-y-6">
      <p className="text-xs text-white/35">{SNAPSHOT_NOTE}</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Mapa / Top UFs" note={SNAPSHOT_NOTE}>
          <GeoMapBr items={m.byEstado} total={m.totals.users} />
        </ChartCard>
        <ChartCard title="Distribuição por UF">
          <DonutChart items={m.byEstado} />
        </ChartCard>
      </div>
      <ChartCard title="Top 10 cidades">
        <BarChartSimple title="" items={m.byCidade} maxItems={10} />
      </ChartCard>
      <ChartCard title="Tabela por UF">
        <DataTable
          columns={[
            { key: 'label', header: 'UF' },
            { key: 'count', header: 'Usuários' },
            { key: 'pct', header: '%', render: (r) => `${r.pct}%` },
          ]}
          rows={rows}
        />
      </ChartCard>
    </div>
  );
}

function PessoasView({ m }: { m: AdminMetrics }) {
  const anatomiaItems = m.byAnatomia.filter((a) => a.label === 'Masculino' || a.label === 'Feminino');
  const totalAnatomia = anatomiaItems.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/35">{SNAPSHOT_NOTE}</p>
      <div className="grid md:grid-cols-2 gap-3">
        <KpiCard label="Masculino" value={anatomiaItems.find((a) => a.label === 'Masculino')?.count ?? 0} accent="#38bdf8" />
        <KpiCard label="Feminino" value={anatomiaItems.find((a) => a.label === 'Feminino')?.count ?? 0} accent="#f472b6" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Anatomia (catálogo loja)" note="Apenas Masculino e Feminino — valores duplicados foram unificados.">
          <DonutChart items={anatomiaItems} centerLabel={totalAnatomia ? String(totalAnatomia) : undefined} />
        </ChartCard>
        <ChartCard title="Orientação sexual">
          <DonutChart items={m.byOrientacao} />
        </ChartCard>
      </div>
      <ChartCard title="Orientação sexual — ranking">
        <BarChartSimple title="" items={m.byOrientacao} />
      </ChartCard>
    </div>
  );
}

function PareamentoView({ m }: { m: AdminMetrics }) {
  const solteiros = m.totals.users - m.totals.withPairing;
  const conv = pct(m.totals.withPairing, m.totals.users);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pareamentos" value={m.totals.pareamentos} accent="#a78bfa" />
        <KpiCard label="Pareados" value={m.totals.withPairing} accent="#f472b6" />
        <KpiCard label="Solteiros" value={solteiros} accent="#38bdf8" />
        <KpiCard label="Conversão" value={`${conv}%`} accent="#34d399" />
      </div>
      <ChartCard title="Funil">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="rounded-lg bg-[#1a1225] border border-white/10 px-4 py-3 flex-1 min-w-[120px] text-center">
            <p className="text-xl font-bold text-white tabular-nums">{m.totals.users}</p>
            <p className="text-xs text-white/50">Cadastrados</p>
          </div>
          <span className="text-white/30">→</span>
          <div className="rounded-lg bg-[#1a1225] border border-white/10 px-4 py-3 flex-1 min-w-[120px] text-center">
            <p className="text-xl font-bold text-[#f472b6] tabular-nums">{m.totals.withPairing}</p>
            <p className="text-xs text-white/50">Pareados ({conv}%)</p>
          </div>
          <span className="text-white/30">→</span>
          <div className="rounded-lg bg-[#1a1225] border border-white/10 px-4 py-3 flex-1 min-w-[120px] text-center">
            <p className="text-xl font-bold text-[#38bdf8] tabular-nums">{m.totals.activeInPeriod}</p>
            <p className="text-xs text-white/50">Ativos 7d</p>
          </div>
        </div>
      </ChartCard>
      {m.pareamentosByDay.length > 0 && (
        <ChartCard title={`Novos pareamentos (${m.periodDays}d)`}>
          <LineAreaChart data={m.pareamentosByDay} color="#a78bfa" />
        </ChartCard>
      )}
    </div>
  );
}

function DemograficaView({ m }: { m: AdminMetrics }) {
  const tempoTotal = m.byTempoRelacionamento.reduce((s, i) => s + i.count, 0);

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/35">{SNAPSHOT_NOTE}</p>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Estado civil">
          <DonutChart items={m.byEstadoCivil} />
        </ChartCard>
        <ChartCard title="Faixa etária">
          <BarChartSimple title="" items={m.byFaixaEtaria} />
        </ChartCard>
      </div>
      <ChartCard
        title="Tempo de relacionamento"
        note="Apenas usuários namorando ou casados — informado no cadastro."
      >
        {tempoTotal > 0 ? (
          <div className="grid lg:grid-cols-2 gap-4 items-center">
            <DonutChart items={m.byTempoRelacionamento} centerLabel={String(tempoTotal)} />
            <BarChartSimple title="" items={m.byTempoRelacionamento} />
          </div>
        ) : (
          <p className="text-xs text-white/40 py-6 text-center">Sem dados ainda (namorando/casado).</p>
        )}
      </ChartCard>
    </div>
  );
}

function EngajamentoView({ m }: { m: AdminMetrics }) {
  const pushOff = m.totals.users - m.totals.notificationsEnabled;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label="Ativos (7d)" value={m.totals.activeInPeriod} hint="Janela fixa de 7 dias" accent="#38bdf8" />
        <KpiCard label="Push ativo" value={m.totals.notificationsEnabled} accent="#fbbf24" />
        <KpiCard label="Push inativo" value={pushOff} accent="#a78bfa" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Push notifications">
          <DonutChart
            items={[
              { label: 'Ativo', count: m.totals.notificationsEnabled },
              { label: 'Inativo', count: pushOff },
            ]}
          />
        </ChartCard>
        {m.activeByDay.length > 0 && (
          <ChartCard title={`Check-ins no período (${m.periodDays}d)`} note="Baseado em lastCheckInDate">
            <LineAreaChart data={m.activeByDay} color="#38bdf8" />
          </ChartCard>
        )}
      </div>
    </div>
  );
}

function LojaView({ m }: { m: AdminMetrics }) {
  const { loja } = m;
  const realizadosTotal = loja.realizadosComFotoInPeriod + loja.realizadosSemFotoInPeriod;
  const periodNote = `Métricas temporais filtradas pelos últimos ${m.periodDays} dias. Pendentes = snapshot atual.`;

  return (
    <div className="space-y-6">
      <p className="text-xs text-white/35">{periodNote}</p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        <KpiCard label={`Resgatados (${m.periodDays}d)`} value={loja.resgatadosInPeriod} accent="#ff5565" />
        <KpiCard label="Pendentes (agora)" value={loja.pendentesTotal} accent="#fbbf24" hint="Status Pendente" />
        <KpiCard label="Finalizados c/ foto" value={loja.realizadosComFotoInPeriod} accent="#34d399" />
        <KpiCard label="Finalizados s/ foto" value={loja.realizadosSemFotoInPeriod} accent="#38bdf8" />
        <KpiCard label="Memórias criadas" value={loja.memoriasCriadasInPeriod} accent="#f472b6" hint="Fotos enviadas" />
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title={`Resgates por dia (${m.periodDays}d)`}>
          <LineAreaChart data={loja.resgatadosByDay} color="#ff5565" />
        </ChartCard>
        <ChartCard title={`Realizações por dia (${m.periodDays}d)`}>
          <LineAreaChart data={loja.realizadosByDay} color="#34d399" />
        </ChartCard>
      </div>
      {realizadosTotal > 0 && (
        <ChartCard title={`Finalizados no período (${realizadosTotal})`}>
          <DonutChart
            items={[
              { label: 'Com foto', count: loja.realizadosComFotoInPeriod },
              { label: 'Sem foto', count: loja.realizadosSemFotoInPeriod },
            ]}
          />
        </ChartCard>
      )}
      {loja.memoriasByDay.length > 0 && (
        <ChartCard title={`Memórias criadas por dia (${m.periodDays}d)`}>
          <LineAreaChart data={loja.memoriasByDay} color="#f472b6" />
        </ChartCard>
      )}
      <ChartCard title="Indicadores ainda não rastreados no backend">
        <ul className="text-xs text-white/50 space-y-2 list-disc pl-4">
          <li>
            <strong className="text-white/70">Carrinhos abandonados</strong> — o carrinho vive apenas no navegador
            (Zustand); não há evento persistido no Firestore.
          </li>
          <li>
            <strong className="text-white/70">Compartilhamento de memórias</strong> — usa <code className="text-white/60">navigator.share</code> no
            cliente; sem contador no backend.
          </li>
          <li>
            <strong className="text-white/70">Curtidas de memórias</strong> — feature ainda não implementada no
            Firestore.
          </li>
        </ul>
      </ChartCard>
    </div>
  );
}

function CadastrosView({ m }: { m: AdminMetrics }) {
  const media = m.periodDays ? Math.round((m.totals.signupsInPeriod / m.periodDays) * 10) / 10 : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard label={`Cadastros (${m.periodDays}d)`} value={m.totals.signupsInPeriod} accent="#34d399" delta={m.totals.signupsGrowthPct} />
        <KpiCard label="Média/dia" value={media} accent="#38bdf8" />
        <KpiCard label="Período ant." value={m.totals.signupsPrevPeriod} accent="#a78bfa" />
      </div>
      <ChartCard title={`Cadastros por dia (${m.periodDays}d)`}>
        <LineAreaChart data={m.signupsByDay} color="#34d399" />
      </ChartCard>
      {m.periodDays >= 90 && m.signupsByDay.length > 0 && (
        <ChartCard title="Cadastros por mês">
          <BarChartSimple title="" items={rollupMonthly(m.signupsByDay)} />
        </ChartCard>
      )}
      {m.recentSignups.length > 0 && (
        <ChartCard title="Últimos cadastros" note="Emails completos — uso interno restrito (allowlist admin).">
          <DataTable
            columns={[
              { key: 'email', header: 'Email' },
              { key: 'nome', header: 'Nome' },
              {
                key: 'telefone',
                header: 'Telefone',
                render: (r) => formatTelefoneBr(String(r.telefone)),
              },
              { key: 'estado', header: 'UF' },
              {
                key: 'vip',
                header: 'VIP',
                render: (r) => (r.vip ? 'Sim' : '—'),
              },
              {
                key: 'createdAt',
                header: 'Data',
                render: (r) => new Date(String(r.createdAt)).toLocaleString('pt-BR'),
              },
            ]}
            rows={m.recentSignups}
          />
        </ChartCard>
      )}
    </div>
  );
}

function ExportacaoView({ m, onExport }: { m: AdminMetrics; onExport: () => void }) {
  return (
    <div className="space-y-6 max-w-xl">
      <ChartCard title="Exportação de dados">
        <p className="text-sm text-white/60 mb-4">
          Exporte a base completa de usuários em CSV para análise externa. Uso interno restrito à allowlist
          admin — respeite a LGPD.
        </p>
        <dl className="text-xs space-y-2 text-white/50 mb-6">
          <div className="flex justify-between">
            <dt>Período selecionado</dt>
            <dd className="text-white/80">{m.periodDays} dias</dd>
          </div>
          <div className="flex justify-between">
            <dt>Gerado em</dt>
            <dd className="text-white/80">{new Date(m.generatedAt).toLocaleString('pt-BR')}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Total usuários</dt>
            <dd className="text-white/80 tabular-nums">{m.totals.users}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={onExport}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ background: 'linear-gradient(135deg, #ff3547 0%, #ff6b7c 100%)' }}
        >
          Exportar CSV
        </button>
      </ChartCard>
    </div>
  );
}

type Props = {
  section: AdminSectionId;
  metrics: AdminMetrics | null;
  onExport: () => void;
};

export default function AdminSectionViews({ section, metrics, onExport }: Props) {
  if (section === 'vips') {
    return <VipsView />;
  }
  if (!metrics) return null;

  switch (section) {
    case 'geral':
      return <GeralView m={metrics} />;
    case 'geolocalizada':
      return <GeolocalizadaView m={metrics} />;
    case 'pessoas':
      return <PessoasView m={metrics} />;
    case 'pareamento':
      return <PareamentoView m={metrics} />;
    case 'demografica':
      return <DemograficaView m={metrics} />;
    case 'engajamento':
      return <EngajamentoView m={metrics} />;
    case 'loja':
      return <LojaView m={metrics} />;
    case 'cadastros':
      return <CadastrosView m={metrics} />;
    case 'exportacao':
      return <ExportacaoView m={metrics} onExport={onExport} />;
    default:
      return <GeralView m={metrics} />;
  }
}
