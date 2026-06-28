'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { showToast } from '@/components/ui/Toast';
import clsx from 'clsx';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';
import { trackGA } from '@/lib/analytics';
import { getCatalogFilterGender, momentMatchesCatalogFilter } from '@/lib/utils/profile';

type CatalogoCfg = { preco?: number; bloqueado?: boolean };

export default function PersonalizarPage() {
  const router = useRouter();
  const { usuario, momentosMestres, set, pareado } = useAppStore();

  // Estado local espelha o catalogoPersonalizado do usuário
  const [catalogo, setCatalogo] = useState<Record<string, CatalogoCfg>>(
    () => {
      const raw = usuario?.catalogoPersonalizado ?? {};
      const result: Record<string, CatalogoCfg> = {};
      for (const [k, v] of Object.entries(raw)) {
        result[k] = v as CatalogoCfg;
      }
      return result;
    }
  );
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<string | null>('Lovezin');

  if (!pareado) {
    return (
      <div className="screen screen-pad bg-black text-white flex flex-col items-center justify-center text-center px-8">
        <i className="fas fa-tags text-red-400 text-5xl mb-6" />
        <h2 className="text-xl font-bold mb-2">Personalizar Catálogo</h2>
        <p className="text-white/50 text-sm mb-6">Pareie com seu parceiro para personalizar o catálogo.</p>
        <button onClick={() => router.push('/parear')} className="btn-red px-8 py-3 rounded-xl text-sm font-semibold">
          Parear agora
        </button>
      </div>
    );
  }

  const meuCatalogo = getCatalogFilterGender(usuario ?? undefined);
  const momentosParaMim = momentosMestres.filter((m) =>
    momentMatchesCatalogFilter(m.targetGender, meuCatalogo),
  );
  const categorias = [...new Set(momentosParaMim.map((m) => m.categoria))];
  const momentosFiltrados = filtro ? momentosParaMim.filter((m) => m.categoria === filtro) : momentosParaMim;

  function toggleBloqueado(nomeItem: string) {
    setCatalogo((prev) => {
      const atual = prev[nomeItem] ?? {};
      return { ...prev, [nomeItem]: { ...atual, bloqueado: !atual.bloqueado } };
    });
  }

  function setPreco(nomeItem: string, preco: number) {
    setCatalogo((prev) => {
      const atual = prev[nomeItem] ?? {};
      return { ...prev, [nomeItem]: { ...atual, preco } };
    });
  }

  async function salvar() {
    if (!usuario?.uid) return;
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario.uid), {
        catalogoPersonalizado: catalogo,
      });
      set({ usuario: { ...usuario, catalogoPersonalizado: catalogo } });
      trackGA('customize_catalog');
      showToast('Catálogo personalizado salvo! 🎉', 'sucesso');
      router.back();
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="screen bg-black text-white pb-28">
      <ParceiroHeader />

      {/* Hero section — igual ao _catalogoHero do index.html */}
      <section
        className="px-6 pt-10 pb-28 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}
      >
        <div className="flex flex-col items-center text-center" style={{ marginTop: -8 }}>
          <i className="fas fa-store text-3xl text-white mb-3" />
          <h2 className="text-3xl font-semibold text-white">Meu Catálogo</h2>
          <p className="text-white/80">Gerencie os momentos que seu parceiro irá resgatar.</p>
        </div>
      </section>

      {/* Content com -mt-10 para sobrepor o hero */}
      <section className="px-5 pb-8 -mt-10">
        <div className="max-w-5xl mx-auto">
          {/* Card escuro que sobrepõe o hero — padrão das outras telas */}
          <div className="rounded-[28px] bg-[#111114] p-4 shadow-lg space-y-4">

          {/* Filtro de categoria */}
          <div className="flex flex-wrap justify-center gap-2 pb-1">
          {categorias.map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltro(cat === filtro ? null : cat)}
              className={clsx('px-4 py-2 rounded-full text-xs font-semibold transition', filtro === cat ? 'bg-white text-black' : 'bg-white/10 text-white/60')}
            >
              {cat === 'Sair da Rotina' ? 'Rotina' : cat}
            </button>
          ))}
        </div>

        {/* Lista de itens */}
        <div className="space-y-3">
          {momentosFiltrados.map((m) => {
            const cfg = catalogo[m.nome ?? ''] ?? {};
            const bloqueado = cfg.bloqueado ?? false;
            const precoDefault = Number(m.intensidade ?? 1) * 2;
            const preco = cfg.preco !== undefined ? cfg.preco : precoDefault;

            return (
              <div
                key={m.id}
                className={clsx(
                  'rounded-2xl bg-[#1a1020] border border-white/10 overflow-hidden transition',
                  bloqueado && 'opacity-50'
                )}
              >
                <div className="flex items-center gap-3 p-3">
                  {m.img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(m.img)}
                      alt={m.nome ?? ''}
                      className="w-14 h-14 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-500/30 to-pink-500/30 flex items-center justify-center shrink-0">
                      <span className="text-2xl">{String(m.emoji ?? '🔥')}</span>
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">{m.nome ?? ''}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{m.categoria}</p>
                    {/* Preço customizável */}
                    <div className="flex items-center gap-1 mt-1">
                      <i className="fas fa-fire text-amber-400 text-[10px]" />
                      <input
                        type="number"
                        value={preco}
                        min={0}
                        max={999}
                        onChange={(e) => setPreco(m.nome ?? '', Number(e.target.value))}
                        className="w-16 bg-white/10 rounded-md px-2 py-0.5 text-xs text-amber-300 font-semibold border border-white/10 focus:outline-none focus:border-red-400"
                      />
                      <span className="text-[10px] text-white/40">foguinhos</span>
                    </div>
                  </div>

                  {/* Toggle bloqueado */}
                  <button
                    onClick={() => toggleBloqueado(m.nome ?? '')}
                    className={clsx(
                      'shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition',
                      bloqueado ? 'bg-red-500/30 border border-red-500/50' : 'bg-white/10 border border-white/15'
                    )}
                  >
                    <i className={clsx('fas text-base', bloqueado ? 'fa-lock text-red-400' : 'fa-lock-open text-white/60')} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

          {/* Botão salvar — centralizado no fim */}
          <div className="pt-2 pb-1">
            <button
              onClick={salvar}
              disabled={salvando}
              className="w-full py-3 rounded-2xl text-sm font-bold transition"
              style={{ background: 'linear-gradient(135deg,#ff2d3f,#ff5565)', color: 'white', opacity: salvando ? 0.5 : 1 }}
            >
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>

          </div>{/* closes card escuro */}
        </div>{/* closes max-w-5xl */}
      </section>{/* closes content section */}
    </div>
  );
}
