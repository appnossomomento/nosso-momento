'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveySegment,
} from '@/lib/types/survey';
import { DEFAULT_SURVEY_PUSH, SURVEY_SEGMENT_LABELS } from '@/lib/types/survey';
import { ADMIN_OPTION_STYLE, ADMIN_SELECT_CLASS } from '@/admin-panel/constants';
import KpiCard from '@/admin-panel/components/KpiCard';
import ChartCard from '@/admin-panel/components/ChartCard';
import BarChartSimple from '@/admin-panel/components/BarChartSimple';
import DonutChart from '@/admin-panel/components/DonutChart';
import clsx from 'clsx';

type TabId = 'enviar' | 'resultados';

type ResultsPayload = {
  surveyId: string;
  title: string;
  status: string;
  targetedCount: number | null;
  notifiedCount: number | null;
  totals: { responses: number; answered: number; skipped: number };
  aggregates: Record<
    string,
    {
      type: string;
      label: string;
      choiceCounts?: Record<string, number>;
      foguinhosSum?: number;
      foguinhosCount?: number;
      foguinhosAvg?: number;
      foguinhosDist?: Record<string, number>;
      textSamples?: string[];
    }
  >;
};

function newQuestion(type: SurveyQuestionType): SurveyQuestion {
  const id = `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  if (type === 'choice') {
    return { id, type, label: '', options: ['Opção 1', 'Opção 2'] };
  }
  return { id, type, label: '' };
}

function statusStyle(status: string) {
  if (status === 'active') return { background: 'rgba(52,211,153,0.15)', color: '#34d399' };
  if (status === 'draft') return { background: 'rgba(251,191,36,0.15)', color: '#fbbf24' };
  return { background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' };
}

export default function SurveysView() {
  const [tab, setTab] = useState<TabId>('enviar');
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [segment, setSegment] = useState<SurveySegment>('todos');
  const [pushTitle, setPushTitle] = useState(DEFAULT_SURVEY_PUSH.title);
  const [pushBody, setPushBody] = useState(DEFAULT_SURVEY_PUSH.body);
  const [questions, setQuestions] = useState<SurveyQuestion[]>([newQuestion('foguinhos')]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [audienceBySegment, setAudienceBySegment] = useState<
    Partial<Record<SurveySegment, { alvo: number; push: number }>>
  >({});

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await fetch('/api/admin/surveys', { cache: 'no-store' });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      if (!res.ok) throw new Error('fetch_failed');
      const data = (await res.json()) as {
        surveys: Survey[];
        audienceBySegment?: Partial<Record<SurveySegment, { alvo: number; push: number }>>;
      };
      setSurveys(data.surveys || []);
      setAudienceBySegment(data.audienceBySegment || {});
    } catch {
      setErro('Falha ao carregar pesquisas.');
    } finally {
      setLoading(false);
    }
  }, []);

  function audienceLabel(s: Survey) {
    if (s.status !== 'draft') {
      const parts: string[] = [];
      if (typeof s.targetedCount === 'number') parts.push(`alvo ${s.targetedCount}`);
      if (typeof s.notifiedCount === 'number') parts.push(`push ${s.notifiedCount}`);
      return parts.length ? ` · ${parts.join(' · ')}` : '';
    }
    const est = audienceBySegment[s.segment];
    if (!est) return ' · estimando audiência...';
    return ` · alvo ~${est.alvo} · push ~${est.push}`;
  }
  useEffect(() => {
    void load();
  }, [load]);

  const resultsSurveys = useMemo(
    () => surveys.filter((s) => s.status === 'active' || s.status === 'closed'),
    [surveys],
  );

  async function handleCreate() {
    setCreating(true);
    setErro('');
    try {
      if (editingId) {
        const res = await fetch(`/api/admin/surveys/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'update',
            title,
            segment,
            questions,
            pushTitle,
            pushBody,
          }),
        });
        if (res.status === 401) {
          window.location.href = '/paineladmin-monitoring-v0/login';
          return;
        }
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
          throw new Error(err.message || err.error || 'update_failed');
        }
        clearForm();
        await load();
        return;
      }

      const res = await fetch('/api/admin/surveys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, segment, questions, pushTitle, pushBody }),
      });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'create_failed');
      }
      clearForm();
      await load();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar pesquisa.');
    } finally {
      setCreating(false);
    }
  }

  function clearForm() {
    setEditingId(null);
    setTitle('');
    setQuestions([newQuestion('foguinhos')]);
    setPushTitle(DEFAULT_SURVEY_PUSH.title);
    setPushBody(DEFAULT_SURVEY_PUSH.body);
    setSegment('todos');
  }

  function startEdit(s: Survey) {
    if (s.status !== 'draft') return;
    setEditingId(s.id);
    setTitle(s.title);
    setSegment(s.segment);
    setPushTitle(s.pushTitle || DEFAULT_SURVEY_PUSH.title);
    setPushBody(s.pushBody || DEFAULT_SURVEY_PUSH.body);
    setQuestions(
      s.questions?.length
        ? s.questions.map((q) => ({
            ...q,
            options: q.options ? [...q.options] : undefined,
          }))
        : [newQuestion('foguinhos')],
    );
    setTab('enviar');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function handleDispatch(id: string) {
    const ok = window.confirm(
      'Disparar esta pesquisa agora?\n\nEncerra qualquer pesquisa ativa, envia push no SO e mostra o popup só quando o usuário abrir uma nova sessão.',
    );
    if (!ok) return;
    setBusyId(id);
    setErro('');
    try {
      const res = await fetch(`/api/admin/surveys/${id}/dispatch`, { method: 'POST' });
      if (res.status === 401) {
        window.location.href = '/paineladmin-monitoring-v0/login';
        return;
      }
      const data = (await res.json()) as {
        error?: string;
        targetedCount?: number;
        notifiedCount?: number;
      };
      if (!res.ok) throw new Error(data.error || 'dispatch_failed');
      window.alert(
        `Disparada!\nAlvo: ${data.targetedCount ?? 0} usuários\nPush: ${data.notifiedCount ?? 0} notificações`,
      );
      await load();
      setTab('resultados');
      void openResults(id);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao disparar.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleClose(id: string) {
    if (!window.confirm('Encerrar esta pesquisa ativa?')) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/surveys/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      if (!res.ok) throw new Error('close_failed');
      await load();
      if (selectedId === id) void openResults(id);
    } catch {
      setErro('Falha ao encerrar pesquisa.');
    } finally {
      setBusyId(null);
    }
  }

  async function openResults(id: string) {
    setSelectedId(id);
    setResults(null);
    setResultsLoading(true);
    setErro('');
    try {
      const res = await fetch(`/api/admin/surveys/${id}/responses`, { cache: 'no-store' });
      if (!res.ok) throw new Error('results_failed');
      setResults((await res.json()) as ResultsPayload);
    } catch {
      setErro('Falha ao carregar resultados.');
      setSelectedId(null);
    } finally {
      setResultsLoading(false);
    }
  }

  const activeCount = surveys.filter((s) => s.status === 'active').length;
  const draftCount = surveys.filter((s) => s.status === 'draft').length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Pesquisas" value={surveys.length} />
        <KpiCard label="Ativas" value={activeCount} accent="#34d399" />
        <KpiCard label="Rascunhos" value={draftCount} accent="#fbbf24" />
        <KpiCard label="MVP" value="1 ativa" hint="por vez" accent="#a78bfa" />
      </div>

      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {(
          [
            ['enviar', 'Enviar'],
            ['resultados', 'Resultados'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => {
              setTab(id);
              if (id === 'enviar') {
                setSelectedId(null);
                setResults(null);
              }
            }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-semibold transition',
              tab === id
                ? 'bg-[#ff2d3f] text-white'
                : 'text-white/55 hover:text-white/85 hover:bg-white/5',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {erro && <p className="text-red-400 text-sm">{erro}</p>}

      {tab === 'enviar' && (
        <>
          <ChartCard
            title={editingId ? 'Editar pesquisa (rascunho)' : 'Nova pesquisa'}
            note={
              editingId
                ? 'Altere e salve. Só rascunhos na fila podem ser editados.'
                : 'Múltipla escolha, texto ou foguinhos 0–5. Um clique dispara popup + push.'
            }
          >
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-white/50">Título</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={120}
                    placeholder="Ex.: Como está sendo usar o app?"
                    className={`w-full ${ADMIN_SELECT_CLASS}`}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-white/50">Segmento</span>
                  <select
                    value={segment}
                    onChange={(e) => setSegment(e.target.value as SurveySegment)}
                    className={`w-full ${ADMIN_SELECT_CLASS}`}
                  >
                    {(Object.keys(SURVEY_SEGMENT_LABELS) as SurveySegment[]).map((k) => {
                      const est = audienceBySegment[k];
                      const suffix = est ? ` (~${est.alvo} · push ~${est.push})` : '';
                      return (
                        <option key={k} value={k} style={ADMIN_OPTION_STYLE}>
                          {SURVEY_SEGMENT_LABELS[k]}
                          {suffix}
                        </option>
                      );
                    })}
                  </select>
                  {audienceBySegment[segment] && (
                    <span className="text-[11px] text-amber-200/80">
                      Antes do disparo: ~{audienceBySegment[segment]!.alvo} pessoas no segmento
                      {' · '}
                      ~{audienceBySegment[segment]!.push} com push ativo
                    </span>
                  )}
                </label>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs text-white/50">Push — título</span>
                  <input
                    value={pushTitle}
                    onChange={(e) => setPushTitle(e.target.value)}
                    maxLength={80}
                    className={`w-full ${ADMIN_SELECT_CLASS}`}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs text-white/50">Push — mensagem</span>
                  <input
                    value={pushBody}
                    onChange={(e) => setPushBody(e.target.value)}
                    maxLength={160}
                    className={`w-full ${ADMIN_SELECT_CLASS}`}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/80">Perguntas</p>
                  <div className="flex gap-2">
                    {(
                      [
                        ['foguinhos', 'Foguinhos'],
                        ['choice', 'Escolha'],
                        ['text', 'Texto'],
                      ] as const
                    ).map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        disabled={questions.length >= 8}
                        onClick={() => setQuestions((prev) => [...prev, newQuestion(t)])}
                        className="text-xs px-2.5 py-1 rounded-lg border border-white/15 hover:bg-white/5 disabled:opacity-40"
                      >
                        + {label}
                      </button>
                    ))}
                  </div>
                </div>

                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wide text-white/40">
                        {q.type === 'foguinhos'
                          ? '🔥 0–5'
                          : q.type === 'choice'
                            ? 'Escolha'
                            : 'Texto'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setQuestions((prev) => prev.filter((x) => x.id !== q.id))
                        }
                        disabled={questions.length <= 1}
                        className="ml-auto text-xs text-red-300/80 hover:text-red-300 disabled:opacity-30"
                      >
                        Remover
                      </button>
                    </div>
                    <input
                      value={q.label}
                      onChange={(e) =>
                        setQuestions((prev) =>
                          prev.map((x, i) =>
                            i === idx ? { ...x, label: e.target.value } : x,
                          ),
                        )
                      }
                      placeholder={`Pergunta ${idx + 1}`}
                      className={`w-full ${ADMIN_SELECT_CLASS}`}
                    />
                    {q.type === 'choice' && (
                      <div className="space-y-1.5">
                        {(q.options || []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <input
                              value={opt}
                              onChange={(e) =>
                                setQuestions((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== idx) return x;
                                    const options = [...(x.options || [])];
                                    options[oi] = e.target.value;
                                    return { ...x, options };
                                  }),
                                )
                              }
                              className={`flex-1 ${ADMIN_SELECT_CLASS}`}
                            />
                            <button
                              type="button"
                              disabled={(q.options || []).length <= 2}
                              onClick={() =>
                                setQuestions((prev) =>
                                  prev.map((x, i) => {
                                    if (i !== idx) return x;
                                    return {
                                      ...x,
                                      options: (x.options || []).filter((_, j) => j !== oi),
                                    };
                                  }),
                                )
                              }
                              className="text-xs text-white/40 px-2 disabled:opacity-30"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={(q.options || []).length >= 8}
                          onClick={() =>
                            setQuestions((prev) =>
                              prev.map((x, i) =>
                                i === idx
                                  ? {
                                      ...x,
                                      options: [
                                        ...(x.options || []),
                                        `Opção ${(x.options || []).length + 1}`,
                                      ],
                                    }
                                  : x,
                              ),
                            )
                          }
                          className="text-xs text-pink-300 hover:text-pink-200 disabled:opacity-40"
                        >
                          + opção
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={creating || !title.trim() || questions.some((q) => !q.label.trim())}
                  onClick={() => void handleCreate()}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
                  style={{ background: 'linear-gradient(135deg,#ff2d3f,#ff5565)' }}
                >
                  {creating
                    ? 'Salvando...'
                    : editingId
                      ? 'Salvar alterações'
                      : 'Salvar rascunho'}
                </button>
                {editingId && (
                  <button
                    type="button"
                    disabled={creating}
                    onClick={clearForm}
                    className="px-4 py-2.5 rounded-xl text-sm font-semibold border border-white/20 text-white/70 hover:bg-white/5 disabled:opacity-40"
                  >
                    Cancelar edição
                  </button>
                )}
              </div>
            </div>
          </ChartCard>

          <ChartCard title="Fila de envio">
            {loading ? (
              <p className="text-white/40 text-sm animate-pulse">Carregando...</p>
            ) : surveys.length === 0 ? (
              <p className="text-white/40 text-sm">Nenhuma pesquisa ainda.</p>
            ) : (
              <div className="space-y-2">
                {surveys.map((s) => (
                  <div
                    key={s.id}
                    className={clsx(
                      'rounded-xl border p-3 flex flex-col md:flex-row md:items-center gap-3',
                      editingId === s.id
                        ? 'border-amber-400/40 bg-amber-400/5'
                        : 'border-white/10 bg-white/[0.03]',
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold truncate">{s.title}</p>
                        {s.status !== 'draft' && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={statusStyle(s.status)}
                          >
                            {s.status}
                          </span>
                        )}
                        <span className="text-[10px] text-white/40">
                          {SURVEY_SEGMENT_LABELS[s.segment]}
                        </span>
                      </div>
                      <p className="text-xs text-white/40 mt-1">
                        {s.questions.length} pergunta(s)
                        {audienceLabel(s)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {s.status === 'draft' && (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(s)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5"
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            disabled={busyId === s.id}
                            onClick={() => void handleDispatch(s.id)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
                            style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }}
                          >
                            {busyId === s.id ? '...' : 'Disparar'}
                          </button>
                        </>
                      )}
                      {s.status === 'active' && (
                        <button
                          type="button"
                          disabled={busyId === s.id}
                          onClick={() => void handleClose(s.id)}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5 disabled:opacity-40"
                        >
                          Encerrar
                        </button>
                      )}
                      {(s.status === 'active' || s.status === 'closed') && (
                        <button
                          type="button"
                          onClick={() => {
                            setTab('resultados');
                            void openResults(s.id);
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/15 hover:bg-white/5"
                        >
                          Ver resultados
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </>
      )}

      {tab === 'resultados' && (
        <div className="grid lg:grid-cols-[280px_1fr] gap-4">
          <ChartCard title="Pesquisas" note="Clique para ver os gráficos">
            {loading ? (
              <p className="text-white/40 text-sm animate-pulse">Carregando...</p>
            ) : resultsSurveys.length === 0 ? (
              <p className="text-white/40 text-sm">
                Nenhuma pesquisa disparada ainda. Crie e dispare na aba Enviar.
              </p>
            ) : (
              <div className="space-y-2">
                {resultsSurveys.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void openResults(s.id)}
                    className={clsx(
                      'w-full text-left rounded-xl border p-3 transition',
                      selectedId === s.id
                        ? 'border-[#ff5565]/50 bg-[#ff2d3f]/10'
                        : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate">{s.title}</p>
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={statusStyle(s.status)}
                      >
                        {s.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-white/40 mt-1">
                      {SURVEY_SEGMENT_LABELS[s.segment]}
                      {s.status !== 'draft' && typeof s.notifiedCount === 'number'
                        ? ` · push ${s.notifiedCount}`
                        : audienceBySegment[s.segment]
                          ? ` · push ~${audienceBySegment[s.segment]!.push}`
                          : ''}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </ChartCard>

          <ChartCard
            title={results ? results.title : 'Detalhe da pesquisa'}
            note={
              resultsLoading
                ? 'Carregando respostas...'
                : selectedId
                  ? 'Agregado das respostas'
                  : 'Selecione uma pesquisa à esquerda'
            }
          >
            {!selectedId && !resultsLoading && (
              <p className="text-white/40 text-sm py-8 text-center">
                Escolha uma pesquisa para ver KPIs e gráficos.
              </p>
            )}
            {resultsLoading && (
              <p className="text-white/40 text-sm animate-pulse py-8 text-center">Carregando...</p>
            )}
            {results && !resultsLoading && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <KpiCard label="Respostas" value={results.totals.responses} />
                  <KpiCard label="Respondidas" value={results.totals.answered} accent="#34d399" />
                  <KpiCard label="Puladas" value={results.totals.skipped} accent="#fbbf24" />
                  <KpiCard
                    label="Push"
                    value={results.notifiedCount ?? '—'}
                    hint={
                      results.targetedCount != null ? `alvo ${results.targetedCount}` : undefined
                    }
                    accent="#a78bfa"
                  />
                </div>

                {results.totals.responses > 0 && (
                  <div className="rounded-xl border border-white/10 p-3">
                    <p className="text-xs text-white/50 mb-2">Respondidas vs puladas</p>
                    <DonutChart
                      items={[
                        { label: 'Respondidas', count: results.totals.answered },
                        { label: 'Puladas', count: results.totals.skipped },
                      ]}
                      centerLabel="total"
                    />
                  </div>
                )}

                {Object.entries(results.aggregates).map(([qid, agg]) => (
                  <div key={qid} className="rounded-xl border border-white/10 p-4 space-y-3">
                    <p className="text-sm font-semibold">{agg.label}</p>

                    {agg.type === 'foguinhos' && (
                      <>
                        <p className="text-sm text-amber-300">
                          Média: {agg.foguinhosAvg ?? '—'} 🔥
                          <span className="text-white/40 text-xs ml-2">
                            ({agg.foguinhosCount || 0} respostas)
                          </span>
                        </p>
                        <BarChartSimple
                          title=""
                          items={[0, 1, 2, 3, 4, 5].map((n) => ({
                            label: `${n} 🔥`,
                            count: agg.foguinhosDist?.[String(n)] || 0,
                          }))}
                        />
                      </>
                    )}

                    {agg.type === 'choice' && agg.choiceCounts && (
                      <div className="grid md:grid-cols-2 gap-4">
                        <BarChartSimple
                          title=""
                          items={Object.entries(agg.choiceCounts).map(([label, count]) => ({
                            label,
                            count,
                          }))}
                        />
                        <DonutChart
                          items={Object.entries(agg.choiceCounts).map(([label, count]) => ({
                            label,
                            count,
                          }))}
                        />
                      </div>
                    )}

                    {agg.type === 'text' && (
                      <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                        {(agg.textSamples || []).length === 0 ? (
                          <li className="text-xs text-white/40">Sem textos ainda.</li>
                        ) : (
                          (agg.textSamples || []).map((t, i) => (
                            <li
                              key={i}
                              className="text-sm text-white/70 border-l-2 border-pink-500/40 pl-2"
                            >
                              {t}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  );
}
