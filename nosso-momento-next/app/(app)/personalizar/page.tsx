'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store/appStore';
import { sendInput } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { openSystemConfirm } from '@/components/ui/Modal';
import OverlayModal from '@/components/ui/OverlayModal';
import clsx from 'clsx';
import ParceiroHeader from '@/components/parceiro/ParceiroHeader';
import MomentoCover from '@/components/ui/MomentoCover';
import { trackGA } from '@/lib/analytics';
import { getCatalogFilterGender, momentMatchesCatalogFilter } from '@/lib/utils/profile';
import { uploadCustomMomentImage, isStorageUploadError } from '@/lib/utils/uploadCustomMomentImage';
import { waitForCustomMomentVisible } from '@/lib/utils/refreshMomentosCustom';
import type { CatalogoCfg, MomentoCustom, MomentoMestre } from '@/lib/types';

const EMOJIS_POR_CATEGORIA = [
  { label: 'Lovezin', emojis: ['💗', '❤️'] },
  { label: 'Rotina', emojis: ['🍷', '🎉'] },
  { label: 'Quentes', emojis: ['🌶️', '🔥'] },
] as const;

const EMOJI_PADRAO = '❤️';

function cfgFromUsuario(raw: Record<string, unknown> | undefined): Record<string, CatalogoCfg> {
  const result: Record<string, CatalogoCfg> = {};
  if (!raw) return result;
  for (const [k, v] of Object.entries(raw)) {
    if (v && typeof v === 'object') result[k] = v as CatalogoCfg;
  }
  return result;
}

function precoDefault(m: MomentoMestre): number {
  return Number(m.intensidade ?? 1) * 2;
}

