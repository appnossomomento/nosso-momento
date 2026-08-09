'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import OverlayModal from '@/components/ui/OverlayModal';
import { openSystemConfirm } from '@/components/ui/Modal';
import clsx from 'clsx';
import AppHeroShell, {
  ACCENT,
  ACCENT_SOFT,
  LP_RED,
  TILE,
} from '@/components/layout/AppHeroShell';
import {
  prazoDiasToMillis,
} from '@/lib/momentos/prazoStatus';
import {
  isStorageMediaPath,
  resolveMediaUrlMap,
} from '@/lib/utils/resolveMediaUrls';

const CTA_GRAD = `linear-gradient(135deg, ${LP_RED}, ${ACCENT})`;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

const MESES_CURTO = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
] as const;

const DOW = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;

const EVENTO_ICONES = [
  'fa-calendar-day',
  'fa-utensils',
  'fa-heart',
  'fa-plane',
  'fa-film',
  'fa-gift',
  'fa-house',
  'fa-music',
] as const;
type EventoIcone = (typeof EVENTO_ICONES)[number];
const EVENTO_ICONE_DEFAULT: EventoIcone = 'fa-calendar-day';

function isEventoIcone(v: string): v is EventoIcone {
  return (EVENTO_ICONES as readonly string[]).includes(v);
}

type TarefaCal = {
  id: string;
  momentoNome: string;
  momentoEmoji?: string;
  momentoImg?: string;
  status: string;
  dataLimite?: { seconds: number } | null;
  dataResgate?: { seconds: number } | null;
};

type EventoLivre = {
  id: string;
  titulo: string;
  dataInicio: string;
  horaInicio?: string | null;
  diaInteiro?: boolean;
  icone?: string | null;
  notas?: string | null;
  criadoPorUid?: string;
};

type MonthItem =
  | { kind: 'momento'; sortKey: string; data: TarefaCal }
  | { kind: 'livre'; sortKey: string; data: EventoLivre };

