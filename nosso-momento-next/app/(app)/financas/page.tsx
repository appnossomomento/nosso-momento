'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  where,
} from 'firebase/firestore';
import clsx from 'clsx';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import OverlayModal from '@/components/ui/OverlayModal';
import { openSystemConfirm } from '@/components/ui/Modal';
import AppHeroShell, {
  ACCENT,
  ACCENT_SOFT,
  LP_RED,
  TILE,
} from '@/components/layout/AppHeroShell';
import { primeiroNome } from '@/lib/utils/displayName';
import {
  CATEGORIA_COLORS,
  GASTO_CATEGORIAS,
  formatBRLFromCentavos,
  parseBRLToCentavos,
  type GastoCategoria,
} from '@/lib/financas/categorias';

const CTA_GRAD = `linear-gradient(135deg, ${LP_RED}, ${ACCENT})`;
const CARD_BG = '#FFF5F6';
const CARD_TITLE = '#1A1214';
const CARD_META = '#8B6B73';
const FALLBACK_AVATAR = '/assets/icons/iconprincipal.png';
const GASTOS_POR_PAGINA = 5;

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const;

type Gasto = {
  id: string;
  titulo: string;
  valorCentavos: number;
  categoria: GastoCategoria;
  data: string;
  pagoPorUid: string;
  notas?: string | null;
};

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

function formatDiaCurto(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const mes = MESES[m - 1].slice(0, 3).toLowerCase();
  return `${d} de ${mes}.`;
}

function saudacaoSP(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Sao_Paulo',
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Donut via conic-gradient — funciona com 1 fatia (SVG arc de 360° some). */
function CategoryDonut({
  parts,
  holeColor,
}: {
  parts: { key: string; value: number; color: string }[];
  holeColor: string;
}) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (total <= 0 || parts.length === 0) return null;

  const stops = parts
    .reduce<{ list: string[]; acc: number }>(
      (state, p) => {
        const start = (state.acc / total) * 100;
        const nextAcc = state.acc + p.value;
        const end = (nextAcc / total) * 100;
        return {
          acc: nextAcc,
          list: [...state.list, `${p.color} ${start}% ${end}%`],
        };
      },
      { list: [], acc: 0 },
    )
    .list.join(', ');

  return (
    <div
      className="relative w-28 h-28 shrink-0 rounded-full"
      style={{ background: `conic-gradient(from -90deg, ${stops})` }}
      aria-hidden
    >
      <div
        className="absolute inset-[26%] rounded-full"
        style={{ background: holeColor }}
      />
    </div>
  );
}