export default function PersonalizarPage() {
  const router = useRouter();
  const {
    usuario,
    momentosMestres,
    set,
    pareado,
    conexaoAtiva,
    momentosCustomAtivo,
  } = useAppStore();

  const isVip = usuario?.vip === true;
  const meuUid = usuario?.uid ?? '';
  const pareamentoId = conexaoAtiva?.pareamentoId ?? null;

  const [catalogo, setCatalogo] = useState<Record<string, CatalogoCfg>>(() =>
    cfgFromUsuario(usuario?.catalogoPersonalizado as Record<string, unknown> | undefined),
  );
  const [salvando, setSalvando] = useState(false);
  const [filtro, setFiltro] = useState<string | null>('Lovezin');
  const [showExcluidos, setShowExcluidos] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [novoNome, setNovoNome] = useState('');
  const [novoPreco, setNovoPreco] = useState(10);
  const [novoEmoji, setNovoEmoji] = useState(EMOJI_PADRAO);
  const [novaImagemFile, setNovaImagemFile] = useState<File | null>(null);
  const [novaImagemPreview, setNovaImagemPreview] = useState<string | null>(null);
  const imagemInputRef = useRef<HTMLInputElement>(null);
  const [criandoCustom, setCriandoCustom] = useState(false);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  useEffect(() => {
    setCatalogo(cfgFromUsuario(usuario?.catalogoPersonalizado as Record<string, unknown> | undefined));
  }, [usuario?.catalogoPersonalizado]);

  const meusCustom: MomentoCustom[] = useMemo(() => {
    if (!meuUid || !momentosCustomAtivo) return [];
    const list = momentosCustomAtivo[meuUid];
    if (!Array.isArray(list)) return [];
    return list.filter((m) => m && m.ativo !== false);
  }, [meuUid, momentosCustomAtivo]);

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

  const momentosAtivos = momentosParaMim.filter((m) => {
    const cfg = catalogo[m.nome ?? ''] ?? {};
    if (cfg.excluido) return false;
    return filtro ? m.categoria === filtro : true;
  });

  const momentosExcluidos = momentosParaMim.filter((m) => catalogo[m.nome ?? '']?.excluido === true);

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

  function handleExcluir(nomeItem: string) {
    if (!isVip) {
      set({ showVipPopup: true });
      return;
    }
    setCatalogo((prev) => {
      const atual = prev[nomeItem] ?? {};
      return { ...prev, [nomeItem]: { ...atual, excluido: true } };
    });
  }

  function handleRestaurar(nomeItem: string) {
    setCatalogo((prev) => {
      const atual = { ...(prev[nomeItem] ?? {}) };
      delete atual.excluido;
      return { ...prev, [nomeItem]: atual };
    });
  }

  function handleCriarCustomClick() {
    if (!isVip) {
      set({ showVipPopup: true });
      return;
    }
    if (!pareamentoId) {
      showToast('Selecione uma conexão ativa.', 'aviso');
      return;
    }
    setNovoNome('');
    setNovoPreco(10);
    setNovoEmoji(EMOJI_PADRAO);
    setNovaImagemFile(null);
    setNovaImagemPreview(null);
    setShowCreateModal(true);
  }

  function handleImagemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('A imagem deve ter menos de 5 MB.', 'aviso');
      return;
    }
    setNovaImagemFile(file);
    setNovaImagemPreview(URL.createObjectURL(file));
  }

  function limparImagemModal() {
    setNovaImagemFile(null);
    if (novaImagemPreview) URL.revokeObjectURL(novaImagemPreview);
    setNovaImagemPreview(null);
    if (imagemInputRef.current) imagemInputRef.current.value = '';
  }

  async function salvar() {
    if (!usuario?.uid) return;
    setSalvando(true);
    try {
      await sendInput('catalog_personalizado_save', {
        catalogoPersonalizado: catalogo,
      });
      set({ usuario: { ...usuario, catalogoPersonalizado: catalogo } });
      trackGA('customize_catalog');
      showToast('Catálogo personalizado salvo!', 'sucesso');
    } catch {
      showToast('Erro ao salvar. Tente novamente.', 'erro');
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarCriarCustom() {
    const nome = novoNome.trim();
    const preco = Math.floor(novoPreco);
    if (!nome) {
      showToast('Informe um nome para o momento.', 'aviso');
      return;
    }
    if (preco < 1 || preco > 999) {
      showToast('Preço deve ser entre 1 e 999 foguinhos.', 'aviso');
      return;
    }
    if (!pareamentoId) return;
    if (!novaImagemFile || !meuUid) {
      showToast('Adicione uma foto para criar o momento.', 'aviso');
      return;
    }

    setCriandoCustom(true);
    try {
      let imgUrl = '';
      try {
        imgUrl = await uploadCustomMomentImage(novaImagemFile, pareamentoId, meuUid);
      } catch (uploadErr) {
        if (uploadErr instanceof Error && uploadErr.message === 'file_too_large') {
          showToast('A imagem deve ter menos de 5 MB.', 'aviso');
          return;
        }
        if (isStorageUploadError(uploadErr)) {
          showToast('Não foi possível enviar a foto. Tente novamente.', 'erro');
          return;
        }
        throw uploadErr;
      }
      await sendInput('custom_moment_create', {
        pareamentoId,
        nome,
        preco,
        emoji: novoEmoji,
        img: imgUrl,
      });

      const visivel = await waitForCustomMomentVisible(pareamentoId, meuUid, nome);
      if (!visivel) {
        showToast('Momento enviado — atualize a página se não aparecer.', 'aviso');
      } else {
        showToast('Momento custom criado!', 'sucesso');
      }
      limparImagemModal();
      setShowCreateModal(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('file_too_large')) {
        showToast('A imagem deve ter menos de 5 MB.', 'aviso');
      } else {
        showToast('Não foi possível criar o momento.', 'erro');
      }
    } finally {
      setCriandoCustom(false);
    }
  }

  async function excluirCustom(itemId: string) {
    if (!pareamentoId) return;
    openSystemConfirm('Excluir este momento custom?', async () => {
      setExcluindoId(itemId);
      try {
        await sendInput('custom_moment_delete', { pareamentoId, itemId });
        showToast('Momento removido.', 'sucesso');
      } catch {
        showToast('Erro ao excluir momento.', 'erro');
      } finally {
        setExcluindoId(null);
      }
    });
  }

  function renderMomentoRow(
    m: MomentoMestre,
    opts: { showRestore?: boolean; showExclude?: boolean },
  ) {
    const cfg = catalogo[m.nome ?? ''] ?? {};
    const bloqueado = cfg.bloqueado ?? false;
    const preco = cfg.preco !== undefined ? cfg.preco : precoDefault(m);

    return (
      <div
        key={m.id}
        className={clsx(
          'rounded-2xl bg-[#1a1020] border border-white/10 overflow-hidden transition',
          bloqueado && 'opacity-50',
        )}
      >
        <div className="flex items-center gap-3 p-3">
          <MomentoCover
            src={m.img ? String(m.img) : undefined}
            alt={m.nome ?? ''}
            emoji={String(m.emoji ?? '🔥')}
            variant="thumb"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{m.nome ?? ''}</p>
            <p className="text-[11px] text-white/40 mt-0.5">{m.categoria}</p>
            {!opts.showRestore && (
              <div className="flex items-center gap-1 mt-1">
                <i className="fas fa-fire text-amber-400 text-[10px]" />
                <input
                  type="number"
                  value={preco}
                  min={1}
                  max={999}
                  onChange={(e) => setPreco(m.nome ?? '', Number(e.target.value))}
                  className="w-16 bg-white/10 rounded-md px-2 py-0.5 text-xs text-amber-300 font-semibold border border-white/10 focus:outline-none focus:border-red-400"
                />
                <span className="text-[10px] text-white/40">foguinhos</span>
              </div>
            )}
          </div>

          {opts.showRestore ? (
            <button
              type="button"
              onClick={() => handleRestaurar(m.nome ?? '')}
              className="shrink-0 px-3 py-2 rounded-xl bg-green-500/15 border border-green-500/30 text-green-400 text-xs font-semibold"
            >
              Restaurar
            </button>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => toggleBloqueado(m.nome ?? '')}
                className={clsx(
                  'w-10 h-10 rounded-xl flex items-center justify-center transition',
                  bloqueado
                    ? 'bg-red-500/30 border border-red-500/50'
                    : 'bg-white/10 border border-white/15',
                )}
                aria-label={bloqueado ? 'Desbloquear' : 'Bloquear'}
              >
                <i
                  className={clsx(
                    'fas text-base',
                    bloqueado ? 'fa-lock text-red-400' : 'fa-lock-open text-white/60',
                  )}
                />
              </button>
              {opts.showExclude && (
                <button
                  type="button"
                  onClick={() => handleExcluir(m.nome ?? '')}
                  className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center transition border',
                    isVip
                      ? 'bg-white/10 border-white/15 hover:bg-red-500/20'
                      : 'bg-white/5 border-white/10 opacity-50',
                  )}
                  aria-label="Excluir do catálogo"
                >
                  <i className="fas fa-trash-alt text-white/50 text-sm" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen bg-black text-white pb-28">
      <ParceiroHeader />

      <section
        className="px-6 pt-10 pb-28 flex flex-col items-center text-center"
        style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}
      >
        <div className="flex flex-col items-center text-center" style={{ marginTop: -8 }}>
          <i className="fas fa-store text-3xl text-white mb-3" />
          <h2 className="text-3xl font-semibold text-white">Meu Catálogo</h2>
          <p className="text-white/80">Gerencie os momentos que seu parceiro irá resgatar.</p>
          {conexaoAtiva && (
            <p className="text-white/60 text-xs mt-2">
              Conexão: {conexaoAtiva.nome}
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pb-8 -mt-10">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-[28px] bg-[#111114] p-4 shadow-lg space-y-6">

            {/* Catálogo mestre */}
            <div className="space-y-3">
              <div className="flex flex-wrap justify-center gap-2 pb-1">
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setFiltro(cat === filtro ? null : cat)}
                    className={clsx(
                      'px-4 py-2 rounded-full text-xs font-semibold transition',
                      filtro === cat ? 'bg-white text-black' : 'bg-white/10 text-white/60',
                    )}
                  >
                    {cat === 'Sair da Rotina' ? 'Rotina' : cat}
                  </button>
                ))}
              </div>
              <div className="space-y-3">
                {momentosAtivos.map((m) =>
                  renderMomentoRow(m, { showExclude: true }),
                )}
              </div>
            </div>

            {/* Excluídos (VIP) */}
            {isVip && momentosExcluidos.length > 0 && (
              <div className="space-y-2 border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowExcluidos((v) => !v)}
                  className="w-full flex items-center justify-between px-1 text-sm font-semibold text-white/70"
                >
                  <span>
                    <i className="fas fa-trash-restore mr-2 text-white/40" />
                    Excluídos ({momentosExcluidos.length})
                  </span>
                  <i className={clsx('fas text-xs text-white/40', showExcluidos ? 'fa-chevron-up' : 'fa-chevron-down')} />
                </button>
                {showExcluidos && (
                  <div className="space-y-3">
                    {momentosExcluidos.map((m) =>
                      renderMomentoRow(m, { showRestore: true }),
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Meus momentos custom */}
            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between px-1">
                <p className="text-sm font-semibold text-white/80">Meus momentos (custom)</p>
                {isVip && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                    VIP
                  </span>
                )}
              </div>

              {meusCustom.length === 0 ? (
                <p className="text-xs text-white/40 px-1">
                  {isVip
                    ? 'Crie momentos exclusivos para esta conexão.'
                    : 'Disponível no plano VIP.'}
                </p>
              ) : (
                <div className="space-y-2">
                  {meusCustom.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl bg-[#1a1020] border border-purple-500/20 p-3 flex items-center gap-3"
                    >
                      <MomentoCover
                        src={item.img}
                        alt={item.nome}
                        emoji={item.emoji || '✨'}
                        variant="customThumb"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{item.nome}</p>
                        <p className="text-xs text-amber-400 mt-0.5">
                          <i className="fas fa-fire text-[10px] mr-1" />
                          {item.preco} foguinhos
                        </p>
                      </div>
                      {isVip && (
                        <button
                          type="button"
                          onClick={() => excluirCustom(item.id)}
                          disabled={excluindoId === item.id}
                          className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center disabled:opacity-50"
                          aria-label="Excluir momento custom"
                        >
                          <i className="fas fa-trash-alt text-white/50 text-xs" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleCriarCustomClick}
                className="w-full py-3 rounded-2xl border border-dashed border-white/20 text-sm font-semibold text-white/70 hover:bg-white/5 transition flex items-center justify-center gap-2"
              >
                <i className="fas fa-plus text-pink-400" />
                Criar momento
                {!isVip && <i className="fas fa-crown text-yellow-400/60 text-xs" />}
              </button>
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={salvar}
                disabled={salvando}
                className="w-full py-3 rounded-2xl text-sm font-bold transition"
                style={{
                  background: 'linear-gradient(135deg,#ff2d3f,#ff5565)',
                  color: 'white',
                  opacity: salvando ? 0.5 : 1,
                }}
              >
                {salvando ? 'Salvando...' : 'Salvar catálogo mestre'}
              </button>
            </div>
          </div>
        </div>
      </section>

      <OverlayModal
        open={showCreateModal}
        onClose={() => {
          if (criandoCustom) return;
          limparImagemModal();
          setShowCreateModal(false);
        }}
        ariaLabel="Criar momento custom"
        panelClassName="bg-[#111114] border border-white/10"
      >
        <div className="p-6 space-y-4">
          <h3 className="text-lg font-bold">Novo momento custom</h3>
          <p className="text-xs text-white/50">
            Seu parceiro poderá resgatar este momento na loja desta conexão.
          </p>

          <div className="space-y-2">
            <label className="text-xs text-white/60">Nome</label>
            <input
              type="text"
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              maxLength={80}
              placeholder="Ex: Noite especial"
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/60">Valor (1–999 foguinhos)</label>
            <input
              type="number"
              value={novoPreco}
              min={1}
              max={999}
              onChange={(e) => setNovoPreco(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-white/60">Foto (obrigatória)</label>
            <input
              ref={imagemInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleImagemChange}
              className="hidden"
            />
            {novaImagemPreview ? (
              <div className="relative rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={novaImagemPreview}
                  alt="Preview"
                  className="w-full h-32 object-cover"
                />
                <button
                  type="button"
                  onClick={limparImagemModal}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
                  aria-label="Remover imagem"
                >
                  <i className="fas fa-times text-white text-xs" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => imagemInputRef.current?.click()}
                className="w-full py-3 rounded-xl border border-dashed border-white/20 text-xs text-white/50 hover:bg-white/5 transition"
              >
                <i className="fas fa-camera mr-2" />
                Adicionar foto
              </button>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/60">Emoji</label>
              <p className="text-[11px] text-white/40 mt-0.5">
                Identifica a categoria do momento na loja.
              </p>
            </div>
            {EMOJIS_POR_CATEGORIA.map((grupo) => (
              <div key={grupo.label} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35 px-0.5">
                  {grupo.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {grupo.emojis.map((em) => (
                    <button
                      key={em}
                      type="button"
                      onClick={() => setNovoEmoji(em)}
                      className={clsx(
                        'w-10 h-10 rounded-xl text-xl flex items-center justify-center border transition',
                        novoEmoji === em
                          ? 'border-pink-500 bg-pink-500/20'
                          : 'border-white/10 bg-white/5',
                      )}
                      aria-label={`Emoji ${grupo.label} ${em}`}
                    >
                      {em}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={confirmarCriarCustom}
            disabled={criandoCustom || !novaImagemPreview || !novoNome.trim()}
            className="btn-red w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-60"
          >
            {criandoCustom ? 'Criando...' : 'Criar momento'}
          </button>
        </div>
      </OverlayModal>
    </div>
  );
}