function toSpDateKey(ms: number): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(year, month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

function formatDiaMesPt(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const month = MESES_CURTO[m - 1];
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${d} ${monthCap}`;
}

function formatLimiteCurto(ms: number): string {
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
  }).formatToParts(new Date(ms));
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const monthRaw = parts.find((p) => p.type === 'month')?.value ?? '';
  const month = monthRaw.replace('.', '');
  const monthCap = month ? month.charAt(0).toUpperCase() + month.slice(1) : '';
  return `${day} ${monthCap}`.trim();
}

function formatLimiteCurtoFromKey(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const month = MESES_CURTO[m - 1];
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  return `${d} ${monthCap}`;
}

function isPendingStatus(status: string): boolean {
  const st = String(status || '').toLowerCase();
  return st === 'pendente';
}

function tarefaDateKey(t: TarefaCal): string | null {
  const lim = prazoDiasToMillis(t.dataLimite);
  if (lim != null) return toSpDateKey(lim);
  const resgate = prazoDiasToMillis(t.dataResgate);
  if (resgate != null) return toSpDateKey(resgate);
  return null;
}

function isValidHora(hora: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const [hh, mm] = hora.split(':').map(Number);
  return hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59;
}

export default function CalendarioPage() {
  const { usuario, idPareamentoAmigavel, pareado } = useAppStore();
  const agora = new Date();
  const [selectedMonth, setSelectedMonth] = useState(agora.getMonth());
  const [selectedYear, setSelectedYear] = useState(agora.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  /** Dia usado na lista — atrasado p/ crossfade. */
  const [listDay, setListDay] = useState<string | null>(null);
  const [listPhase, setListPhase] = useState<'in' | 'out'>('in');
  const [tarefas, setTarefas] = useState<TarefaCal[]>([]);
  const [eventos, setEventos] = useState<EventoLivre[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EventoLivre | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formData, setFormData] = useState(toSpDateKey(Date.now()));
  const [formHora, setFormHora] = useState('');
  const [formIcone, setFormIcone] = useState<EventoIcone>(EVENTO_ICONE_DEFAULT);
  const [formNotas, setFormNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  const uid = usuario?.uid ?? null;
  const hojeStr = toSpDateKey(Date.now());

  useEffect(() => {
    setListPhase('out');
    const t = window.setTimeout(() => {
      setListDay(selectedDay);
      setListPhase('in');
    }, 160);
    return () => window.clearTimeout(t);
  }, [selectedDay, selectedMonth, selectedYear]);

  const reload = useCallback(async () => {
    if (!uid || !idPareamentoAmigavel) return;
    setCarregando(true);
    let hadError = false;
    try {
      // Rules de tarefasMomentos exigem filtro por uid (executado/resgatado).
      const baseTarefas = collection(db, 'tarefasMomentos');
      const [snapExec, snapResg] = await Promise.all([
        getDocs(
          query(
            baseTarefas,
            where('executadoPorUid', '==', uid),
            where('idPareamento', '==', idPareamentoAmigavel),
            orderBy('dataResgate', 'desc'),
            limit(40),
          ),
        ),
        getDocs(
          query(
            baseTarefas,
            where('resgatadoPorUid', '==', uid),
            where('idPareamento', '==', idPareamentoAmigavel),
            orderBy('dataResgate', 'desc'),
            limit(40),
          ),
        ),
      ]);

      const byId = new Map<string, TarefaCal>();
      for (const d of [...snapExec.docs, ...snapResg.docs]) {
        if (byId.has(d.id)) continue;
        byId.set(d.id, { id: d.id, ...d.data() } as TarefaCal);
      }
      const rows = [...byId.values()].filter((t) => isPendingStatus(t.status));

      const paths = rows
        .map((m) => m.momentoImg)
        .filter((v): v is string => Boolean(v && isStorageMediaPath(v)));
      if (paths.length) {
        const urls = await resolveMediaUrlMap(paths);
        for (const m of rows) {
          if (m.momentoImg && urls[m.momentoImg]) {
            m.momentoImg = urls[m.momentoImg]!;
          }
        }
      }
      setTarefas(rows);
    } catch (err) {
      hadError = true;
      console.error('calendario reload momentos', err);
    }

    let eventosError = false;
    try {
      const snapEventos = await getDocs(
        query(
          collection(db, 'eventosCasal'),
          where('memberUids', 'array-contains', uid),
          limit(100),
        ),
      );
      setEventos(
        snapEventos.docs
          .filter((d) => d.data().idPareamento === idPareamentoAmigavel)
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              titulo: String(data.titulo || ''),
              dataInicio: String(data.dataInicio || ''),
              horaInicio:
                typeof data.horaInicio === 'string' ? data.horaInicio : null,
              diaInteiro: data.diaInteiro !== false && !data.horaInicio,
              icone: typeof data.icone === 'string' ? data.icone : null,
              notas: data.notas ?? null,
              criadoPorUid: data.criadoPorUid,
            };
          }),
      );
    } catch (err) {
      eventosError = true;
      console.error('calendario reload eventos', err);
    }

    if (hadError || eventosError) {
      showToast('Erro ao carregar calendário.', 'erro');
    }
    setCarregando(false);
  }, [uid, idPareamentoAmigavel]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const momentosByDay = useMemo(() => {
    const map: Record<string, TarefaCal[]> = {};
    for (const t of tarefas) {
      const key = tarefaDateKey(t);
      if (!key) continue;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    }
    return map;
  }, [tarefas]);

  const livresByDay = useMemo(() => {
    const map: Record<string, EventoLivre[]> = {};
    for (const e of eventos) {
      if (!e.dataInicio) continue;
      if (!map[e.dataInicio]) map[e.dataInicio] = [];
      map[e.dataInicio].push(e);
    }
    return map;
  }, [eventos]);

  const calendarCells = useMemo(() => {
    const first = new Date(selectedYear, selectedMonth, 1);
    const firstDow = first.getDay();
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const daysPrev = new Date(selectedYear, selectedMonth, 0).getDate();

    type Cell = { dateStr: string; day: number; inMonth: boolean };
    const cells: Cell[] = [];

    for (let i = firstDow - 1; i >= 0; i--) {
      const day = daysPrev - i;
      const prev = shiftMonth(selectedYear, selectedMonth, -1);
      cells.push({
        day,
        inMonth: false,
        dateStr: `${prev.year}-${String(prev.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({
        day: d,
        inMonth: true,
        dateStr: `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
      });
    }

    let nextDay = 1;
    while (cells.length < 42) {
      const next = shiftMonth(selectedYear, selectedMonth, 1);
      cells.push({
        day: nextDay,
        inMonth: false,
        dateStr: `${next.year}-${String(next.month + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`,
      });
      nextDay++;
    }

    return cells;
  }, [selectedYear, selectedMonth]);

  /** Eventos do mês; se há dia na lista (atrasado), filtra só aquele dia. */
  const monthItems = useMemo(() => {
    const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
    const items: MonthItem[] = [];

    for (const t of tarefas) {
      const key = tarefaDateKey(t);
      if (!key || !key.startsWith(prefix)) continue;
      items.push({ kind: 'momento', sortKey: key, data: t });
    }
    for (const e of eventos) {
      if (!e.dataInicio?.startsWith(prefix)) continue;
      items.push({ kind: 'livre', sortKey: e.dataInicio, data: e });
    }

    items.sort((a, b) => {
      const byDay = a.sortKey.localeCompare(b.sortKey);
      if (byDay !== 0) return byDay;
      const ha =
        a.kind === 'livre' ? a.data.horaInicio || '99:99' : '00:00';
      const hb =
        b.kind === 'livre' ? b.data.horaInicio || '99:99' : '00:00';
      return ha.localeCompare(hb);
    });
    if (listDay) {
      return items.filter((it) => it.sortKey === listDay);
    }
    return items;
  }, [tarefas, eventos, selectedYear, selectedMonth, listDay]);

  function goMonth(delta: number) {
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
    setSelectedDay(null);
  }

  function abrirCriar(day?: string) {
    setEditing(null);
    setFormTitulo('');
    setFormData(day || selectedDay || toSpDateKey(Date.now()));
    setFormHora('');
    setFormIcone(EVENTO_ICONE_DEFAULT);
    setFormNotas('');
    setModalOpen(true);
  }

  function abrirEditar(e: EventoLivre) {
    setEditing(e);
    setFormTitulo(e.titulo);
    setFormData(e.dataInicio);
    setFormHora(e.horaInicio && isValidHora(e.horaInicio) ? e.horaInicio : '');
    setFormIcone(
      e.icone && isEventoIcone(e.icone) ? e.icone : EVENTO_ICONE_DEFAULT,
    );
    setFormNotas(e.notas || '');
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditing(null);
    setSalvando(false);
  }

  async function salvarEvento() {
    if (!idPareamentoAmigavel || salvando) return;
    const titulo = formTitulo.trim();
    if (!titulo) {
      showToast('Informe um título.', 'aviso');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData)) {
      showToast('Data inválida.', 'aviso');
      return;
    }
    const hora = formHora.trim();
    if (hora && !isValidHora(hora)) {
      showToast('Horário inválido.', 'aviso');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        pareamentoId: idPareamentoAmigavel,
        titulo,
        dataInicio: formData,
        horaInicio: hora || '',
        icone: formIcone,
        notas: formNotas.trim(),
      };
      if (editing) {
        await sendInput('calendar_event_update', {
          ...payload,
          eventId: editing.id,
        });
        showToast('Evento atualizado!', 'sucesso');
      } else {
        await sendInput('calendar_event_create', payload);
        showToast('Evento criado!', 'sucesso');
      }
      fecharModal();
      // Aguarda processInput gravar o doc antes de reler
      await new Promise((r) => setTimeout(r, 900));
      await reload();
      setSelectedDay(formData);
    } catch (err) {
      console.error('calendario salvar', err);
      showToast('Erro ao salvar evento.', 'erro');
      setSalvando(false);
    }
  }

  function excluirEvento(e: EventoLivre) {
    if (!idPareamentoAmigavel) return;
    openSystemConfirm('Excluir este evento?', async () => {
      try {
        await sendInput('calendar_event_delete', {
          pareamentoId: idPareamentoAmigavel,
          eventId: e.id,
        });
        showToast('Evento excluído.', 'sucesso');
        await reload();
      } catch {
        showToast('Erro ao excluir.', 'erro');
      }
    });
  }

  const monthLabel = `${MESES[selectedMonth]} ${selectedYear}`;

  const monthHero = (
    <div className="flex w-full max-w-sm items-center justify-center gap-5 px-10">
      <button
        type="button"
        onClick={() => goMonth(-1)}
        className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95"
        style={{ color: 'rgba(255,255,255,0.85)' }}
        aria-label="Mês anterior"
      >
        <i className="fas fa-chevron-left text-sm" />
      </button>
      <p className="min-w-[9.5rem] text-center text-[17px] font-semibold tracking-wide text-white">
        {monthLabel}
      </p>
      <button
        type="button"
        onClick={() => goMonth(1)}
        className="flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95"
        style={{ color: 'rgba(255,255,255,0.85)' }}
        aria-label="Próximo mês"
      >
        <i className="fas fa-chevron-right text-sm" />
      </button>
    </div>
  );

  if (!pareado || !idPareamentoAmigavel) {
    return (
      <AppHeroShell compactHero hero={monthHero}>
        <div className="rounded-2xl p-6 text-center" style={{ background: TILE }}>
          <p className="text-white/70 text-sm">Pareie para ver o calendário do casal.</p>
          <Link
            href="/parear"
            className="inline-block mt-4 px-6 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: CTA_GRAD }}
          >
            Parear agora
          </Link>
        </div>
      </AppHeroShell>
    );
  }

  return (
    <>
      <AppHeroShell compactHero sheetClassName="space-y-4" hero={monthHero}>
        {/* Bloco 1 — Calendário */}
        <div
          className="rounded-[28px] p-4 relative"
          style={{
            background: TILE,
            border: '1px solid rgba(244,63,94,0.28)',
            boxShadow:
              '0 0 0 1px rgba(244,63,94,0.12), 0 0 28px rgba(244,63,94,0.22), 0 12px 32px rgba(0,0,0,0.35)',
          }}
          onClick={() => setSelectedDay(null)}
          role="presentation"
        >
          <div className="grid grid-cols-7 mb-2">
            {DOW.map((d) => (
              <div
                key={d}
                className="text-center text-[11px] font-semibold text-white pb-2"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-2">
            {calendarCells.map((cell) => {
              const hasM = (momentosByDay[cell.dateStr]?.length ?? 0) > 0;
              const hasL = (livresByDay[cell.dateStr]?.length ?? 0) > 0;
              const isSel = cell.dateStr === selectedDay;
              const isHoje = cell.dateStr === hojeStr;
              return (
                <button
                  key={cell.dateStr + String(cell.inMonth)}
                  type="button"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setSelectedDay((prev) =>
                      prev === cell.dateStr ? null : cell.dateStr,
                    );
                  }}
                  className="nm-cal-day-btn relative flex flex-col items-center justify-start pt-0.5 pb-1 min-h-[44px]"
                >
                  <span
                    className={clsx(
                      'nm-cal-day-btn flex h-9 w-9 items-center justify-center rounded-full text-[15px] font-medium',
                      isSel && 'text-white font-semibold',
                      !isSel && cell.inMonth && 'text-white',
                      !isSel && !cell.inMonth && 'text-white/25',
                      !isSel && isHoje && cell.inMonth && 'ring-1 ring-white/40',
                    )}
                    style={
                      isSel
                        ? {
                            background: CTA_GRAD,
                            boxShadow: '0 4px 14px rgba(244,63,94,0.45)',
                          }
                        : {
                            background: 'transparent',
                            boxShadow: 'none',
                          }
                    }
                  >
                    {cell.day}
                  </span>
                  <span className="flex gap-0.5 mt-0.5 h-1.5 items-center justify-center">
                    {hasM && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ACCENT_SOFT }}
                      />
                    )}
                    {hasL && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: 'rgba(96,165,250,0.95)' }}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={(ev) => {
              ev.stopPropagation();
              abrirCriar(selectedDay || undefined);
            }}
            className="absolute -bottom-4 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
            style={{
              background: CTA_GRAD,
              boxShadow: '0 6px 18px rgba(244,63,94,0.5)',
            }}
            aria-label="Novo evento"
          >
            <i className="fas fa-plus text-sm" />
          </button>
        </div>

        {/* Bloco 2 — Resumo do mês */}
        <div
          className="rounded-[28px] p-4 mt-2"
          style={{
            background: TILE,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 12px 32px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className={clsx(
              'nm-cal-list-fade',
              listPhase === 'out' ? 'nm-cal-list-fade--out' : 'nm-cal-list-fade--in',
            )}
          >
          <p className="text-[15px] font-bold text-white mb-3">
            {listDay
              ? listDay === hojeStr
                ? 'Eventos de hoje'
                : `Eventos de ${listDay.split('-').reverse().join('/')}`
              : `Eventos de ${MESES[selectedMonth].toLowerCase()}`}
            {!carregando && (
              <span className="text-white/45 font-semibold text-sm">
                {' '}
                · {monthItems.length}
              </span>
            )}
          </p>

          {carregando ? (
            <p className="text-center text-white/50 text-sm py-8">Carregando...</p>
          ) : monthItems.length === 0 ? (
            <p className="text-center text-white/45 text-sm py-8 px-2">
              {listDay
                ? 'Nenhum evento neste dia.'
                : 'Nenhum evento neste mês. Toque no + para criar.'}
            </p>
          ) : (
            <div
              key={listDay ?? `month-${selectedYear}-${selectedMonth}`}
              className="space-y-3 nm-cal-list-swap"
            >
              {monthItems.map((item) => {
                if (item.kind === 'momento') {
                  const m = item.data;
                  const dateKey = item.sortKey;
                  const limMs = prazoDiasToMillis(m.dataLimite);
                  const limiteLabel = limMs != null
                    ? formatLimiteCurto(limMs)
                    : formatLimiteCurtoFromKey(dateKey);
                  return (
                    <Link
                      key={`m-${m.id}`}
                      href="/momentos"
                      className="relative block rounded-2xl p-3.5"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(244,63,94,0.22)',
                        boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
                          style={{ background: 'rgba(244,63,94,0.14)' }}
                        >
                          {m.momentoImg ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={m.momentoImg}
                              alt=""
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-xl">{m.momentoEmoji || '🔥'}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-[14px] font-bold text-white truncate leading-tight">
                            {m.momentoNome}
                          </p>
                          <p
                            className="mt-0.5 flex items-center gap-1.5 text-[12px] font-semibold truncate"
                            style={{ color: ACCENT }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src="/assets/icons/iconprincipal.png"
                              alt=""
                              width={12}
                              height={12}
                              className="shrink-0"
                              style={{ width: 12, height: 'auto' }}
                            />
                            Momento para realizar
                          </p>
                        </div>
                        <div className="text-right shrink-0 pl-1">
                          <p className="text-[14px] font-bold text-white leading-tight">
                            {limiteLabel}
                          </p>
                          <p className="text-[10px] text-white/40 mt-0.5">
                            Prazo
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                }

                const e = item.data;
                return (
                  <div
                    key={`e-${e.id}`}
                    className="relative rounded-2xl p-3.5 pr-10"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 8px 22px rgba(0,0,0,0.28)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => excluirEvento(e)}
                      className="absolute -top-2 -right-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-white"
                      style={{
                        background: ACCENT,
                        boxShadow: '0 4px 12px rgba(244,63,94,0.45)',
                      }}
                      aria-label="Excluir evento"
                    >
                      <i className="fas fa-times text-[11px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => abrirEditar(e)}
                      className="w-full flex items-center gap-3 text-left"
                    >
                      <div
                        className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center"
                        style={{ background: 'rgba(96,165,250,0.14)' }}
                      >
                        <i
                          className={clsx(
                            'fas text-sky-300',
                            e.icone && isEventoIcone(e.icone)
                              ? e.icone
                              : EVENTO_ICONE_DEFAULT,
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-bold text-white truncate leading-tight">
                          {e.titulo}
                        </p>
                        <p className="text-[12px] text-white/55 mt-0.5 truncate">
                          {e.notas?.trim() || 'Evento livre'}
                        </p>
                      </div>
                      <div className="text-right shrink-0 pl-1">
                        <p className="text-[14px] font-bold text-white leading-tight">
                          {e.horaInicio && isValidHora(e.horaInicio)
                            ? e.horaInicio
                            : 'Dia todo'}
                        </p>
                        <p className="text-[10px] text-white/40 mt-0.5">
                          {formatDiaMesPt(e.dataInicio)}
                        </p>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </AppHeroShell>

      {modalOpen && (
        <OverlayModal
          open
          onClose={fecharModal}
          backdropClassName="bg-black/85"
          maxWidth="max-w-sm"
          scrollPanel={false}
          panelClassName="overflow-hidden border border-white/10"
          ariaLabel={editing ? 'Editar evento' : 'Novo evento'}
        >
          <div
            className="overflow-hidden flex flex-col min-h-0"
            style={{ background: '#101010' }}
          >
            <div className="px-6 py-5 shrink-0" style={{ background: CTA_GRAD }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                  >
                    <i
                      className={clsx(
                        'fas text-white text-base',
                        editing ? 'fa-pen' : 'fa-calendar-plus',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base leading-tight">
                      {editing ? 'Editar evento' : 'Novo evento'}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5 truncate">
                      {editing
                        ? 'Atualize os detalhes do compromisso'
                        : 'Adicione um compromisso do casal'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fecharModal}
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 ml-2"
                  style={{ background: 'rgba(0,0,0,0.45)' }}
                  aria-label="Fechar"
                >
                  <i className="fas fa-times text-white text-sm" />
                </button>
              </div>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto min-h-0 flex-1">
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">
                  Título
                </label>
                <input
                  value={formTitulo}
                  onChange={(ev) => setFormTitulo(ev.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Jantar da sogra"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{
                    background: TILE,
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1.5">
                    Data
                  </label>
                  <input
                    type="date"
                    value={formData}
                    onChange={(ev) => setFormData(ev.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{
                      background: TILE,
                      border: '1px solid rgba(255,255,255,0.10)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/60 mb-1.5">
                    Horário
                  </label>
                  <input
                    type="time"
                    value={formHora}
                    onChange={(ev) => setFormHora(ev.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                    style={{
                      background: TILE,
                      border: '1px solid rgba(255,255,255,0.10)',
                      colorScheme: 'dark',
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] text-white/40 -mt-2">
                Deixe o horário vazio para evento o dia todo.
              </p>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">
                  Ícone
                </label>
                <div
                  className="rounded-2xl p-2.5"
                  style={{
                    background: TILE,
                    border: '1px solid rgba(244,63,94,0.18)',
                  }}
                >
                  <div className="grid grid-cols-4 gap-2">
                    {EVENTO_ICONES.map((icone) => {
                      const selected = formIcone === icone;
                      return (
                        <button
                          key={icone}
                          type="button"
                          onClick={() => setFormIcone(icone)}
                          className="flex h-11 items-center justify-center rounded-xl transition active:scale-95"
                          style={{
                            background: selected
                              ? 'rgba(244,63,94,0.22)'
                              : 'rgba(255,255,255,0.04)',
                            border: selected
                              ? `1px solid ${ACCENT}`
                              : '1px solid rgba(255,255,255,0.08)',
                            color: selected ? ACCENT : 'rgba(255,255,255,0.65)',
                          }}
                          aria-label={`Ícone ${icone}`}
                          aria-pressed={selected}
                        >
                          <i className={clsx('fas text-base', icone)} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">
                  Notas (opcional)
                </label>
                <textarea
                  value={formNotas}
                  onChange={(ev) => setFormNotas(ev.target.value)}
                  maxLength={500}
                  rows={3}
                  placeholder="Detalhes do compromisso..."
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none"
                  style={{
                    background: TILE,
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={salvarEvento}
                disabled={salvando}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: CTA_GRAD }}
              >
                {salvando
                  ? 'Salvando...'
                  : editing
                    ? 'Salvar alterações'
                    : 'Criar evento'}
              </button>
              <button
                type="button"
                onClick={fecharModal}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(255,255,255,0.35)',
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </OverlayModal>
      )}
    </>
  );
}