export default function FinancasPage() {
  const {
    usuario,
    idPareamentoAmigavel,
    pareado,
    parceiroNome,
    parceiroData,
    pareadoUid,
  } = useAppStore();

  const agora = new Date();
  const [selectedMonth, setSelectedMonth] = useState(agora.getMonth());
  const [selectedYear, setSelectedYear] = useState(agora.getFullYear());
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [limiteCentavos, setLimiteCentavos] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Gasto | null>(null);
  const [formTitulo, setFormTitulo] = useState('');
  const [formValor, setFormValor] = useState('');
  const [formData, setFormData] = useState(toSpDateKey(Date.now()));
  const [formCategoria, setFormCategoria] = useState<GastoCategoria>('Mercado');
  const [formPagoPor, setFormPagoPor] = useState<string>('');
  const [formNotas, setFormNotas] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [limiteModalOpen, setLimiteModalOpen] = useState(false);
  const [formLimite, setFormLimite] = useState('');
  const [salvandoLimite, setSalvandoLimite] = useState(false);
  const [listaPage, setListaPage] = useState(0);

  const uid = usuario?.uid ?? null;
  const partnerUid = pareadoUid ?? parceiroData?.uid ?? null;
  const meuNome = primeiroNome(usuario?.nome) || 'Você';
  const partnerFirst =
    primeiroNome(parceiroNome) ||
    primeiroNome(parceiroData?.nome) ||
    'Parceiro';
  const meuFoto = usuario?.fotoUrl || FALLBACK_AVATAR;
  const partnerFoto = parceiroData?.fotoUrl || FALLBACK_AVATAR;

  const reload = useCallback(async () => {
    if (!uid || !idPareamentoAmigavel) return;
    setCarregando(true);
    try {
      const snapGastos = await getDocs(
        query(
          collection(db, 'gastosCasal'),
          where('memberUids', 'array-contains', uid),
          limit(200),
        ),
      );

      setGastos(
        snapGastos.docs
          .filter((d) => d.data().idPareamento === idPareamentoAmigavel)
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              titulo: String(data.titulo || ''),
              valorCentavos: Number(data.valorCentavos) || 0,
              categoria: (GASTO_CATEGORIAS as readonly string[]).includes(
                data.categoria,
              )
                ? (data.categoria as GastoCategoria)
                : 'Outros',
              data: String(data.data || ''),
              pagoPorUid: String(data.pagoPorUid || ''),
              notas: data.notas ?? null,
            };
          }),
      );

      try {
        const snapConfig = await getDoc(
          doc(db, 'financasCasal', idPareamentoAmigavel),
        );
        if (snapConfig.exists()) {
          const lim = snapConfig.data()?.limiteMensalCentavos;
          setLimiteCentavos(
            typeof lim === 'number' && lim > 0 ? lim : null,
          );
        } else {
          setLimiteCentavos(null);
        }
      } catch (cfgErr) {
        // Doc ausente / rules antigas: não derruba a tela de gastos.
        console.warn('financas config', cfgErr);
        setLimiteCentavos(null);
      }
    } catch (err) {
      console.error('financas reload', err);
      showToast('Erro ao carregar finanças.', 'erro');
    } finally {
      setCarregando(false);
    }
  }, [uid, idPareamentoAmigavel]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (uid && !formPagoPor) setFormPagoPor(uid);
  }, [uid, formPagoPor]);

  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
  const monthGastos = useMemo(
    () =>
      gastos
        .filter((g) => g.data.startsWith(monthPrefix))
        .sort((a, b) => b.data.localeCompare(a.data)),
    [gastos, monthPrefix],
  );

  const listaTotalPages = Math.max(
    1,
    Math.ceil(monthGastos.length / GASTOS_POR_PAGINA),
  );
  const listaPageSafe = Math.min(listaPage, listaTotalPages - 1);
  const pageGastos = useMemo(() => {
    const start = listaPageSafe * GASTOS_POR_PAGINA;
    return monthGastos.slice(start, start + GASTOS_POR_PAGINA);
  }, [monthGastos, listaPageSafe]);

  useEffect(() => {
    setListaPage(0);
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    if (listaPage > listaTotalPages - 1) {
      setListaPage(Math.max(0, listaTotalPages - 1));
    }
  }, [listaPage, listaTotalPages]);

  const totalMes = useMemo(
    () => monthGastos.reduce((s, g) => s + g.valorCentavos, 0),
    [monthGastos],
  );

  const porPessoa = useMemo(() => {
    let eu = 0;
    let par = 0;
    for (const g of monthGastos) {
      if (uid && g.pagoPorUid === uid) eu += g.valorCentavos;
      else if (partnerUid && g.pagoPorUid === partnerUid) par += g.valorCentavos;
    }
    return { eu, par };
  }, [monthGastos, uid, partnerUid]);

  const porCategoria = useMemo(() => {
    const map = new Map<GastoCategoria, number>();
    for (const g of monthGastos) {
      map.set(g.categoria, (map.get(g.categoria) || 0) + g.valorCentavos);
    }
    return [...map.entries()]
      .map(([key, value]) => ({
        key,
        value,
        color: CATEGORIA_COLORS[key],
      }))
      .sort((a, b) => b.value - a.value);
  }, [monthGastos]);

  const sobrou =
    limiteCentavos != null ? limiteCentavos - totalMes : null;
  const pctLimite =
    limiteCentavos && limiteCentavos > 0
      ? Math.min(100, Math.round((totalMes / limiteCentavos) * 100))
      : 0;

  function goMonth(delta: number) {
    const next = shiftMonth(selectedYear, selectedMonth, delta);
    setSelectedYear(next.year);
    setSelectedMonth(next.month);
  }

  function abrirCriar() {
    setEditing(null);
    setFormTitulo('');
    setFormValor('');
    setFormData(toSpDateKey(Date.now()));
    setFormCategoria('Mercado');
    setFormPagoPor(uid || '');
    setFormNotas('');
    setModalOpen(true);
  }

  function abrirEditar(g: Gasto) {
    setEditing(g);
    setFormTitulo(g.titulo);
    setFormValor((g.valorCentavos / 100).toFixed(2).replace('.', ','));
    setFormData(g.data);
    setFormCategoria(g.categoria);
    setFormPagoPor(g.pagoPorUid);
    setFormNotas(g.notas || '');
    setModalOpen(true);
  }

  function fecharModal() {
    setModalOpen(false);
    setEditing(null);
    setSalvando(false);
  }

  async function salvarGasto() {
    if (!idPareamentoAmigavel || salvando) return;
    const titulo = formTitulo.trim();
    if (!titulo) {
      showToast('Informe um título.', 'aviso');
      return;
    }
    const centavos = parseBRLToCentavos(formValor);
    if (centavos == null) {
      showToast('Valor inválido.', 'aviso');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData)) {
      showToast('Data inválida.', 'aviso');
      return;
    }
    if (!formPagoPor) {
      showToast('Informe quem pagou.', 'aviso');
      return;
    }
    setSalvando(true);
    try {
      const payload = {
        pareamentoId: idPareamentoAmigavel,
        titulo,
        valorCentavos: centavos,
        categoria: formCategoria,
        data: formData,
        pagoPorUid: formPagoPor,
        notas: formNotas.trim(),
      };
      if (editing) {
        await sendInput('gasto_update', { ...payload, gastoId: editing.id });
        showToast('Gasto atualizado!', 'sucesso');
      } else {
        await sendInput('gasto_create', payload);
        showToast('Gasto registrado!', 'sucesso');
      }
      fecharModal();
      await new Promise((r) => setTimeout(r, 1100));
      try {
        await reload();
      } catch {
        // create já ok — reload falhou à parte
      }
    } catch (err) {
      console.error('financas salvar', err);
      showToast('Erro ao salvar gasto.', 'erro');
      setSalvando(false);
    }
  }

  function excluirGasto(g: Gasto) {
    if (!idPareamentoAmigavel) return;
    openSystemConfirm('Excluir este gasto?', async () => {
      try {
        await sendInput('gasto_delete', {
          pareamentoId: idPareamentoAmigavel,
          gastoId: g.id,
        });
        showToast('Gasto excluído.', 'sucesso');
        await reload();
      } catch {
        showToast('Erro ao excluir.', 'erro');
      }
    });
  }

  function abrirLimite() {
    setFormLimite(
      limiteCentavos != null
        ? (limiteCentavos / 100).toFixed(2).replace('.', ',')
        : '',
    );
    setLimiteModalOpen(true);
  }

  async function salvarLimite() {
    if (!idPareamentoAmigavel || salvandoLimite) return;
    const trimmed = formLimite.trim();
    let limiteMensalCentavos: number | null = null;
    if (trimmed) {
      const c = parseBRLToCentavos(trimmed);
      if (c == null) {
        showToast('Limite inválido.', 'aviso');
        return;
      }
      limiteMensalCentavos = c;
    }
    setSalvandoLimite(true);
    try {
      await sendInput('financas_limite_set', {
        pareamentoId: idPareamentoAmigavel,
        limiteMensalCentavos,
      });
      showToast(
        limiteMensalCentavos == null ? 'Limite removido.' : 'Limite salvo!',
        'sucesso',
      );
      setLimiteModalOpen(false);
      await new Promise((r) => setTimeout(r, 700));
      await reload();
    } catch {
      showToast('Erro ao salvar limite.', 'erro');
    } finally {
      setSalvandoLimite(false);
    }
  }

  const financasHero = (
    <div className="w-full max-w-sm text-left">
      <div className="flex items-start justify-between gap-2 pl-10 pr-1">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium text-white/80 leading-none">
            {saudacaoSP()}
          </p>
          <h1 className="mt-1 text-[15px] font-bold text-white leading-snug">
            {meuNome} & {partnerFirst}
          </h1>
        </div>
        <div className="flex items-center gap-0.5 shrink-0 pt-0.5">
          <button
            type="button"
            onClick={() => goMonth(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95"
            style={{ color: 'rgba(255,255,255,0.9)' }}
            aria-label="Mês anterior"
          >
            <i className="fas fa-chevron-left text-xs" />
          </button>
          <p className="min-w-[4.8rem] text-center text-[11px] font-semibold text-white/90">
            {MESES[selectedMonth].slice(0, 3)} {selectedYear}
          </p>
          <button
            type="button"
            onClick={() => goMonth(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95"
            style={{ color: 'rgba(255,255,255,0.9)' }}
            aria-label="Próximo mês"
          >
            <i className="fas fa-chevron-right text-xs" />
          </button>
        </div>
      </div>

      <div
        className="relative mt-4 mx-1 rounded-[28px] px-5 pt-4 pb-4 text-left"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 12px 28px rgba(0,0,0,0.22)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: '#6B7280' }}>
              Total gasto
            </p>
            <p
              className="mt-1 text-[30px] font-bold leading-none tracking-tight"
              style={{ color: CARD_TITLE }}
            >
              {formatBRLFromCentavos(totalMes)}
            </p>
          </div>
          <div className="relative shrink-0 mt-1" style={{ width: 48, height: 34 }}>
            <div
              className="absolute left-0 top-0 rounded-full overflow-hidden border-2 border-white"
              style={{ width: 32, height: 32, zIndex: 1 }}
            >
              <Image
                src={meuFoto}
                alt=""
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            </div>
            <div
              className="absolute right-0 top-0 rounded-full overflow-hidden border-2 border-white"
              style={{ width: 32, height: 32, zIndex: 2 }}
            >
              <Image
                src={partnerFoto}
                alt=""
                width={32}
                height={32}
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>

        {limiteCentavos != null ? (
          <button
            type="button"
            onClick={abrirLimite}
            className="mt-3.5 w-full text-left"
          >
            <div
              className="h-2.5 rounded-full overflow-hidden"
              style={{ background: 'rgba(244,63,94,0.14)' }}
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, pctLimite)}%`,
                  background:
                    sobrou != null && sobrou < 0
                      ? LP_RED
                      : pctLimite >= 80
                        ? ACCENT
                        : `linear-gradient(90deg, ${ACCENT_SOFT}, ${ACCENT})`,
                }}
              />
            </div>
            <div
              className="mt-2 flex items-center justify-between gap-2 text-[11px]"
              style={{ color: CARD_META }}
            >
              <span>
                {pctLimite}% do limite · {formatBRLFromCentavos(limiteCentavos)}
              </span>
              <span
                className="font-semibold shrink-0"
                style={{
                  color: sobrou != null && sobrou < 0 ? LP_RED : ACCENT,
                }}
              >
                {sobrou != null && sobrou < 0
                  ? `+${formatBRLFromCentavos(Math.abs(sobrou))}`
                  : `sobra ${formatBRLFromCentavos(sobrou ?? 0)}`}
              </span>
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={abrirLimite}
            className="mt-3 text-[12px] font-semibold"
            style={{ color: ACCENT }}
          >
            Definir limite mensal
          </button>
        )}
      </div>
    </div>
  );

  if (!pareado || !idPareamentoAmigavel) {
    return (
      <AppHeroShell bareSheet hero={financasHero}>
        <div
          className="rounded-2xl p-6 text-center"
          style={{
            background: CARD_BG,
            boxShadow: '0 6px 16px rgba(0,0,0,0.14)',
          }}
        >
          <p className="text-sm" style={{ color: CARD_META }}>
            Pareie para ver as finanças do casal.
          </p>
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
      <AppHeroShell bareSheet sheetClassName="space-y-3" hero={financasHero}>
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-[16px] font-bold text-white">Finanças do casal</h2>
          <button
            type="button"
            onClick={abrirCriar}
            className="flex h-10 w-10 items-center justify-center rounded-full text-white transition active:scale-95"
            style={{ background: CTA_GRAD }}
            aria-label="Adicionar gasto"
          >
            <i className="fas fa-plus text-sm" />
          </button>
        </div>

        {/* Quem pagou */}
        <div
          className="rounded-[24px] p-4 space-y-3"
          style={{ background: CARD_BG, boxShadow: '0 6px 16px rgba(0,0,0,0.14)' }}
        >
          {[
            { nome: meuNome, foto: meuFoto, valor: porPessoa.eu },
            { nome: partnerFirst, foto: partnerFoto, valor: porPessoa.par },
          ].map((row) => {
            const pct = totalMes > 0 ? Math.round((row.valor / totalMes) * 100) : 0;
            return (
              <div key={row.nome} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                  <Image src={row.foto} alt="" width={36} height={36} className="object-cover w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-[12px] mb-1">
                    <span className="font-semibold truncate" style={{ color: CARD_TITLE }}>{row.nome}</span>
                    <span className="font-bold" style={{ color: ACCENT }}>{formatBRLFromCentavos(row.valor)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(244,63,94,0.12)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: ACCENT }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Categorias / pizza */}
        <div
          className="rounded-[24px] p-4"
          style={{ background: CARD_BG, boxShadow: '0 6px 16px rgba(0,0,0,0.14)' }}
        >
          {porCategoria.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: CARD_META }}>
              Nenhum gasto neste mês.
            </p>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <CategoryDonut parts={porCategoria} holeColor={CARD_BG} />
                <div className="flex-1 space-y-1.5 min-w-0">
                  {porCategoria.map((c) => {
                    const pct = totalMes > 0 ? Math.round((c.value / totalMes) * 100) : 0;
                    return (
                      <div key={c.key} className="flex items-center gap-2 text-[12px]">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="font-semibold truncate" style={{ color: CARD_TITLE }}>{pct}%</span>
                        <span className="truncate" style={{ color: CARD_META }}>{c.key}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-4 space-y-2 border-t pt-3" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
                {porCategoria.map((c) => (
                  <div key={c.key} className="flex justify-between text-[13px]">
                    <span className="flex items-center gap-2" style={{ color: CARD_TITLE }}>
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      {c.key}
                    </span>
                    <span className="font-bold" style={{ color: CARD_TITLE }}>
                      {formatBRLFromCentavos(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Lista */}
        <div>
          <p className="text-[14px] font-bold text-white mb-2 px-0.5">Gastos do mês</p>
          {carregando ? (
            <p className="text-center text-white/50 text-sm py-8">Carregando...</p>
          ) : monthGastos.length === 0 ? (
            <div
              className="rounded-[20px] p-6 text-center"
              style={{ background: CARD_BG }}
            >
              <p className="text-sm" style={{ color: CARD_META }}>
                Nenhum lançamento. Toque em + Adicionar.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {pageGastos.map((g) => {
                  const isMe = uid && g.pagoPorUid === uid;
                  const foto = isMe ? meuFoto : partnerFoto;
                  return (
                    <div
                      key={g.id}
                      className="rounded-[18px] px-3 py-3 flex items-center gap-3"
                      style={{
                        background: CARD_BG,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => abrirEditar(g)}
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                      >
                        <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                          <Image src={foto} alt="" width={40} height={40} className="object-cover w-full h-full" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-bold truncate" style={{ color: CARD_TITLE }}>
                            {g.titulo}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: CARD_META }}>
                            {g.categoria} · {formatDiaCurto(g.data)}
                          </p>
                        </div>
                        <p className="text-[14px] font-bold shrink-0" style={{ color: ACCENT }}>
                          -{formatBRLFromCentavos(g.valorCentavos)}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => excluirGasto(g)}
                        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                        style={{ color: ACCENT, background: 'rgba(244,63,94,0.1)' }}
                        aria-label="Excluir"
                      >
                        <i className="fas fa-trash text-[11px]" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {listaTotalPages > 1 && (
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setListaPage((p) => Math.max(0, p - 1))}
                    disabled={listaPageSafe <= 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                    aria-label="Página anterior"
                  >
                    <i className="fas fa-chevron-left text-[11px]" />
                  </button>
                  <p className="text-[12px] font-semibold text-white/70 tabular-nums">
                    {listaPageSafe + 1} / {listaTotalPages}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setListaPage((p) => Math.min(listaTotalPages - 1, p + 1))
                    }
                    disabled={listaPageSafe >= listaTotalPages - 1}
                    className="flex h-8 w-8 items-center justify-center rounded-full transition disabled:opacity-30"
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.85)',
                    }}
                    aria-label="Próxima página"
                  >
                    <i className="fas fa-chevron-right text-[11px]" />
                  </button>
                </div>
              )}
            </>
          )}
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
          ariaLabel={editing ? 'Editar gasto' : 'Novo gasto'}
        >
          <div className="overflow-hidden flex flex-col min-h-0" style={{ background: '#101010' }}>
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
                        editing ? 'fa-pen' : 'fa-wallet',
                      )}
                    />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-white font-bold text-base leading-tight">
                      {editing ? 'Editar gasto' : 'Novo gasto'}
                    </h3>
                    <p className="text-white/70 text-xs mt-0.5 truncate">
                      {editing
                        ? 'Atualize os detalhes do lançamento'
                        : 'Registre um gasto do casal'}
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
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Valor (R$)</label>
                <input
                  value={formValor}
                  onChange={(e) => setFormValor(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                  autoFocus
                  className="w-full rounded-xl px-3 py-3 text-2xl font-bold text-white outline-none"
                  style={{ background: TILE, border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Título</label>
                <input
                  value={formTitulo}
                  onChange={(e) => setFormTitulo(e.target.value)}
                  maxLength={80}
                  placeholder="Ex.: Mercado"
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: TILE, border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Categoria</label>
                <div className="flex flex-wrap gap-2">
                  {GASTO_CATEGORIAS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setFormCategoria(c)}
                      className={clsx(
                        'px-3 py-1.5 rounded-full text-[12px] font-semibold transition',
                      )}
                      style={{
                        background: formCategoria === c ? 'rgba(244,63,94,0.25)' : 'rgba(255,255,255,0.06)',
                        border: formCategoria === c ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)',
                        color: formCategoria === c ? ACCENT : 'rgba(255,255,255,0.7)',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Pago por</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: uid || '', nome: meuNome, foto: meuFoto },
                    { id: partnerUid || '', nome: partnerFirst, foto: partnerFoto },
                  ].filter((p) => p.id).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFormPagoPor(p.id)}
                      className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-left"
                      style={{
                        background: formPagoPor === p.id ? 'rgba(244,63,94,0.2)' : TILE,
                        border: formPagoPor === p.id ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.1)',
                      }}
                    >
                      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                        <Image src={p.foto} alt="" width={32} height={32} className="object-cover w-full h-full" />
                      </div>
                      <span className="text-sm font-semibold text-white truncate">{p.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Data</label>
                <input
                  type="date"
                  value={formData}
                  onChange={(e) => setFormData(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
                  style={{ background: TILE, border: '1px solid rgba(255,255,255,0.1)', colorScheme: 'dark' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/60 mb-1.5">Notas (opcional)</label>
                <textarea
                  value={formNotas}
                  onChange={(e) => setFormNotas(e.target.value)}
                  rows={2}
                  maxLength={500}
                  className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none resize-none"
                  style={{ background: TILE, border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              <button
                type="button"
                onClick={salvarGasto}
                disabled={salvando}
                className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
                style={{ background: CTA_GRAD }}
              >
                {salvando ? 'Salvando...' : editing ? 'Salvar' : 'Registrar'}
              </button>
              <button
                type="button"
                onClick={fecharModal}
                className="w-full py-2.5 rounded-xl text-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </OverlayModal>
      )}

      {limiteModalOpen && (
        <OverlayModal
          open
          onClose={() => setLimiteModalOpen(false)}
          backdropClassName="bg-black/85"
          maxWidth="max-w-sm"
          panelClassName="overflow-hidden border border-white/10"
          ariaLabel="Limite mensal"
        >
          <div className="p-5 space-y-4" style={{ background: '#101010' }}>
            <h3 className="text-white font-bold text-base">Limite mensal do casal</h3>
            <input
              value={formLimite}
              onChange={(e) => setFormLimite(e.target.value)}
              placeholder="Ex.: 3000,00 (vazio remove)"
              inputMode="decimal"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
              style={{ background: TILE, border: '1px solid rgba(255,255,255,0.1)' }}
            />
            <button
              type="button"
              onClick={salvarLimite}
              disabled={salvandoLimite}
              className="w-full py-3 rounded-xl font-bold text-white text-sm disabled:opacity-40"
              style={{ background: CTA_GRAD }}
            >
              {salvandoLimite ? 'Salvando...' : 'Salvar limite'}
            </button>
            <button
              type="button"
              onClick={() => setLimiteModalOpen(false)}
              className="w-full py-2.5 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}
            >
              Cancelar
            </button>
          </div>
        </OverlayModal>
      )}
    </>
  );
}
