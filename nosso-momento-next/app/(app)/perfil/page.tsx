'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signOut, updateProfile } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import { showToast } from '@/components/ui/Toast';
import { openSystemAlert, openSystemConfirm } from '@/components/ui/Modal';
import { requestFCMPermission, revokeLocalFCM } from '@/lib/hooks/useFCM';
import DarkSelect from '@/components/ui/DarkSelect';
import { validateApelidoReal, APELIDO_REAL_MAX_LENGTH } from '@/lib/utils/validations';
import {
  CATALOGO_LOJA_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  TEMPO_RELACIONAMENTO_OPTIONS,
} from '@/lib/types/profileEnums';
import { nomeParaCard } from '@/lib/utils/displayName';
import { getCatalogFilterGender } from '@/lib/utils/profile';
import VipStatusInline from '@/components/profile/VipStatusInline';
import AppHeroShell, { ACCENT, TILE } from '@/components/layout/AppHeroShell';
import { membershipLabel } from '@/lib/utils/usuarioMembership';

function labelFromOptions(
  options: readonly { value: string; label: string }[],
  value?: string | null,
): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? value;
}

export default function PerfilPage() {
  const router = useRouter();
  const { usuario, reset, set, fcmToken } = useAppStore();
  const [editandoNome, setEditandoNome] = useState(false);
  const [novoNome, setNovoNome] = useState(usuario?.nome ?? '');
  const [editandoApelido, setEditandoApelido] = useState(false);
  const [novoApelido, setNovoApelido] = useState(usuario?.apelidoReal ?? '');
  const [editandoCatalogo, setEditandoCatalogo] = useState(false);
  const [novoCatalogo, setNovoCatalogo] = useState(
    () => getCatalogFilterGender(usuario ?? undefined) === 'feminino' ? 'feminino' : 'masculino',
  );
  const [editandoEstadoCivil, setEditandoEstadoCivil] = useState(false);
  const [novoEstadoCivil, setNovoEstadoCivil] = useState(usuario?.estadoCivil ?? '');
  const [editandoTempoRel, setEditandoTempoRel] = useState(false);
  const [novoTempoRel, setNovoTempoRel] = useState(usuario?.tempoRelacionamento ?? '');
  const [salvando, setSalvando] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const fotoPerfil = usuario?.fotoUrl ?? '/assets/icons/iconprincipal.png';
  const isVip = usuario?.vip === true;
  const notifAtivas = !!(fcmToken || usuario?.notificationsEnabled);
  const estadoCivilAtual = usuario?.estadoCivil ?? '';
  const precisaTempoRel =
    estadoCivilAtual === 'namorando' || estadoCivilAtual === 'casado';
  const editandoPrecisaTempo =
    novoEstadoCivil === 'namorando' || novoEstadoCivil === 'casado';

  async function handleSalvarNome() {
    if (!novoNome.trim()) { openSystemAlert('O nome não pode ser vazio.'); return; }
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario!.uid), { nome: novoNome.trim() });
      set({ usuario: { ...usuario!, nome: novoNome.trim() } });
      showToast('Nome atualizado!', 'sucesso');
      setEditandoNome(false);
    } catch (_) {
      openSystemAlert('Erro ao atualizar o nome. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarApelido() {
    const err = validateApelidoReal(novoApelido);
    if (err) { openSystemAlert(err); return; }
    setSalvando(true);
    try {
      const trimmed = novoApelido.trim();
      const payload = trimmed ? { apelidoReal: trimmed } : { apelidoReal: '' };
      await updateDoc(doc(db, 'usuarios', usuario!.uid), payload);
      set({ usuario: { ...usuario!, apelidoReal: trimmed || undefined } });
      showToast('Apelido no card atualizado!', 'sucesso');
      setEditandoApelido(false);
    } catch {
      openSystemAlert('Erro ao atualizar o apelido. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarCatalogo() {
    if (!novoCatalogo) { openSystemAlert('Selecione uma opção.'); return; }
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario!.uid), {
        anatomia: novoCatalogo,
        sexo: novoCatalogo,
      });
      set({ usuario: { ...usuario!, anatomia: novoCatalogo, sexo: novoCatalogo } });
      showToast('Personalização da loja atualizada!', 'sucesso');
      setEditandoCatalogo(false);
    } catch {
      openSystemAlert('Erro ao atualizar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarEstadoCivil() {
    if (!novoEstadoCivil) {
      openSystemAlert('Selecione seu estado civil.');
      return;
    }
    const precisaTempo =
      novoEstadoCivil === 'namorando' || novoEstadoCivil === 'casado';
    const tempo = precisaTempo
      ? (novoTempoRel || usuario?.tempoRelacionamento || '')
      : null;
    if (precisaTempo && !tempo) {
      openSystemAlert('Selecione o tempo de relacionamento.');
      return;
    }
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario!.uid), {
        estadoCivil: novoEstadoCivil,
        tempoRelacionamento: tempo,
      });
      set({
        usuario: {
          ...usuario!,
          estadoCivil: novoEstadoCivil,
          tempoRelacionamento: tempo,
        },
      });
      setNovoTempoRel(tempo ?? '');
      showToast('Estado civil atualizado!', 'sucesso');
      setEditandoEstadoCivil(false);
      setEditandoTempoRel(false);
    } catch {
      openSystemAlert('Erro ao atualizar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleSalvarTempoRel() {
    if (!precisaTempoRel) return;
    if (!novoTempoRel) {
      openSystemAlert('Selecione o tempo de relacionamento.');
      return;
    }
    setSalvando(true);
    try {
      await updateDoc(doc(db, 'usuarios', usuario!.uid), {
        tempoRelacionamento: novoTempoRel,
      });
      set({
        usuario: { ...usuario!, tempoRelacionamento: novoTempoRel },
      });
      showToast('Tempo de relacionamento atualizado!', 'sucesso');
      setEditandoTempoRel(false);
    } catch {
      openSystemAlert('Erro ao atualizar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  async function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !usuario?.uid) return;

    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (file.size > MAX_SIZE) {
      openSystemAlert('A foto deve ter menos de 5 MB.');
      return;
    }

    setUploadingFoto(true);
    setUploadProgress(10);
    try {
      const storageRef = ref(storage, `profile_pics/${usuario.uid}/foto.jpg`);
      setUploadProgress(30);
      await uploadBytes(storageRef, file, { contentType: file.type });
      setUploadProgress(80);
      const downloadURL = await getDownloadURL(storageRef);
      setUploadProgress(90);
      await updateDoc(doc(db, 'usuarios', usuario.uid), { fotoUrl: downloadURL });
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
      }
      set({ usuario: { ...usuario, fotoUrl: downloadURL } });
      setUploadProgress(100);
      showToast('Foto atualizada! 📸', 'sucesso');
    } catch {
      openSystemAlert('Erro ao enviar a foto. Tente novamente.');
    } finally {
      setUploadingFoto(false);
      setUploadProgress(0);
      if (fotoInputRef.current) fotoInputRef.current.value = '';
    }
  }

  async function handleLogout() {
    openSystemConfirm('Deseja sair da sua conta?', async () => {
      try {
        await signOut(auth);
        reset();
        router.replace('/');
      } catch (_) {
        openSystemAlert('Erro ao sair. Tente novamente.');
      }
    }, 'Sair', 'Cancelar');
  }

  async function handleToggleNotificacoes() {
    if (togglingNotif) return;
    setTogglingNotif(true);
    try {
      if (notifAtivas) {
        await callFunction(FUNCTIONS.setNotificationToken, { revoke: true, token: fcmToken ?? undefined });
        await revokeLocalFCM();
        set({ fcmToken: null, usuario: usuario ? { ...usuario, notificationsEnabled: false } : usuario });
        showToast('Notificações desativadas.', 'sucesso');
      } else {
        // Ativar
        if ('Notification' in window && Notification.permission === 'denied') {
          openSystemAlert('Notificações bloqueadas no navegador. Habilite nas configurações do seu dispositivo.');
          return;
        }
        const token = await requestFCMPermission();
        if (token) {
          set({ fcmToken: token, usuario: usuario ? { ...usuario, notificationsEnabled: true } : usuario });
        }
      }
    } catch (_) {
      openSystemAlert('Erro ao alterar as notificações. Tente novamente.');
    } finally {
      setTogglingNotif(false);
    }
  }

  async function handleExcluirConta() {
    openSystemConfirm(
      'Tem certeza? Esta ação é irreversível.\n\nTodos os seus dados serão excluídos permanentemente e não poderão ser recuperados.',
      async () => {
        try {
          if (!usuario?.uid) return;
          await callFunction(FUNCTIONS.excluirConta, {});
          await signOut(auth).catch(() => {});
          reset();
          router.replace('/');
          showToast('Conta excluída.', 'sucesso');
        } catch (err) {
          const msg = err instanceof Error ? err.message : '';
          if (msg.includes('app_check') || msg.includes('401')) {
            openSystemAlert(
              'Não foi possível validar a segurança do app (App Check). Recarregue a página e tente de novo.',
            );
          } else {
            openSystemAlert('Erro ao excluir a conta. Tente novamente.');
          }
        }
      },
      'Sim, excluir',
      'Cancelar',
    );
  }

  if (!usuario) return null;

  const tileBtn = {
    background: TILE,
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
  } as const;

  const membroLabel = membershipLabel({
    numeroUsuario: usuario?.numeroUsuario,
    fundadorNumero: usuario?.fundadorNumero,
    fundador: usuario?.fundador === true,
    anatomia: usuario?.anatomia,
    sexo: usuario?.sexo,
    genero: usuario?.genero,
  });
  return (
    <AppHeroShell
      bareSheet
      sheetClassName="space-y-4"
      hero={
        <>
          <div className="relative mb-5">
            <div
              className="rounded-full overflow-hidden"
              style={{
                width: 118,
                height: 118,
                boxShadow: [
                  `0 0 0 3px ${ACCENT}`,
                  '0 0 0 8px rgba(244, 63, 94, 0.2)',
                  '0 8px 40px rgba(244, 63, 94, 0.55)',
                ].join(', '),
              }}
            >
              <Image
                src={fotoPerfil}
                alt="Foto de perfil"
                width={118}
                height={118}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto}
              className="absolute bottom-[3px] right-[3px] w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-gray-100 transition disabled:opacity-50"
            >
              <i className="fas fa-camera text-xs" style={{ color: ACCENT }} />
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFotoChange}
            />
          </div>
          {uploadingFoto && (
            <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <h2 className="text-[25px] font-bold leading-tight tracking-tight">
            {usuario.nome || 'Sem nome'}
          </h2>
          {membroLabel && (
            <p className="mt-1 text-[13px] font-semibold tracking-wide text-white/90">
              {membroLabel}
            </p>
          )}
          <p className="mt-0.5 text-[15px] text-white/75 leading-snug px-4 break-all">
            {usuario.email}
          </p>
        </>
      }
    >
      <div className="rounded-[24px] p-5 space-y-4" style={tileBtn}>
          <div>
            <p className="text-xs text-white/50 mb-1">Nome</p>
            {editandoNome ? (
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="flex-1 text-sm"
                  style={{ padding: '8px 12px' }}
                  autoFocus
                />
                <button
                  onClick={handleSalvarNome}
                  disabled={salvando}
                  className="btn-red px-4 py-2 rounded-xl text-xs disabled:opacity-60"
                >
                  {salvando ? '...' : 'Salvar'}
                </button>
                <button
                  onClick={() => { setEditandoNome(false); setNovoNome(usuario.nome ?? ''); }}
                  className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{usuario.nome || '—'}</p>
                <button
                  onClick={() => { setEditandoNome(true); setNovoNome(usuario.nome ?? ''); }}
                  className="text-xs transition hover:opacity-80"
                  style={{ color: ACCENT }}
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1">Apelido no card</p>
            {editandoApelido ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={novoApelido}
                  maxLength={APELIDO_REAL_MAX_LENGTH}
                  onChange={(e) => setNovoApelido(e.target.value)}
                  className="w-full text-sm"
                  style={{ padding: '8px 12px' }}
                  placeholder="Como aparece no card de memórias"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button onClick={handleSalvarApelido} disabled={salvando}
                    className="btn-red px-4 py-2 rounded-xl text-xs disabled:opacity-60">
                    {salvando ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setEditandoApelido(false); setNovoApelido(usuario.apelidoReal ?? ''); }}
                    className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {usuario.apelidoReal || nomeParaCard({ nome: usuario.nome }) || '—'}
                  {!usuario.apelidoReal && (
                    <span className="text-white/40 text-xs ml-1">(primeiro nome)</span>
                  )}
                </p>
                <button
                  onClick={() => { setEditandoApelido(true); setNovoApelido(usuario.apelidoReal ?? ''); }}
                  className="text-xs transition hover:opacity-80"
                  style={{ color: ACCENT }}
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1">Personalização da loja</p>
            {editandoCatalogo ? (
              <div className="space-y-2">
                <DarkSelect value={novoCatalogo} onChange={(e) => setNovoCatalogo(e.target.value)}>
                  {CATALOGO_LOJA_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
                <div className="flex gap-2">
                  <button onClick={handleSalvarCatalogo} disabled={salvando}
                    className="btn-red px-4 py-2 rounded-xl text-xs disabled:opacity-60">
                    {salvando ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setEditandoCatalogo(false);
                      const cur = getCatalogFilterGender(usuario);
                      setNovoCatalogo(cur === 'feminino' ? 'feminino' : 'masculino');
                    }}
                    className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {getCatalogFilterGender(usuario) === 'feminino' ? 'Momentos femininos' : 'Momentos masculinos'}
                </p>
                <button
                  onClick={() => setEditandoCatalogo(true)}
                  className="text-xs transition hover:opacity-80"
                  style={{ color: ACCENT }}
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1">Estado civil</p>
            {editandoEstadoCivil ? (
              <div className="space-y-2">
                <DarkSelect
                  value={novoEstadoCivil}
                  onChange={(e) => {
                    const v = e.target.value;
                    setNovoEstadoCivil(v);
                    if (v === 'solteiro') setNovoTempoRel('');
                  }}
                >
                  {ESTADO_CIVIL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
                {editandoPrecisaTempo && (
                  <DarkSelect
                    value={novoTempoRel}
                    onChange={(e) => setNovoTempoRel(e.target.value)}
                  >
                    <option value="">Tempo de relacionamento</option>
                    {TEMPO_RELACIONAMENTO_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </DarkSelect>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleSalvarEstadoCivil}
                    disabled={salvando}
                    className="btn-red px-4 py-2 rounded-xl text-xs disabled:opacity-60"
                  >
                    {salvando ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setEditandoEstadoCivil(false);
                      setNovoEstadoCivil(usuario.estadoCivil ?? '');
                      setNovoTempoRel(usuario.tempoRelacionamento ?? '');
                    }}
                    className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {labelFromOptions(ESTADO_CIVIL_OPTIONS, usuario.estadoCivil)}
                </p>
                <button
                  onClick={() => {
                    setEditandoEstadoCivil(true);
                    setNovoEstadoCivil(usuario.estadoCivil ?? '');
                    setNovoTempoRel(usuario.tempoRelacionamento ?? '');
                  }}
                  className="text-xs transition hover:opacity-80"
                  style={{ color: ACCENT }}
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          <div className={precisaTempoRel ? undefined : 'opacity-40'}>
            <p className="text-xs text-white/50 mb-1">Tempo de relacionamento</p>
            {editandoTempoRel && precisaTempoRel ? (
              <div className="space-y-2">
                <DarkSelect
                  value={novoTempoRel}
                  onChange={(e) => setNovoTempoRel(e.target.value)}
                >
                  {TEMPO_RELACIONAMENTO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </DarkSelect>
                <div className="flex gap-2">
                  <button
                    onClick={handleSalvarTempoRel}
                    disabled={salvando}
                    className="btn-red px-4 py-2 rounded-xl text-xs disabled:opacity-60"
                  >
                    {salvando ? '...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => {
                      setEditandoTempoRel(false);
                      setNovoTempoRel(usuario.tempoRelacionamento ?? '');
                    }}
                    className="px-3 py-2 rounded-xl text-xs border border-white/20 text-white/60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {precisaTempoRel
                    ? labelFromOptions(
                        TEMPO_RELACIONAMENTO_OPTIONS,
                        usuario.tempoRelacionamento,
                      )
                    : 'Não se aplica'}
                </p>
                {precisaTempoRel ? (
                  <button
                    onClick={() => {
                      setEditandoTempoRel(true);
                      setNovoTempoRel(usuario.tempoRelacionamento ?? '');
                    }}
                    className="text-xs transition hover:opacity-80"
                    style={{ color: ACCENT }}
                  >
                    <i className="fas fa-pen mr-1" />Editar
                  </button>
                ) : (
                  <span className="text-[10px] text-white/35 uppercase tracking-wide">
                    Inativo
                  </span>
                )}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-white/50 mb-1">Telefone</p>
            <p className="text-sm">{usuario.telefone || '—'}</p>
          </div>

          {isVip && (
            <div className="pt-3 mt-1 border-t border-white/[0.06] flex justify-center">
              <VipStatusInline />
            </div>
          )}
      </div>

      <button
        onClick={handleToggleNotificacoes}
        disabled={togglingNotif}
        className="w-full rounded-2xl p-4 flex items-center justify-between text-sm font-medium transition disabled:opacity-60"
        style={tileBtn}
      >
        <span className={notifAtivas ? 'text-green-400' : 'text-white/60'}>
          <i className={`fas fa-bell mr-2 ${notifAtivas ? 'text-green-400' : 'text-white/40'}`} />
          {notifAtivas ? 'Notificações ativas' : 'Ativar notificações'}
        </span>
        <div
          className="w-10 h-6 rounded-full transition-colors flex items-center px-1"
          style={{ background: notifAtivas ? '#22c55e' : 'rgba(255,255,255,0.15)' }}
        >
          <div
            className="w-4 h-4 rounded-full bg-white shadow transition-transform"
            style={{ transform: notifAtivas ? 'translateX(16px)' : 'translateX(0)' }}
          />
        </div>
      </button>

      <button
        onClick={handleLogout}
        className="w-full rounded-2xl p-4 text-red-400 text-sm font-medium transition"
        style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          boxShadow: '0 6px 16px rgba(0,0,0,0.2)',
        }}
      >
        <i className="fas fa-sign-out-alt mr-2" />Sair da conta
      </button>

      <button
        onClick={handleExcluirConta}
        className="w-full mt-2 rounded-xl py-2 px-3 text-white/30 text-[11px] hover:text-red-500/60 transition text-center"
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        Excluir minha conta
      </button>
    </AppHeroShell>
  );
}
