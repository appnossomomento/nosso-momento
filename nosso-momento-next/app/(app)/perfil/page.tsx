'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { signOut, updateProfile, deleteUser, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '@/lib/firebase/client';
import { useAppStore } from '@/lib/store/appStore';
import { openSystemAlert, openSystemConfirm } from '@/components/ui/Modal';
import { showToast } from '@/components/ui/Toast';
import { requestFCMPermission } from '@/lib/hooks/useFCM';
import { callFunction, FUNCTIONS } from '@/lib/firebase/functions';
import DarkSelect from '@/components/ui/DarkSelect';
import { validateApelidoReal, APELIDO_REAL_MAX_LENGTH } from '@/lib/utils/validations';
import { CATALOGO_LOJA_OPTIONS } from '@/lib/types/profileEnums';
import { nomeParaCard } from '@/lib/utils/displayName';
import { getCatalogFilterGender } from '@/lib/utils/profile';

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
  const [salvando, setSalvando] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  const fotoPerfil = usuario?.fotoUrl ?? '/assets/icons/iconprincipal.png';
  const notifAtivas = !!(fcmToken || usuario?.notificationsEnabled);

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
      const storageRef = ref(storage, `perfis/${usuario.uid}/foto.jpg`);
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
        // Desativar
        await callFunction(FUNCTIONS.setNotificationToken, { revoke: true, token: fcmToken ?? undefined });
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
      'Tem certeza? Esta ação é irreversível. Seus dados serão excluídos permanentemente.',
      async () => {
        openSystemConfirm(
          'Confirmar exclusão da conta?',
          async () => {
            try {
              const user = auth.currentUser;
              if (!user || !usuario?.uid) return;
              // Apaga doc do usuário
              await deleteDoc(doc(db, 'usuarios', usuario.uid));
              // Apaga conta do Firebase Auth
              await deleteUser(user);
              reset();
              router.replace('/');
              showToast('Conta excluída.', 'sucesso');
            } catch (err: unknown) {
              if (err instanceof Error && err.message.includes('requires-recent-login')) {
                openSystemAlert('Por segurança, faça logout e login novamente antes de excluir a conta.');
              } else {
                openSystemAlert('Erro ao excluir a conta. Tente novamente.');
              }
            }
          },
          'Sim, excluir',
          'Cancelar'
        );
      },
      'Continuar',
      'Cancelar'
    );
  }

  if (!usuario) return null;

  return (
    <div className="screen screen-pad bg-black text-white">
      {/* Header */}
      <section className="px-0 pt-11 pb-16" style={{ background: 'linear-gradient(180deg, #ff2d3f 0%, #ff5565 100%)' }}>
        <div className="flex flex-col items-center text-center -mt-3">
          <div className="relative mb-3">
            <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center overflow-hidden border-2 border-white/40">
              <Image src={fotoPerfil} alt="Foto de perfil" width={96} height={96} className="w-full h-full object-cover" />
            </div>
            {/* Botão trocar foto */}
            <button
              onClick={() => fotoInputRef.current?.click()}
              disabled={uploadingFoto}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-md hover:bg-gray-100 transition disabled:opacity-50"
            >
              <i className="fas fa-camera text-red-500 text-xs" />
            </button>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFotoChange}
            />
          </div>
          {/* Barra de progresso do upload */}
          {uploadingFoto && (
            <div className="w-32 h-1.5 bg-white/30 rounded-full overflow-hidden mb-2">
              <div
                className="h-full bg-white rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
          <div>
            <h2 className="text-xl font-semibold">{usuario.nome || 'Sem nome'}</h2>
            <p className="text-sm text-white/80">{usuario.email}</p>
          </div>
        </div>
      </section>

      <section className="px-5 -mt-8 space-y-4">
        {/* Card do perfil */}
        <div className="rounded-2xl bg-[#0f0b14] p-5 space-y-4">
          {/* Nome */}
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
                  className="text-pink-400 text-xs hover:text-pink-300 transition"
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          {/* Apelido no card */}
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
                  className="text-pink-400 text-xs hover:text-pink-300 transition"
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          {/* Personalização da loja */}
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
                  className="text-pink-400 text-xs hover:text-pink-300 transition"
                >
                  <i className="fas fa-pen mr-1" />Editar
                </button>
              </div>
            )}
          </div>

          {/* Telefone */}
          <div>
            <p className="text-xs text-white/50 mb-1">Telefone</p>
            <p className="text-sm">{usuario.telefone || '—'}</p>
          </div>
        </div>

        {/* Sair */}
        <button
          onClick={handleLogout}
          className="w-full rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400 text-sm font-medium hover:bg-red-500/20 transition"
        >
          <i className="fas fa-sign-out-alt mr-2" />Sair da conta
        </button>

        {/* Notificações */}
        <button
          onClick={handleToggleNotificacoes}
          disabled={togglingNotif}
          className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center justify-between text-sm font-medium hover:bg-white/10 transition disabled:opacity-60"
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

        {/* Excluir conta */}
        <button
          onClick={handleExcluirConta}
          className="w-full rounded-2xl border border-white/10 bg-transparent p-4 text-white/30 text-xs hover:text-red-500/60 hover:border-red-500/20 transition text-center"
        >
          <i className="fas fa-trash-alt mr-1" />Excluir minha conta
        </button>
      </section>
    </div>
  );
}
